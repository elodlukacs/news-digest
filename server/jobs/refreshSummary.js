const { parseFeedUrl, extractImage } = require('../lib/rss');
const { extractKeywords } = require('../lib/bias-radar/topicCluster');
const { buildMessages } = require('../lib/promptManager');
const { matchOutlet } = require('../lib/outletMatcher');
const { attributeSection, buildUrlIndex } = require('../lib/attribution');
const { recordSuccess, recordFailure } = require('../lib/feedHealth');
const { parseJSON } = require('../lib/parseJSON');
const { selectArticles, isSearchableKeyword } = require('../lib/articleTriage');

const ONE_DAY_MS = 86400000;
// Upper bound per feed, not a selection rule: lib/articleTriage.js picks what
// the summary covers. This only guards against a feed that dumps its archive.
const MAX_ITEMS_PER_FEED = 60;

class RefreshError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

function deriveTopicId(title) {
  return extractKeywords(title).sort().slice(0, 5).join('-');
}

function enrichSentimentData(sentimentData) {
  if (!Array.isArray(sentimentData)) return sentimentData;
  return sentimentData.map((entry) => {
    if (!entry.source) return entry;
    const rating = matchOutlet(entry.source);
    return rating
      ? { ...entry, bias: rating.bias, credibility: rating.credibility, factCheckGrade: rating.factCheckGrade }
      : entry;
  });
}

async function refreshCategorySummary(db, callLLM, categoryId, { provider, keyword } = {}) {
  const keywordTrim = keyword?.trim() || '';
  if (keywordTrim && !isSearchableKeyword(keywordTrim)) {
    throw new RefreshError('Filter keyword must contain letters or numbers', 400);
  }

  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);
  if (!category) throw new RefreshError('Category not found', 404);

  const feeds = db.prepare('SELECT * FROM feeds WHERE category_id = ?').all(categoryId);
  if (feeds.length === 0) throw new RefreshError('No feeds in this category', 400);

  const feedResults = await Promise.allSettled(
    feeds.map(async (feed) => {
      try {
        const parsed = await parseFeedUrl(feed.url);
        recordSuccess(db, feed.id);
        return parsed.items.slice(0, MAX_ITEMS_PER_FEED).map((item) => ({
          title: item.title || '',
          description: (item.contentSnippet || item.content || '').slice(0, 3000),
          contentEncoded: (item['content:encoded'] || '').slice(0, 5000),
          link: item.link || '',
          pubDate: item.pubDate || '',
          source: feed.name,
          image: extractImage(item),
        }));
      } catch (err) {
        console.warn(`Failed to fetch feed "${feed.name}" (${feed.url}):`, err.message);
        // Persist the failure so a feed that has been dead for a week is
        // visible in the UI instead of just quietly shrinking the digest.
        recordFailure(db, feed.id, err.message);
        return [];
      }
    })
  );

  const fetched = feedResults
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value);

  if (fetched.length === 0) {
    throw new RefreshError('Could not fetch any articles from the feeds', 400);
  }

  const { articles: allArticles, poolSize, method } = await selectArticles(callLLM, fetched, {
    category,
    keyword: keywordTrim,
    provider,
  });
  console.log(`[Summary] ${category.name}: ${fetched.length} fetched, ${poolSize} in pool, ${allArticles.length} selected (${method})`);

  if (allArticles.length === 0) {
    throw new RefreshError(
      keywordTrim
        ? `No articles found matching "${keywordTrim}"`
        : 'No recent articles in the feeds',
      400
    );
  }

  const now = new Date().toISOString();
  const oneDayAgo = new Date(Date.now() - ONE_DAY_MS).toISOString();
  db.prepare('DELETE FROM articles WHERE category_id = ? AND fetched_at < ?').run(categoryId, oneDayAgo);
  const insertArticle = db.prepare('INSERT INTO articles (category_id, feed_name, title, description, link, pub_date, fetched_at, topic_id, body_text, image_url) VALUES (?,?,?,?,?,?,?,?,?,?)');
  const insertArticles = db.transaction((arts) => {
    for (const a of arts) {
      const fullContent = a.contentEncoded || a.content || a.description || '';
      insertArticle.run(categoryId, a.source, a.title, a.description || '', a.link, a.pubDate, now, deriveTopicId(a.title), fullContent, a.image || '');
    }
  });
  insertArticles(allArticles);

  const articleText = allArticles
    .map((a, i) => `[${i + 1}] ${a.title} (${a.source})\n${a.description}\nLink: ${a.link}`)
    .join('\n\n');

  const customPrompt = category.custom_prompt?.trim();
  const lang = category.language || 'English';
  // The stored category-summary prompt caps output at 8 and says "never repeat
  // information", which folded every article on a filtered story into one card.
  // This section is code-built, so it reaches DBs whose prompt predates it.
  const orderingSection = '\nThe articles are ordered by importance. Lead with the first story; a major story outranks routine news.\n';
  const keywordSection = keywordTrim
    ? `\nFocus only on news related to: "${keywordTrim}". This overrides the article limit above: include up to 12 articles, each covering a distinct development or angle of this story.\n`
    : '';
  const customPromptSection = (customPrompt ? `\nAdditional instructions:\n${customPrompt}\n` : '') + orderingSection + keywordSection;

  const messages = buildMessages('category-summary', {
    category: category.name,
    lang,
    customPrompt: customPromptSection,
    articles: articleText,
  });
  const result = await callLLM(messages, { purpose: 'summary', categoryId: Number(categoryId), providerId: provider || null, db });
  const generated_at = new Date().toISOString();
  const dateKey = generated_at.split('T')[0];

  let rawContent = (result.content || '').trim();
  if (rawContent.startsWith('```')) {
    rawContent = rawContent.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
  }

  let parsedArticles;
  const parsed = parseJSON(rawContent, null);
  if (parsed) {
    if (Array.isArray(parsed)) {
      parsedArticles = parsed;
    } else if (parsed.articles) {
      parsedArticles = parsed.articles;
    } else if (parsed.groups && Array.isArray(parsed.groups)) {
      parsedArticles = parsed.groups.flatMap(g => g.articles || []);
    } else {
      parsedArticles = parsed.items || parsed.data || [];
    }
    if (parsedArticles.length === 0) {
      console.warn('[Summary] Parsed JSON has no articles. Keys:', Object.keys(parsed || {}));
      console.warn('[Summary] Raw content (first 1000 chars):', rawContent.slice(0, 1000));
    }
  } else {
    console.error('[Summary] Could not parse or repair LLM JSON response');
    console.error('[Summary] Raw content (first 1000 chars):', rawContent.slice(0, 1000));
    throw new RefreshError('LLM returned invalid response format. Please try again.', 500);
  }

  const summary = parsedArticles.map(a =>
    `## [${a.title}](${a.url})\n${a.summary}`
  ).join('\n\n---\n\n');

  // Attribution: index → normalized URL → exact title → fuzzy title. See
  // lib/attribution.js for why exact-title matching alone silently dropped the
  // source, date and image for every rewritten or translated headline.
  const urlIndex = buildUrlIndex(allArticles);
  const attributionStats = { index: 0, url: 0, title: 0, fuzzy: 0, none: 0 };

  const sentimentData = parsedArticles.map(a => {
    const { article: original, method } = attributeSection(a, allArticles, urlIndex);
    attributionStats[method]++;
    return {
      title: a.title,
      sentiment: ['positive', 'negative', 'neutral', 'mixed'].includes(a.sentiment) ? a.sentiment : 'neutral',
      tags: Array.isArray(a.tags) ? a.tags : [],
      original_content: original ? original.description : '',
      source: original ? original.source : '',
      pub_date: original ? original.pubDate : '',
      image: original ? (original.image || '') : '',
    };
  });

  if (attributionStats.none > 0) {
    console.warn(
      `[Summary] ${attributionStats.none}/${parsedArticles.length} sections could not be matched ` +
      `to a source article — those lose their source badge, date and image. ` +
      `(matched: ${attributionStats.index} by index, ${attributionStats.url} by URL, ` +
      `${attributionStats.title} by title, ${attributionStats.fuzzy} fuzzy)`
    );
  }

  const tagSet = new Set();
  for (const s of sentimentData) {
    for (const tag of s.tags) tagSet.add(tag);
  }
  const tagsData = [...tagSet];

  // sentiment_data/tags_data are stored here as well as in summary_history:
  // this row is what the API falls back to once history is purged, and without
  // them the cards lose their source, bias, credibility, image and sentiment.
  db.prepare(`
    INSERT INTO summaries (category_id, summary, article_count, feed_count, generated_at, sentiment_data, tags_data)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(category_id) DO UPDATE SET
      summary = excluded.summary,
      article_count = excluded.article_count,
      feed_count = excluded.feed_count,
      generated_at = excluded.generated_at,
      sentiment_data = excluded.sentiment_data,
      tags_data = excluded.tags_data
  `).run(categoryId, summary, allArticles.length, feeds.length, generated_at, JSON.stringify(sentimentData), JSON.stringify(tagsData));

  const histResult = db.prepare('INSERT INTO summary_history (category_id, summary, article_count, feed_count, provider, sentiment_data, tags_data, date_key, generated_at) VALUES (?,?,?,?,?,?,?,?,?)').run(
    categoryId, summary, allArticles.length, feeds.length, result.provider, JSON.stringify(sentimentData), JSON.stringify(tagsData), dateKey, generated_at
  );
  const historyId = histResult.lastInsertRowid;

  // Retention is centralised in lib/retention.js; this used to compare
  // date_key while surprise.js compared generated_at, and the two raced.

  return {
    id: historyId,
    category: category.name,
    summary,
    article_count: allArticles.length,
    feed_count: feeds.length,
    generated_at,
    provider: result.provider,
    sentiment_data: enrichSentimentData(sentimentData),
    tags_data: tagsData,
  };
}

module.exports = { refreshCategorySummary, enrichSentimentData, RefreshError };

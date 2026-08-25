const { parseFeedUrl, extractImage } = require('../lib/rss');
const { extractKeywords } = require('../lib/bias-radar/topicCluster');
const { buildMessages } = require('../lib/promptManager');
const { matchOutlet } = require('../lib/outletMatcher');
const { attributeSection, buildUrlIndex } = require('../lib/attribution');
const { recordSuccess, recordFailure } = require('../lib/feedHealth');
const { parseJSON } = require('../lib/parseJSON');

const ONE_DAY_MS = 86400000;

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
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);
  if (!category) throw new RefreshError('Category not found', 404);

  const feeds = db.prepare('SELECT * FROM feeds WHERE category_id = ?').all(categoryId);
  if (feeds.length === 0) throw new RefreshError('No feeds in this category', 400);

  const feedResults = await Promise.allSettled(
    feeds.map(async (feed) => {
      try {
        const parsed = await parseFeedUrl(feed.url);
        recordSuccess(db, feed.id);
        return parsed.items.slice(0, 10).map((item) => ({
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

  const keywordTrim = keyword?.trim() || '';

  let allArticles = feedResults
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value)
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .slice(0, 30);

  if (keywordTrim) {
    const kw = keywordTrim.toLowerCase();
    allArticles = allArticles.filter(
      (a) => a.title.toLowerCase().includes(kw) || a.description.toLowerCase().includes(kw)
    );
    if (allArticles.length === 0) {
      throw new RefreshError(`No articles found matching "${keywordTrim}"`, 400);
    }
  }

  if (allArticles.length === 0) {
    throw new RefreshError('Could not fetch any articles from the feeds', 400);
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
  const keywordSection = keywordTrim ? `\nFocus only on news related to: "${keywordTrim}"\n` : '';
  const customPromptSection = (customPrompt ? `\nAdditional instructions:\n${customPrompt}\n` : '') + keywordSection;

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

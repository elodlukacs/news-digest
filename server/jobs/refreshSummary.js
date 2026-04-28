const { parser, extractImage } = require('../lib/rss');
const { extractKeywords } = require('../lib/bias-radar/topicCluster');
const { buildMessages } = require('../lib/promptManager');
const { matchOutlet } = require('../lib/outletMatcher');

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

function repairAndParseJSON(str) {
  try { return JSON.parse(str); } catch {}

  let fixed = str;
  fixed = fixed.replace(/,\s*([}\]])/g, '$1');

  try { return JSON.parse(fixed); } catch {}

  const lastCompleteObj = fixed.lastIndexOf('}');
  if (lastCompleteObj > 0) {
    let truncated = fixed.slice(0, lastCompleteObj + 1);
    truncated = truncated.replace(/,\s*$/, '');
    const openBrackets = (truncated.match(/\[/g) || []).length - (truncated.match(/\]/g) || []).length;
    const openBraces = (truncated.match(/\{/g) || []).length - (truncated.match(/\}/g) || []).length;
    truncated += ']'.repeat(Math.max(0, openBrackets)) + '}'.repeat(Math.max(0, openBraces));
    try { return JSON.parse(truncated); } catch {}
  }

  return null;
}

async function refreshCategorySummary(db, callLLM, categoryId, { provider, keyword } = {}) {
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);
  if (!category) throw new RefreshError('Category not found', 404);

  const feeds = db.prepare('SELECT * FROM feeds WHERE category_id = ?').all(categoryId);
  if (feeds.length === 0) throw new RefreshError('No feeds in this category', 400);

  const feedResults = await Promise.allSettled(
    feeds.map(async (feed) => {
      try {
        const parsed = await parser.parseURL(feed.url);
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
  const parsed = repairAndParseJSON(rawContent);
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

  const sentimentData = parsedArticles.map(a => {
    const original = allArticles.find(orig =>
      orig.link === a.url || orig.title.toLowerCase() === (a.title || '').toLowerCase()
    );
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

  const tagSet = new Set();
  for (const s of sentimentData) {
    for (const tag of s.tags) tagSet.add(tag);
  }
  const tagsData = [...tagSet];

  db.prepare(`
    INSERT INTO summaries (category_id, summary, article_count, feed_count, generated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(category_id) DO UPDATE SET
      summary = excluded.summary,
      article_count = excluded.article_count,
      feed_count = excluded.feed_count,
      generated_at = excluded.generated_at
  `).run(categoryId, summary, allArticles.length, feeds.length, generated_at);

  const histResult = db.prepare('INSERT INTO summary_history (category_id, summary, article_count, feed_count, provider, sentiment_data, tags_data, date_key, generated_at) VALUES (?,?,?,?,?,?,?,?,?)').run(
    categoryId, summary, allArticles.length, feeds.length, result.provider, JSON.stringify(sentimentData), JSON.stringify(tagsData), dateKey, generated_at
  );
  const historyId = histResult.lastInsertRowid;

  const cutoff = new Date(Date.now() - 3 * ONE_DAY_MS).toISOString().split('T')[0];
  const oldIds = db.prepare('SELECT id FROM summary_history WHERE category_id = ? AND date_key < ?').all(categoryId, cutoff).map(r => r.id);
  if (oldIds.length > 0) {
    db.prepare(`DELETE FROM chat_messages WHERE summary_id IN (${oldIds.map(() => '?').join(',')})`).run(...oldIds);
    db.prepare('DELETE FROM summary_history WHERE category_id = ? AND date_key < ?').run(categoryId, cutoff);
  }

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

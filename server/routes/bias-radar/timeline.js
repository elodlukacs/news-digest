const express = require('express');
const db = require('../../db');
const { callLLM } = require('../../lib/llm');
const { TIMELINE_CHECK_PROMPT, fillPrompt } = require('../../lib/bias-radar/prompts');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const articleId = Number(req.query.articleId);
    if (!articleId || isNaN(articleId)) {
      return res.status(400).json({ error: 'articleId query param is required (numeric)' });
    }

    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(articleId);
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    if (!article.topic_id) {
      return res.status(422).json({ error: 'Article has no topic cluster', code: 'NO_CLUSTER' });
    }

    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString();
    const historical = db.prepare(
      `SELECT * FROM articles
       WHERE topic_id = ? AND feed_name = ? AND id != ? AND pub_date >= ?
       ORDER BY pub_date ASC
       LIMIT 10`
    ).all(article.topic_id, article.feed_name, article.id, sixtyDaysAgo);

    if (historical.length === 0) {
      return res.json({ result: null, note: 'No historical coverage found for this topic from the same source.' });
    }

    const previousText = historical.map((a, i) =>
      `[${i + 1}] "${a.title}" (${a.pub_date || 'unknown date'})\n${a.body_text || a.description || ''}`
    ).join('\n\n');

    const currentText = `"${article.title}" (${article.pub_date || 'unknown date'})\n${article.body_text || article.description || ''}`;

    const prompt = fillPrompt(TIMELINE_CHECK_PROMPT, {
      STORY_TOPIC: article.title,
      PREVIOUS_ARTICLES: previousText,
      CURRENT_ARTICLE: currentText,
    });

    const messages = [
      { role: 'system', content: 'You are a media analysis assistant. Respond only with valid JSON.' },
      { role: 'user', content: prompt },
    ];

    const result = await callLLM(messages, { purpose: 'bias-radar-timeline', temperature: 0.2, db });

    let rawContent = (result.content || '').trim();
    if (rawContent.startsWith('```')) {
      rawContent = rawContent.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    }

    const analysis = JSON.parse(rawContent);

    const entries = historical.map(a => ({
      id: a.id,
      title: a.title,
      feed_name: a.feed_name,
      pub_date: a.pub_date,
      link: a.link,
    }));

    res.json({ result: { ...analysis, entries } });
  } catch (err) {
    console.error('[Timeline] Error:', err);
    res.status(500).json({ error: err.message || 'Failed to perform timeline check' });
  }
});

module.exports = router;

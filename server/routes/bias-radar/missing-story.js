const express = require('express');
const db = require('../../db');
const { callLLM } = require('../../lib/llm');
const { MISSING_STORY_PROMPT, fillPrompt } = require('../../lib/bias-radar/prompts');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    // Auth: shared secret for n8n calls — fail closed when not configured
    const secret = req.headers['x-internal-secret'];
    if (!process.env.INTERNAL_API_SECRET) {
      return res.status(500).json({ error: 'INTERNAL_API_SECRET not configured' });
    }
    if (secret !== process.env.INTERNAL_API_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Fetch last 7 days of headlines
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const articles = db.prepare(`
      SELECT title, feed_name as source, pub_date as publishedAt
      FROM articles
      WHERE pub_date IS NOT NULL AND pub_date >= ?
      ORDER BY pub_date DESC
      LIMIT 150
    `).all(oneWeekAgo);

    if (articles.length === 0) {
      return res.json({ stories: [], weekArticleCount: 0, note: 'No articles found in the last 7 days' });
    }

    // Format headlines for the prompt (cap at ~8000 chars for token safety)
    const headlineList = articles
      .map((a) => `- [${a.source}] ${a.title} (${a.publishedAt.slice(0, 10)})`)
      .join('\n')
      .slice(0, 8000);

    const prompt = fillPrompt(MISSING_STORY_PROMPT, { HEADLINES: headlineList });

    const messages = [
      { role: 'system', content: 'You are a media analysis assistant. Respond only with valid JSON.' },
      { role: 'user', content: prompt },
    ];

    const result = await callLLM(messages, {
      purpose: 'bias-radar-missing-story',
      temperature: 0.3,
      db,
    });

    const raw = result.content;

    // Parse JSON response
    try {
      let clean = raw.trim();
      if (clean.startsWith('```')) {
        clean = clean.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
      }
      const stories = JSON.parse(clean);
      if (!Array.isArray(stories)) {
        throw new Error('Expected JSON array');
      }
      return res.json({ stories, weekArticleCount: articles.length });
    } catch {
      console.error('[MissingStory] Failed to parse LLM response:', raw);
      return res.status(500).json({ error: 'Failed to parse LLM response' });
    }
  } catch (err) {
    console.error('[MissingStory] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

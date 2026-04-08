const express = require('express');
const db = require('../../db');
const { callLLM } = require('../../lib/llm');
const { getPrompt, renderPrompt } = require('../../lib/promptManager');
const { fetchWithTimeout } = require('../../lib/fetchWithTimeout');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { headline, content, language, provider } = req.body;

    if (!headline?.trim()) {
      return res.status(400).json({ error: 'headline required' });
    }

    const rabbitPrompt = getPrompt('bias-radar-rabbit-hole');
    const prompt = renderPrompt(rabbitPrompt.user_prompt, {
      headline: headline.trim(),
      content: (content || '').slice(0, 1500),
    });

    const messages = [{ role: 'user', content: prompt }];
    const result = await callLLM(messages, { purpose: 'bias-radar-rabbit-hole', temperature: 0.5, providerId: provider || null, db });

    let raw = (result.content || '').trim();
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch { /* noop */ }
      }
    }

    if (!parsed?.topic) {
      return res.json({ topic: 'Related topics', whyItConnects: 'Explore related ideas', wikiSummary: '', searchQuery: headline, funFact: '' });
    }

    // Fetch Wikipedia summary
    let wikiSummary = '';
    try {
      const searchTerm = parsed.topic || parsed.searchQuery || '';
      if (searchTerm) {
        // Try direct page first
        let wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchTerm)}`;
        let wikiResp = await fetchWithTimeout(wikiUrl, {}, 3000);
        if (wikiResp.ok) {
          const wikiData = await wikiResp.json();
          wikiSummary = wikiData.extract || '';
        }
        // Fallback: search Wikipedia
        if (!wikiSummary) {
          const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchTerm.replace(/\s+/g, '_'))}`;
          wikiResp = await fetchWithTimeout(searchUrl, {}, 3000);
          if (wikiResp.ok) {
            const wikiData = await wikiResp.json();
            wikiSummary = wikiData.extract || '';
          }
        }
        if (!wikiSummary) {
          const searchApi = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTerm)}&srlimit=1&format=json&origin=*`;
          wikiResp = await fetchWithTimeout(searchApi, {}, 3000);
          if (wikiResp.ok) {
            const searchData = await wikiResp.json();
            const pageTitle = searchData?.query?.search?.[0]?.title;
            if (pageTitle) {
              const pageUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
              wikiResp = await fetchWithTimeout(pageUrl, {}, 3000);
              if (wikiResp.ok) {
                const pageData = await wikiResp.json();
                wikiSummary = pageData.extract || '';
              }
            }
          }
        }
      }
    } catch {
      // Wikipedia fetch failed — continue without it
    }

    return res.json({
      topic: parsed.topic,
      whyItConnects: parsed.whyItConnects || '',
      searchQuery: parsed.searchQuery || parsed.topic,
      funFact: parsed.funFact || '',
      wikiSummary,
    });
  } catch (err) {
    console.error('[RabbitHole] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

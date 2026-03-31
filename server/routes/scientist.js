const express = require('express');
const db = require('../db');
const { callLLM } = require('../lib/llm');
const { getPrompt } = require('../lib/promptManager');

const router = express.Router();

const PERSONA_SLUGS = [
  { id: 'skeptic', slug: 'scientist-skeptic' },
  { id: 'institutionalist', slug: 'scientist-institutionalist' },
  { id: 'moralist', slug: 'scientist-moralist' },
];

// POST /api/scientist/debate — run multi-agent debate
router.post('/debate', async (req, res) => {
  const { claim, provider: selectedProvider } = req.body;
  if (!claim || claim.trim().length < 10) return res.status(400).json({ error: 'Claim must be at least 10 characters' });

  try {
    const responses = await Promise.allSettled(
      PERSONA_SLUGS.map(({ id, slug }) => {
        const prompt = getPrompt(slug);
        return callLLM(
          [
            { role: 'system', content: prompt.user_prompt },
            { role: 'user', content: `Critique this claim: "${claim}"\n\nProvide your analysis in 2-3 paragraphs. Be specific and constructive.` }
          ],
          { purpose: 'scientist_debate', categoryId: null, providerId: selectedProvider || null, db }
        );
      })
    );

    const debate = PERSONA_SLUGS.map(({ id, slug }, i) => {
      const r = responses[i];
      const prompt = getPrompt(slug);
      return {
        persona: prompt.name,
        personaId: id,
        response: r.status === 'fulfilled' ? r.value.content : `Analysis unavailable: ${r.reason?.message || 'error'}`,
        provider: r.status === 'fulfilled' ? r.value.provider : null,
      };
    });

    res.json({ claim, debate });
  } catch (err) {
    console.error('Scientist debate error:', err);
    res.status(500).json({ error: err.message || 'Debate failed' });
  }
});

// POST /api/scientist/journal — log rethinking entry
router.post('/journal', (req, res) => {
  const { topic, initialConfidence, finalConfidence, shiftingEvidence, mode, userId } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic required' });

  const uid = userId || 'default';
  const result = db.prepare(
    'INSERT INTO rethinking_journal (user_id, topic, initial_confidence, final_confidence, shifting_evidence, mode) VALUES (?,?,?,?,?,?)'
  ).run(uid, topic, initialConfidence || 50, finalConfidence || 50, shiftingEvidence || '', mode || 'scientist');

  res.json({ id: result.lastInsertRowid });
});

// GET /api/scientist/journal — get rethinking journal
router.get('/journal', (req, res) => {
  const userId = req.query.userId || 'default';
  const rows = db.prepare('SELECT * FROM rethinking_journal WHERE user_id = ? ORDER BY created_at DESC LIMIT 30').all(userId);
  res.json(rows);
});

// GET /api/scientist/personas — get available personas
router.get('/personas', (req, res) => {
  res.json(PERSONA_SLUGS.map(({ id, slug }) => {
    const prompt = getPrompt(slug);
    return { id, name: prompt.name };
  }));
});

// GET /api/scientist/journal/trends — aggregate journal entries as time series
router.get('/journal/trends', (req, res) => {
  const userId = req.query.userId || 'default';
  const days = parseInt(req.query.days) || 30;

  const rows = db.prepare(`
    SELECT
      DATE(created_at) as date,
      topic,
      initial_confidence as preConfidence,
      final_confidence as postConfidence,
      (final_confidence - initial_confidence) as shift
    FROM rethinking_journal
    WHERE user_id = ?
      AND created_at >= datetime('now', '-' || ? || ' days')
    ORDER BY created_at ASC
  `).all(userId, days);

  res.json({ entries: rows });
});

module.exports = router;

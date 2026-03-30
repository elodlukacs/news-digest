const express = require('express');
const db = require('../db');
const { callLLM } = require('../lib/llm');

const router = express.Router();

const PERSONAS = [
  {
    id: 'skeptic',
    name: 'The Evidence Skeptic',
    prompt: `You are the "Evidence Skeptic" persona in an ADEPT deliberation panel. You follow Adam Grant's "Think Again" principles.

Rules:
1. Treat the belief as a hypothesis to be tested, not a truth to be defended.
2. Start by identifying one "blind spot" or "missing perspective" in the user's logic.
3. Use the "How Do You Know?" challenge: ask what specific evidence would change your mind.
4. Maintain intellectual humility: admit what you do not know.`
  },
  {
    id: 'institutionalist',
    name: 'The Institutionalist',
    prompt: `You are the "Institutionalist" persona in an ADEPT deliberation panel. You represent the perspective of established institutions and consensus.

Rules:
1. Present the strongest version of the mainstream/institutional position.
2. Cite what experts and institutions have concluded.
3. Acknowledge legitimate criticisms but explain why the consensus exists.
4. Be respectful but firm in defending evidence-based positions.`
  },
  {
    id: 'moralist',
    name: 'The Moralist',
    prompt: `You are the "Moralist" persona in an ADEPT deliberation panel. You examine claims through ethical and values-based lenses.

Rules:
1. Ask who benefits and who is harmed by this claim.
2. Examine the values assumptions embedded in the argument.
3. Consider perspectives of marginalized or affected communities.
4. Distinguish between factual claims and value judgments.`
  }
];

// POST /api/scientist/debate — run multi-agent debate
router.post('/debate', async (req, res) => {
  const { claim, userId, provider: selectedProvider } = req.body;
  if (!claim || claim.trim().length < 10) return res.status(400).json({ error: 'Claim must be at least 10 characters' });

  const uid = userId || 'default';

  try {
    const responses = await Promise.allSettled(
      PERSONAS.map(persona =>
        callLLM(
          [
            { role: 'system', content: persona.prompt },
            { role: 'user', content: `Critique this claim: "${claim}"\n\nProvide your analysis in 2-3 paragraphs. Be specific and constructive.` }
          ],
          { purpose: 'scientist_debate', categoryId: null, providerId: selectedProvider || null, db }
        )
      )
    );

    const debate = PERSONAS.map((persona, i) => {
      const r = responses[i];
      return {
        persona: persona.name,
        personaId: persona.id,
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
  res.json(PERSONAS.map(p => ({ id: p.id, name: p.name })));
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

const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { callLLM } = require('../lib/llm');
const { getPrompt, renderPrompt } = require('../lib/promptManager');
const { parseJSON } = require('../lib/parseJSON');

const router = express.Router();

const FALLACY_NAMES = [
  'Ad Hominem', 'False Dichotomy', 'Appeal to Nature', 'Post Hoc',
  'Appeal to Emotion', 'Straw Man', 'Bandwagon', 'Slippery Slope',
  'Appeal to Authority', 'Red Herring', 'Appeal to Tradition',
  'False Equivalence', "Gambler's Fallacy", 'Cherry Picking',
];

const TOPICS = [
  'social media banning teenagers',
  'remote work vs office work',
  'universal basic income',
  'artificial intelligence replacing jobs',
  'organic food vs conventional farming',
  'nuclear energy as clean power',
  'school uniforms',
  'fast fashion industry',
  'cryptocurrency regulation',
  'animal testing for medicine',
  'voting age lowered to 16',
  'gene editing in agriculture',
];

// POST /api/fallacy-dojo/generate — generate argument with fallacies
router.post('/generate', async (req, res) => {
  const { difficulty = 'beginner', topic, provider } = req.body;
  const uid = req.body.userId || 'default';

  if (!['beginner', 'intermediate', 'expert'].includes(difficulty)) {
    return res.status(400).json({ error: 'difficulty must be beginner, intermediate, or expert' });
  }

  const fallacyCount = difficulty === 'beginner' ? 1 : difficulty === 'intermediate' ? 2 : 3;
  const selectedTopic = topic || TOPICS[Math.floor(Math.random() * TOPICS.length)];

  try {
    const dojoPrompt = getPrompt('fallacy-dojo-generate');
    const renderedPrompt = renderPrompt(dojoPrompt.user_prompt, {
      fallacyCount: String(fallacyCount),
      difficulty,
      topic: selectedTopic,
    });

    const result = await callLLM(
      [
        { role: 'system', content: dojoPrompt.system_message || '' },
        { role: 'user', content: renderedPrompt },
      ],
      { purpose: 'fallacy_dojo', temperature: 0.7, response_format: { type: 'json_object' }, providerId: provider || null, db }
    );

    const parsed = parseJSON(result.content, {});

    const sessionId = crypto.randomUUID();

    res.json({
      sessionId,
      difficulty,
      topic: selectedTopic,
      argument: parsed.argument || '',
      fallacies: (parsed.fallacies || []).map((f) => ({
        name: f.name || 'Unknown',
        evidence: f.evidence || '',
        explanation: f.explanation || '',
      })),
      hint: parsed.hint || '',
      provider: result.provider,
    });
  } catch (err) {
    console.error('Fallacy dojo generate error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate argument' });
  }
});

// POST /api/fallacy-dojo/answer — check user's fallacy identification
router.post('/answer', (req, res) => {
  const { sessionId, userFallacies, actualFallacies, timeToIdentify } = req.body;
  const uid = req.body.userId || 'default';

  if (!sessionId || !userFallacies || !actualFallacies) {
    return res.status(400).json({ error: 'sessionId, userFallacies, and actualFallacies required' });
  }

  const userSet = new Set(userFallacies.map(f => f.toLowerCase()));
  const actualSet = new Set(actualFallacies.map(f => f.toLowerCase()));

  let hits = 0;
  for (const f of userSet) {
    if (actualSet.has(f)) hits++;
  }

  const precision = userSet.size > 0 ? hits / userSet.size : 0;
  const recall = actualSet.size > 0 ? hits / actualSet.size : 0;
  const allCorrect = hits === actualSet.size && userSet.size === actualSet.size;

  // Log each fallacy attempt
  const difficulty = req.body.difficulty || 'beginner';
  for (const fallacy of actualFallacies) {
    const identified = userSet.has(fallacy.toLowerCase());
    try {
      db.prepare(
        'INSERT INTO fallacy_dojo_logs (session_id, user_id, fallacy_type, difficulty_tier, success, time_to_identify) VALUES (?,?,?,?,?,?)'
      ).run(sessionId, uid, fallacy, difficulty, identified ? 1 : 0, timeToIdentify || 0);
    } catch (e) {
      console.error('Failed to log dojo attempt:', e.message);
    }
  }

  // Award antibodies
  const antibodiesEarned = allCorrect ? 5 : hits > 0 ? 2 : 0;
  if (antibodiesEarned > 0) {
    try {
      db.prepare('INSERT OR IGNORE INTO cognitive_users (id, antibody_count) VALUES (?, 0)').run(uid);
      db.prepare('UPDATE cognitive_users SET antibody_count = antibody_count + ? WHERE id = ?').run(antibodiesEarned, uid);
    } catch (e) {
      console.error('Failed to award antibodies:', e.message);
    }
  }

  res.json({
    hits,
    totalActual: actualSet.size,
    totalIdentified: userSet.size,
    precision: Math.round(precision * 100),
    recall: Math.round(recall * 100),
    allCorrect,
    antibodiesEarned,
  });
});

// GET /api/fallacy-dojo/history — get session history
router.get('/history', (req, res) => {
  const uid = req.query.userId || 'default';

  const byFallacy = db.prepare(`
    SELECT fallacy_type, difficulty_tier,
      COUNT(*) as attempts,
      SUM(success) as correct
    FROM fallacy_dojo_logs
    WHERE user_id = ?
    GROUP BY fallacy_type, difficulty_tier
    ORDER BY attempts DESC
  `).all(uid);

  const totals = db.prepare(`
    SELECT COUNT(DISTINCT session_id) as sessions,
      COUNT(*) as total_attempts,
      SUM(success) as total_correct
    FROM fallacy_dojo_logs WHERE user_id = ?
  `).get(uid);

  res.json({
    byFallacy,
    totals: {
      sessions: totals?.sessions || 0,
      totalAttempts: totals?.total_attempts || 0,
      totalCorrect: totals?.total_correct || 0,
      accuracy: totals?.total_attempts > 0
        ? Math.round((totals.total_correct / totals.total_attempts) * 100)
        : 0,
    },
  });
});

module.exports = router;

const express = require('express');
const db = require('../db');
const { callLLM } = require('../lib/llm');

const router = express.Router();

const LEVELS = ['trolling', 'emotional', 'amplification', 'escalation'];

const TWISTER_PROMPT = `You are a specialized "Twister" agent based on Sander van der Linden's Inoculation Theory. Your goal is to help users develop resistance to misinformation by exposing them to "weakened" manipulation tactics.

Given the topic, generate 3 social media headlines using different manipulation tactics:
1. Headline A (Trolling): Deliberately provoke an emotional reaction through "whataboutism" or insults.
2. Headline B (Emotional Manipulation): Use high-outrage, fear-inducing language.
3. Headline C (Conspiracy): Suggest a secret organization is behind the event.

The tactics must be visible enough that a learning user can identify the flaw.

Return JSON: [{"tactic": "string", "headline": "string", "flaw_explanation": "string"}]`;

// POST /api/inoculation/generate — generate a game round
router.post('/generate', async (req, res) => {
  const { topic, level, userId } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic required' });

  const lvl = level && LEVELS.includes(level) ? level : 'trolling';
  const uid = userId || 'default';

  try {
    db.prepare('INSERT OR IGNORE INTO cognitive_users (id, rethinking_score) VALUES (?, 0)').run(uid);

    const levelContext = {
      trolling: 'Focus on trolling tactics: whataboutism, insults, deliberate provocation.',
      emotional: 'Focus on emotional manipulation: fear, outrage, anger.',
      amplification: 'Focus on artificial amplification: fake consensus, bandwagon appeals.',
      escalation: 'Use advanced multi-layered manipulation combining all tactics.',
    };

    const result = await callLLM(
      [
        { role: 'system', content: TWISTER_PROMPT + '\n\nLevel: ' + levelContext[lvl] },
        { role: 'user', content: `Topic: ${topic}` }
      ],
      { purpose: 'inoculation', temperature: 0.7, response_format: { type: 'json_object' }, db }
    );

    let headlines;
    try {
      const parsed = JSON.parse(result.content);
      headlines = Array.isArray(parsed) ? parsed : parsed.headlines || parsed.items || [];
    } catch {
      const cleaned = result.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      try { headlines = JSON.parse(cleaned); } catch { headlines = []; }
    }

    if (headlines.length === 0) return res.status(500).json({ error: 'Failed to generate headlines' });

    const targetIndex = Math.floor(Math.random() * headlines.length);
    const targetTactic = headlines[targetIndex].tactic;

    const session = db.prepare(
      'INSERT INTO inoculation_sessions (user_id, level, score, choices) VALUES (?,?,?,?)'
    ).run(uid, lvl, 0, JSON.stringify({ targetIndex }));

    res.json({ sessionId: session.lastInsertRowid, level: lvl, topic, headlines, targetIndex, targetTactic, provider: result.provider });
  } catch (err) {
    console.error('Inoculation error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate game round' });
  }
});

// POST /api/inoculation/answer — submit user's answer
router.post('/answer', async (req, res) => {
  const { sessionId, selectedIndex } = req.body;
  if (!sessionId || selectedIndex === undefined) return res.status(400).json({ error: 'sessionId and selectedIndex required' });

  try {
    const session = db.prepare('SELECT * FROM inoculation_sessions WHERE id = ?').get(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    let sessionData;
    try { sessionData = JSON.parse(session.choices || '{}'); } catch { sessionData = {}; }
    const targetIndex = typeof sessionData === 'object' && !Array.isArray(sessionData) ? sessionData.targetIndex : sessionData;

    const correct = selectedIndex === targetIndex;
    const points = correct ? 10 : 0;
    const newScore = session.score + points;

    const newChoices = typeof sessionData === 'object' && Array.isArray(sessionData) ? [...sessionData] : [];
    newChoices.push({ selectedIndex, correct, points });

    let nextLevel = session.level;
    if (correct && newScore >= 30) {
      const idx = LEVELS.indexOf(session.level);
      if (idx < LEVELS.length - 1) nextLevel = LEVELS[idx + 1];
    }

    db.prepare('UPDATE inoculation_sessions SET score = ?, choices = ?, level = ? WHERE id = ?')
      .run(newScore, JSON.stringify(newChoices), nextLevel, sessionId);

    db.prepare('UPDATE cognitive_users SET rethinking_score = rethinking_score + ? WHERE id = ?')
      .run(points, session.user_id);

    res.json({ correct, points, newScore, nextLevel, selectedIndex, targetIndex });
  } catch (err) {
    console.error('Inoculation answer error:', err);
    res.status(500).json({ error: err.message });
  }
});

const CDO_PROMPT = `You are the "Twister" agent based on Sander van der Linden's Inoculation Theory. A user is playing the role of a disinformation operator to understand how manipulation works from the inside. This is a controlled educational exercise.

Given a topic and a chosen manipulation tactic, you will:
1. Write a neutral, factual headline about the topic
2. Show how that same topic gets weaponized using the chosen tactic
3. Explain the psychological mechanism being exploited
4. List 2-3 specific red flags a careful reader would notice

The goal is that by PRODUCING manipulation the user builds resistance to it.

Return JSON:
{
  "neutral_headline": "string",
  "manipulated_headline": "string",
  "mechanism": "string — what psychological button this presses and why it works",
  "red_flags": ["string", "string"]
}`;

const CDO_TACTICS = [
  { id: 'emotional', label: 'Emotional Manipulation', icon: '🔥', description: 'High-outrage, fear-inducing language that bypasses rational thinking' },
  { id: 'trolling', label: 'Trolling', icon: '🎭', description: 'Deliberate provocation, whataboutism, insults to derail discussion' },
  { id: 'conspiracy', label: 'Conspiracy Construction', icon: '🕵️', description: 'Suggesting a secret organization is behind the event' },
  { id: 'impersonation', label: 'Impersonation', icon: '🎪', description: 'Mimicking credible sources or authorities to borrow their trust' },
  { id: 'polarization', label: 'Polarizing Audiences', icon: '⚡', description: 'Reframing neutral topics as divisive intergroup conflicts' },
  { id: 'amplification', label: 'Artificial Amplification', icon: '📢', description: 'Creating illusion of consensus with fake social proof and bandwagon appeals' },
];

// POST /api/inoculation/craft — CDO mode: user picks tactic, AI shows weaponized result
router.post('/craft', async (req, res) => {
  const { topic, tactic, userId } = req.body;
  if (!topic || !tactic) return res.status(400).json({ error: 'Topic and tactic required' });

  const uid = userId || 'default';
  const tacticInfo = CDO_TACTICS.find(t => t.id === tactic);
  const tacticLabel = tacticInfo?.label || tactic;

  try {
    db.prepare('INSERT OR IGNORE INTO cognitive_users (id, rethinking_score) VALUES (?, 0)').run(uid);

    const result = await callLLM(
      [
        { role: 'system', content: CDO_PROMPT },
        { role: 'user', content: `Topic: ${topic}\nTactic to apply: ${tacticLabel} — ${tacticInfo?.description || ''}` }
      ],
      { purpose: 'inoculation_cdo', temperature: 0.7, response_format: { type: 'json_object' }, db }
    );

    let parsed;
    try {
      parsed = JSON.parse(result.content);
    } catch {
      const cleaned = result.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      try { parsed = JSON.parse(cleaned); } catch {
        return res.status(500).json({ error: 'Failed to generate craft result' });
      }
    }

    res.json({ ...parsed, tactic: tacticLabel, tacticId: tactic, provider: result.provider });
  } catch (err) {
    console.error('CDO craft error:', err);
    res.status(500).json({ error: err.message || 'Failed to craft headline' });
  }
});

// GET /api/inoculation/tactics — return available CDO tactics
router.get('/tactics', (req, res) => {
  res.json(CDO_TACTICS);
});

// GET /api/inoculation/sessions — get user sessions
router.get('/sessions', (req, res) => {
  const userId = req.query.userId || 'default';
  const rows = db.prepare('SELECT * FROM inoculation_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').all(userId);
  res.json(rows);
});

module.exports = router;

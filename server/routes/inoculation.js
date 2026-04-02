const express = require('express');
const db = require('../db');
const { callLLM } = require('../lib/llm');
const { getPrompt, renderPrompt } = require('../lib/promptManager');
const { parseJSON } = require('../lib/parseJSON');

const router = express.Router();

// ─── 6 Core Viral Antigens (Tactics) ───
// Each maps to a cognitive bias (Host Vulnerability)
const VIRAL_ANTIGENS = [
  { id: 'impersonation', label: 'Impersonation', icon: 'Users', bias: 'Authority Bias', description: 'Mimicking credible sources or authorities to borrow their trust' },
  { id: 'emotion', label: 'Emotion', icon: 'Flame', bias: 'Emotional Reasoning', description: 'Using fear, outrage, or anger to bypass rational thinking' },
  { id: 'polarization', label: 'Polarization', icon: 'Zap', bias: 'In-Group Bias', description: 'Reframing neutral topics as divisive intergroup conflicts' },
  { id: 'conspiracy', label: 'Conspiracy', icon: 'Search', bias: 'Pattern Seeking', description: 'Suggesting hidden agendas to explain complex or random events' },
  { id: 'discredit', label: 'Discredit', icon: 'Shield', bias: 'Confirmation Bias', description: 'Attacking the source rather than engaging with the evidence' },
  { id: 'trolling', label: 'Trolling', icon: 'Theater', bias: 'Emotional Reactivity', description: 'Deliberate provocation designed to trigger defensive reactions' },
];

// ─── Dose tiers based on antibody_count ───
function getDose(antibodyCount) {
  if (antibodyCount <= 20) return 1;  // Micro-dose / Subtle
  if (antibodyCount <= 50) return 2;  // Active / Standard
  return 3;                           // Full Virus / Obvious
}

// ─── Immunity Decay: check + apply 10% decay if >7 days ───
function checkImmunityDecay(userId) {
  const user = db.prepare('SELECT antibody_count, last_inoculation_date FROM cognitive_users WHERE id = ?').get(userId);
  if (!user || !user.last_inoculation_date) return { antibodyCount: user?.antibody_count || 0, needsBooster: false };

  const lastDate = new Date(user.last_inoculation_date);
  const now = new Date();
  const daysSince = (now - lastDate) / (1000 * 60 * 60 * 24);

  if (daysSince > 7) {
    const decayed = Math.max(0, Math.floor(user.antibody_count * 0.9));
    db.prepare('UPDATE cognitive_users SET antibody_count = ? WHERE id = ?').run(decayed, userId);
    return { antibodyCount: decayed, needsBooster: true };
  }

  return { antibodyCount: user.antibody_count, needsBooster: false };
}

// ─── Shuffle array (Fisher-Yates) ───
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Helper: update last_inoculation_date ───
function touchInoculationDate(userId) {
  db.prepare("UPDATE cognitive_users SET last_inoculation_date = datetime('now') WHERE id = ?").run(userId);
}

// ─── POST /api/inoculation/generate — Passive Inoculation ───
router.post('/generate', async (req, res) => {
  const { topic, userId } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic required' });

  const uid = userId || 'default';

  try {
    db.prepare('INSERT OR IGNORE INTO cognitive_users (id, antibody_count) VALUES (?, 0)').run(uid);

    // Check immunity decay
    const { antibodyCount, needsBooster } = checkImmunityDecay(uid);
    const dose = getDose(antibodyCount);

    // Pick a random tactic + its associated bias
    const antigen = VIRAL_ANTIGENS[Math.floor(Math.random() * VIRAL_ANTIGENS.length)];

    const passivePrompt = getPrompt('foolproof_passive_inoculation');
    const renderedPrompt = renderPrompt(passivePrompt.user_prompt, {
      bias: antigen.bias,
      tactic: antigen.label,
      dose: String(dose),
      topic,
    });

    const result = await callLLM(
      [
        { role: 'system', content: passivePrompt.system_message || '' },
        { role: 'user', content: renderedPrompt },
      ],
      { purpose: 'foolproof_passive', temperature: 0.7, response_format: { type: 'json_object' }, db }
    );

    const parsed = parseJSON(result.content, {});
    const rawHeadlines = parsed.headlines || [];

    if (rawHeadlines.length === 0) return res.status(500).json({ error: 'Failed to generate headlines' });

    // Find the virus headline (is_virus: true) — the LLM marks it
    const virusIndex = rawHeadlines.findIndex(h => h.is_virus === true);
    if (virusIndex < 0) {
      return res.status(500).json({ error: 'Failed to generate a valid round — no virus headline detected' });
    }

    // Shuffle headlines so the virus isn't always at the same position
    const shuffled = shuffleArray(rawHeadlines);
    // Find where the virus ended up after shuffle
    const shuffledTargetIndex = shuffled.findIndex(h => h.is_virus === true);

    const session = db.prepare(
      'INSERT INTO inoculation_sessions (user_id, level, score, choices) VALUES (?,?,?,?)'
    ).run(uid, String(dose), 0, JSON.stringify({ targetIndex: shuffledTargetIndex >= 0 ? shuffledTargetIndex : 0 }));

    touchInoculationDate(uid);

    res.json({
      sessionId: session.lastInsertRowid,
      dose,
      topic,
      headlines: shuffled,
      targetIndex: shuffledTargetIndex >= 0 ? shuffledTargetIndex : 0,
      targetTactic: antigen.label,
      targetBias: antigen.bias,
      theAntibody: parsed.the_antibody || '',
      antibodyCount,
      needsBooster,
      provider: result.provider,
    });
  } catch (err) {
    console.error('Passive inoculation error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate round' });
  }
});

// ─── POST /api/inoculation/answer — submit answer ───
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

    db.prepare('UPDATE inoculation_sessions SET score = ?, choices = ? WHERE id = ?')
      .run(newScore, JSON.stringify(newChoices), sessionId);

    if (correct) {
      db.prepare('UPDATE cognitive_users SET antibody_count = antibody_count + ?, last_inoculation_date = datetime(\'now\') WHERE id = ?')
        .run(points, session.user_id);
    }

    const user = db.prepare('SELECT antibody_count FROM cognitive_users WHERE id = ?').get(session.user_id);

    res.json({
      correct,
      points,
      newScore,
      selectedIndex,
      targetIndex,
      antibodyCount: user?.antibody_count || 0,
    });
  } catch (err) {
    console.error('Inoculation answer error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/inoculation/craft — Active Inoculation ───
router.post('/craft', async (req, res) => {
  const { topic, tactic, userId } = req.body;
  if (!topic || !tactic) return res.status(400).json({ error: 'Topic and tactic required' });

  const uid = userId || 'default';
  const antigen = VIRAL_ANTIGENS.find(t => t.id === tactic);
  if (!antigen) return res.status(400).json({ error: 'Unknown tactic. Use one of: ' + VIRAL_ANTIGENS.map(t => t.id).join(', ') });

  try {
    db.prepare('INSERT OR IGNORE INTO cognitive_users (id, antibody_count) VALUES (?, 0)').run(uid);
    checkImmunityDecay(uid);

    const activePrompt = getPrompt('foolproof_active_inoculation');
    const renderedActive = renderPrompt(activePrompt.user_prompt, {
      topic,
      tactic: `${antigen.label} — ${antigen.description}`,
      bias: antigen.bias,
    });

    const result = await callLLM(
      [
        { role: 'system', content: activePrompt.system_message || '' },
        { role: 'user', content: renderedActive },
      ],
      { purpose: 'foolproof_active', temperature: 0.7, response_format: { type: 'json_object' }, db }
    );

    let parsed;
    try {
      parsed = JSON.parse(result.content);
    } catch {
      const cleaned = result.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      try { parsed = JSON.parse(cleaned); } catch {
        return res.status(500).json({ error: 'Failed to generate active inoculation result' });
      }
    }

    touchInoculationDate(uid);
    const user = db.prepare('SELECT antibody_count FROM cognitive_users WHERE id = ?').get(uid);

    res.json({
      neutral_headline: parsed.neutral_headline || '',
      manipulated_headline: parsed.manipulated_headline || '',
      the_antibody: parsed.the_antibody || parsed.mechanism || '',
      red_flags: parsed.red_flags || [],
      tactic: antigen.label,
      tacticId: antigen.id,
      bias: antigen.bias,
      antibodyCount: user?.antibody_count || 0,
      provider: result.provider,
    });
  } catch (err) {
    console.error('Active inoculation error:', err);
    res.status(500).json({ error: err.message || 'Failed to craft headline' });
  }
});

// ─── GET /api/inoculation/tactics — return 6 Core Viral Antigens ───
router.get('/tactics', (req, res) => {
  res.json(VIRAL_ANTIGENS.map(t => ({ id: t.id, label: t.label, icon: t.icon, description: t.description, bias: t.bias })));
});

// ─── GET /api/inoculation/sessions — get user sessions + immunity status ───
router.get('/sessions', (req, res) => {
  const userId = req.query.userId || 'default';
  const rows = db.prepare('SELECT id, user_id, level, score, created_at FROM inoculation_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').all(userId);

  const user = db.prepare('SELECT antibody_count, last_inoculation_date FROM cognitive_users WHERE id = ?').get(userId);
  const { antibodyCount, needsBooster } = checkImmunityDecay(userId);

  res.json({
    sessions: rows,
    antibodyCount,
    needsBooster,
    lastInoculation: user?.last_inoculation_date || null,
  });
});

module.exports = router;

const express = require('express');
const db = require('../db');
const { callLLM } = require('../lib/llm');
const { getPrompt } = require('../lib/promptManager');
const { parseJSON } = require('../lib/parseJSON');

const router = express.Router();

const VALUES_QUIZ = [
  { id: 'universalism', name: 'Universalism', description: 'Understanding and protection for all people and nature.' },
  { id: 'security', name: 'Security', description: 'Safety, harmony, and stability of society and relationships.' },
  { id: 'conformity', name: 'Conformity', description: 'Restraint of actions likely to upset or harm others.' },
  { id: 'tradition', name: 'Tradition', description: 'Respect, commitment, and acceptance of cultural customs.' },
  { id: 'self_direction', name: 'Self-Direction', description: 'Independent thought and action; choosing, creating, exploring.' },
  { id: 'benevolence', name: 'Benevolence', description: 'Preserving and enhancing the welfare of those with whom one is in frequent personal contact.' },
  { id: 'achievement', name: 'Achievement', description: 'Personal success through demonstrating competence according to social standards.' },
  { id: 'stimulation', name: 'Stimulation', description: 'Excitement, novelty, and challenge in life.' },
  { id: 'hedonism', name: 'Hedonism', description: 'Pleasure and sensuous gratification for oneself.' },
  { id: 'power', name: 'Power', description: 'Social status and prestige, control or dominance over people and resources.' },
];

// POST /api/bridge/audit — run SOS audit
router.post('/audit', async (req, res) => {
  const { sources, viewpoints, userId } = req.body || {};
  if (!sources || !Array.isArray(sources) || sources.length === 0) {
    return res.status(400).json({ error: 'Sources array required' });
  }

  const uid = userId || 'default';

  try {
    const promptText = viewpoints
      ? `Sources: ${sources.join(', ')}\nViewpoints to analyze: ${viewpoints}`
      : `Information sources: ${sources.join(', ')}`;

    const sosPrompt = getPrompt('sos-audit');

    const result = await callLLM(
      [
        { role: 'system', content: sosPrompt.user_prompt },
        { role: 'user', content: promptText }
      ],
      { purpose: 'bridge_audit', temperature: 0.3, response_format: { type: 'json_object' }, db }
    );

    const parsed = parseJSON(result.content, { siloing_score: 5, sorting_examples: [], othering_examples: [], siloing_examples: [], how_questions: [], shared_values: [] });

    db.prepare(
      'INSERT INTO bridge_audits (user_id, sources, siloing_score, shared_values, questions) VALUES (?,?,?,?,?)'
    ).run(uid, JSON.stringify(sources), parsed.siloing_score || 0, JSON.stringify(parsed.shared_values || []), JSON.stringify(parsed.how_questions || []));

    res.json({ ...parsed, provider: result.provider });
  } catch (err) {
    console.error('Bridge audit error:', err);
    res.status(500).json({ error: err.message || 'Audit failed' });
  }
});

// POST /api/bridge/bridge — generate bridge-building questions between two viewpoints
router.post('/bridge', async (req, res) => {
  const { viewA, viewB, userId } = req.body || {};
  if (!viewA || !viewB) return res.status(400).json({ error: 'Both viewpoints required' });

  try {
    const bridgePrompt = getPrompt('bridge-builder');

    const result = await callLLM(
      [
        { role: 'system', content: bridgePrompt.user_prompt },
        { role: 'user', content: `View A: ${viewA}\nView B: ${viewB}` }
      ],
      { purpose: 'bridge_builder', temperature: 0.4, response_format: { type: 'json_object' }, db }
    );

    let parsed;
    try { parsed = JSON.parse(result.content); } catch {
      const cleaned = result.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      try { parsed = JSON.parse(cleaned); } catch { parsed = { sorting_analysis: '', how_questions: [], shared_value: '', bridge_summary: '' }; }
    }

    res.json({ ...parsed, provider: result.provider });
  } catch (err) {
    console.error('Bridge builder error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bridge/values — get Schwartz values quiz
router.get('/values', (req, res) => {
  res.json(VALUES_QUIZ);
});

// POST /api/bridge/values — submit values quiz
router.post('/values', (req, res) => {
  const { values, userId } = req.body || {};
  if (!values || !Array.isArray(values)) return res.status(400).json({ error: 'Values array required' });

  const uid = (userId || 'default').toString();
  try {
    db.prepare('UPDATE cognitive_users SET primary_values = ? WHERE id = ?').run(JSON.stringify(values), uid);
  } catch (e) {
    console.error('Bridge values error:', e.message);
    return res.status(500).json({ error: 'Failed to save values' });
  }

  res.json({ saved: true });
});

// GET /api/bridge/audits — get audit history
router.get('/audits', (req, res) => {
  const userId = req.query.userId || 'default';
  const rows = db.prepare('SELECT * FROM bridge_audits WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').all(userId);
  res.json(rows);
});

const INFORMATION_DIET_PROMPT_SLUG = 'information-diet';

// POST /api/bridge/information-diet — analyze user's feed sources for echo-chamber effects
router.post('/information-diet', async (req, res) => {
  const { sources, userId } = req.body || {};
  
  if (!sources || !Array.isArray(sources) || sources.length === 0) {
    return res.status(400).json({ error: 'Sources array required' });
  }

  const uid = userId || 'default';

  try {
    const sourceList = sources.map(s => typeof s === 'string' ? s : `${s.name} (${s.url || 'unknown'})`).join(', ');

    const dietPrompt = getPrompt(INFORMATION_DIET_PROMPT_SLUG);

    const result = await callLLM(
      [
        { role: 'system', content: dietPrompt.user_prompt },
        { role: 'user', content: `Analyze these news sources: ${sourceList}` }
      ],
      { purpose: 'information_diet', temperature: 0.3, response_format: { type: 'json_object' }, db }
    );

    let parsed;
    try {
      parsed = JSON.parse(result.content);
    } catch {
      const cleaned = result.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      try { parsed = JSON.parse(cleaned); } catch {
        parsed = {
          sources: sources.map(s => ({ name: typeof s === 'string' ? s : s.name, bias: 'Center', frequency: 'medium', url: typeof s === 'string' ? '' : (s.url || '') })),
          diversityScore: 50,
          dominantBias: 'Center',
          echoChamberRisk: 'medium',
          recommendations: ['Consider adding sources from different political perspectives'],
          biasDistribution: { farLeft: 0, left: 0, centerLeft: 0, center: sources.length, centerRight: 0, right: 0, farRight: 0 }
        };
      }
    }

    if (!parsed.biasDistribution) {
      parsed.biasDistribution = { farLeft: 0, left: 0, centerLeft: 0, center: 0, centerRight: 0, right: 0, farRight: 0 };
      const biasKey = parsed.dominantBias?.toLowerCase().replace(/[\s-]/g, '') || 'center';
      const biasMap = {
        'farleft': 'farLeft', 'left': 'left', 'centerleft': 'centerLeft',
        'center': 'center', 'centerright': 'centerRight', 'right': 'right', 'farright': 'farRight'
      };
      const key = biasMap[biasKey] || 'center';
      parsed.biasDistribution[key] = sources.length;
    }

    res.json({ ...parsed, provider: result.provider });
  } catch (err) {
    console.error('Information diet error:', err);
    res.status(500).json({ error: err.message || 'Analysis failed' });
  }
});

module.exports = router;

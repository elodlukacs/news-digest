const express = require('express');
const db = require('../db');
const { callLLM } = require('../lib/llm');
const { getPrompt } = require('../lib/promptManager');
const { parseJSON } = require('../lib/parseJSON');

const router = express.Router();

const PLATFORMS = ['Twitter/X', 'Facebook', 'Reddit', 'News sites', 'YouTube', 'TikTok', 'Instagram'];

router.post('/narrative-map', async (req, res) => {
  const { topic, userId, provider } = req.body || {};
  
  if (!topic || topic.trim().length < 3) {
    return res.status(400).json({ error: 'Topic must be at least 3 characters' });
  }
  
  const trimmed = topic.trim().slice(0, 500);
  const uid = userId || 'default';

  try {
    const narrativePrompt = getPrompt('narrative-map');

    const result = await callLLM(
      [
        { role: 'system', content: narrativePrompt.user_prompt },
        { role: 'user', content: `Map the spread of this narrative across platforms:\n\n"${trimmed}"` }
      ],
      { purpose: 'narrative_map', temperature: 0.3, response_format: { type: 'json_object' }, providerId: provider || null, db }
    );

    const parsed = parseJSON(result.content, generateFallbackNarrative(trimmed));

    if (!parsed.stages) parsed.stages = [];
    if (!parsed.platforms) parsed.platforms = PLATFORMS.map((p, i) => ({
      id: `platform-${i}`,
      name: p,
      virality: 30,
      role: 'amplifier',
      description: '',
      keyAccounts: []
    }));
    if (!parsed.connections) parsed.connections = [];

    db.prepare(
      'INSERT INTO narrative_maps (user_id, topic, map_data) VALUES (?,?,?)'
    ).run(uid, trimmed, JSON.stringify(parsed));

    res.json({ ...parsed, provider: result.provider });
  } catch (err) {
    console.error('Narrative map error:', err);
    res.status(500).json({ error: err.message || 'Analysis failed' });
  }
});

function generateFallbackNarrative(topic) {
  const stageLabels = ['Origin', 'Early Spread', 'Amplification', 'Peak', 'Decline'];
  const stages = stageLabels.map((label, i) => ({
    id: `stage-${i}`,
    label,
    date: `Stage ${i + 1}`,
    description: `Narrative "${topic}" at ${label.toLowerCase()} stage`,
    platforms: PLATFORMS.slice(0, Math.min(3 + i, 7)),
    mutations: [`Initial claim evolved through platform adoption`]
  }));

  const platforms = PLATFORMS.map((p, i) => ({
    id: `platform-${i}`,
    name: p,
    virality: 20 + Math.random() * 60,
    role: i === 0 ? 'origin' : i < 3 ? 'amplifier' : 'mainstream',
    description: '',
    keyAccounts: []
  }));

  const connections = [];
  for (let i = 0; i < PLATFORMS.length - 1; i++) {
    connections.push({
      from: `platform-${i}`,
      to: `platform-${i + 1}`,
      weight: Math.floor(Math.random() * 8) + 2,
      description: 'Spread via shares and reposts',
      stage: `stage-${Math.floor(i / 2)}`
    });
  }

  return {
    narrative: topic,
    description: `Analysis of "${topic}" narrative spread pattern`,
    stage: 'Circulating',
    viralityScore: 55,
    stages,
    platforms,
    connections,
    keyAccounts: [],
    mutationHistory: [],
    summary: 'Fallback analysis - detailed mapping requires more context.'
  };
}

router.get('/narrative-map/trending', (req, res) => {
  const narratives = [
    { id: 'election-fraud', label: 'Election Fraud Claims', example: '2020 election was stolen' },
    { id: 'covid-origin', label: 'COVID Origin Theories', example: 'Lab leak theory debate' },
    { id: 'climate-denial', label: 'Climate Denial', example: 'Climate change is not real' },
    { id: 'vaccine-misinfo', label: 'Vaccine Misinformation', example: 'Vaccines cause autism' },
    { id: 'health-conspiracy', label: 'Health Conspiracies', example: '5G and health effects' },
    { id: 'financial-fraud', label: 'Financial Fraud Claims', example: 'Banking manipulation theories' }
  ];
  res.json(narratives);
});

router.get('/narrative-map/history', (req, res) => {
  const userId = req.query.userId || 'default';
  const limit = parseInt(req.query.limit) || 20;
  const rows = db.prepare('SELECT * FROM narrative_maps WHERE user_id = ? ORDER BY created_at DESC LIMIT ?').all(userId, limit);
  res.json(rows);
});

module.exports = router;

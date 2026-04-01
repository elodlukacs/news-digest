const express = require('express');
const db = require('../db');
const { callLLM } = require('../lib/llm');
const { getPrompt } = require('../lib/promptManager');
const { parseJSON } = require('../lib/parseJSON');

const router = express.Router();

// POST /api/forensics — analyze text
router.post('/', async (req, res) => {
  const { text, userId, provider } = req.body;
  if (!text || text.trim().length < 20) return res.status(400).json({ error: 'Text must be at least 20 characters' });
  const trimmed = text.trim().slice(0, 5000);

  try {
    const forensicPrompt = getPrompt('forensic-analysis');

    const result = await callLLM(
      [
        { role: 'system', content: forensicPrompt.user_prompt },
        { role: 'user', content: `Analyze this text:\n\n${trimmed}` }
      ],
      { purpose: 'forensic_analysis', temperature: 0.2, response_format: { type: 'json_object' }, providerId: provider || null, db }
    );

    const parsed = parseJSON(result.content, { fallacies: [], funnel_stage: 'unknown', emotional_intensity: 5, bias_score: 5, summary: 'Analysis parsing failed' });

    const uid = userId || 'default';
    db.prepare(
      'INSERT INTO forensic_history (user_id, raw_text, fallacy_data, bias_score, emotional_intensity, funnel_stage) VALUES (?,?,?,?,?,?)'
    ).run(uid, text.substring(0, 5000), JSON.stringify(parsed.fallacies || []), parsed.bias_score || 0, parsed.emotional_intensity || 0, parsed.funnel_stage || '');

    res.json({ ...parsed, provider: result.provider });
  } catch (err) {
    console.error('Forensics error:', err);
    res.status(500).json({ error: err.message || 'Analysis failed' });
  }
});

// POST /api/forensics/stream — SSE streaming analysis
router.post('/stream', async (req, res) => {
  const { text, provider } = req.body;
  if (!text || text.trim().length < 20) return res.status(400).json({ error: 'Text must be at least 20 characters' });
  const trimmed = text.trim().slice(0, 5000);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let closed = false;
  req.on('close', () => { closed = true; });

  const sendEvent = (event, data) => {
    if (closed) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    sendEvent('status', { step: 'analyzing', message: 'Analyzing text for cognitive vulnerabilities...' });

    const forensicPrompt = getPrompt('forensic-analysis');

    const result = await callLLM(
      [
        { role: 'system', content: forensicPrompt.user_prompt },
        { role: 'user', content: `Analyze this text:\n\n${trimmed}` }
      ],
      { purpose: 'forensic_analysis_stream', temperature: 0.2, response_format: { type: 'json_object' }, providerId: provider || null, db }
    );

    const parsed = parseJSON(result.content, { fallacies: [], emotional_intensity: 5, bias_score: 5 });

    sendEvent('fallacies', { fallacies: parsed.fallacies || [] });
    sendEvent('intensity', { emotional_intensity: parsed.emotional_intensity || 0 });
    sendEvent('funnel', { funnel_stage: parsed.funnel_stage || '' });
    sendEvent('done', { summary: parsed.summary || '', bias_score: parsed.bias_score || 0, provider: result.provider });

    const streamUserId = req.body.userId || 'default';
    db.prepare(
      'INSERT INTO forensic_history (user_id, raw_text, fallacy_data, bias_score, emotional_intensity, funnel_stage) VALUES (?,?,?,?,?,?)'
    ).run(streamUserId, trimmed, JSON.stringify(parsed.fallacies || []), parsed.bias_score || 0, parsed.emotional_intensity || 0, parsed.funnel_stage || '');

    res.end();
  } catch (err) {
    console.error('Forensic stream error:', err);
    sendEvent('error', { error: err.message || 'Analysis failed' });
    res.end();
  }
});

// GET /api/forensics/history — get forensic analysis history
router.get('/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const userId = req.query.userId || 'default';
  const rows = db.prepare('SELECT * FROM forensic_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?').all(userId, limit);
  res.json(rows);
});

router.post('/study', async (req, res) => {
  const { headline, userId, provider } = req.body;
  if (!headline || headline.trim().length < 10) {
    return res.status(400).json({ error: 'Headline must be at least 10 characters' });
  }
  const trimmed = headline.trim().slice(0, 2000);

  try {
    const studyPrompt = getPrompt('study-analysis');

    const result = await callLLM(
      [
        { role: 'system', content: studyPrompt.user_prompt },
        { role: 'user', content: `Analyze this research headline:\n\n${trimmed}` }
      ],
      { purpose: 'study_analysis', temperature: 0.2, response_format: { type: 'json_object' }, providerId: provider || null, db }
    );

    const parsed = parseJSON(result.content, {
      sampleSize: { score: 5, label: 'Unclear', reasoning: 'Parse failed' },
      hasControlGroup: { present: false, unclear: true, reasoning: '' },
      conflictOfInterest: { hasConflict: false, unclear: true, details: '' },
      peerReviewed: { likely: false, unclear: true, reasoning: '' },
      effectSize: { meaningful: false, inflated: false, reasoning: '' },
      methodologyIssues: [],
      overallScore: 5,
      issues: ['Analysis parsing failed'],
      strengths: [],
      headlineVsStudy: 'Unable to compare',
      summary: 'Analysis could not be completed due to parsing error.'
    });

    const uid = userId || 'default';
    db.prepare(
      'INSERT INTO study_analyses (user_id, headline, analysis_data) VALUES (?,?,?)'
    ).run(uid, trimmed, JSON.stringify(parsed));

    res.json({ ...parsed, provider: result.provider });
  } catch (err) {
    console.error('Study analysis error:', err);
    res.status(500).json({ error: err.message || 'Analysis failed' });
  }
});

router.get('/study/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const userId = req.query.userId || 'default';
  const rows = db.prepare('SELECT * FROM study_analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT ?').all(userId, limit);
  res.json(rows);
});

module.exports = router;

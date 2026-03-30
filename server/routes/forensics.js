const express = require('express');
const db = require('../db');
const { callLLM } = require('../lib/llm');

const router = express.Router();

const FORENSIC_PROMPT = `You are a senior forensic sub-editor trained in David Robert Grimes' logical fallacy taxonomy and Dan Ariely's "Funnel of Misbelief."

Analyze the provided text for cognitive vulnerabilities. Be educational and non-judgmental. Do not rewrite the text.

Rules:
1. Identify Fallacies: Explicitly search for Ad Hominem, False Dichotomy, Appeal to Nature, Post Hoc, Appeal to Emotion, Straw Man, Bandwagon, Slippery Slope, Appeal to Authority, Red Herring.
2. Map the Funnel of Misbelief: Identify elements of Stress exploitation, Confirmation Bias, Pattern Seeking, or Social Exclusion.
3. Quantitative Scoring: Provide a 0-10 score for "Emotional Intensity."

Return JSON:
{
  "fallacies": [{"name": "string", "evidence": "string", "explanation": "string"}],
  "funnel_stage": "string",
  "emotional_intensity": number,
  "bias_score": number,
  "summary": "string"
}`;

// POST /api/forensics — analyze text
router.post('/', async (req, res) => {
  const { text, userId, provider } = req.body;
  if (!text || text.trim().length < 20) return res.status(400).json({ error: 'Text must be at least 20 characters' });
  const trimmed = text.trim().slice(0, 5000);

  try {
    const result = await callLLM(
      [
        { role: 'system', content: FORENSIC_PROMPT },
        { role: 'user', content: `Analyze this text:\n\n${trimmed}` }
      ],
      { purpose: 'forensic_analysis', temperature: 0.2, response_format: { type: 'json_object' }, providerId: provider || null, db }
    );

    let parsed;
    try {
      parsed = JSON.parse(result.content);
    } catch {
      // JSON repair attempts
      const cleaned = result.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const withCommas = cleaned.replace(/,\s*([\]}])/g, '$1');
      try {
        parsed = JSON.parse(withCommas);
      } catch {
        parsed = { fallacies: [], funnel_stage: 'unknown', emotional_intensity: 5, bias_score: 5, summary: 'Analysis parsing failed' };
      }
    }

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

    const result = await callLLM(
      [
        { role: 'system', content: FORENSIC_PROMPT },
        { role: 'user', content: `Analyze this text:\n\n${trimmed}` }
      ],
      { purpose: 'forensic_analysis_stream', temperature: 0.2, response_format: { type: 'json_object' }, providerId: provider || null, db }
    );

    let parsed;
    try {
      parsed = JSON.parse(result.content);
    } catch {
      const cleaned = result.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const withCommas = cleaned.replace(/,\s*([\]}])/g, '$1');
      try { parsed = JSON.parse(withCommas); } catch { parsed = { fallacies: [], emotional_intensity: 5, bias_score: 5 }; }
    }

    sendEvent('fallacies', { fallacies: parsed.fallacies || [] });
    sendEvent('intensity', { emotional_intensity: parsed.emotional_intensity || 0 });
    sendEvent('funnel', { funnel_stage: parsed.funnel_stage || '' });
    sendEvent('done', { summary: parsed.summary || '', bias_score: parsed.bias_score || 0, provider: result.provider });

    db.prepare(
      'INSERT INTO forensic_history (user_id, raw_text, fallacy_data, bias_score, emotional_intensity, funnel_stage) VALUES (?,?,?,?,?,?)'
    ).run('default', trimmed, JSON.stringify(parsed.fallacies || []), parsed.bias_score || 0, parsed.emotional_intensity || 0, parsed.funnel_stage || '');

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
  const rows = db.prepare('SELECT * FROM forensic_history ORDER BY created_at DESC LIMIT ?').all(limit);
  res.json(rows);
});

const STUDY_PROMPT = `You are a senior research methodology analyst specializing in evaluating scientific studies reported in news headlines.

Analyze the provided headline about a research study for methodological quality and reporting accuracy.

Rules:
1. Sample Size Assessment: Is the sample size adequate? Flag if suspiciously small.
2. Control Groups: Does the study appear to have proper controls?
3. Conflicts of Interest: Look for funding sources or author affiliations that may introduce bias.
4. Statistical Significance: Note if significance is claimed but sample is small.
5. Peer Review Status: Is it clear if this is peer-reviewed?
6. Effect Size: Evaluate if the effect size is meaningful or inflated.
7. Headline vs Study: Identify any mismatch between headline claims and actual findings.

Return JSON:
{
  "sampleSize": {"score": number, "label": "string", "reasoning": "string"},
  "hasControlGroup": {"present": boolean, "unclear": boolean, "reasoning": "string"},
  "conflictOfInterest": {"hasConflict": boolean, "unclear": boolean, "details": "string"},
  "peerReviewed": {"likely": boolean, "unclear": boolean, "reasoning": "string"},
  "effectSize": {"meaningful": boolean, "inflated": boolean, "reasoning": "string"},
  "methodologyIssues": ["string"],
  "overallScore": number,
  "issues": ["string"],
  "strengths": ["string"],
  "headlineVsStudy": "string",
  "summary": "string"
}`;

router.post('/study', async (req, res) => {
  const { headline, userId, provider } = req.body;
  if (!headline || headline.trim().length < 10) {
    return res.status(400).json({ error: 'Headline must be at least 10 characters' });
  }
  const trimmed = headline.trim().slice(0, 2000);

  try {
    const result = await callLLM(
      [
        { role: 'system', content: STUDY_PROMPT },
        { role: 'user', content: `Analyze this research headline:\n\n${trimmed}` }
      ],
      { purpose: 'study_analysis', temperature: 0.2, response_format: { type: 'json_object' }, providerId: provider || null, db }
    );

    let parsed;
    try {
      parsed = JSON.parse(result.content);
    } catch {
      const cleaned = result.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const withCommas = cleaned.replace(/,\s*([\]}])/g, '$1');
      try {
        parsed = JSON.parse(withCommas);
      } catch {
        parsed = {
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
        };
      }
    }

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
  const rows = db.prepare('SELECT * FROM study_analyses ORDER BY created_at DESC LIMIT ?').all(limit);
  res.json(rows);
});

module.exports = router;

const express = require('express');
const db = require('../db');
const { callLLM } = require('../lib/llm');
const { getPrompt, renderPrompt } = require('../lib/promptManager');
const { parseJSON } = require('../lib/parseJSON');

const router = express.Router();

const BIASES = [
  'confirmation-bias', 'anchoring-bias', 'availability-heuristic',
  'dunning-kruger', 'sunk-cost-fallacy', 'bandwagon-effect',
  'authority-bias', 'negativity-bias', 'in-group-bias', 'framing-effect',
];

const BIAS_LABELS = {
  'confirmation-bias': 'Confirmation Bias',
  'anchoring-bias': 'Anchoring Bias',
  'availability-heuristic': 'Availability Heuristic',
  'dunning-kruger': 'Dunning-Kruger',
  'sunk-cost-fallacy': 'Sunk Cost Fallacy',
  'bandwagon-effect': 'Bandwagon Effect',
  'authority-bias': 'Authority Bias',
  'negativity-bias': 'Negativity Bias',
  'in-group-bias': 'In-Group Bias',
  'framing-effect': 'Framing Effect',
};

// Hardcoded scenarios as fallback (10 scenarios, one per bias)
const SCENARIOS = [
  {
    bias: 'confirmation-bias',
    scenario: 'A study finds that coffee drinkers live longer. You love coffee. Do you share this study without reading the methodology?',
    options: ['Yes — it confirms what I already believe', 'No — I need to check the study design first'],
    biasedIndex: 0,
  },
  {
    bias: 'anchoring-bias',
    scenario: 'A jacket is marked "Was $200, now $80." A similar jacket elsewhere costs $85 with no discount. Which feels like a better deal?',
    options: ['The discounted one — what a saving!', 'They cost about the same — the discount is irrelevant'],
    biasedIndex: 0,
  },
  {
    bias: 'availability-heuristic',
    scenario: 'Two news stories: a plane crash (killing 12) and car accidents (killing 100 that day). Which feels more dangerous to you?',
    options: ['Flying — that crash was terrifying', 'Driving — statistically far deadlier'],
    biasedIndex: 0,
  },
  {
    bias: 'dunning-kruger',
    scenario: 'You read 3 articles about cryptocurrency. A friend asks your opinion on investing. How do you respond?',
    options: ['I feel confident explaining crypto strategy', 'I know enough to know I don\'t know enough'],
    biasedIndex: 0,
  },
  {
    bias: 'sunk-cost-fallacy',
    scenario: 'You bought a $50 movie ticket and after 30 minutes the film is terrible. Do you stay?',
    options: ['Yes — I already paid, might as well finish', 'No — my time is worth more than $50'],
    biasedIndex: 0,
  },
  {
    bias: 'bandwagon-effect',
    scenario: 'A product has 50,000 five-star reviews. A friend says the quality is poor. Who do you trust?',
    options: ['The crowd — 50,000 people can\'t be wrong', 'My friend — numbers don\'t guarantee quality'],
    biasedIndex: 0,
  },
  {
    bias: 'authority-bias',
    scenario: 'A famous actor recommends a specific brand of vitamins. A doctor you don\'t know says they\'re unnecessary. Who do you follow?',
    options: ['The actor — they seem healthy and successful', 'The doctor — credentials matter more than fame'],
    biasedIndex: 0,
  },
  {
    bias: 'negativity-bias',
    scenario: 'A restaurant has 95 positive reviews and 5 negative ones. Which reviews do you focus on?',
    options: ['The negative ones — what if I have the same bad experience?', 'The overall trend — 95% positive is excellent'],
    biasedIndex: 0,
  },
  {
    bias: 'in-group-bias',
    scenario: 'Your political party proposes a policy you\'d normally oppose. How do you react?',
    options: ['Support it — my party probably has good reasons', 'Evaluate it independently of who proposed it'],
    biasedIndex: 0,
  },
  {
    bias: 'framing-effect',
    scenario: 'Medicine A: "90% survival rate." Medicine B: "10% mortality rate." Which do you choose?',
    options: ['Medicine A — it sounds much safer', 'They\'re identical — the framing doesn\'t change the facts'],
    biasedIndex: 0,
  },
];

// POST /api/bias-mirror/quiz — generate quiz
router.post('/quiz', (req, res) => {
  const { count = 5 } = req.body || {};
  const shuffled = [...SCENARIOS].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(count, SCENARIOS.length));

  res.json({
    questions: selected.map((s, i) => ({
      id: i,
      bias: s.bias,
      biasLabel: BIAS_LABELS[s.bias],
      scenario: s.scenario,
      options: s.options,
      biasedIndex: s.biasedIndex,
    })),
  });
});

// POST /api/bias-mirror/score — score answers and save profile
router.post('/score', (req, res) => {
  const { answers } = req.body || {};
  const uid = req.body.userId || 'default';

  if (!answers || !Array.isArray(answers)) {
    return res.status(400).json({ error: 'answers array required' });
  }

  const scores = {};
  for (const bias of BIASES) {
    scores[bias] = { biased: 0, total: 0 };
  }

  for (const ans of answers) {
    const { bias, selectedIndex, biasedIndex } = ans;
    if (!scores[bias]) scores[bias] = { biased: 0, total: 0 };
    scores[bias].total += 1;
    if (selectedIndex === biasedIndex) scores[bias].biased += 1;
  }

  // Calculate susceptibility per bias (0-10 scale)
  const profile = {};
  for (const bias of BIASES) {
    const s = scores[bias];
    if (s.total > 0) {
      profile[bias] = Math.round((s.biased / s.total) * 10);
    }
  }

  // Save to bias_fingerprints
  for (const [bias, score] of Object.entries(profile)) {
    db.prepare(`
      INSERT INTO bias_fingerprints (user_id, bias_type, susceptibility_score, last_tested_date)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, bias_type) DO UPDATE SET
        susceptibility_score = excluded.susceptibility_score,
        last_tested_date = excluded.last_tested_date
    `).run(uid, bias, score);
  }

  res.json({
    profile,
    biasLabels: BIAS_LABELS,
    message: answers.length === 0 ? 'No answers to score' : 'Profile saved',
  });
});

// GET /api/bias-mirror/profile — get saved profile
router.get('/profile', (req, res) => {
  const uid = req.query.userId || 'default';

  const rows = db.prepare(
    'SELECT bias_type, susceptibility_score, last_tested_date FROM bias_fingerprints WHERE user_id = ?'
  ).all(uid);

  const profile = {};
  for (const row of rows) {
    profile[row.bias_type] = row.susceptibility_score;
  }

  res.json({
    profile,
    biasLabels: BIAS_LABELS,
    hasData: rows.length > 0,
    lastTested: rows.length > 0 ? rows[0].last_tested_date : null,
  });
});

module.exports = router;

const express = require('express');
const db = require('../db');
const { callLLM } = require('../lib/llm');
const { getPrompt, renderPrompt } = require('../lib/promptManager');

const router = express.Router();

const PERSONAS = [
  {
    id: 'influence-analyst',
    name: 'Senior Influence Operations Analyst',
    description: 'You are a former intelligence analyst who studied state-sponsored influence operations for 15 years. You now teach media literacy and help people understand how nation-states and political actors shape public opinion through sophisticated multi-channel campaigns.',
    icon: '🕵️',
    greeting: 'I\'ve spent 15 years studying how governments and political actors shape what you believe. Ask me anything — I\'ll show you the playbook.',
  },
  {
    id: 'troll-farm',
    name: 'Troll Farm Operator',
    description: 'You are a reformed former operator of a commercial disinformation service. You ran fake social media accounts, astroturfing campaigns, and viral content farms. You\'ve since left the industry and now expose how these operations work from the inside.',
    icon: '🎭',
    greeting: 'I used to run 200 fake accounts that could make any narrative go viral in 48 hours. I\'ll tell you exactly how we did it — and what to watch for.',
  },
  {
    id: 'bias-coach',
    name: 'Cognitive Bias Coach',
    description: 'You are a behavioral psychologist specializing in cognitive biases and decision-making. You help people understand their own psychological vulnerabilities by explaining exactly how manipulators exploit specific biases like confirmation bias, anchoring, and negativity bias.',
    icon: '🧠',
    greeting: 'Your brain has predictable shortcuts. I\'ll show you which ones are your weakest — and how someone with bad intentions would exploit them.',
  },
];

// GET /api/manipulator/personas
router.get('/personas', (_req, res) => {
  res.json(PERSONAS.map(p => ({
    id: p.id,
    name: p.name,
    icon: p.icon,
    greeting: p.greeting,
  })));
});

// POST /api/manipulator/chat
router.post('/chat', async (req, res) => {
  const { personaId, message, interests = '', provider } = req.body || {};

  const persona = PERSONAS.find(p => p.id === personaId);
  if (!persona) {
    return res.status(400).json({ error: 'Unknown persona. Use one of: ' + PERSONAS.map(p => p.id).join(', ') });
  }
  if (!message || message.trim().length < 2) {
    return res.status(400).json({ error: 'Message required' });
  }
  if (message.length > 1000) {
    return res.status(400).json({ error: 'Message must be 1000 characters or fewer' });
  }

  try {
    const prompt = getPrompt('ask-the-manipulator');
    const rendered = renderPrompt(prompt.user_prompt, {
      message: message.trim(),
      interests: interests || 'general news consumer',
      personaName: persona.name,
    });

    const result = await callLLM(
      [
        { role: 'system', content: prompt.system_message.replace('{{personaName}}', persona.name).replace('{{personaDescription}}', persona.description) },
        { role: 'user', content: rendered },
      ],
      { purpose: 'manipulator_chat', temperature: 0.7, providerId: provider || null, db }
    );

    res.json({
      personaId,
      personaName: persona.name,
      personaIcon: persona.icon,
      response: result.content,
      provider: result.provider,
    });
  } catch (err) {
    console.error('Manipulator chat error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate response' });
  }
});

module.exports = router;

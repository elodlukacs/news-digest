const express = require('express');
const { getAllPrompts, updatePrompt, getPrompt } = require('../lib/promptManager');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const prompts = getAllPrompts();
    res.json(prompts);
  } catch (err) {
    console.error('Get prompts error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:slug', (req, res) => {
  try {
    const prompt = getPrompt(req.params.slug);
    res.json(prompt);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.put('/:slug', (req, res) => {
  try {
    const { name, description, system_message, user_prompt } = req.body || {};
    const updated = updatePrompt(req.params.slug, { name, description, system_message, user_prompt });
    res.json(updated);
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    console.error('Update prompt error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

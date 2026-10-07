const express = require('express');
const router = express.Router();

const env = (name) => process.env[name];

// The models offered in the navbar menu. DeepSeek is the only provider (see
// lib/llm.js), and its catalogue is small and stable, so it is declared here
// rather than fetched. Keep in sync with the `deepseek` entry in lib/llm.js.
const DEEPSEEK_MODELS = [
  {
    id: 'deepseek-flash',
    name: 'DeepSeek V4.1 Flash',
    owned_by: 'DeepSeek',
    context_window: 1000000,
    max_completion_tokens: 8192,
    provider: 'DeepSeek',
  },
  {
    id: 'deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    owned_by: 'DeepSeek',
    context_window: 1000000,
    max_completion_tokens: 8192,
    provider: 'DeepSeek',
  },
];

router.get('/', (req, res) => {
  // An empty list tells the client no model is usable (no key configured).
  res.json(env('DEEPSEEK_API_KEY') ? DEEPSEEK_MODELS : []);
});

module.exports = router;

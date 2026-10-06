// Topic research — the homepage search.
//
// POST   /             → research a topic (LLM plan + news/Wikipedia search +
//                        LLM narrative). Reuses a recent result for the same
//                        topic unless `fresh` is set.
// GET    /recent       → recently researched topics, newest first.
// GET    /:id          → one stored result.
// DELETE /:id          → remove a result and its chat.
// GET    /:id/chat     → follow-up chat history.
// POST   /:id/chat     → ask a follow-up question.

const express = require('express');
const db = require('../db');
const { callLLM } = require('../lib/llm');
const { buildMessages } = require('../lib/promptManager');
const { runExclusive } = require('../lib/inFlight');
const validateId = require('../middleware/validateId');
const { researchTopic, researchScope, cleanTopic, topicKey, formatSourcesForChat } = require('../lib/topicResearch');

const router = express.Router();

// A topic researched this recently is served from the table: the news has
// barely moved, and a re-run costs two LLM calls and a dozen searches.
const CACHE_HOURS = Number(process.env.RESEARCH_CACHE_HOURS) || 6;
const RECENT_LIMIT = 12;
const CHAT_HISTORY = 10;
const MAX_MESSAGE_LENGTH = 2000;
const LANGUAGE_RE = /^[\p{L} ]{2,30}$/u;

const stmts = {
  findCached: db.prepare(`
    SELECT * FROM topic_research
    WHERE topic_key = ? AND language = ? AND scope = ? AND created_at >= ?
    ORDER BY created_at DESC LIMIT 1
  `),
  insert: db.prepare(`
    INSERT INTO topic_research (topic, topic_key, language, headline, narrative, sources_json, provider, scope, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  get: db.prepare('SELECT * FROM topic_research WHERE id = ?'),
  // Latest row per topic, so re-researching a topic does not list it twice.
  recent: db.prepare(`
    SELECT t.id, t.topic, t.headline, t.language, t.created_at
    FROM topic_research t
    JOIN (
      SELECT MAX(id) AS id FROM topic_research GROUP BY topic_key, language
    ) latest ON latest.id = t.id
    ORDER BY t.created_at DESC
    LIMIT ?
  `),
  remove: db.prepare('DELETE FROM topic_research WHERE id = ?'),
  messages: db.prepare(`
    SELECT id, role, content, created_at FROM topic_research_messages
    WHERE research_id = ? ORDER BY created_at ASC, id ASC
  `),
  history: db.prepare(`
    SELECT role, content FROM topic_research_messages
    WHERE research_id = ? ORDER BY created_at DESC, id DESC LIMIT ?
  `),
  addMessage: db.prepare(
    'INSERT INTO topic_research_messages (research_id, role, content, created_at) VALUES (?, ?, ?, ?)'
  ),
};

function toResponse(row, cached = false) {
  let sources = [];
  try { sources = JSON.parse(row.sources_json); } catch { /* keep empty */ }
  return {
    id: row.id,
    topic: row.topic,
    language: row.language,
    headline: row.headline,
    narrative: row.narrative,
    sources,
    provider: row.provider,
    created_at: row.created_at,
    cached,
  };
}

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  err.expose = true;
  return err;
}

router.post('/', async (req, res) => {
  const { topic: rawTopic, language: rawLanguage, provider, fresh } = req.body || {};
  const topic = cleanTopic(rawTopic);
  const language = typeof rawLanguage === 'string' && LANGUAGE_RE.test(rawLanguage.trim())
    ? rawLanguage.trim()
    : 'English';
  const key = topicKey(topic);
  // Ticking or unticking "Include in research" on a category changes the
  // scope, so the next search runs fresh instead of reusing the cache.
  const scope = researchScope(db);

  if (!fresh) {
    const since = new Date(Date.now() - CACHE_HOURS * 3600000).toISOString();
    const cached = stmts.findCached.get(key, language, scope, since);
    if (cached) return res.json(toResponse(cached, true));
  }

  const row = await runExclusive(`research:${key}:${language}:${scope}`, async () => {
    const result = await researchTopic(callLLM, db, {
      topic,
      language,
      provider: typeof provider === 'string' && provider ? provider : null,
    });
    const now = new Date().toISOString();
    const info = stmts.insert.run(
      result.topic, key, language, result.headline, result.narrative,
      JSON.stringify(result.sources), result.provider, scope, now,
    );
    return stmts.get.get(info.lastInsertRowid);
  });
  res.json(toResponse(row));
});

router.get('/recent', (req, res) => {
  res.json(stmts.recent.all(RECENT_LIMIT));
});

router.get('/:id', validateId, (req, res) => {
  const row = stmts.get.get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Research not found' });
  res.json(toResponse(row, true));
});

router.delete('/:id', validateId, (req, res) => {
  // topic_research_messages rows go with it (ON DELETE CASCADE).
  const { changes } = stmts.remove.run(Number(req.params.id));
  if (!changes) return res.status(404).json({ error: 'Research not found' });
  res.json({ ok: true });
});

router.get('/:id/chat', validateId, (req, res) => {
  res.json(stmts.messages.all(Number(req.params.id)));
});

router.post('/:id/chat', validateId, async (req, res) => {
  const { message, provider } = req.body || {};
  if (typeof message !== 'string' || !message.trim()) throw badRequest('message is required');
  if (message.length > MAX_MESSAGE_LENGTH) throw badRequest(`message must be under ${MAX_MESSAGE_LENGTH} characters`);

  const researchId = Number(req.params.id);
  const row = stmts.get.get(researchId);
  if (!row) return res.status(404).json({ error: 'Research not found' });

  let sources = [];
  try { sources = JSON.parse(row.sources_json); } catch { /* keep empty */ }

  const history = stmts.history.all(researchId, CHAT_HISTORY).reverse();
  const messages = [
    ...buildMessages('topic-research-chat', {
      narrative: row.narrative,
      sources: formatSourcesForChat(sources),
      topic: row.topic,
    }),
    ...history,
    { role: 'user', content: message.trim() },
  ];

  const result = await callLLM(messages, {
    db,
    purpose: 'topic-research-chat',
    providerId: typeof provider === 'string' && provider ? provider : null,
    temperature: 0.4,
    max_tokens: 1200,
  });
  const reply = String(result.content || '').trim() || 'I couldn\'t generate a response. Please try again.';

  // Both turns are stored only once the reply exists, so a failed call leaves
  // no orphaned question in the history.
  const userTime = new Date().toISOString();
  const replyTime = new Date().toISOString();
  db.transaction(() => {
    stmts.addMessage.run(researchId, 'user', message.trim(), userTime);
    stmts.addMessage.run(researchId, 'assistant', reply, replyTime);
  })();

  res.json({ role: 'assistant', content: reply, created_at: replyTime });
});

module.exports = router;

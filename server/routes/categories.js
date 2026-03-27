const express = require('express');
const db = require('../db');
const validateId = require('../middleware/validateId');

const router = express.Router();

router.get('/', (req, res) => {
  const categories = db.prepare(`
    SELECT c.*, COUNT(f.id) as feed_count
    FROM categories c
    LEFT JOIN feeds f ON f.category_id = c.id
    GROUP BY c.id
    ORDER BY c.sort_order
  `).all();
  res.json(categories);
});

router.get('/:id', validateId, (req, res) => {
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!category) return res.status(404).json({ error: 'Category not found' });
  res.json(category);
});

router.post('/', (req, res) => {
  const { name, icon } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM categories').get();
    const result = db.prepare('INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)').run(name, icon || 'newspaper', (maxOrder.m || 0) + 1);
    res.json({ id: result.lastInsertRowid, name, icon: icon || 'newspaper' });
  } catch (e) {
    res.status(400).json({ error: 'Category already exists' });
  }
});

router.put('/:id/prompt', validateId, (req, res) => {
  const { prompt } = req.body;
  db.prepare('UPDATE categories SET custom_prompt = ? WHERE id = ?').run(prompt || '', req.params.id);
  res.json({ ok: true });
});

router.put('/:id/language', validateId, (req, res) => {
  const { language } = req.body;
  db.prepare('UPDATE categories SET language = ? WHERE id = ?').run(language || 'English', req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', validateId, (req, res) => {
  const catId = req.params.id;
  db.prepare('DELETE FROM chat_messages WHERE summary_id IN (SELECT id FROM summary_history WHERE category_id = ?)').run(catId);
  db.prepare('DELETE FROM llm_usage WHERE category_id = ?').run(catId);
  db.prepare('DELETE FROM summary_history WHERE category_id = ?').run(catId);
  db.prepare('DELETE FROM articles WHERE category_id = ?').run(catId);
  db.prepare('DELETE FROM summaries WHERE category_id = ?').run(catId);
  db.prepare('DELETE FROM feeds WHERE category_id = ?').run(catId);
  db.prepare('DELETE FROM categories WHERE id = ?').run(catId);
  res.json({ ok: true });
});

module.exports = router;

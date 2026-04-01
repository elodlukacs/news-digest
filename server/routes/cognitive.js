const express = require('express');
const db = require('../db');

const router = express.Router();

// DELETE /api/cognitive/reset — clear all cognitive progress data
router.delete('/reset', (req, res) => {
  const userId = req.body.userId || 'default';
  
  try {
    db.transaction(() => {
      db.prepare('DELETE FROM forensic_history WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM inoculation_sessions WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM rethinking_journal WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM bridge_audits WHERE user_id = ?').run(userId);
    })();

    res.json({ success: true, message: 'All cognitive progress data cleared' });
  } catch (err) {
    console.error('Reset error:', err);
    res.status(500).json({ error: 'Failed to reset data' });
  }
});

module.exports = router;

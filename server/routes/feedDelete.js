const express = require('express');
const db = require('../db');
const validateId = require('../middleware/validateId');

const router = express.Router();

router.delete('/:id', validateId, (req, res) => {
  db.prepare('DELETE FROM feeds WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;

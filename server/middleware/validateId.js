function validateId(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid ID' });
  next();
}

module.exports = validateId;

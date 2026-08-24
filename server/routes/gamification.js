const express = require('express');
const db = require('../db');

const DAY_MS = 86_400_000;

const router = express.Router();

function getOrCreateUser(userId) {
  let user = db.prepare('SELECT * FROM user_gamification WHERE user_id = ?').get(userId);
  if (!user) {
    db.prepare('INSERT INTO user_gamification (user_id) VALUES (?)').run(userId);
    user = db.prepare('SELECT * FROM user_gamification WHERE user_id = ?').get(userId);
  }
  return user;
}

function sanitizeUser(row) {
  return {
    current_streak: row.current_streak,
    longest_streak: row.longest_streak,
    total_antibodies: row.total_antibodies,
    last_challenge_date: row.last_challenge_date,
    recovery_boosts_used: row.recovery_boosts_used,
  };
}

function todayUTC() {
  return new Date().toISOString().split('T')[0];
}

// GET /api/gamification/stats
router.get('/stats', (req, res) => {
  const userId = req.query.userId || 'default';
  const user = getOrCreateUser(userId);

  const dojoStats = db.prepare(`
    SELECT
      COUNT(*) as total_sessions,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as correct,
      AVG(CASE WHEN success = 1 THEN time_to_identify ELSE NULL END) as avg_time
    FROM fallacy_dojo_logs WHERE user_id = ?
  `).get(userId);

  const biasCount = db.prepare('SELECT COUNT(*) as c FROM bias_fingerprints WHERE user_id = ?').get(userId).c;
  const inoculationCount = db.prepare('SELECT COUNT(*) as c FROM inoculation_sessions WHERE user_id = ? AND completed = 1').get(userId).c;

  const today = todayUTC();
  const completedToday = user.last_challenge_date === today;

  res.json({
    ...sanitizeUser(user),
    completed_today: completedToday,
    dojo: {
      total_sessions: dojoStats.total_sessions || 0,
      correct: dojoStats.correct || 0,
      accuracy: dojoStats.total_sessions > 0 ? Math.round((dojoStats.correct / dojoStats.total_sessions) * 100) : 0,
      avg_time_ms: dojoStats.avg_time ? Math.round(dojoStats.avg_time) : null,
    },
    bias_fingerprints_count: biasCount,
    inoculation_sessions: inoculationCount,
  });
});

// POST /api/gamification/complete-challenge
router.post('/complete-challenge', (req, res) => {
  const userId = req.body.userId || 'default';
  const antibodiesEarned = Math.max(1, Math.round(req.body.antibodiesEarned || 1));

  const user = getOrCreateUser(userId);
  const today = todayUTC();

  if (user.last_challenge_date === today) {
    return res.json({
      ...sanitizeUser(user),
      already_completed: true,
      message: 'Challenge already completed today',
    });
  }

  const yesterday = new Date(Date.now() - DAY_MS).toISOString().split('T')[0];
  const streakContinues = user.last_challenge_date === yesterday;
  const newStreak = streakContinues ? user.current_streak + 1 : 1;
  const newLongest = Math.max(user.longest_streak, newStreak);

  db.prepare(`
    UPDATE user_gamification SET
      current_streak = ?,
      longest_streak = ?,
      total_antibodies = total_antibodies + ?,
      last_challenge_date = ?
    WHERE user_id = ?
  `).run(newStreak, newLongest, antibodiesEarned, today, userId);

  const updated = db.prepare('SELECT * FROM user_gamification WHERE user_id = ?').get(userId);

  res.json({
    ...sanitizeUser(updated),
    already_completed: false,
    streak_continued: streakContinues,
    message: streakContinues ? `Streak extended to ${newStreak} days!` : `New streak started!`,
  });
});

// POST /api/gamification/recovery-boost
router.post('/recovery-boost', (req, res) => {
  const userId = req.body.userId || 'default';
  const user = getOrCreateUser(userId);
  const today = todayUTC();

  if (user.last_challenge_date === today) {
    return res.status(400).json({ error: 'Already completed today, no recovery needed' });
  }

  const yesterday = new Date(Date.now() - DAY_MS).toISOString().split('T')[0];
  if (user.last_challenge_date === yesterday) {
    return res.status(400).json({ error: 'Streak is still active, no recovery needed' });
  }

  if (user.current_streak === 0) {
    return res.status(400).json({ error: 'No streak to recover' });
  }

  db.prepare(`
    UPDATE user_gamification SET
      recovery_boosts_used = recovery_boosts_used + 1,
      last_challenge_date = ?
    WHERE user_id = ?
  `).run(today, userId);

  const updated = db.prepare('SELECT * FROM user_gamification WHERE user_id = ?').get(userId);

  res.json({
    ...sanitizeUser(updated),
    recovered: true,
    message: `Streak of ${updated.current_streak} days saved with recovery boost!`,
  });
});

// POST /api/gamification/skill-event — record one answer from any exercise.
//
// Every module used to keep its own scoreboard, and the in-reading-flow
// ChallengeQuiz kept none at all. A single event log makes mastery per
// technique derivable instead of guessed.
router.post('/skill-event', (req, res) => {
  const { module: moduleName, itemType, itemRef, userAnswer, correctAnswer, correct, latencyMs } = req.body || {};
  if (!moduleName) return res.status(400).json({ error: 'module is required' });

  const clip = (v) => (v == null ? null : String(v).slice(0, 200));
  const latency = Number.isFinite(Number(latencyMs)) ? Math.max(0, Math.round(Number(latencyMs))) : null;

  db.prepare(`
    INSERT INTO skill_events (module, item_type, item_ref, user_answer, correct_answer, correct, latency_ms, created_at)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(
    clip(moduleName), clip(itemType), clip(itemRef),
    clip(userAnswer), clip(correctAnswer),
    correct ? 1 : 0, latency, new Date().toISOString()
  );

  res.json({ ok: true });
});

// GET /api/gamification/mastery — accuracy per item type, weakest first.
router.get('/mastery', (req, res) => {
  const days = Math.min(Math.max(1, parseInt(req.query.days, 10) || 90), 365);
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const rows = db.prepare(`
    SELECT item_type AS itemType,
           COUNT(*) AS attempts,
           SUM(correct) AS correct,
           CAST(AVG(latency_ms) AS INTEGER) AS avgLatencyMs
    FROM skill_events
    WHERE created_at >= ? AND item_type IS NOT NULL
    GROUP BY item_type
    HAVING attempts > 0
  `).all(since);

  res.json(
    rows
      .map(r => ({ ...r, accuracy: r.attempts ? r.correct / r.attempts : 0 }))
      .sort((a, b) => a.accuracy - b.accuracy)
  );
});

module.exports = router;

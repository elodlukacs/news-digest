# Database Backup

## Backup file

`newsreader.backup.db` in the project root — created 2026-04-01.

Contains all tables: categories, feeds, summaries, summary_history, articles,
chat_messages, llm_usage, user_settings, jobs, ai_filtered_jobs, forensic_history,
inoculation_sessions, rethinking_journal, bridge_audits, study_analyses,
cognitive_users, prompts.

---

## How to restore

### Option A — replace the live database directly (simplest)

Stop the server first, then:

```bash
cp newsreader.backup.db server/newsreader.db
```

Restart the server. Done.

---

### Option B — restore to a custom path (Railway / production)

If your server uses a `DB_PATH` env var pointing to a volume (e.g. `/data/newsreader.db`):

```bash
# Copy via Railway CLI
railway run cp newsreader.backup.db /data/newsreader.db

# Or if you have SSH / exec access:
sqlite3 /data/newsreader.db ".restore '/path/to/newsreader.backup.db'"
```

---

### Option C — restore individual tables only

Open both databases in sqlite3 and copy what you need:

```bash
sqlite3 server/newsreader.db

-- Attach the backup
ATTACH 'newsreader.backup.db' AS bak;

-- Example: restore only categories and feeds
DELETE FROM categories;
INSERT INTO categories SELECT * FROM bak.categories;

DELETE FROM feeds;
INSERT INTO feeds SELECT * FROM bak.feeds;

DETACH bak;
```

---

## How to take a new backup

```bash
# From the project root — safe to run while the server is running
sqlite3 server/newsreader.db ".backup 'newsreader.backup.db'"
```

SQLite's `.backup` command uses the online backup API, so it is safe to run
against a live database without stopping the server.

---

## Verify a backup

```bash
sqlite3 newsreader.backup.db "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
sqlite3 newsreader.backup.db "SELECT COUNT(*) FROM summaries;"
sqlite3 newsreader.backup.db "PRAGMA integrity_check;"
```

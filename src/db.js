const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const config = require('./config');

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
const db = new DatabaseSync(config.dbPath);

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  created_by    INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  last_login_at INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  admin_id   INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS invites (
  token      TEXT PRIMARY KEY,
  note       TEXT,
  created_by INTEGER REFERENCES admins(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_by    INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  used_at    INTEGER
);

CREATE TABLE IF NOT EXISTS games (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  role_id    TEXT,
  sort       INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS signups (
  user_id      TEXT PRIMARY KEY,
  username     TEXT NOT NULL,
  display_name TEXT,
  avatar_url   TEXT,
  other_games  TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS signup_games (
  user_id TEXT NOT NULL REFERENCES signups(user_id) ON DELETE CASCADE,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, game_id)
);

-- Analytics. Message content is never stored, only counts.
CREATE TABLE IF NOT EXISTS members (
  user_id    TEXT PRIMARY KEY,
  username   TEXT,
  joined_at  INTEGER,
  first_seen INTEGER
);

CREATE TABLE IF NOT EXISTS channels (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS message_daily (
  day        TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  count      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, user_id, channel_id)
);
CREATE INDEX IF NOT EXISTS message_daily_user ON message_daily(user_id, day);

CREATE TABLE IF NOT EXISTS voice_daily (
  day     TEXT NOT NULL,
  user_id TEXT NOT NULL,
  seconds INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, user_id)
);
`);

const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Calendar day (YYYY-MM-DD) in the configured time zone. */
function dayKey(ms = Date.now()) {
  return dayFormat.format(new Date(ms));
}

/** Shift a YYYY-MM-DD string by whole days. */
function addDays(day, n) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

function setSetting(key, value) {
  if (value === null || value === undefined || value === '') {
    db.prepare('DELETE FROM settings WHERE key = ?').run(key);
  } else {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, String(value));
  }
}

function tx(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// Popular multiplayer / tournament games, inserted once on a fresh database.
const DEFAULT_GAMES = [
  'Counter-Strike 2',
  'League of Legends',
  'Valorant',
  'Dota 2',
  'Rocket League',
  'Fortnite',
  'Rainbow Six Siege',
  'EA Sports FC 26',
  'Overwatch 2',
  'Apex Legends',
];

if (!getSetting('games_seeded')) {
  tx(() => {
    const insert = db.prepare('INSERT INTO games (name, sort, created_at) VALUES (?, ?, ?)');
    DEFAULT_GAMES.forEach((name, i) => insert.run(name, i, Date.now()));
    setSetting('games_seeded', '1');
  });
}

module.exports = { db, dayKey, addDays, getSetting, setSetting, tx };

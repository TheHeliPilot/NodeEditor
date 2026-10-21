// Data access for games, signups and activity tracking. Shared by the bot and the panel.
const { db, dayKey, addDays, tx } = require('./db');

const MAX_GAMES = 24; // a Discord select menu holds 25 options, one is "Iné"

const games = {
  list() {
    return db.prepare(`
      SELECT g.*, (SELECT COUNT(*) FROM signup_games sg WHERE sg.game_id = g.id) AS signups
      FROM games g ORDER BY g.sort, g.id`).all();
  },
  get(id) {
    return db.prepare('SELECT * FROM games WHERE id = ?').get(id);
  },
  add(name) {
    const count = db.prepare('SELECT COUNT(*) AS n FROM games').get().n;
    if (count >= MAX_GAMES) throw new Error(`Maximálne ${MAX_GAMES} hier (limit Discord menu).`);
    const sort = db.prepare('SELECT COALESCE(MAX(sort), -1) + 1 AS s FROM games').get().s;
    db.prepare('INSERT INTO games (name, sort, created_at) VALUES (?, ?, ?)').run(name, sort, Date.now());
  },
  rename(id, name) {
    db.prepare('UPDATE games SET name = ? WHERE id = ?').run(name, id);
  },
  setRole(id, roleId) {
    db.prepare('UPDATE games SET role_id = ? WHERE id = ?').run(roleId || null, id);
  },
  remove(id) {
    db.prepare('DELETE FROM games WHERE id = ?').run(id);
  },
  move(id, direction) {
    const list = games.list();
    const i = list.findIndex(g => g.id === id);
    const j = i + (direction === 'up' ? -1 : 1);
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    tx(() => {
      const stmt = db.prepare('UPDATE games SET sort = ? WHERE id = ?');
      list.forEach((g, idx) => stmt.run(idx, g.id));
    });
  },
};

const signups = {
  get(userId) {
    const row = db.prepare('SELECT * FROM signups WHERE user_id = ?').get(userId);
    if (!row) return null;
    row.gameIds = db.prepare('SELECT game_id FROM signup_games WHERE user_id = ?').all(userId).map(r => r.game_id);
    return row;
  },

  /** Insert or replace a user's signup. Returns the previous signup (or null). */
  save({ userId, username, displayName, avatarUrl, gameIds, otherGames }) {
    const previous = signups.get(userId);
    const now = Date.now();
    tx(() => {
      db.prepare(`
        INSERT INTO signups (user_id, username, display_name, avatar_url, other_games, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          username = excluded.username, display_name = excluded.display_name,
          avatar_url = excluded.avatar_url, other_games = excluded.other_games,
          updated_at = excluded.updated_at`)
        .run(userId, username, displayName || null, avatarUrl || null, otherGames || null, now, now);
      db.prepare('DELETE FROM signup_games WHERE user_id = ?').run(userId);
      const insert = db.prepare('INSERT OR IGNORE INTO signup_games (user_id, game_id) VALUES (?, ?)');
      for (const id of gameIds) insert.run(userId, id);
    });
    return previous;
  },

  remove(userId) {
    const previous = signups.get(userId);
    db.prepare('DELETE FROM signups WHERE user_id = ?').run(userId);
    return previous;
  },

  list({ gameId, q } = {}) {
    const where = [];
    const params = [];
    if (gameId === 'other') {
      where.push("s.other_games IS NOT NULL AND s.other_games <> ''");
    } else if (gameId) {
      where.push('EXISTS (SELECT 1 FROM signup_games x WHERE x.user_id = s.user_id AND x.game_id = ?)');
      params.push(Number(gameId));
    }
    if (q) {
      where.push('(s.username LIKE ? OR s.display_name LIKE ? OR s.other_games LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const rows = db.prepare(`
      SELECT s.*, (SELECT GROUP_CONCAT(g.name, '\u001f') FROM signup_games sg JOIN games g ON g.id = sg.game_id
                   WHERE sg.user_id = s.user_id ORDER BY g.sort) AS game_names
      FROM signups s
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY s.created_at DESC`).all(...params);
    for (const r of rows) r.games = r.game_names ? r.game_names.split('\u001f') : [];
    return rows;
  },

  count() {
    return db.prepare('SELECT COUNT(*) AS n FROM signups').get().n;
  },
};

const tracking = {
  message({ userId, username, channelId, channelName, at = Date.now() }) {
    db.prepare(`
      INSERT INTO message_daily (day, user_id, channel_id, count) VALUES (?, ?, ?, 1)
      ON CONFLICT(day, user_id, channel_id) DO UPDATE SET count = count + 1`)
      .run(dayKey(at), userId, channelId);
    tracking.channel(channelId, channelName);
    tracking.seen(userId, username, at);
  },

  /** Credit voice time between two timestamps, split across calendar days. */
  voice(userId, fromMs, toMs) {
    const stmt = db.prepare(`
      INSERT INTO voice_daily (day, user_id, seconds) VALUES (?, ?, ?)
      ON CONFLICT(day, user_id) DO UPDATE SET seconds = seconds + excluded.seconds`);
    let cursor = fromMs;
    while (cursor < toMs) {
      const day = dayKey(cursor);
      let end = toMs;
      if (dayKey(toMs) !== day) {
        // Binary search for the moment the calendar day changes (handles DST).
        let lo = cursor, hi = Math.min(toMs, cursor + 26 * 3600_000);
        while (hi - lo > 1000) {
          const mid = Math.floor((lo + hi) / 2);
          if (dayKey(mid) === day) lo = mid; else hi = mid;
        }
        end = hi;
      }
      const secs = Math.round((end - cursor) / 1000);
      if (secs > 0) stmt.run(day, userId, secs);
      cursor = end;
    }
  },

  channel(id, name) {
    if (!name) return;
    db.prepare('INSERT INTO channels (id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name').run(id, name);
  },

  seen(userId, username, at = Date.now()) {
    db.prepare(`
      INSERT INTO members (user_id, username, first_seen) VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        username = COALESCE(excluded.username, members.username),
        first_seen = MIN(COALESCE(members.first_seen, excluded.first_seen), excluded.first_seen)`)
      .run(userId, username || null, at);
  },

  joined(userId, username, joinedAt) {
    db.prepare(`
      INSERT INTO members (user_id, username, joined_at) VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET username = COALESCE(excluded.username, members.username),
        joined_at = excluded.joined_at`)
      .run(userId, username || null, joinedAt);
  },
};

module.exports = { games, signups, tracking, MAX_GAMES, dayKey, addDays };

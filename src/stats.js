// Server analytics computed from the daily counters in the database.
const { db, dayKey, addDays } = require('./db');
const { games, signups } = require('./store');

// A user is "active" on a day when they sent a message or spent at least a minute in voice.
const ACTIVITY = `
  SELECT day, user_id FROM message_daily
  UNION
  SELECT day, user_id FROM voice_daily WHERE seconds >= 60`;

const RETENTION_DAYS = [1, 7, 30];
const RETENTION_COHORT_WINDOW = 90; // only users who arrived in the last 90 days

function daysBetween(start, end) {
  const out = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

function compute({ rangeDays = 30, discussionChannelId = null, memberCount = null } = {}) {
  const today = dayKey();
  const start = addDays(today, -(rangeDays - 1));
  const days = daysBetween(start, today);
  const week = addDays(today, -6);
  const one = (sql, ...p) => db.prepare(sql).get(...p);
  const all = (sql, ...p) => db.prepare(sql).all(...p);

  // Daily series
  const dauRows = all(`SELECT day, COUNT(DISTINCT user_id) AS n FROM (${ACTIVITY}) WHERE day >= ? GROUP BY day`, start);
  const msgRows = all('SELECT day, SUM(count) AS n FROM message_daily WHERE day >= ? GROUP BY day', start);
  const dauMap = new Map(dauRows.map(r => [r.day, r.n]));
  const msgMap = new Map(msgRows.map(r => [r.day, r.n]));
  const dau = days.map(day => ({ day, value: dauMap.get(day) || 0 }));
  const messages = days.map(day => ({ day, value: msgMap.get(day) || 0 }));

  const distinctActive = from => one(`SELECT COUNT(DISTINCT user_id) AS n FROM (${ACTIVITY}) WHERE day >= ?`, from).n;
  const wau = distinctActive(week);
  const rangeActive = distinctActive(start);
  const avg = arr => (arr.length ? arr.reduce((a, b) => a + b.value, 0) / arr.length : 0);
  const last7 = arr => arr.slice(-7);

  // Weekly series (last 12 weeks, Monday-less rolling 7-day buckets ending today)
  const weekly = [];
  for (let i = 11; i >= 0; i--) {
    const end = addDays(today, -7 * i);
    const from = addDays(end, -6);
    weekly.push({
      day: end,
      label: from,
      active: one(`SELECT COUNT(DISTINCT user_id) AS n FROM (${ACTIVITY}) WHERE day BETWEEN ? AND ?`, from, end).n,
      messages: one('SELECT COALESCE(SUM(count), 0) AS n FROM message_daily WHERE day BETWEEN ? AND ?', from, end).n,
    });
  }

  // Messages per channel
  const channels = all(`
    SELECT m.channel_id AS id, COALESCE(c.name, m.channel_id) AS name, SUM(m.count) AS value,
           COUNT(DISTINCT m.user_id) AS users
    FROM message_daily m LEFT JOIN channels c ON c.id = m.channel_id
    WHERE m.day >= ? GROUP BY m.channel_id ORDER BY value DESC`, start);

  // Averages
  const posters = one('SELECT COUNT(DISTINCT user_id) AS n, COALESCE(SUM(count), 0) AS total FROM message_daily WHERE day >= ?', start);
  const voice = one('SELECT COUNT(DISTINCT user_id) AS n, COALESCE(SUM(seconds), 0) AS total FROM voice_daily WHERE day >= ?', start);

  // Funnel: signed up for the gaming event -> active on the server -> posted in the discussion channel
  const signupTotal = signups.count();
  const signupActive = one(`
    SELECT COUNT(DISTINCT a.user_id) AS n FROM (${ACTIVITY}) a
    JOIN signups s ON s.user_id = a.user_id WHERE a.day >= ?`, start).n;
  let signupDiscussion = 0;
  let activeDiscussion = 0;
  if (discussionChannelId) {
    signupDiscussion = one(`
      SELECT COUNT(DISTINCT m.user_id) AS n FROM message_daily m JOIN signups s ON s.user_id = m.user_id
      WHERE m.day >= ? AND m.channel_id = ?`, start, discussionChannelId).n;
    activeDiscussion = one('SELECT COUNT(DISTINCT user_id) AS n FROM message_daily WHERE day >= ? AND channel_id = ?',
      start, discussionChannelId).n;
  }

  // Daily posters: people who posted on each of the last 7 days
  const weekPosters = all(`
    SELECT user_id, COUNT(DISTINCT day) AS d FROM message_daily WHERE day >= ? GROUP BY user_id`, week);
  const everyDay = weekPosters.filter(r => r.d >= 7).length;
  const dailyPosterRows = all('SELECT day, COUNT(DISTINCT user_id) AS n FROM message_daily WHERE day >= ? GROUP BY day', week);
  const avgDailyPosters = dailyPosterRows.reduce((a, r) => a + r.n, 0) / 7;

  // Retention
  const cohortFrom = addDays(today, -RETENTION_COHORT_WINDOW);
  const members = all('SELECT user_id, joined_at, first_seen FROM members');
  const activity = new Set(all(`SELECT user_id || '|' || day AS k FROM (${ACTIVITY}) WHERE day >= ?`, cohortFrom).map(r => r.k));
  const cohorts = members
    .map(m => ({ id: m.user_id, day: dayKey(m.joined_at ?? m.first_seen) }))
    .filter(m => m.day >= cohortFrom);
  const retention = RETENTION_DAYS.map(n => {
    const eligible = cohorts.filter(c => c.day <= addDays(today, -n));
    const kept = eligible.filter(c => activity.has(`${c.id}|${addDays(c.day, n)}`)).length;
    return { n, eligible: eligible.length, kept, pct: eligible.length ? kept / eligible.length : null };
  });
  const usesJoinDate = members.some(m => m.joined_at);

  // People per game
  const gameRows = games.list().map(g => ({ id: g.id, name: g.name, value: g.signups, roleId: g.role_id }));
  const otherCount = one("SELECT COUNT(*) AS n FROM signups WHERE other_games IS NOT NULL AND other_games <> ''").n;

  // Signups over the range (cumulative)
  const signupDays = all('SELECT created_at FROM signups').map(r => dayKey(r.created_at));
  const beforeRange = signupDays.filter(d => d < start).length;
  let running = beforeRange;
  const signupSeries = days.map(day => {
    running += signupDays.filter(d => d === day).length;
    return { day, value: running };
  });

  return {
    today, start, rangeDays, memberCount,
    dau, messages, weekly,
    kpi: {
      dauToday: dau.at(-1).value,
      dauAvg: avg(dau),
      wau,
      rangeActive,
      messagesToday: messages.at(-1).value,
      messagesWeek: last7(messages).reduce((a, b) => a + b.value, 0),
      messagesAvg: avg(messages),
      avgMessagesPerUser: posters.n ? posters.total / posters.n : 0,
      posters: posters.n,
      avgVoicePerUser: voice.n ? voice.total / voice.n : 0,
      voiceUsers: voice.n,
      voiceTotal: voice.total,
      stickiness: wau ? avg(last7(dau)) / wau : 0,
    },
    channels,
    funnel: {
      discussionChannelId,
      signupTotal, signupActive, signupDiscussion,
      rangeActive, activeDiscussion,
    },
    daily: {
      weekPosters: weekPosters.length,
      everyDay,
      pct: weekPosters.length ? everyDay / weekPosters.length : 0,
      avgDailyPosters,
      memberPct: memberCount ? avgDailyPosters / memberCount : null,
    },
    retention, usesJoinDate,
    games: gameRows, otherCount,
    signupSeries,
  };
}

module.exports = { compute };

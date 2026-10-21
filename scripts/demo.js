// Runs the admin panel against a fake Discord server with generated data.
// Useful for trying the panel and taking screenshots without a bot token.
//   npm run demo   ->  http://localhost:3000  (login: demo / demo-heslo-123)
const path = require('node:path');
const fs = require('node:fs');

process.env.DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'demo.db');
if (process.argv.includes('--fresh')) for (const ext of ['', '-wal', '-shm']) fs.rmSync(process.env.DB_PATH + ext, { force: true });

const { db, dayKey, addDays, getSetting, setSetting, tx } = require('../src/db');
const { games, tracking } = require('../src/store');
const auth = require('../src/web/auth');
const { startServer } = require('../src/web/server');

const channels = [
  ['c1', 'oznamy', 'Info'], ['c2', 'turnaj-info', 'Info'], ['c3', 'prihlasovanie', 'Info'],
  ['c4', 'všeobecné', 'Komunita'], ['c5', 'diskusie', 'Komunita'], ['c6', 'memes', 'Komunita'], ['c7', 'hudba', 'Komunita'],
  ['c8', 'cs2', 'Hry'], ['c9', 'league-of-legends', 'Hry'], ['c10', 'valorant', 'Hry'], ['c11', 'hľadám-spoluhráčov', 'Hry'],
];
const roles = [
  ['r0', 'Admin', false], ['r1', 'Moderátor', false], ['r2', 'Event Bot', false],
  ['r3', 'Hráč turnaja', true], ['r4', 'CS2', true], ['r5', 'LoL', true], ['r6', 'Valorant', true],
  ['r7', 'Dota 2', true], ['r8', 'Rocket League', true], ['r9', 'Fortnite', true], ['r10', 'Člen', true],
];

const fakeApi = {
  ready: () => true,
  serverName: () => 'Slovenská LAN Liga',
  memberCount: () => 412,
  textChannels: () => channels.map(([id, name, category]) => ({ id, name, category, canSend: id !== 'c1' })),
  roles: () => roles.map(([id, name, assignable]) => ({ id, name, color: '#99aab5', assignable, members: 0 })),
  postSignupMessage: async () => { setSetting('signup_message_id', '1290000000000000000'); setSetting('signup_message_channel_id', getSetting('signup_channel_id')); return ''; },
  applySignupRole: async () => 0,
  removeSignup: async userId => require('../src/store').signups.remove(userId),
};

// Deterministic random numbers so screenshots look the same every run.
let seed = 1438;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = arr => arr[Math.floor(rand() * arr.length)];

const first = ['Marek', 'Tomáš', 'Peter', 'Jakub', 'Lukáš', 'Martin', 'Adam', 'Samuel', 'Filip', 'Matej', 'Dominik', 'Patrik', 'Michal', 'Erik', 'Simona', 'Lucia', 'Natália', 'Kristína', 'Veronika', 'Daniel', 'Oliver', 'Šimon', 'Richard', 'Viktor', 'Andrej', 'Zuzana', 'Barbora', 'Ondrej', 'Juraj', 'Róbert'];
const handles = ['shadow', 'kubo', 'ghost', 'frag', 'nova', 'tatra', 'blesk', 'vlk', 'orol', 'pixel', 'rush', 'ace', 'clutch', 'noob', 'hrdina', 'medved', 'byte', 'lynx', 'storm', 'raptor', 'zenit', 'kobra', 'bocian', 'dunaj'];

function seedData() {
  if (db.prepare('SELECT COUNT(*) AS n FROM members').get().n > 0) return;
  const now = Date.now();
  const today = dayKey(now);
  const gameList = games.list();
  const chanWeights = { c4: 30, c5: 14, c6: 12, c7: 3, c8: 14, c9: 10, c10: 8, c11: 7, c2: 2 };
  const chanIds = Object.entries(chanWeights).flatMap(([id, w]) => Array(w).fill(id));
  tx(() => {
    for (const [id, name] of channels) tracking.channel(id, name);
    const msg = db.prepare(`INSERT INTO message_daily (day, user_id, channel_id, count) VALUES (?, ?, ?, ?)
      ON CONFLICT(day, user_id, channel_id) DO UPDATE SET count = count + excluded.count`);
    const voice = db.prepare(`INSERT INTO voice_daily (day, user_id, seconds) VALUES (?, ?, ?)
      ON CONFLICT(day, user_id) DO UPDATE SET seconds = seconds + excluded.seconds`);
    const signup = db.prepare(`INSERT INTO signups (user_id, username, display_name, avatar_url, other_games, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?, ?)`);
    const sg = db.prepare('INSERT OR IGNORE INTO signup_games (user_id, game_id) VALUES (?, ?)');

    for (let u = 0; u < 260; u++) {
      const id = String(400000000000000000n + BigInt(u * 7919));
      const name = pick(first);
      const username = `${pick(handles)}${rand() < 0.5 ? Math.floor(rand() * 99) : ''}_${name.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}`.slice(0, 24);
      // Newer members joined more recently; server grows toward the event.
      const joinedDaysAgo = Math.floor(Math.pow(rand(), 1.4) * 150);
      const joined = now - joinedDaysAgo * 86400_000 - Math.floor(rand() * 86400_000);
      tracking.joined(id, username, joined);
      const engagement = Math.pow(rand(), 2.2); // most people are quiet, a few are very active
      const fade = 0.85 + rand() * 0.14;
      const lovesDiscussion = rand() < 0.35;
      const joinedDay = dayKey(joined);
      for (let d = joinedDay; d <= today; d = addDays(d, 1)) {
        const age = (Date.parse(d) - Date.parse(joinedDay)) / 86400_000;
        const weekend = [0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay());
        const eventBuzz = d >= addDays(today, -14) ? 1.25 : 1;
        const p = Math.min(0.97, (0.08 + engagement * 0.9) * (age < 2 ? 1.6 : Math.max(0.25, Math.pow(fade, age / 7))) * (weekend ? 1.2 : 1) * eventBuzz);
        if (rand() > p) continue;
        const total = 1 + Math.floor(rand() * (2 + engagement * 28));
        for (let i = 0; i < total; i++) {
          let ch = pick(chanIds);
          if (ch === 'c5' && !lovesDiscussion && rand() < 0.8) ch = 'c4';
          msg.run(d, id, ch, 1);
        }
        if (rand() < 0.3 + engagement * 0.4) voice.run(d, id, Math.floor(600 + rand() * (1800 + engagement * 12000)));
      }
      // Roughly 40 % signed up for the event, mostly in the last three weeks.
      if (rand() < 0.22 + engagement * 0.55) {
        const at = now - Math.floor(Math.pow(rand(), 0.7) * 21 * 86400_000);
        const display = rand() < 0.6 ? `${name}${rand() < 0.3 ? ' ' + pick(['K.', 'M.', 'B.', 'S.']) : ''}` : null;
        const other = rand() < 0.14 ? pick(['Minecraft', 'World of Tanks', 'Brawl Stars', 'Tekken 8', 'StarCraft II', 'Chess.com', 'Hearthstone']) : null;
        signup.run(id, username, display, other, at, at);
        if (lovesDiscussion && rand() < 0.5) msg.run(today, id, 'c5', 1 + Math.floor(rand() * 4));
        const weights = [0.5, 0.42, 0.33, 0.14, 0.2, 0.16, 0.12, 0.13, 0.09, 0.06];
        let any = false;
        gameList.forEach((g, i) => { if (rand() < (weights[i] ?? 0.05)) { sg.run(id, g.id); any = true; } });
        if (!any && !other) sg.run(id, gameList[0].id);
      }
    }
    // Game roles and settings
    const roleFor = { 'Counter-Strike 2': 'r4', 'League of Legends': 'r5', Valorant: 'r6', 'Dota 2': 'r7', 'Rocket League': 'r8', Fortnite: 'r9' };
    for (const g of gameList) if (roleFor[g.name]) games.setRole(g.id, roleFor[g.name]);
    setSetting('signup_channel_id', 'c3');
    setSetting('signup_role_id', 'r3');
    setSetting('discussion_channel_id', 'c5');
    setSetting('signup_text', 'Prihlasovanie na Slovenskú LAN Ligu 2026 je otvorené! Turnaj je 15. – 16. novembra v Bratislave.');
    setSetting('signup_message_id', '1290000000000000000');
    setSetting('signup_message_channel_id', 'c3');
  });

  if (auth.adminCount() === 0) {
    const a = auth.createAdmin('demo', 'demo-heslo-123');
    const b = auth.createAdmin('marek', 'demo-heslo-123', a);
    auth.createAdmin('lucia_k', 'demo-heslo-123', a);
    db.prepare('UPDATE admins SET created_at = ?, last_login_at = ? WHERE id = ?').run(now - 40 * 86400_000, now - 3600_000, a);
    db.prepare('UPDATE admins SET created_at = ?, last_login_at = ? WHERE id = ?').run(now - 33 * 86400_000, now - 2 * 86400_000, b);
    auth.createInvite(a, 'Ondrej (stream)');
    setSetting('setup_token', null);
  }
}

seedData();
startServer(fakeApi).then(() => console.log('Demo login: demo / demo-heslo-123'));

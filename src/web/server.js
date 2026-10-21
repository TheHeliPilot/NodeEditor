const path = require('node:path');
const express = require('express');
const config = require('../config');
const { db, getSetting, setSetting } = require('../db');
const { games, signups, MAX_GAMES } = require('../store');
const stats = require('../stats');
const auth = require('./auth');
const charts = require('./charts');

const RANGES = [7, 30, 90];

function createServer(api) {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.set('trust proxy', 'loopback');
  app.disable('x-powered-by');

  app.use('/static', express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
  app.use('/fonts', express.static(path.join(__dirname, '..', '..', 'node_modules', '@fontsource'), { maxAge: '30d' }));
  app.use(express.urlencoded({ extended: false, limit: '20kb' }));
  // Express 5 leaves req.body undefined for posts without fields.
  app.use((req, res, next) => { req.body ??= {}; next(); });

  app.use((req, res, next) => {
    res.set('X-Frame-Options', 'DENY');
    res.set('Referrer-Policy', 'same-origin');
    // Cookies are SameSite=Lax; on top of that reject cross-site form posts.
    if (req.method === 'POST') {
      const origin = req.get('origin') || req.get('referer');
      if (origin && new URL(origin).host !== req.get('host')) return res.status(403).send('Cross-site request blocked');
    }
    const cookies = auth.parseCookies(req.get('cookie'));
    req.sessionToken = cookies[auth.COOKIE];
    req.admin = auth.sessionAdmin(req.sessionToken);
    res.locals.admin = req.admin;
    res.locals.path = req.path;
    res.locals.serverName = api.serverName();
    res.locals.botReady = api.ready();
    res.locals.flash = takeFlash(req);
    next();
  });

  const secure = config.publicUrl.startsWith('https://');
  const setSession = (res, t) => res.set('Set-Cookie', auth.sessionCookie(t, secure));

  // ------------------------------------------------------------ public routes

  app.get('/login', (req, res) => {
    if (req.admin) return res.redirect('/');
    res.render('login', { error: null, username: '', needsSetup: auth.adminCount() === 0 });
  });

  app.post('/login', (req, res) => {
    const t = auth.login(String(req.body.username || '').trim(), String(req.body.password || ''));
    if (!t) {
      return res.status(401).render('login', { error: 'Nesprávne meno alebo heslo.', username: req.body.username || '', needsSetup: false });
    }
    setSession(res, t);
    res.redirect('/');
  });

  app.post('/logout', (req, res) => {
    if (req.sessionToken) auth.endSession(req.sessionToken);
    res.set('Set-Cookie', auth.sessionCookie('', secure, 0));
    res.redirect('/login');
  });

  function accountForm(res, view, extra) {
    res.render('account', { error: null, username: '', ...extra, view });
  }

  function validateAccount(body) {
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    if (!/^[\p{L}\p{N}._-]{3,32}$/u.test(username)) return { error: 'Meno: 3–32 znakov, písmená, čísla, bodka, pomlčka.' };
    if (password.length < 10) return { error: 'Heslo musí mať aspoň 10 znakov.' };
    if (password !== String(body.password2 || '')) return { error: 'Heslá sa nezhodujú.' };
    if (db.prepare('SELECT 1 FROM admins WHERE username = ?').get(username)) return { error: 'Toto meno už existuje.' };
    return { username, password };
  }

  app.get('/setup/:token', (req, res) => {
    if (req.params.token !== auth.setupToken()) return res.status(404).render('message', { title: 'Odkaz neplatí', text: 'Prvý admin už existuje alebo je odkaz nesprávny.' });
    accountForm(res, 'setup', { title: 'Prvý admin', lead: 'Vytvor si účet. Ďalších adminov potom pozveš cez prihlasovacie odkazy.' });
  });

  app.post('/setup/:token', (req, res) => {
    if (req.params.token !== auth.setupToken()) return res.status(404).render('message', { title: 'Odkaz neplatí', text: 'Prvý admin už existuje.' });
    const v = validateAccount(req.body);
    if (v.error) return accountForm(res.status(400), 'setup', { title: 'Prvý admin', lead: '', error: v.error, username: req.body.username });
    const id = auth.createAdmin(v.username, v.password);
    setSetting('setup_token', null);
    setSession(res, auth.startSession(id));
    res.redirect('/settings');
  });

  app.get('/invite/:token', (req, res) => {
    const invite = auth.validInvite(req.params.token);
    if (!invite) return res.status(404).render('message', { title: 'Odkaz neplatí', text: 'Prihlasovací odkaz už bol použitý alebo vypršal. Popros admina o nový.' });
    const by = db.prepare('SELECT username FROM admins WHERE id = ?').get(invite.created_by);
    accountForm(res, 'invite', { title: 'Pozvánka do panelu', lead: `${by ? by.username : 'Admin'} ťa pozval ako admina. Vyber si meno a heslo.` });
  });

  app.post('/invite/:token', (req, res) => {
    const invite = auth.validInvite(req.params.token);
    if (!invite) return res.status(404).render('message', { title: 'Odkaz neplatí', text: 'Prihlasovací odkaz už bol použitý alebo vypršal.' });
    const v = validateAccount(req.body);
    if (v.error) return accountForm(res.status(400), 'invite', { title: 'Pozvánka do panelu', lead: '', error: v.error, username: req.body.username });
    const id = auth.createAdmin(v.username, v.password, invite.created_by);
    auth.useInvite(invite.token, id);
    setSession(res, auth.startSession(id));
    res.redirect('/');
  });

  // ------------------------------------------------------------ admin routes

  app.use((req, res, next) => (req.admin ? next() : res.redirect('/login')));

  app.get('/', (req, res) => {
    const range = RANGES.includes(Number(req.query.range)) ? Number(req.query.range) : 30;
    const discussionChannelId = getSetting('discussion_channel_id');
    const s = stats.compute({ rangeDays: range, discussionChannelId, memberCount: api.memberCount() });
    const discussionName = discussionChannelId
      ? (api.textChannels().find(c => c.id === discussionChannelId)?.name
        || db.prepare('SELECT name FROM channels WHERE id = ?').get(discussionChannelId)?.name || 'diskusie')
      : null;
    res.render('stats', { s, range, ranges: RANGES, charts, discussionName });
  });

  app.get('/signups', (req, res) => {
    const filter = { gameId: req.query.game || '', q: String(req.query.q || '').trim() };
    res.render('signups', { rows: signups.list(filter), filter, games: games.list(), total: signups.count() });
  });

  app.get('/signups.csv', (req, res) => {
    const rows = signups.list({ gameId: req.query.game || '', q: String(req.query.q || '').trim() });
    const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['discord_id', 'username', 'display_name', 'games', 'other_games', 'signed_up'].join(',')];
    for (const r of rows) {
      lines.push([r.user_id, r.username, r.display_name, r.games.join('; '), r.other_games, new Date(r.created_at).toISOString()].map(cell).join(','));
    }
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="prihlasky.csv"');
    res.send('﻿' + lines.join('\r\n'));
  });

  app.post('/signups/:userId/remove', async (req, res) => {
    await api.removeSignup(req.params.userId);
    flash(req, 'Prihláška odstránená.');
    const back = String(req.body.back || '');
    res.redirect(back.startsWith('/signups') ? back : '/signups');
  });

  app.get('/games', (req, res) => {
    res.render('games', { list: games.list(), roles: api.roles(), max: MAX_GAMES });
  });

  app.post('/games', (req, res) => {
    const name = String(req.body.name || '').trim().slice(0, 80);
    if (name) {
      try { games.add(name); flash(req, `Pridané: ${name}`); } catch (err) { flash(req, err.message, 'error'); }
    }
    res.redirect('/games');
  });

  app.post('/games/:id', (req, res) => {
    const id = Number(req.params.id);
    const name = String(req.body.name || '').trim().slice(0, 80);
    if (name) games.rename(id, name);
    games.setRole(id, req.body.role_id);
    flash(req, 'Uložené.');
    res.redirect('/games');
  });

  app.post('/games/:id/move', (req, res) => {
    games.move(Number(req.params.id), req.body.dir === 'up' ? 'up' : 'down');
    res.redirect('/games');
  });

  app.post('/games/:id/delete', (req, res) => {
    const g = games.get(Number(req.params.id));
    if (g) { games.remove(g.id); flash(req, `Odstránené: ${g.name}`); }
    res.redirect('/games');
  });

  app.get('/settings', (req, res) => {
    res.render('settings', {
      channels: api.textChannels(),
      roles: api.roles(),
      settings: {
        signupChannel: getSetting('signup_channel_id'),
        signupText: getSetting('signup_text', ''),
        signupRole: getSetting('signup_role_id'),
        discussionChannel: getSetting('discussion_channel_id'),
        messageId: getSetting('signup_message_id'),
        messageChannel: getSetting('signup_message_channel_id'),
      },
      guildId: config.guildId,
    });
  });

  app.post('/settings', (req, res) => {
    setSetting('signup_channel_id', req.body.signup_channel_id);
    setSetting('signup_text', String(req.body.signup_text || '').slice(0, 1800));
    setSetting('signup_role_id', req.body.signup_role_id);
    setSetting('discussion_channel_id', req.body.discussion_channel_id);
    flash(req, 'Nastavenia uložené.');
    res.redirect('/settings');
  });

  app.post('/settings/post', async (req, res) => {
    const channelId = getSetting('signup_channel_id');
    if (!channelId) {
      flash(req, 'Najprv vyber kanál a ulož nastavenia.', 'error');
    } else {
      try {
        await api.postSignupMessage(channelId, getSetting('signup_text', ''));
        flash(req, 'Správa s prihlásením odoslaná.');
      } catch (err) {
        flash(req, `Nepodarilo sa odoslať: ${err.message}`, 'error');
      }
    }
    res.redirect('/settings');
  });

  app.post('/settings/apply-role', async (req, res) => {
    const n = await api.applySignupRole();
    flash(req, `Rola pridaná ${n} ľuďom.`);
    res.redirect('/settings');
  });

  app.get('/admins', (req, res) => {
    const admins = db.prepare(`
      SELECT a.id, a.username, a.created_at, a.last_login_at, b.username AS created_by_name
      FROM admins a LEFT JOIN admins b ON b.id = a.created_by ORDER BY a.created_at`).all();
    const invites = db.prepare(`
      SELECT i.*, a.username AS created_by_name FROM invites i LEFT JOIN admins a ON a.id = i.created_by
      WHERE i.used_at IS NULL AND i.expires_at > ? ORDER BY i.created_at DESC`).all(Date.now());
    res.render('admins', { admins, invites, publicUrl: config.publicUrl, newInvite: req.query.new || null, hours: auth.INVITE_HOURS });
  });

  app.post('/admins/invites', (req, res) => {
    const t = auth.createInvite(req.admin.id, String(req.body.note || '').trim().slice(0, 60));
    res.redirect(`/admins?new=${t}`);
  });

  app.post('/admins/invites/:token/revoke', (req, res) => {
    db.prepare('DELETE FROM invites WHERE token = ? AND used_at IS NULL').run(req.params.token);
    flash(req, 'Odkaz zrušený.');
    res.redirect('/admins');
  });

  app.post('/admins/:id/delete', (req, res) => {
    const id = Number(req.params.id);
    if (id === req.admin.id) flash(req, 'Seba odstrániť nemôžeš.', 'error');
    else { db.prepare('DELETE FROM admins WHERE id = ?').run(id); flash(req, 'Admin odstránený.'); }
    res.redirect('/admins');
  });

  app.use((req, res) => res.status(404).render('message', { title: 'Nenájdené', text: 'Táto stránka neexistuje.' }));

  app.use((err, req, res, _next) => {
    console.error(err);
    res.status(500).render('message', { title: 'Chyba', text: 'Niečo sa pokazilo. Pozri log servera.' });
  });

  return app;
}

// Flash messages survive exactly one redirect, keyed by session.
const flashes = new Map();
function flash(req, text, kind = 'ok') {
  flashes.set(req.sessionToken, { text, kind });
}
function takeFlash(req) {
  const f = flashes.get(req.sessionToken);
  flashes.delete(req.sessionToken);
  return f || null;
}

function startServer(api) {
  const app = createServer(api);
  return new Promise(resolve => {
    const server = app.listen(config.port, () => {
      console.log(`Admin panel: ${config.publicUrl}`);
      const t = auth.setupToken();
      if (t) console.log(`\n  Žiadny admin zatiaľ neexistuje. Vytvor prvého tu:\n  ${config.publicUrl}/setup/${t}\n`);
      resolve(server);
    });
  });
}

module.exports = { startServer, createServer };

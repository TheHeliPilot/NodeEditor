const crypto = require('node:crypto');
const { db, getSetting, setSetting } = require('../db');

const SESSION_DAYS = 30;
const INVITE_HOURS = 48;
const COOKIE = 'panel_session';

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [, saltHex, hashHex] = stored.split('$');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

const token = () => crypto.randomBytes(24).toString('base64url');

function adminCount() {
  return db.prepare('SELECT COUNT(*) AS n FROM admins').get().n;
}

/** One-time token that lets the very first admin create their account. */
function setupToken() {
  if (adminCount() > 0) return null;
  let t = getSetting('setup_token');
  if (!t) {
    t = token();
    setSetting('setup_token', t);
  }
  return t;
}

function createAdmin(username, password, createdBy = null) {
  const info = db.prepare('INSERT INTO admins (username, password_hash, created_at, created_by) VALUES (?, ?, ?, ?)')
    .run(username, hashPassword(password), Date.now(), createdBy);
  return Number(info.lastInsertRowid);
}

function login(username, password) {
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  // Run scrypt even for unknown users so response time doesn't reveal which names exist.
  const ok = admin ? verifyPassword(password, admin.password_hash) : (hashPassword(password), false);
  if (!ok) return null;
  db.prepare('UPDATE admins SET last_login_at = ? WHERE id = ?').run(Date.now(), admin.id);
  return startSession(admin.id);
}

function startSession(adminId) {
  const t = token();
  db.prepare('INSERT INTO sessions (token, admin_id, expires_at) VALUES (?, ?, ?)')
    .run(t, adminId, Date.now() + SESSION_DAYS * 86400_000);
  return t;
}

function sessionAdmin(t) {
  if (!t) return null;
  return db.prepare(`
    SELECT a.id, a.username FROM sessions s JOIN admins a ON a.id = s.admin_id
    WHERE s.token = ? AND s.expires_at > ?`).get(t, Date.now()) || null;
}

function endSession(t) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(t);
}

function createInvite(adminId, note) {
  const t = token();
  db.prepare('INSERT INTO invites (token, note, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run(t, note || null, adminId, Date.now(), Date.now() + INVITE_HOURS * 3600_000);
  return t;
}

function validInvite(t) {
  return db.prepare('SELECT * FROM invites WHERE token = ? AND used_at IS NULL AND expires_at > ?').get(t, Date.now()) || null;
}

function useInvite(t, adminId) {
  db.prepare('UPDATE invites SET used_by = ?, used_at = ? WHERE token = ?').run(adminId, Date.now(), t);
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function sessionCookie(value, secure, maxAgeSec = SESSION_DAYS * 86400) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure ? '; Secure' : ''}`;
}

module.exports = {
  COOKIE, INVITE_HOURS,
  adminCount, setupToken, createAdmin, login, startSession, sessionAdmin, endSession,
  createInvite, validInvite, useInvite, parseCookies, sessionCookie,
};

const http = require('http');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const { LoginRateLimiter, clientAddress } = require('./loginRateLimiter.cjs');

const port = Number(process.env.PORT || 3002);
const db = new sqlite3.Database(process.env.DB_PATH || '/var/www/barsik-backend/data/barsik.db');
const loginRateLimiter = new LoginRateLimiter();
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS barsik_accounts (
    id TEXT PRIMARY KEY, nick TEXT NOT NULL, nick_key TEXT NOT NULL UNIQUE,
    pin_hash TEXT NOT NULL, gender TEXT NOT NULL, lang TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS barsik_account_sessions (
    token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES barsik_accounts(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS barsik_account_progress (
    account_id TEXT PRIMARY KEY REFERENCES barsik_accounts(id) ON DELETE CASCADE,
    payload TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
});

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const token = () => crypto.randomBytes(32).toString('base64url');
const normalizeNick = (value) => String(value || '').trim().toLocaleLowerCase('ru-RU').replace(/\s+/g, '_');
const validNick = (value) => /^[\p{L}\p{N}_ -]{2,16}$/u.test(value);
const json = (res, status, value, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(value));
};
const cookie = (value) => `barsik_account=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
const clearCookie = 'barsik_account=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';

function pinHash(pin, salt = crypto.randomBytes(16).toString('hex')) {
  return new Promise((resolve, reject) => crypto.scrypt(pin, salt, 64, (error, derived) =>
    error ? reject(error) : resolve(`${salt}:${derived.toString('hex')}`)));
}
async function pinMatches(pin, stored) {
  const [salt, expectedHex] = String(stored).split(':');
  if (!salt || !expectedHex) return false;
  const actual = await pinHash(pin, salt);
  const expected = Buffer.from(`${salt}:${expectedHex}`);
  const received = Buffer.from(actual);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; if (raw.length > 256000) req.destroy(new Error('body_too_large')); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('invalid_json')); } });
    req.on('error', reject);
  });
}
function getCookie(req) {
  const found = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('barsik_account='));
  return found ? decodeURIComponent(found.slice('barsik_account='.length)) : null;
}
function accountRow(id, callback) {
  db.get('SELECT id, nick, gender, lang, created_at FROM barsik_accounts WHERE id = ?', [id], callback);
}
function publicAccount(row) {
  return { id: row.id, nick: row.nick, gender: row.gender, lang: row.lang, createdAt: row.created_at };
}
function withAccount(req, callback) {
  const raw = getCookie(req);
  if (!raw) return callback(null);
  db.get('SELECT account_id FROM barsik_account_sessions WHERE token_hash = ? AND expires_at > ?', [hash(raw), Date.now()], (error, session) => {
    if (error || !session) return callback(null);
    accountRow(session.account_id, (accountError, account) => callback(accountError ? null : account));
  });
}
function storedProgress(accountId, callback) {
  db.get('SELECT payload FROM barsik_account_progress WHERE account_id = ?', [accountId], (error, row) => {
    if (error || !row) return callback(error, null);
    try { callback(null, JSON.parse(row.payload)); } catch { callback(null, null); }
  });
}
function createSession(accountId, callback) {
  const raw = token();
  db.run('INSERT INTO barsik_account_sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)', [hash(raw), accountId, Date.now() + 30 * 86400000], (error) => callback(error, raw));
}

async function route(req, res) {
  const path = new URL(req.url, 'http://localhost').pathname;
  try {
    if (req.method === 'POST' && path === '/api/auth/register') {
      const input = await readBody(req);
      const nick = String(input.nick || '').trim();
      const nickKey = normalizeNick(nick);
      const pin = String(input.pin || '');
      if (!validNick(nick)) return json(res, 400, { error: 'invalid_nick' });
      if (!/^\d{4,8}$/.test(pin)) return json(res, 400, { error: 'invalid_pin' });
      if (!['boy', 'girl'].includes(input.gender) || !['ru', 'kk'].includes(input.lang)) return json(res, 400, { error: 'invalid_profile' });
      db.get('SELECT id FROM barsik_accounts WHERE nick_key = ?', [nickKey], async (lookupError, existing) => {
        if (lookupError) return json(res, 500, { error: 'database_error' });
        if (existing) return json(res, 409, { error: 'nick_taken' });
        const id = `account_${crypto.randomBytes(12).toString('hex')}`;
        const stored = await pinHash(pin);
        db.run('INSERT INTO barsik_accounts (id, nick, nick_key, pin_hash, gender, lang) VALUES (?, ?, ?, ?, ?, ?)', [id, nick, nickKey, stored, input.gender, input.lang], (error) => {
          if (error) return json(res, 500, { error: 'database_error' });
          createSession(id, (sessionError, session) => {
            if (sessionError) return json(res, 500, { error: 'session_error' });
            accountRow(id, (_accountError, account) => json(res, 201, { user: publicAccount(account), progress: null }, { 'Set-Cookie': cookie(session) }));
          });
        });
      });
      return;
    }
    if (req.method === 'POST' && path === '/api/auth/login') {
      const input = await readBody(req);
      const ip = clientAddress(req);
      if (loginRateLimiter.isBlocked(ip)) return json(res, 429, { error: 'too_many_attempts' });
      db.get('SELECT * FROM barsik_accounts WHERE nick_key = ?', [normalizeNick(input.nick)], async (error, account) => {
        if (error || !account || !(await pinMatches(String(input.pin || ''), account.pin_hash))) {
          loginRateLimiter.recordFailure(ip);
          return json(res, 401, { error: 'invalid_credentials' });
        }
        loginRateLimiter.recordSuccess(ip);
        createSession(account.id, (sessionError, session) => {
          if (sessionError) return json(res, 500, { error: 'session_error' });
          storedProgress(account.id, (_progressError, progress) => json(res, 200, { user: publicAccount(account), progress }, { 'Set-Cookie': cookie(session) }));
        });
      });
      return;
    }
    if (req.method === 'POST' && path === '/api/auth/logout') {
      const raw = getCookie(req);
      if (raw) db.run('DELETE FROM barsik_account_sessions WHERE token_hash = ?', [hash(raw)]);
      return json(res, 200, { ok: true }, { 'Set-Cookie': clearCookie });
    }
    withAccount(req, async (account) => {
      if (!account && req.method === 'GET' && path === '/api/auth/me') {
        return json(res, 200, { user: null, progress: null });
      }
      if (!account) return json(res, 401, { error: 'unauthorized' });
      if (req.method === 'GET' && path === '/api/auth/me') {
        return storedProgress(account.id, (_error, progress) => json(res, 200, { user: publicAccount(account), progress }));
      }
      if (req.method === 'GET' && path === '/api/progress') {
        return storedProgress(account.id, (_error, progress) => json(res, 200, { progress }));
      }
      if (req.method === 'PUT' && path === '/api/progress') {
        const progress = await readBody(req);
        if (!progress || typeof progress !== 'object' || Array.isArray(progress)) return json(res, 400, { error: 'invalid_progress' });
        const payload = JSON.stringify(progress);
        db.run(`INSERT INTO barsik_account_progress (account_id, payload, version) VALUES (?, ?, 1)
          ON CONFLICT(account_id) DO UPDATE SET payload = excluded.payload, version = barsik_account_progress.version + 1, updated_at = datetime('now')`, [account.id, payload], (error) => {
          if (error) return json(res, 500, { error: 'database_error' });
          return json(res, 200, { ok: true });
        });
        return;
      }
      return json(res, 404, { error: 'not_found' });
    });
  } catch (error) {
    console.error('[account-api]', error);
    json(res, 400, { error: 'bad_request' });
  }
}

http.createServer((req, res) => { void route(req, res); }).listen(port, '127.0.0.1', () => console.log(`[account-api] listening on ${port}`));

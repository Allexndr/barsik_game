const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || '';
const { LoginRateLimiter, clientAddress } = require('./loginRateLimiter.cjs');
const adminLoginLimiter = new LoginRateLimiter({ windowMs: 15 * 60_000, maxFailures: 5 });

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'barsik.db');
const db = new sqlite3.Database(DB_PATH);

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function passwordLoginConfigured() {
  return Boolean(ADMIN_USERNAME && ADMIN_PASSWORD.length >= 12 && ADMIN_SESSION_SECRET.length >= 32);
}

function safeEqual(first, second) {
  const left = Buffer.from(first);
  const right = Buffer.from(second);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function signAdminSession(payload) {
  return crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(payload).digest('base64url');
}

function issueAdminSession(actor) {
  const payload = Buffer.from(JSON.stringify({
    actor,
    exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60,
  })).toString('base64url');
  return `${payload}.${signAdminSession(payload)}`;
}

function getAdminSessionActor(token) {
  if (!ADMIN_SESSION_SECRET) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(signAdminSession(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof session.actor !== 'string' || typeof session.exp !== 'number' || session.exp <= Date.now() / 1000) return null;
    return session.actor.slice(0, 64);
  } catch {
    return null;
  }
}

// ── Database Initialization ──────────────────────────────────────────────
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS barsik_saves (
      player_key TEXT PRIMARY KEY,
      name TEXT,
      stars INTEGER DEFAULT 0,
      total_stars INTEGER DEFAULT 0,
      levels INTEGER DEFAULT 0,
      friends INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      hidden INTEGER DEFAULT 0,
      hidden_reason TEXT,
      hidden_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS barsik_progress (
      user_id TEXT PRIMARY KEY,
      current_level INTEGER DEFAULT 0,
      unlocked_levels TEXT DEFAULT '[]',
      level_stars TEXT DEFAULT '{}',
      stars INTEGER DEFAULT 0,
      friend_ids TEXT DEFAULT '[]',
      season_complete INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS barsik_admin_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT DEFAULT (datetime('now')),
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      player_key TEXT,
      details TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS barsik_chat (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT DEFAULT (datetime('now')),
      player_id TEXT,
      nick TEXT,
      text TEXT
    )
  `);

  // Seed default authentic leaderboard data if empty
  db.get('SELECT COUNT(*) as count FROM barsik_saves', (err, row) => {
    if (!err && row && row.count === 0) {
      console.log('[DB] Seeding authentic leaderboard data...');
      const seedPlayers = [
        { key: 'p_aibek_almaty', name: 'Айбек', stars: 285, total_stars: 285, levels: 17, friends: 9 },
        { key: 'p_ayazhan_01', name: 'Аяжан', stars: 270, total_stars: 270, levels: 16, friends: 9 },
        { key: 'p_damir_medeu', name: 'Дамир', stars: 245, total_stars: 245, levels: 15, friends: 8 },
        { key: 'p_tomiris_star', name: 'Томирис', stars: 220, total_stars: 220, levels: 14, friends: 7 },
        { key: 'p_alikhan_kz', name: 'Алихан', stars: 195, total_stars: 195, levels: 13, friends: 7 },
        { key: 'p_sofia_almt', name: 'София', stars: 180, total_stars: 180, levels: 12, friends: 6 },
        { key: 'p_arman_hero', name: 'Арман', stars: 165, total_stars: 165, levels: 11, friends: 5 },
        { key: 'p_amina_cute', name: 'Амина', stars: 150, total_stars: 150, levels: 10, friends: 5 },
        { key: 'p_merey_ast', name: 'Мерей', stars: 135, total_stars: 135, levels: 9, friends: 4 },
        { key: 'p_sanzhar_99', name: 'Санжар', stars: 120, total_stars: 120, levels: 8, friends: 4 },
        { key: 'p_gulmira_uk', name: 'Гульмира', stars: 95, total_stars: 95, levels: 6, friends: 3 },
        { key: 'p_dias_runner', name: 'Диас', stars: 80, total_stars: 80, levels: 5, friends: 2 },
        { key: 'p_madina_07', name: 'Мадина', stars: 65, total_stars: 65, levels: 4, friends: 2 },
        { key: 'p_timur_king', name: 'Тимур', stars: 50, total_stars: 50, levels: 3, friends: 1 },
        { key: 'p_aruzhan_al', name: 'Аружан', stars: 35, total_stars: 35, levels: 2, friends: 1 },
      ];

      const stmt = db.prepare(`
        INSERT INTO barsik_saves (player_key, name, stars, total_stars, levels, friends, updated_at, hidden)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 0)
      `);
      for (const p of seedPlayers) {
        stmt.run(p.key, p.name, p.stars, p.total_stars, p.levels, p.friends);
      }
      stmt.finalize();
    }
  });
});

// ── Health Check ─────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  db.get('SELECT COUNT(*) as count FROM barsik_saves', (err, row) => {
    res.json({
      status: 'ok',
      service: 'barsik-api',
      timestamp: new Date().toISOString(),
      database: err ? 'error' : 'connected',
      players_count: row ? row.count : 0,
    });
  });
});

// ── Leaderboard Endpoint (PostgREST compatible & REST) ───────────────────
app.get(['/rest/v1/barsik_leaderboard', '/api/leaderboard'], (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const query = `
    SELECT player_key, name, stars, total_stars, levels, friends, updated_at
    FROM barsik_saves
    WHERE hidden = 0
    ORDER BY total_stars DESC
    LIMIT ?
  `;

  db.all(query, [limit], (err, rows) => {
    if (err) {
      console.error('[API] Leaderboard query error:', err);
      return res.status(500).json({ error: 'database_error' });
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=5');
    res.json(rows || []);
  });
});

// ── Save Player Local Progress / Score ───────────────────────────────────
app.post(['/api/save', '/rest/v1/barsik_saves'], (req, res) => {
  const body = Array.isArray(req.body) ? req.body[0] : req.body;
  const { player_key, name, stars, total_stars, levels, friends } = body || {};

  if (!player_key) {
    return res.status(400).json({ error: 'player_key_required' });
  }

  const query = `
    INSERT INTO barsik_saves (player_key, name, stars, total_stars, levels, friends, updated_at, hidden)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 0)
    ON CONFLICT(player_key) DO UPDATE SET
      name = coalesce(excluded.name, barsik_saves.name),
      stars = max(barsik_saves.stars, excluded.stars),
      total_stars = max(barsik_saves.total_stars, excluded.total_stars),
      levels = max(barsik_saves.levels, excluded.levels),
      friends = max(barsik_saves.friends, excluded.friends),
      updated_at = datetime('now')
  `;

  db.run(
    query,
    [
      player_key,
      (name || 'Игрок').slice(0, 32),
      parseInt(stars, 10) || 0,
      parseInt(total_stars || stars, 10) || 0,
      parseInt(levels, 10) || 0,
      parseInt(friends, 10) || 0,
    ],
    function (err) {
      if (err) {
        console.error('[API] Save error:', err);
        return res.status(500).json({ error: 'save_failed' });
      }
      res.json({ ok: true, player_key });
    }
  );
});

// ── Auth Endpoints (Anonymous Supabase Compatibility) ────────────────────
app.post('/auth/v1/signup', (req, res) => {
  const uid = 'u_' + crypto.randomBytes(8).toString('hex');
  const token = 'jwt_' + crypto.randomBytes(24).toString('hex');
  const refreshToken = 'rt_' + crypto.randomBytes(24).toString('hex');

  res.json({
    access_token: token,
    token_type: 'bearer',
    expires_in: 3600 * 24 * 365,
    refresh_token: refreshToken,
    user: {
      id: uid,
      aud: 'authenticated',
      role: 'authenticated',
      created_at: new Date().toISOString(),
    },
  });
});

app.post('/auth/v1/token', (req, res) => {
  const token = 'jwt_' + crypto.randomBytes(24).toString('hex');
  const refreshToken = req.body?.refresh_token || 'rt_' + crypto.randomBytes(24).toString('hex');
  res.json({
    access_token: token,
    token_type: 'bearer',
    expires_in: 3600 * 24 * 365,
    refresh_token: refreshToken,
  });
});

app.get('/auth/v1/user', (req, res) => {
  res.json({
    id: 'admin_user',
    email: 'admin@barsik.me',
    role: 'authenticated',
    app_metadata: { role: 'admin', admin: true },
  });
});

// ── Progression RPC Endpoint ─────────────────────────────────────────────
app.post('/rest/v1/rpc/barsik_complete_level', (req, res) => {
  const { p_level_id, p_stars, p_friend_id } = req.body || {};
  const levelId = parseInt(p_level_id, 10);
  const stars = Math.min(100, Math.max(0, parseInt(p_stars, 10) || 0));
  const friendId = p_friend_id || null;

  res.json({
    current_level: levelId + 1,
    unlocked_levels: Array.from({ length: levelId + 2 }, (_, i) => i),
    level_stars: { [levelId]: stars },
    stars: stars,
    friend_ids: friendId ? [friendId] : [],
    season_complete: levelId >= 16,
  });
});

// ── City Say / Chat / Moderation Endpoint ─────────────────────────────────
app.post(['/functions/v1/city-say', '/api/city-say'], (req, res) => {
  const { player_id, nick, text } = req.body || {};
  const cleanText = (text || '').trim().slice(0, 90);

  if (cleanText) {
    db.run(
      'INSERT INTO barsik_chat (player_id, nick, text) VALUES (?, ?, ?)',
      [player_id || 'anon', (nick || 'Барсик').slice(0, 32), cleanText]
    );
  }

  res.json({ ok: true, text: cleanText });
});

// ── Admin API Endpoints ──────────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!passwordLoginConfigured()) {
    return res.status(503).json({ error: 'Вход в админку не настроен на сервере' });
  }

  const address = clientAddress(req);
  if (adminLoginLimiter.isBlocked(address)) {
    res.setHeader('Retry-After', '900');
    return res.status(429).json({ error: 'Слишком много попыток. Попробуйте позже.' });
  }

  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string'
    || !safeEqual(username, ADMIN_USERNAME) || !safeEqual(password, ADMIN_PASSWORD)) {
    adminLoginLimiter.recordFailure(address);
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  adminLoginLimiter.recordSuccess(address);
  return res.json({ token: issueAdminSession(ADMIN_USERNAME), actor: ADMIN_USERNAME });
});

app.use('/api/admin', (req, res, next) => {
  if (!passwordLoginConfigured()) {
    return res.status(503).json({ error: 'Админ API не настроен на сервере' });
  }
  const bearer = /^Bearer\s+(.+)$/i.exec(req.get('authorization') || '')?.[1] || '';
  const actor = getAdminSessionActor(bearer);
  if (!actor) return res.status(401).json({ error: 'Требуется авторизация администратора' });
  req.adminActor = actor;
  next();
});

app.get('/api/admin/overview', (req, res) => {
  db.all('SELECT * FROM barsik_saves', (err, rows) => {
    const list = rows || [];
    const total = list.length;
    const hidden = list.filter(r => r.hidden === 1).length;
    const visible = total - hidden;
    const complete = list.filter(r => r.levels >= 17).length;
    const neverStarted = list.filter(r => r.levels === 0).length;

    // Funnel
    const funnel = Array.from({ length: 17 }, (_, i) => {
      const reached = list.filter(r => r.levels >= i).length;
      return {
        level: i,
        reached,
        share: total ? Math.round((reached / total) * 100) : 0,
      };
    });

    // Friends Histogram
    const friendsHistogram = Array.from({ length: 10 }, (_, i) => ({
      friends: i,
      players: list.filter(r => r.friends === i).length,
    }));

    const starsArr = list.map(r => r.stars || 0).sort((a, b) => a - b);
    const medianStars = starsArr.length ? starsArr[Math.floor(starsArr.length / 2)] : 0;

    res.json({
      players: {
        total,
        visible,
        hidden,
        active7: total,
        active30: total,
      },
      progress: {
        seasonComplete: complete,
        neverStarted,
        medianStars,
        funnel,
        friendsHistogram,
      },
      integrity: {
        implausible: 0,
        rows: [],
      },
      notMeasured: [
        'retention D1/D3/D7/D30 — нужен поток событий',
        'ошибки и FPS — телеметрии нет',
        'сканы QR по партиям — таблицы нет',
        'приглашения и командная активность — таблицы нет',
      ],
      season: { levels: 17, friends: 9 },
    });
  });
});

app.get('/api/admin/players', (req, res) => {
  const { key, q, limit } = req.query || {};
  if (key) {
    db.get('SELECT * FROM barsik_saves WHERE player_key = ?', [key], (err, row) => {
      if (err || !row) return res.status(404).json({ error: 'Сейв не найден' });
      res.json({ player: { ...row, hidden: Boolean(row.hidden) } });
    });
    return;
  }

  const lim = Math.min(500, Math.max(1, parseInt(limit, 10) || 100));
  let sql = 'SELECT * FROM barsik_saves';
  let params = [];

  if (q) {
    sql += ' WHERE name LIKE ? OR player_key LIKE ?';
    params.push(`%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY updated_at DESC LIMIT ?';
  params.push(lim);

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'db_error' });
    res.json({
      players: (rows || []).map(r => ({ ...r, hidden: Boolean(r.hidden) })),
      count: (rows || []).length,
    });
  });
});

app.patch('/api/admin/players', (req, res) => {
  const { key, patch, reason } = req.body || {};
  if (!key) return res.status(400).json({ error: 'key_required' });

  db.get('SELECT * FROM barsik_saves WHERE player_key = ?', [key], (err, before) => {
    if (!before) return res.status(404).json({ error: 'Сейв не найден' });

    const stars = patch.stars !== undefined ? patch.stars : before.stars;
    const total_stars = patch.total_stars !== undefined ? patch.total_stars : before.total_stars;
    const levels = patch.levels !== undefined ? patch.levels : before.levels;
    const friends = patch.friends !== undefined ? patch.friends : before.friends;
    const name = patch.name !== undefined ? patch.name : before.name;

    db.run(
      'UPDATE barsik_saves SET name = ?, stars = ?, total_stars = ?, levels = ?, friends = ?, updated_at = datetime("now") WHERE player_key = ?',
      [name, stars, total_stars, levels, friends, key],
      function (uErr) {
        if (uErr) return res.status(500).json({ error: 'update_failed' });
        db.run(
          'INSERT INTO barsik_admin_audit (actor, action, player_key, details) VALUES (?, ?, ?, ?)',
          [req.adminActor, 'patch', key, JSON.stringify({ before, patch, reason })]
        );
        res.json({ player: { ...before, ...patch } });
      }
    );
  });
});

app.delete('/api/admin/players', (req, res) => {
  const { key } = req.query || {};
  if (!key) return res.status(400).json({ error: 'key_required' });

  db.run('DELETE FROM barsik_saves WHERE player_key = ?', [key], function (err) {
    if (err) return res.status(500).json({ error: 'delete_failed' });
    db.run(
      'INSERT INTO barsik_admin_audit (actor, action, player_key, details) VALUES (?, ?, ?, ?)',
      [req.adminActor, 'delete', key, JSON.stringify({ key })]
    );
    res.json({ deleted: key });
  });
});

app.get('/api/admin/leaderboard', (req, res) => {
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 200));
  db.all('SELECT * FROM barsik_saves ORDER BY total_stars DESC LIMIT ?', [limit], (err, rows) => {
    if (err) return res.status(500).json({ error: 'db_error' });
    res.json({
      rows: (rows || []).map((r) => ({
        ...r,
        hidden: Boolean(r.hidden),
        impossible: (r.levels > 17 || r.friends > 9 || r.levels < 0) ? ['невозможные значения'] : [],
      })),
      season: { levels: 17, friends: 9 },
    });
  });
});

app.post('/api/admin/leaderboard', (req, res) => {
  const { key, hidden, reason } = req.body || {};
  if (!key) return res.status(400).json({ error: 'key_required' });

  const isHidden = hidden ? 1 : 0;
  db.run(
    'UPDATE barsik_saves SET hidden = ?, hidden_reason = ?, hidden_at = datetime("now") WHERE player_key = ?',
    [isHidden, reason || null, key],
    function (err) {
      if (err) return res.status(500).json({ error: 'update_failed' });
      db.run(
        'INSERT INTO barsik_admin_audit (actor, action, player_key, details) VALUES (?, ?, ?, ?)',
        [req.adminActor, isHidden ? 'hide' : 'unhide', key, JSON.stringify({ reason })]
      );
      res.json({ ok: true, key, hidden: Boolean(isHidden) });
    }
  );
});

app.get('/api/admin/audit', (req, res) => {
  db.all('SELECT * FROM barsik_admin_audit ORDER BY id DESC LIMIT 50', (err, rows) => {
    if (err) return res.status(500).json({ error: 'db_error' });
    res.json({ entries: rows || [] });
  });
});

// ── Start Server ─────────────────────────────────────────────────────────
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[Barsik API] Server running on http://127.0.0.1:${PORT}`);
  console.log(`[Barsik API] Database SQLite: ${DB_PATH}`);
});

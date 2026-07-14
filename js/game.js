// ===== Game Engine =====
let G = null;

class Game {
  constructor(canvas, level, world, diff, state) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.level = level;
    this.world = world;
    this.diff = diff;
    this.state = state;
    this.running = false;
    this.paused = false;
    this.done = false;

    this.resize();
    const dpr = window.devicePixelRatio || 1;
    this.W = canvas.width / dpr;
    this.H = canvas.height / dpr;

    const d = DIFFS.find(x => x.id === diff) || DIFFS[0];
    this.speed = d.speed;
    this.obsRate = d.obs;
    this.mul = d.mul;

    this.bg = new Image();
    this.bg.src = world.bg;
    this.bgX = 0;

    this.barsik = new Image();
    this.barsik.src = 'assets/barsik_run.png';
    this.barsikIdle = new Image();
    this.barsikIdle.src = 'assets/barsik_idle.png';

    this.starImg = new Image();
    this.starImg.src = 'assets/item_star.png';
    this.heartImg = new Image();
    this.heartImg.src = 'assets/item_heart.png';

    this.lanes = [this.H * 0.62, this.H * 0.75, this.H * 0.88];
    this.player = { x: this.W * 0.22, y: this.lanes[1], vy: 0, lane: 1, onGround: true, w: 70, h: 70 };
    this.gravity = 0.65;
    this.jumpPwr = -15;

    this.items = [];
    this.obstacles = [];
    this.particles = [];
    this.spawnT = 0;
    this.spawnInt = 55;

    this.stars = 0;
    this.hearts = 0;
    this.dist = 0;
    this.target = 1800 + level * 40;
    this.frame = 0;
    this.maxTime = 40 * 60;
    this.hits = 0;
    this.shieldActive = (state.boosters.shield || 0) > 0;
    this.magnetActive = (state.boosters.magnet || 0) > 0;
    this.speedBoost = (state.boosters.speed || 0) > 0;
    if (this.shieldActive) state.boosters.shield--;
    if (this.magnetActive) state.boosters.magnet--;
    if (this.speedBoost) state.boosters.speed--;

    this.onFinish = null;
    this.onUpdate = null;

    this.tx = 0; this.ty = 0;
    this.bind();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = r.width * dpr;
    this.canvas.height = r.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  bind() {
    this._kd = (e) => {
      if (!this.running || this.paused) return;
      if (e.key === 'ArrowUp' || e.key === 'w') this.laneUp();
      if (e.key === 'ArrowDown' || e.key === 's') this.laneDown();
      if (e.key === ' ') this.jump();
    };
    window.addEventListener('keydown', this._kd);

    this._ts = (e) => { e.preventDefault(); this.tx = e.touches[0].clientX; this.ty = e.touches[0].clientY; };
    this._te = (e) => {
      e.preventDefault();
      if (!this.running || this.paused) return;
      const dx = e.changedTouches[0].clientX - this.tx;
      const dy = e.changedTouches[0].clientY - this.ty;
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 25) {
        if (dy < 0) this.laneUp(); else this.laneDown();
      } else { this.jump(); }
    };
    this.canvas.addEventListener('touchstart', this._ts, { passive: false });
    this.canvas.addEventListener('touchend', this._te, { passive: false });
    this._cl = () => { if (this.running && !this.paused) this.jump(); };
    this.canvas.addEventListener('click', this._cl);
  }

  laneUp() { if (this.player.lane > 0) { this.player.lane--; this.player.y = this.lanes[this.player.lane]; this.player.onGround = true; this.player.vy = 0; } }
  laneDown() { if (this.player.lane < 2) { this.player.lane++; this.player.y = this.lanes[this.player.lane]; this.player.onGround = true; this.player.vy = 0; } }
  jump() { if (this.player.onGround) { this.player.vy = this.jumpPwr; this.player.onGround = false; } }

  spawn() {
    const r = Math.random();
    const lane = Math.floor(Math.random() * 3);
    if (r < 0.06 * this.obsRate) {
      this.obstacles.push({ x: this.W + 60, y: this.lanes[lane] - 10, emoji: '🪨', size: 34, hit: false });
    } else if (r < 0.7) {
      this.items.push({ x: this.W + 60, y: this.lanes[lane] - 15, type: 'star', size: 28, got: false });
    } else {
      this.items.push({ x: this.W + 60, y: this.lanes[lane] - 15, type: 'heart', size: 28, got: false });
    }
  }

  update() {
    if (!this.running || this.paused || this.done) return;
    this.frame++;

    this.dist += this.speed;
    this.bgX -= this.speed * 0.4;
    if (this.bgX <= -this.W) this.bgX += this.W;

    if (!this.player.onGround) {
      this.player.vy += this.gravity;
      this.player.y += this.player.vy;
      const gy = this.lanes[this.player.lane];
      if (this.player.y >= gy) { this.player.y = gy; this.player.vy = 0; this.player.onGround = true; }
    }

    this.spawnT++;
    const int = Math.max(28, this.spawnInt - Math.floor(this.level / 8) * 4);
    if (this.spawnT >= int) { this.spawn(); this.spawnT = 0; }

    this.items.forEach(i => {
      i.x -= this.speed;
      if (this.magnetActive && !i.got) {
        const dx = this.player.x - i.x, dy = this.player.y - i.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < 180) { i.x += dx * 0.15; i.y += dy * 0.15; }
      }
    });
    this.items = this.items.filter(i => i.x > -60 && !i.got);
    this.obstacles.forEach(o => o.x -= this.speed);
    this.obstacles = this.obstacles.filter(o => o.x > -60 && !o.hit);

    this.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life--; });
    this.particles = this.particles.filter(p => p.life > 0);

    this.collide();

    if (this.onUpdate) this.onUpdate({ stars: this.stars, progress: Math.min(1, this.dist / this.target) });

    if (this.dist >= this.target || this.frame >= this.maxTime) this.finish(true);
  }

  collide() {
    const px = this.player.x, py = this.player.y, pw = this.player.w * 0.5, ph = this.player.h * 0.5;
    this.items.forEach(i => {
      if (i.got) return;
      if (Math.abs(i.x - px) < pw && Math.abs(i.y - py) < ph) {
        i.got = true;
        if (i.type === 'star') { this.stars++; this.burst(i.x, i.y, '#fdcb6e'); }
        else { this.hearts++; this.burst(i.x, i.y, '#fd79a8'); }
      }
    });
    this.obstacles.forEach(o => {
      if (o.hit) return;
      if (Math.abs(o.x - px) < pw * 0.8 && Math.abs(o.y - py) < ph * 0.8) {
        o.hit = true;
        if (this.shieldActive) {
          this.shieldActive = false;
          this.burst(o.x, o.y, '#0984e3');
          toast('🛡️ Щит спас!', 'success');
        } else {
          this.hits++;
          this.stars = Math.max(0, this.stars - 3);
          this.burst(o.x, o.y, '#e74c3c');
          this.shake = 10;
        }
      }
    });
  }

  burst(x, y, color) {
    for (let i = 0; i < 10; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 7,
        vy: (Math.random() - 0.5) * 7 - 3,
        life: 28, color, size: 3 + Math.random() * 4,
      });
    }
  }

  draw() {
    const ctx = this.ctx, W = this.W, H = this.H;
    let sx = 0;
    if (this.shake > 0) { sx = (Math.random() - 0.5) * this.shake; this.shake--; }

    ctx.save();
    ctx.translate(sx, 0);

    // Background with parallax
    if (this.bg.complete && this.bg.naturalWidth > 0) {
      ctx.drawImage(this.bg, this.bgX, 0, W, H);
      ctx.drawImage(this.bg, this.bgX + W, 0, W, H);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#a29bfe'); g.addColorStop(1, '#6c5ce7');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }

    // Ground lines
    this.lanes.forEach(ly => {
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(0, ly + 28, W, 2);
    });

    // Items
    this.items.forEach(i => {
      if (i.type === 'star' && this.starImg.complete && this.starImg.naturalWidth > 0) {
        ctx.drawImage(this.starImg, i.x - i.size/2, i.y - i.size/2, i.size, i.size);
      } else if (i.type === 'heart' && this.heartImg.complete && this.heartImg.naturalWidth > 0) {
        ctx.drawImage(this.heartImg, i.x - i.size/2, i.y - i.size/2, i.size, i.size);
      } else {
        ctx.font = i.size + 'px serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(i.type === 'star' ? '⭐' : '💖', i.x, i.y);
      }
    });

    // Obstacles
    this.obstacles.forEach(o => {
      ctx.font = o.size + 'px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(o.emoji, o.x, o.y);
    });

    // Player
    const img = this.player.onGround ? this.barsik : this.barsikIdle;
    const src = (img.complete && img.naturalWidth > 0) ? img : null;
    if (src) {
      ctx.save();
      if (!this.player.onGround) {
        ctx.translate(this.player.x, this.player.y);
        ctx.rotate(this.player.vy * 0.025);
        ctx.drawImage(src, -this.player.w/2, -this.player.h/2, this.player.w, this.player.h);
      } else {
        ctx.drawImage(src, this.player.x - this.player.w/2, this.player.y - this.player.h/2, this.player.w, this.player.h);
      }
      ctx.restore();
    } else {
      ctx.fillStyle = '#fdcb6e';
      ctx.beginPath(); ctx.arc(this.player.x, this.player.y, 28, 0, Math.PI * 2); ctx.fill();
    }

    // Particles
    this.particles.forEach(p => {
      ctx.globalAlpha = p.life / 28;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Booster indicators
    let bx = W - 50, by = 60;
    if (this.shieldActive) { ctx.font = '28px serif'; ctx.textAlign = 'center'; ctx.fillText('🛡️', bx, by); by += 36; }
    if (this.magnetActive) { ctx.font = '28px serif'; ctx.textAlign = 'center'; ctx.fillText('🧲', bx, by); by += 36; }
    if (this.speedBoost) { ctx.font = '28px serif'; ctx.textAlign = 'center'; ctx.fillText('⚡', bx, by); }

    ctx.restore();
  }

  loop() {
    if (!this.running) return;
    this.update();
    this.draw();
    requestAnimationFrame(() => this.loop());
  }

  start() { this.running = true; this.paused = false; this.loop(); }
  pause() { this.paused = true; }
  resume() { this.paused = false; this.loop(); }

  finish(ok) {
    if (this.done) return;
    this.done = true; this.running = false;
    if (this.onFinish) this.onFinish({ ok, stars: this.stars, hearts: this.hearts, level: this.level, hits: this.hits, speedBoost: this.speedBoost });
  }

  destroy() {
    this.running = false;
    window.removeEventListener('keydown', this._kd);
    this.canvas.removeEventListener('touchstart', this._ts);
    this.canvas.removeEventListener('touchend', this._te);
    this.canvas.removeEventListener('click', this._cl);
  }
}

function startGame(level, world) {
  show('game');
  document.getElementById('hud-level').textContent = 'Ур. ' + level;
  document.getElementById('hud-stars').textContent = '0';
  document.getElementById('hud-progress').style.width = '0%';
  document.getElementById('overlay-pause').classList.remove('show');
  document.getElementById('overlay-result').classList.remove('show');

  const canvas = document.getElementById('canvas');
  if (G) G.destroy();
  G = new Game(canvas, level, world, curDiff, S);

  G.onUpdate = (d) => {
    document.getElementById('hud-stars').textContent = d.stars;
    document.getElementById('hud-progress').style.width = (d.progress * 100) + '%';
  };
  G.onFinish = (r) => endGame(r, world);

  setTimeout(() => G.start(), 150);
}

function endGame(r, world) {
  const card = document.getElementById('result-card');
  const s = S;

  if (r.ok) {
    if (!s.completed.includes(r.level)) s.completed.push(r.level);
    const next = r.level + 1;
    if (next <= 100 && !s.unlocked.includes(next)) s.unlocked.push(next);
    let mul = G.mul;
    if (r.speedBoost) mul *= 1.5;
    const earned = Math.floor(r.stars * mul);
    s.stars += earned;
    s.totalStars += earned;
    s.totalPlayed++;

    trackTask(S, 'play', 1);
    trackTask(S, 'collect', r.stars);
    if (r.hits === 0) { s.perfectLevels++; trackTask(S, 'perfect', 1); }

    const fr = friendAtLevel(r.level);
    let frHtml = '';
    if (fr && !s.friends.includes(fr.id)) {
      s.friends.push(fr.id);
      trackTask(S, 'friend', 1);
      frHtml = `<div class="result-friend">${fr.emoji}</div><div class="result-friend-name">Новый друг: ${fr.name}!</div>`;
    }
    const prize = PRIZES.find(p => p.lvl === r.level);
    let prHtml = prize ? `<p style="font-size:17px;color:#e17055;font-weight:700">🎁 Приз: ${prize.name}!</p>` : '';
    let perfectHtml = r.hits === 0 ? `<p style="font-size:15px;color:#00b894;font-weight:700">✨ Идеально! Без ошибок!</p>` : '';

    card.innerHTML = `<h2>🎉 Уровень пройден!</h2><div class="result-stars">⭐ +${earned}</div>${perfectHtml}${frHtml}${prHtml}<button class="btn-primary" id="btn-next">▶ Следующий</button><button class="btn-secondary" id="btn-to-map">На карту</button>`;
    save(s);

    setTimeout(() => {
      document.getElementById('btn-next').onclick = () => {
        document.getElementById('overlay-result').classList.remove('show');
        const nl = r.level + 1;
        if (nl <= 100) startGame(nl, worldByLevel(nl));
        else { show('menu'); updateMenu(s); toast('🎉 Все 100 уровней пройдены!', 'success'); }
      };
      document.getElementById('btn-to-map').onclick = () => {
        document.getElementById('overlay-result').classList.remove('show');
        show('map'); renderMap(s);
      };
    }, 50);
  } else {
    card.innerHTML = `<h2>Попробуй ещё!</h2><div class="result-stars">⭐ ${r.stars}</div><button class="btn-primary" id="btn-retry">🔄 Заново</button><button class="btn-secondary" id="btn-fail-map">На карту</button>`;
    setTimeout(() => {
      document.getElementById('btn-retry').onclick = () => { document.getElementById('overlay-result').classList.remove('show'); startGame(r.level, world); };
      document.getElementById('btn-fail-map').onclick = () => { document.getElementById('overlay-result').classList.remove('show'); show('map'); renderMap(s); };
    }, 50);
  }
  document.getElementById('overlay-result').classList.add('show');
}

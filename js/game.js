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

    this.worldTheme = this.makeTheme(world);

    this.icons = {
      star: this.loadIcon('assets/items/star.png'),
      heart: this.loadIcon('assets/items/heart.png'),
      shield: this.loadIcon('assets/items/shield.png'),
      magnet: this.loadIcon('assets/items/magnet.png'),
      speed: this.loadIcon('assets/items/speed.png'),
    };
    this.obstacleImgs = this.loadObstacles(world);

    // Composite painted background (fallback base for every world)
    this.bg = new Image();
    this.bg.src = world.bg;
    this.bgLoaded = this.bg.complete && this.bg.naturalWidth > 0;
    this.bg.onload = () => { this.bgLoaded = true; };
    this.bg.onerror = () => { this.bgLoaded = false; };
    this.bgX = 0;

    // Seamless parallax layers (generated per world). Missing layers are skipped.
    this.layers = this.loadLayers(world);

    // Player sprites depend on the equipped costume.
    this.sprites = this.loadPlayerSprites(state.costume || 'default');

    this.lanes = [this.H * 0.62, this.H * 0.75, this.H * 0.88];
    this.player = { x: this.W * 0.22, y: this.lanes[1], vy: 0, lane: 1, onGround: true, w: 70, h: 70 };
    this.gravity = 0.65;
    this.jumpPwr = -15;

    this.items = [];
    this.obstacles = [];
    this.particles = [];
    this.floating = [];
    this.trail = [];
    this.particlePool = [];
    this.floatPool = [];
    this.spawnT = 0;
    this.spawnInt = 55;
    this.powerUpT = 300;

    this.stars = 0;
    this.hearts = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboTimer = 0;
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

  loadObstacles(w) {
    const ids = { fruit_forest:['rock','log','stump','cactus'], ice_valley:['ice_block','snowman','rock'], rainbow:['crystal','rock','cactus'], mountains:['rock','stump','log'], cola_city:['trash','brick','spike'], friends_city:['brick','trash','spike'] };
    const list = ids[w.id] || ['rock','log','stump'];
    return list.map(id => this.loadIcon('assets/obstacles/' + id + '.png'));
  }
  loadIcon(src) { const img = new Image(); img.src = src; return img; }

  loadLayers(w) {
    const mk = (p) => { const i = new Image(); i.src = p; return i; };
    // Layer files share the composite bg prefix, e.g.
    // 'assets/bg_fruit_forest.png' -> 'assets/bg_fruit_forest_{sky,far,mid,near}.png'.
    const base = (w.bg || '').replace(/\.png$/, '');
    return {
      sky: mk(base + '_sky.png'),
      far: mk(base + '_far.png'),
      mid: mk(base + '_mid.png'),
      near: mk(base + '_near.png'),
    };
  }

  loadPlayerSprites(costume) {
    const mk = (p) => { const i = new Image(); i.src = p; return i; };
    if (costume && costume !== 'default') {
      const c = mk('assets/chars/barsik_' + costume + '.png');
      return { run: c, jump: c, fall: c };
    }
    return {
      run: mk('assets/barsik_run.png'),
      jump: mk('assets/barsik_jump.png'),
      fall: mk('assets/barsik_fall.png'),
    };
  }

  ready(img) { return img && img.complete && img.naturalWidth > 0; }

  // Tile a horizontally-seamless layer across the canvas at a parallax speed.
  drawLayer(img, speed, topFrac, heightFrac) {
    if (!this.ready(img)) return false;
    const ctx = this.ctx, W = this.W, H = this.H;
    const dy = H * (topFrac || 0);
    const dh = H * (heightFrac || 1);
    const scale = dh / img.naturalHeight;
    const dw = img.naturalWidth * scale;
    let x = -(((this.bgX * speed) % dw + dw) % dw);
    for (; x < W; x += dw) ctx.drawImage(img, x, dy, dw, dh);
    return true;
  }

  // Cover-fit a single image over the whole canvas (used for painted fallback).
  drawCover(img) {
    if (!this.ready(img)) return false;
    const ctx = this.ctx, W = this.W, H = this.H;
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    return true;
  }

  getParticle(x, y, vx, vy, life, color, size) {
    const p = this.particlePool.pop() || {};
    p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.color = color; p.size = size;
    return p;
  }
  getFloat(x, y, text, color) {
    const f = this.floatPool.pop() || {};
    f.x = x; f.y = y; f.text = text; f.color = color; f.life = 42; f.scale = 1;
    return f;
  }

  randomObstacle() {
    const imgs = this.obstacleImgs.filter(i => i.complete && i.naturalWidth > 0);
    if (imgs.length) return imgs[Math.floor(Math.random() * imgs.length)];
    return null;
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = r.width * dpr;
    this.canvas.height = r.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  makeTheme(w) {
    const palettes = {
      fruit_forest: { sky: ['#a8e6cf','#dcedc1','#fff9c4'], hillsBack: '#81c784', hillsFront: '#66bb6a', ground: '#4caf50', groundLine: '#388e3c' },
      ice_valley: { sky: ['#e1f5fe','#b3e5fc','#81d4fa'], hillsBack: '#90caf9', hillsFront: '#64b5f6', ground: '#e3f2fd', groundLine: '#bbdefb' },
      rainbow: { sky: ['#f8bbd0','#e1bee7','#b3e5fc'], hillsBack: '#ce93d8', hillsFront: '#ba68c8', ground: '#fff176', groundLine: '#fdd835' },
      mountains: { sky: ['#d7ccc8','#bcaaa4','#a1887f'], hillsBack: '#8d6e63', hillsFront: '#6d4c41', ground: '#5d4037', groundLine: '#3e2723' },
      cola_city: { sky: ['#f3e5f5','#e1bee7','#ce93d8'], hillsBack: '#7e57c2', hillsFront: '#5e35b1', ground: '#4a148c', groundLine: '#311b92' },
      friends_city: { sky: ['#fff9c4','#ffecb3','#ffe082'], hillsBack: '#ffb74d', hillsFront: '#ffa726', ground: '#f57c00', groundLine: '#ef6c00' },
    };
    return palettes[w.id] || palettes.fruit_forest;
  }

  drawHill(x, y, w, h, amp) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    for (let i = 0; i <= w; i += 30) {
      ctx.lineTo(x + i, y - Math.sin((i / w) * Math.PI) * h + Math.sin(i * 0.02 + this.frame * 0.01) * amp * 0.3);
    }
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();
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

  laneUp() { if (this.player.lane > 0) { this.player.lane--; this.player.y = this.lanes[this.player.lane]; this.player.onGround = true; this.player.vy = 0; Sound.tap(); } }
  laneDown() { if (this.player.lane < 2) { this.player.lane++; this.player.y = this.lanes[this.player.lane]; this.player.onGround = true; this.player.vy = 0; Sound.tap(); } }
  jump() { if (this.player.onGround) { this.player.vy = this.jumpPwr; this.player.onGround = false; Sound.jump(); } }

  spawn() {
    const r = Math.random();
    const lane = Math.floor(Math.random() * 3);
    if (r < 0.06 * this.obsRate) {
      const img = this.randomObstacle();
      this.obstacles.push({ x: this.W + 60, y: this.lanes[lane] - 10, size: 38, hit: false, img });
    } else if (r < 0.7) {
      this.items.push({ x: this.W + 60, y: this.lanes[lane] - 15, type: 'star', size: 30, got: false });
    } else {
      this.items.push({ x: this.W + 60, y: this.lanes[lane] - 15, type: 'heart', size: 30, got: false });
    }
  }

  spawnPowerUp() {
    if (this.powerUpT-- > 0) return;
    this.powerUpT = 400 + Math.floor(Math.random() * 300);
    const lane = Math.floor(Math.random() * 3);
    const types = ['shield','magnet','speed'];
    const type = types[Math.floor(Math.random() * types.length)];
    this.items.push({ x: this.W + 70, y: this.lanes[lane] - 15, type: 'powerup', subtype: type, size: 32, got: false });
  }

  update() {
    if (!this.running || this.paused || this.done) return;
    this.frame++;

    this.dist += this.speed;
    // Grows unbounded; drawLayer wraps per-layer via modulo so no reset jump.
    this.bgX += this.speed;

    if (!this.player.onGround) {
      this.player.vy += this.gravity;
      this.player.y += this.player.vy;
      const gy = this.lanes[this.player.lane];
      if (this.player.y >= gy) { this.player.y = gy; this.player.vy = 0; this.player.onGround = true; }
    }

    this.spawnT++;
    const int = Math.max(28, this.spawnInt - Math.floor(this.level / 8) * 4);
    if (this.spawnT >= int) { this.spawn(); this.spawnT = 0; }
    this.spawnPowerUp();

    // Combo timer decay
    if (this.comboTimer > 0) { this.comboTimer--; if (this.comboTimer <= 0) { this.combo = 0; } }

    // Trail
    this.trail.push({ x: this.player.x, y: this.player.y, life: 12, size: this.player.w * 0.35 });
    this.trail.forEach(t => t.life--);
    this.trail = this.trail.filter(t => t.life > 0);

    // Running dust puffs at the feet.
    if (this.player.onGround && this.frame % 8 === 0) {
      this.particles.push(this.getParticle(
        this.player.x - 16, this.player.y + this.player.h * 0.4,
        -1 - Math.random() * 1.5, -0.4 - Math.random(),
        18, 'rgba(255,255,255,0.55)', 2 + Math.random() * 3));
    }

    for (let i = this.floating.length - 1; i >= 0; i--) {
      const f = this.floating[i]; f.y -= 1.2; f.life--;
      if (f.life <= 0) { this.floating.splice(i, 1); this.floatPool.push(f); }
    }

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

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life--;
      if (p.life <= 0) { this.particles.splice(i, 1); this.particlePool.push(p); }
    }

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
        if (i.type === 'star') {
          this.combo++; this.comboTimer = 120; this.maxCombo = Math.max(this.maxCombo, this.combo);
          const add = 1 + Math.floor(this.combo / 5);
          this.stars += add;
          this.burst(i.x, i.y, '#fdcb6e');
          this.floatText(i.x, i.y - 20, '+' + add, '#fdcb6e');
          Sound.star();
        } else if (i.type === 'heart') {
          this.hearts++; this.burst(i.x, i.y, '#fd79a8'); this.floatText(i.x, i.y - 20, '♥', '#fd79a8');
          Sound.beep(700, 0.1, 'sine', 0.1);
        } else if (i.type === 'powerup') {
          this.burst(i.x, i.y, '#74b9ff');
          this.activatePowerUp(i.subtype);
        }
      }
    });
    this.obstacles.forEach(o => {
      if (o.hit) return;
      if (Math.abs(o.x - px) < pw * 0.8 && Math.abs(o.y - py) < ph * 0.8) {
        o.hit = true;
        if (this.shieldActive) {
          this.shieldActive = false;
          this.burst(o.x, o.y, '#0984e3');
          this.floatText(o.x, o.y - 30, 'Щит!', '#74b9ff');
          toast('🛡️ Щит спас!', 'success');
          Sound.beep(300, 0.2, 'sawtooth', 0.12);
        } else {
          this.hits++;
          this.combo = 0; this.comboTimer = 0;
          this.stars = Math.max(0, this.stars - 3);
          this.burst(o.x, o.y, '#e74c3c');
          this.shake = 12;
          this.floatText(o.x, o.y - 30, '-3', '#e74c3c');
          Sound.hit();
        }
      }
    });
  }

  activatePowerUp(type) {
    if (type === 'shield') { this.shieldActive = true; this.floatText(this.player.x, this.player.y - 40, 'Щит!', '#74b9ff'); }
    if (type === 'magnet') { this.magnetActive = true; this.floatText(this.player.x, this.player.y - 40, 'Магнит!', '#e84393'); }
    if (type === 'speed') { this.speedBoost = true; this.floatText(this.player.x, this.player.y - 40, 'Скорость!', '#fdcb6e'); }
    Sound.levelup();
  }

  burst(x, y, color) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 5;
      this.particles.push(this.getParticle(x, y, Math.cos(a) * s, Math.sin(a) * s - 2, 28 + Math.floor(Math.random() * 14), color, 3 + Math.random() * 5));
    }
  }

  floatText(x, y, text, color) {
    this.floating.push(this.getFloat(x, y, text, color));
  }

  draw() {
    const ctx = this.ctx, W = this.W, H = this.H;
    let sx = 0;
    if (this.shake > 0) { sx = (Math.random() - 0.5) * this.shake; this.shake--; }

    ctx.save();
    ctx.translate(sx, 0);
    ctx.clearRect(0, 0, W, H);

    // ===== Background =====
    // Base sky gradient always fills first (covers any missing sky layer).
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    const [c1, c2, c3] = this.worldTheme.sky;
    sky.addColorStop(0, c1); sky.addColorStop(0.5, c2); sky.addColorStop(1, c3);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

    const L = this.layers;
    const hasLayers = this.ready(L.far) || this.ready(L.mid) || this.ready(L.near);
    if (hasLayers) {
      // Seamless parallax: each layer scrolls at its own depth speed.
      this.drawLayer(L.sky, 0.06, 0, 1);
      this.drawLayer(L.far, 0.2, 0, 1);
      this.drawLayer(L.mid, 0.45, 0, 1);
      this.drawLayer(L.near, 0.8, 0, 1);
    } else {
      // Fallback: painted composite scene, cover-fit.
      this.drawCover(this.bg);
    }

    // Ground shadow band improves lane/character readability over any art.
    const gTop = this.lanes[0] - 44;
    const grd = ctx.createLinearGradient(0, gTop, 0, H);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,0.30)');
    ctx.fillStyle = grd; ctx.fillRect(0, gTop, W, H - gTop);

    // Subtle lane guides.
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    this.lanes.forEach(ly => {
      ctx.beginPath(); ctx.moveTo(0, ly + 30); ctx.lineTo(W, ly + 30); ctx.stroke();
    });

    // Player trail
    this.trail.forEach((t, i) => {
      ctx.globalAlpha = (t.life / 12) * 0.4;
      ctx.fillStyle = '#fdcb6e';
      ctx.beginPath(); ctx.arc(t.x - 15, t.y + 4, t.size * (t.life / 12), 0, Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Items
    this.items.forEach(i => {
      let img;
      if (i.type === 'powerup') {
        img = this.icons[i.subtype] || this.icons.star;
        ctx.shadowColor = 'rgba(116, 185, 255, 0.6)'; ctx.shadowBlur = 12;
      } else {
        img = i.type === 'star' ? this.icons.star : this.icons.heart;
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
      }
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, i.x - i.size/2, i.y - i.size/2, i.size, i.size);
      } else {
        ctx.fillStyle = i.type === 'star' ? '#fdcb6e' : (i.type === 'powerup' ? '#74b9ff' : '#fd79a8');
        const shp = i.size * 0.4;
        ctx.beginPath(); ctx.arc(i.x, i.y, shp, 0, Math.PI*2); ctx.fill();
      }
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    });

    // Obstacles
    this.obstacles.forEach(o => {
      if (o.img && o.img.complete && o.img.naturalWidth > 0) {
        ctx.drawImage(o.img, o.x - o.size/2, o.y - o.size/2, o.size, o.size);
      } else {
        ctx.fillStyle = '#636e72';
        ctx.beginPath(); ctx.arc(o.x, o.y, o.size * 0.45, 0, Math.PI*2); ctx.fill();
      }
    });

    // Player (procedural run-cycle animation from a single sprite)
    const p = this.player;
    let img;
    if (p.onGround) img = this.sprites.run;
    else img = p.vy < 0 ? this.sprites.jump : (this.sprites.fall || this.sprites.jump);
    const src = this.ready(img) ? img : null;
    ctx.save();
    ctx.translate(p.x, p.y);
    // Soft contact shadow.
    ctx.save();
    ctx.globalAlpha = p.onGround ? 0.3 : 0.15;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, p.h * 0.44, p.w * 0.34, p.h * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (src) {
      if (p.onGround) {
        const t = this.frame * 0.3;
        ctx.translate(0, Math.sin(t) * 3);
        ctx.rotate(Math.sin(t) * 0.04);
        const sq = 1 + Math.sin(t * 2) * 0.03;
        ctx.scale(1 / sq, sq);
      } else {
        ctx.rotate(Math.max(-0.4, Math.min(0.4, p.vy * 0.025)));
      }
      const nh = p.h * 1.15;
      const nw = nh * (src.naturalWidth / src.naturalHeight);
      ctx.drawImage(src, -nw / 2, -nh / 2, nw, nh);
    } else {
      ctx.fillStyle = '#fdcb6e';
      ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // Particles
    this.particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life / 28);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Floating text
    ctx.font = 'bold 20px Baloo 2, sans-serif';
    ctx.textAlign = 'center';
    this.floating.forEach(f => {
      ctx.globalAlpha = f.life / 42;
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      if (f.life > 32) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.strokeText(f.text, f.x, f.y);
      }
    });
    ctx.globalAlpha = 1;

    // Combo counter
    if (this.combo > 1) {
      const cx = W / 2, cy = H * 0.22;
      const pulse = 1 + Math.sin(this.frame * 0.15) * 0.1;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = 'white';
      ctx.strokeStyle = '#fd79a8';
      ctx.lineWidth = 4;
      ctx.font = 'bold 26px Baloo 2, sans-serif';
      ctx.textAlign = 'center';
      const label = 'x' + this.combo + ' COMBO';
      ctx.strokeText(label, 0, 0);
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }

    // Booster indicators
    let bx = W - 50, by = 60;
    const drawBooster = (icon) => {
      const img = this.icons[icon];
      if (img.complete && img.naturalWidth > 0) ctx.drawImage(img, bx - 14, by - 14, 28, 28);
      by += 36;
    };
    if (this.shieldActive) drawBooster('shield');
    if (this.magnetActive) drawBooster('magnet');
    if (this.speedBoost) drawBooster('speed');

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
    if (this.onFinish) this.onFinish({ ok, stars: this.stars, hearts: this.hearts, level: this.level, hits: this.hits, speedBoost: this.speedBoost, maxCombo: this.maxCombo });
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

  // Wait for screen transition so canvas has non-zero size
  setTimeout(() => {
    G = new Game(canvas, level, world, curDiff, S);
    G.onUpdate = (d) => {
      document.getElementById('hud-stars').textContent = d.stars;
      document.getElementById('hud-progress').style.width = (d.progress * 100) + '%';
    };
    G.onFinish = (r) => { Sound.stopMusic(); endGame(r, world); };
    G.start();
    Sound.startMusic();
  }, 300);
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
      frHtml = `<div class="result-friend"><img src="${fr.icon}" alt=""></div><div class="result-friend-name">Новый друг: ${fr.name}!</div>`;
    }
    const prize = PRIZES.find(p => p.lvl === r.level);
    let prHtml = prize ? `<div class="result-badge prize"><img src="assets/items/chest.png" alt=""><span>Приз: ${prize.name}!</span></div>` : '';
    let perfectHtml = r.hits === 0 ? `<div class="result-badge perfect"><img src="assets/items/star.png" alt=""><span>Идеально! Без ошибок!</span></div>` : '';

    card.innerHTML = `<h2>Уровень пройден!</h2><div class="result-stars"><img src="assets/items/star.png" alt=""> +${earned}</div><div class="result-stats"><div><span>${r.stars}</span>собрано</div><div><span>${G.maxCombo}</span>комбо</div><div><span>${r.hits}</span>ошибок</div></div>${perfectHtml}${frHtml}${prHtml}<button class="btn-primary" id="btn-next">▶ Следующий</button><button class="btn-secondary" id="btn-to-map">На карту</button>`;
    checkMilestones(s, r);
    save(s);
    Sound.win();
    celebrateConfetti();
    if (fr) setTimeout(() => Sound.friend(), 500);

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
    Sound.lose();
    setTimeout(() => {
      document.getElementById('btn-retry').onclick = () => { document.getElementById('overlay-result').classList.remove('show'); startGame(r.level, world); };
      document.getElementById('btn-fail-map').onclick = () => { document.getElementById('overlay-result').classList.remove('show'); show('map'); renderMap(s); };
    }, 50);
  }
  document.getElementById('overlay-result').classList.add('show');
}

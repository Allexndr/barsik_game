// ===== Mini-games =====
const MINIGAMES = [
  { id: 'memory', name: 'Память друзей', icon: 'assets/icons/friends/masha.svg', desc: 'Найди парные карточки друзей. Быстрее — больше звёзд!' },
  { id: 'catch', name: 'Лови звёзды', icon: 'assets/icons/items/star.svg', desc: 'Лови падающие звёздочки корзинкой, уклоняйся от бомб. 30 секунд!' },
];

let memoryGame = null;
let catchGame = null;

function renderMinigamesList() {
  const list = document.getElementById('minigames-list');
  if (!list) return;
  list.innerHTML = '';
  MINIGAMES.forEach((g, i) => {
    const card = document.createElement('div');
    card.className = 'minigame-card';
    card.style.animationDelay = (i * 0.1) + 's';
    card.innerHTML = `
      <img class="minigame-icon" src="${g.icon}" alt="">
      <div class="minigame-info">
        <div class="minigame-name">${g.name}</div>
        <div class="minigame-desc">${g.desc}</div>
      </div>
      <button class="btn-primary small" data-game="${g.id}">Играть</button>
    `;
    list.appendChild(card);
  });
  list.querySelectorAll('button[data-game]').forEach(b => {
    b.onclick = () => { Sound.click(); startMinigame(b.dataset.game); };
  });
}

function startMinigame(id) {
  if (id === 'memory') startMemoryGame();
  if (id === 'catch') startCatchGame();
}

class CatchGame {
  constructor(canvas, statusEl, starsEl, btn) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.statusEl = statusEl;
    this.starsEl = starsEl;
    this.btn = btn;
    this.running = false;
    this.score = 0;
    this.time = 30;
    this.items = [];
    this.player = { x: 0, w: 80, h: 30 };
    this.lastSpawn = 0;
    this.raf = null;
    this.icons = {
      star: new Image(), bomb: new Image()
    };
    this.icons.star.src = 'assets/icons/items/star.svg';
    this.icons.bomb.src = 'assets/icons/obstacles/spike.svg';
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindInput();
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * (window.devicePixelRatio || 1);
    this.canvas.height = rect.height * (window.devicePixelRatio || 1);
    this.W = rect.width; this.H = rect.height;
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
    this.ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    this.player.y = this.H - 50;
    this.player.x = this.W / 2 - this.player.w / 2;
  }

  bindInput() {
    const move = (x) => {
      this.player.x = Math.max(0, Math.min(this.W - this.player.w, x - this.player.w / 2));
    };
    this.canvas.addEventListener('pointermove', (e) => move(e.offsetX));
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const r = this.canvas.getBoundingClientRect();
      move(t.clientX - r.left);
    }, { passive: false });
    document.addEventListener('keydown', (e) => {
      if (!this.running) return;
      if (e.key === 'ArrowLeft') this.player.x = Math.max(0, this.player.x - 25);
      if (e.key === 'ArrowRight') this.player.x = Math.min(this.W - this.player.w, this.player.x + 25);
    });
  }

  start() {
    this.running = true;
    this.score = 0;
    this.time = 30;
    this.items = [];
    this.lastSpawn = 0;
    this.starsEl.textContent = '0';
    this.statusEl.textContent = 'Время: 30с';
    this.btn.style.display = 'none';
    this.loop(0);
    this.timer = setInterval(() => {
      this.time--;
      this.statusEl.textContent = `Время: ${this.time}с · Звёзды: ${this.score}`;
      if (this.time <= 0) this.finish();
    }, 1000);
  }

  loop(now) {
    if (!this.running) return;
    this.ctx.clearRect(0, 0, this.W, this.H);
    if (now - this.lastSpawn > 700) {
      this.spawn();
      this.lastSpawn = now;
    }
    this.items.forEach(it => {
      it.y += it.speed;
      if (it.type === 'star') {
        this.ctx.drawImage(this.icons.star, it.x - 16, it.y - 16, 32, 32);
      } else {
        this.ctx.drawImage(this.icons.bomb, it.x - 18, it.y - 18, 36, 36);
      }
    });
    // basket
    this.ctx.fillStyle = 'rgba(253,203,110,0.9)';
    this.ctx.fillRect(this.player.x + 6, this.player.y, this.player.w - 12, this.player.h);
    this.ctx.beginPath();
    this.ctx.arc(this.player.x + 6, this.player.y + this.player.h / 2, this.player.h / 2, Math.PI / 2, Math.PI * 1.5);
    this.ctx.arc(this.player.x + this.player.w - 6, this.player.y + this.player.h / 2, this.player.h / 2, Math.PI * 1.5, Math.PI / 2);
    this.ctx.fill();
    this.ctx.strokeStyle = 'white'; this.ctx.lineWidth = 3;
    this.ctx.strokeRect(this.player.x + 6, this.player.y, this.player.w - 12, this.player.h);
    this.ctx.beginPath();
    this.ctx.arc(this.player.x + 6, this.player.y + this.player.h / 2, this.player.h / 2, Math.PI / 2, Math.PI * 1.5);
    this.ctx.arc(this.player.x + this.player.w - 6, this.player.y + this.player.h / 2, this.player.h / 2, Math.PI * 1.5, Math.PI / 2);
    this.ctx.stroke();
    // collision
    this.items = this.items.filter(it => {
      if (it.y > this.H + 20) return false;
      const dx = it.x - (this.player.x + this.player.w / 2);
      const dy = it.y - (this.player.y + this.player.h / 2);
      if (Math.abs(dx) < this.player.w / 2 + 14 && Math.abs(dy) < this.player.h / 2 + 14) {
        if (it.type === 'star') { this.score++; Sound.star(); }
        else { this.score = Math.max(0, this.score - 3); Sound.hit(); }
        this.starsEl.textContent = this.score;
        return false;
      }
      return true;
    });
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  spawn() {
    const type = Math.random() < 0.75 ? 'star' : 'bomb';
    this.items.push({ x: 20 + Math.random() * (this.W - 40), y: -20, speed: 3 + Math.random() * 3, type });
  }

  finish() {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    if (this.raf) cancelAnimationFrame(this.raf);
    const reward = this.score * 2;
    S.stars += reward;
    S.totalStars += reward;
    save(S);
    updateMenu(S);
    this.statusEl.textContent = `Игра окончена! +${reward} ⭐`;
    this.btn.style.display = 'inline-block';
    Sound.win();
    toast('+' + reward + ' ⭐ за Лови звёзды!', 'success');
  }
}

class MemoryGame {
  constructor(gridEl, statusEl, starsEl) {
    this.gridEl = gridEl;
    this.statusEl = statusEl;
    this.starsEl = starsEl;
    this.cards = [];
    this.flipped = [];
    this.matched = 0;
    this.moves = 0;
    this.stars = 0;
    this.locked = false;
    this.startTime = 0;
    this.timer = null;
  }

  init() {
    const pairs = 6;
    const chosen = FRIENDS.slice(0, pairs);
    this.cards = [...chosen, ...chosen]
      .map((f, i) => ({ id: i, friend: f, flipped: false, matched: false }))
      .sort(() => Math.random() - 0.5);
    this.matched = 0;
    this.moves = 0;
    this.stars = 0;
    this.flipped = [];
    this.locked = false;
    this.startTime = Date.now();
    this.render();
    this.startTimer();
    this.statusEl.textContent = 'Найди парные карточки!';
    this.starsEl.textContent = '0';
  }

  render() {
    this.gridEl.innerHTML = '';
    this.cards.forEach(c => {
      const el = document.createElement('div');
      el.className = 'memory-card' + (c.flipped ? ' flipped' : '') + (c.matched ? ' matched' : '');
      el.innerHTML = `
        <div class="memory-front"></div>
        <div class="memory-back"><img src="${c.friend.icon}" alt=""><span>${c.friend.name}</span></div>
      `;
      el.onclick = () => this.onCardClick(c);
      this.gridEl.appendChild(el);
    });
  }

  onCardClick(card) {
    if (this.locked || card.flipped || card.matched) return;
    Sound.tap();
    card.flipped = true;
    this.flipped.push(card);
    this.render();
    if (this.flipped.length === 2) {
      this.moves++;
      this.locked = true;
      const [a, b] = this.flipped;
      if (a.friend.id === b.friend.id) {
        setTimeout(() => {
          a.matched = b.matched = true;
          this.matched++;
          this.flipped = [];
          this.locked = false;
          Sound.star();
          this.render();
          if (this.matched === this.cards.length / 2) this.finish();
        }, 400);
      } else {
        setTimeout(() => {
          a.flipped = b.flipped = false;
          this.flipped = [];
          this.locked = false;
          this.render();
        }, 800);
      }
    }
  }

  startTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      const sec = Math.floor((Date.now() - this.startTime) / 1000);
      this.statusEl.textContent = `Время: ${sec}с · Ходов: ${this.moves}`;
    }, 1000);
  }

  finish() {
    if (this.timer) clearInterval(this.timer);
    const sec = Math.floor((Date.now() - this.startTime) / 1000);
    const base = 20;
    const timeBonus = Math.max(0, 30 - sec);
    const moveBonus = Math.max(0, 12 - this.moves) * 2;
    this.stars = base + timeBonus + moveBonus;
    S.stars += this.stars;
    S.totalStars += this.stars;
    save(S);
    updateMenu(S);
    this.statusEl.textContent = `Победа! +${this.stars} ⭐ за ${sec}с и ${this.moves} ходов`;
    this.starsEl.textContent = this.stars;
    Sound.win();
    toast('+' + this.stars + ' ⭐ за Память друзей!', 'success');
  }
}

function startMemoryGame() {
  show('memory');
  document.getElementById('memory-stars').textContent = S.stars;
  const grid = document.getElementById('memory-grid');
  const status = document.getElementById('memory-status');
  const stars = document.getElementById('memory-stars');
  memoryGame = new MemoryGame(grid, status, stars);
  document.getElementById('btn-memory-start').onclick = () => { Sound.click(); memoryGame.init(); };
  memoryGame.init();
}

function startCatchGame() {
  show('catch');
  document.getElementById('catch-stars').textContent = S.stars;
  const canvas = document.getElementById('catch-canvas');
  const status = document.getElementById('catch-status');
  const stars = document.getElementById('catch-stars');
  const btn = document.getElementById('btn-catch-start');
  setTimeout(() => {
    if (!catchGame) catchGame = new CatchGame(canvas, status, stars, btn);
    catchGame.resize();
    btn.onclick = () => { Sound.click(); catchGame.start(); };
    status.textContent = 'Лови звёздочки, уклоняйся от бомб!';
    btn.style.display = 'inline-block';
  }, 300);
}

function initMinigames() {
  renderMinigamesList();
}

// ===== Sound Engine (Web Audio API) =====
// Plays decoded audio samples from assets/audio/ when present, and gracefully
// falls back to synthesized oscillator tones when a file is missing. This lets
// the game ship with zero audio files today, and instantly upgrade to real SFX
// simply by dropping *.mp3/*.ogg into assets/audio/ (see SFX_FILES below).
const SFX_FILES = {
  tap: 'assets/audio/click.mp3',
  click: 'assets/audio/click.mp3',
  star: 'assets/audio/coin.mp3',
  jump: 'assets/audio/jump.mp3',
  hit: 'assets/audio/hit.mp3',
  win: 'assets/audio/win.mp3',
  lose: 'assets/audio/lose.mp3',
  chest: 'assets/audio/chest.mp3',
  friend: 'assets/audio/friend.mp3',
};

const Sound = {
  ctx: null,
  enabled: true,
  musicOsc: [],
  musicGain: null,
  musicPlaying: false,
  samples: {},
  _loaded: false,

  init() {
    this.enabled = (S && S.sound !== false);
  },

  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch(e) { return false; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (!this._loaded) { this._loaded = true; this.loadSamples(); }
    return true;
  },

  loadSamples() {
    // Файлов audio пока нет — не спамим 404. Когда появятся mp3, поставь true.
    if (!window.BARSIK_HAS_AUDIO) return;
    Object.entries(SFX_FILES).forEach(([name, url]) => {
      if (this.samples[name] !== undefined) return;
      this.samples[name] = null;
      fetch(url).then(r => r.ok ? r.arrayBuffer() : Promise.reject())
        .then(buf => this.ctx.decodeAudioData(buf))
        .then(decoded => { this.samples[name] = decoded; })
        .catch(() => {});
    });
  },

  // Play a preloaded sample; returns true if a real sample fired.
  sample(name, vol = 0.6) {
    if (!this.enabled || !this.ensure()) return false;
    const buf = this.samples[name];
    if (!buf) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g); g.connect(this.ctx.destination);
    src.start();
    return true;
  },

  beep(freq, dur, type = 'sine', vol = 0.15) {
    if (!this.enabled || !this.ensure()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(t); osc.stop(t + dur);
  },

  // Specific sounds (sample first, synth fallback)
  tap() { if (this.sample('tap', 0.4)) return; this.beep(600, 0.08, 'sine', 0.1); },
  click() { if (this.sample('click', 0.4)) return; this.beep(800, 0.05, 'square', 0.08); },
  star() { if (this.sample('star', 0.5)) return; this.beep(880, 0.1, 'sine', 0.12); setTimeout(() => this.beep(1320, 0.1, 'sine', 0.1), 60); },
  jump() { if (this.sample('jump', 0.5)) return; this.beep(400, 0.15, 'sine', 0.1); setTimeout(() => this.beep(600, 0.1, 'sine', 0.08), 50); },
  hit() { if (this.sample('hit', 0.6)) return; this.beep(150, 0.2, 'sawtooth', 0.15); },
  win() {
    if (this.sample('win', 0.6)) return;
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.beep(f, 0.15, 'sine', 0.12), i * 80));
  },
  lose() {
    if (this.sample('lose', 0.6)) return;
    [400, 350, 300, 200].forEach((f, i) => setTimeout(() => this.beep(f, 0.2, 'sawtooth', 0.1), i * 100));
  },
  chest() {
    if (this.sample('chest', 0.6)) return;
    [523, 659, 784, 988, 1319].forEach((f, i) => setTimeout(() => this.beep(f, 0.12, 'triangle', 0.12), i * 60));
  },
  friend() {
    if (this.sample('friend', 0.6)) return;
    [659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => this.beep(f, 0.15, 'sine', 0.14), i * 70));
  },
  whoosh() { this.beep(200, 0.2, 'sawtooth', 0.05); },
  levelup() {
    [523, 659, 784].forEach((f, i) => setTimeout(() => this.beep(f, 0.1, 'square', 0.08), i * 50));
  },
  daily() {
    [659, 880].forEach((f, i) => setTimeout(() => this.beep(f, 0.15, 'sine', 0.12), i * 80));
  },

  startMusic() {
    if (!this.enabled || !this.ensure() || this.musicPlaying) return;
    this.musicPlaying = true;
    const melody = [523, 659, 784, 659, 523, 784, 880, 784];
    let step = 0;
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.06;
    this.musicGain.connect(this.ctx.destination);
    const playNext = () => {
      if (!this.musicPlaying) return;
      const f = melody[step % melody.length];
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, this.ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.18, this.ctx.currentTime + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.28);
      osc.connect(g); g.connect(this.musicGain);
      osc.start(); osc.stop(this.ctx.currentTime + 0.3);
      step++;
      this.musicTimer = setTimeout(() => { if (this.musicPlaying) playNext(); }, 360);
    };
    playNext();
  },
  stopMusic() {
    this.musicPlaying = false;
    if (this.musicTimer) { clearTimeout(this.musicTimer); this.musicTimer = null; }
    if (this.musicGain) { try { this.musicGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2); } catch {} setTimeout(() => { if (this.musicGain && !this.musicPlaying) { this.musicGain.disconnect(); this.musicGain = null; } }, 250); }
  },
};

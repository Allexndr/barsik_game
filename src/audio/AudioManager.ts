/**
 * AudioManager — unified audio system for the game.
 *
 * - SFX: procedural Web Audio (no asset files)
 * - Music: procedural ambient loops per world (forest / ice), quiet under SFX/TTS
 * - TTS: Web Speech API (browser voices)
 * - Mute/volume synced with useUIStore
 *
 * Drop real files later into public/assets/audio/ — playMusicFile() ready when needed.
 * Hero model is managed by the shared scene loader; audio stays model-agnostic.
 */

type SfxName =
  | 'collect'
  | 'bonus'
  | 'interact'
  | 'success'
  | 'stumble'
  | 'found'
  | 'click'
  | 'whoosh'
  | 'sparkle'
  | 'levelComplete'
  | 'tick'
  | 'step';

export type MusicTheme = 'forest' | 'ice' | 'hub' | 'none';

class AudioManagerClass {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private _muted = false;
  private _volume = 0.6;
  private _ttsEnabled = true;
  private _ttsRate = 0.9;
  private _ttsPitch = 1.1;
  private _voices: SpeechSynthesisVoice[] = [];
  private _ruVoice: SpeechSynthesisVoice | null = null;
  private _kkVoice: SpeechSynthesisVoice | null = null;

  private musicTheme: MusicTheme = 'none';
  private musicNodes: AudioNode[] = [];
  private musicTimers: number[] = [];
  private musicStop: (() => void) | null = null;

  get muted() {
    return this._muted;
  }
  get volume() {
    return this._volume;
  }
  get ttsEnabled() {
    return this._ttsEnabled;
  }

  setMuted(v: boolean) {
    this._muted = v;
    if (v) {
      this.stopTts();
      if (this.musicGain) this.musicGain.gain.value = 0;
    } else if (this.musicGain) {
      this.musicGain.gain.value = 0.22;
    }
  }

  setVolume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) this.masterGain.gain.value = this._volume;
  }

  setTtsEnabled(v: boolean) {
    this._ttsEnabled = v;
    if (!v) this.stopTts();
  }

  /** Must be called from a user gesture (click, keypress) to satisfy autoplay policy */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this._volume;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this._muted ? 0 : 0.22;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 1;
      this.sfxGain.connect(this.masterGain);
    } catch {
      console.warn('[Audio] Web Audio API not supported');
    }

    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        this._voices = window.speechSynthesis.getVoices();
        this._ruVoice = this._voices.find((v) => v.lang.startsWith('ru')) || null;
        this._kkVoice = this._voices.find((v) => v.lang.startsWith('kk')) || null;
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  // ── SFX (procedural via Web Audio API) ────────────────────────

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gain = 0.3,
    freqEnd?: number,
  ) {
    if (!this.ctx || !this.sfxGain || this._muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), now + duration);
    }
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(gain, now + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(env);
    env.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  private playChord(freqs: number[], duration: number, type: OscillatorType = 'sine', gain = 0.2) {
    for (const f of freqs) this.playTone(f, duration, type, gain);
  }

  private playSequence(notes: [number, number][], type: OscillatorType = 'sine', gain = 0.25) {
    if (!this.ctx || this._muted) return;
    let t = 0;
    for (const [freq, dur] of notes) {
      setTimeout(() => this.playTone(freq, dur, type, gain), t * 1000);
      t += dur;
    }
  }

  sfx(name: SfxName) {
    this.init();
    if (!this.ctx || this._muted) return;
    switch (name) {
      case 'collect':
        this.playTone(523, 0.12, 'sine', 0.3, 784);
        break;
      case 'bonus':
        this.playSequence(
          [
            [523, 0.08],
            [659, 0.08],
            [784, 0.12],
          ],
          'triangle',
          0.25,
        );
        break;
      case 'interact':
        this.playTone(440, 0.08, 'square', 0.15, 550);
        break;
      case 'success':
        this.playSequence(
          [
            [523, 0.1],
            [659, 0.1],
            [784, 0.15],
          ],
          'sine',
          0.3,
        );
        break;
      case 'stumble':
        this.playTone(200, 0.2, 'sawtooth', 0.2, 100);
        break;
      case 'found':
        this.playSequence(
          [
            [392, 0.1],
            [523, 0.1],
            [659, 0.1],
            [784, 0.2],
          ],
          'triangle',
          0.3,
        );
        break;
      case 'click':
        this.playTone(800, 0.04, 'sine', 0.15);
        break;
      case 'whoosh':
        this.playTone(300, 0.15, 'sine', 0.1, 600);
        break;
      case 'sparkle':
        this.playChord([1047, 1319, 1568], 0.15, 'sine', 0.12);
        break;
      case 'levelComplete':
        this.playSequence(
          [
            [523, 0.12],
            [659, 0.12],
            [784, 0.12],
            [1047, 0.25],
          ],
          'triangle',
          0.3,
        );
        break;
      case 'tick':
        this.playTone(1200, 0.03, 'sine', 0.1);
        break;
      case 'step':
        this.playTone(90 + Math.random() * 40, 0.05, 'triangle', 0.06);
        break;
    }
  }

  // ── Music (procedural ambient) ────────────────────────────────

  /** Theme by Season 1 level id: 0–9 forest, 10–16 ice. */
  musicForLevel(levelId: number): MusicTheme {
    if (levelId >= 10) return 'ice';
    return 'forest';
  }

  playMusic(theme: MusicTheme) {
    this.init();
    if (!this.ctx || !this.musicGain || theme === 'none') {
      this.stopMusic();
      return;
    }
    if (this.musicTheme === theme && this.musicStop) return;
    this.stopMusic();
    this.musicTheme = theme;
    if (theme === 'forest') this.startForestMusic();
    else if (theme === 'ice') this.startIceMusic();
    else if (theme === 'hub') this.startHubMusic();
  }

  stopMusic() {
    for (const t of this.musicTimers) clearInterval(t);
    this.musicTimers = [];
    if (this.musicStop) {
      this.musicStop();
      this.musicStop = null;
    }
    for (const n of this.musicNodes) {
      try {
        (n as OscillatorNode).stop?.();
      } catch {
        /* already stopped */
      }
      try {
        n.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.musicNodes = [];
    this.musicTheme = 'none';
  }

  private startPad(freqs: number[], type: OscillatorType, gain = 0.04) {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = f;
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(gain, now + 2);
      osc.connect(env);
      env.connect(this.musicGain);
      osc.start(now);
      this.musicNodes.push(osc, env);
    }
  }

  private startForestMusic() {
    if (!this.ctx || !this.musicGain) return;
    // Soft major pad (C–E–G–A) — warm fruit-forest feel
    this.startPad([130.81, 164.81, 196.0, 220.0], 'sine', 0.035);
    this.startPad([261.63], 'triangle', 0.018);

    // Occasional soft bird-like chirps
    const chirp = () => {
      if (this._muted || this.musicTheme !== 'forest') return;
      const base = 800 + Math.random() * 600;
      this.playTone(base, 0.08, 'sine', 0.04, base * 1.4);
      setTimeout(() => this.playTone(base * 1.2, 0.06, 'sine', 0.03, base), 90);
    };
    const id = window.setInterval(chirp, 4200 + Math.random() * 2000);
    this.musicTimers.push(id);
    this.musicStop = () => clearInterval(id);
  }

  private startIceMusic() {
    if (!this.ctx || !this.musicGain) return;
    // Cool minor pad (A–C–E–G) — soft winter
    this.startPad([110.0, 130.81, 164.81, 196.0], 'sine', 0.03);
    this.startPad([329.63], 'triangle', 0.012);

    // Sparse icy sparkles
    const sparkle = () => {
      if (this._muted || this.musicTheme !== 'ice') return;
      const f = 1200 + Math.random() * 800;
      this.playTone(f, 0.2, 'sine', 0.035, f * 0.7);
    };
    const id = window.setInterval(sparkle, 5000 + Math.random() * 2500);
    this.musicTimers.push(id);
    this.musicStop = () => clearInterval(id);
  }

  private startHubMusic() {
    if (!this.ctx || !this.musicGain) return;
    this.startPad([146.83, 185.0, 220.0], 'sine', 0.028);
    this.musicStop = () => undefined;
  }

  // ── TTS (Web Speech API) ──────────────────────────────────────

  tts(text: string, lang: 'ru' | 'kk' = 'ru') {
    if (!this._ttsEnabled || this._muted || !('speechSynthesis' in window)) return;
    this.stopTts();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'kk' ? 'kk-KZ' : 'ru-RU';
    u.rate = this._ttsRate;
    u.pitch = this._ttsPitch;
    u.volume = this._volume;
    const voice = lang === 'kk' ? this._kkVoice : this._ruVoice;
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  }

  stopTts() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  isSpeaking() {
    return 'speechSynthesis' in window && window.speechSynthesis.speaking;
  }

  // ── Dispose ───────────────────────────────────────────────────

  dispose() {
    this.stopTts();
    this.stopMusic();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.masterGain = null;
      this.musicGain = null;
      this.sfxGain = null;
    }
  }
}

export const AudioManager = new AudioManagerClass();
export type { SfxName };

/**
 * AudioManager — единая звуковая система игры.
 *
 * - Эффекты: процедурный Web Audio, без файлов
 * - Музыка: процедурные фоновые петли по мирам (лес / лёд), тише эффектов и речи
 * - Речь: Web Speech API, голоса браузера
 * - Отключение звука и громкость синхронизированы с useUIStore
 *
 * Настоящие файлы можно положить в public/assets/audio/ — playMusicFile() готов.
 * Моделью героя занимается общий загрузчик сцены; звук от модели не зависит.
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
  | 'step'
  | 'stepGrass'
  | 'stepSnow'
  | 'stepStone';

import { lineId, VOICE_BASE, type VoiceManifest } from './voiceLines';

/**
 * Приведение казахской кириллицы к буквам, которые умеет произнести русский
 * движок синтеза.
 *
 * Таблица перенесена из avtobus-speak-app (`src/data/providers/ExpoTtsProvider.ts`)
 * — там она написана для приложения незрячим, где ошибка произношения стоит
 * дороже всего. Нужна ровно потому, что казахского голоса на устройствах
 * практически не бывает: см. `speakWithBrowser`.
 */
const KK_TO_RU_APPROX: Array<[RegExp, string]> = [
  [/ә/g, 'а'], [/Ә/g, 'А'],
  [/қ/g, 'к'], [/Қ/g, 'К'],
  [/ң/g, 'н'], [/Ң/g, 'Н'],
  [/ғ/g, 'г'], [/Ғ/g, 'Г'],
  [/ү/g, 'у'], [/Ү/g, 'У'],
  [/ұ/g, 'у'], [/Ұ/g, 'У'],
  [/һ/g, 'х'], [/Һ/g, 'Х'],
  [/і/g, 'и'], [/І/g, 'И'],
  [/ө/g, 'о'], [/Ө/g, 'О'],
];

export function approximateKazakhForRuVoice(text: string): string {
  return KK_TO_RU_APPROX.reduce((acc, [pattern, to]) => acc.replace(pattern, to), text);
}

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

  /**
   * Заранее записанные реплики с теми же ключами, какие им дал
   * `scripts/extract-voice-lines.mjs`. До завершения `loadVoicePack` — null;
   * пустой манифест означает, что пакет не собирали, и все реплики читает браузер.
   */
  private voiceManifest: VoiceManifest | null = null;
  private voiceLoad: Promise<void> | null = null;
  private voiceEl: HTMLAudioElement | null = null;
  /** Реплики, заблокированные политикой автовоспроизведения до следующего действия игрока. */
  private pendingTts: { text: string; lang: 'ru' | 'kk'; nick?: string } | null = null;
  private voicePrimed = false;
  /** Идентификаторы, вернувшие 404. Просить дважды несуществующий клип — впустую. */
  private voiceMissing = new Set<string>();

  constructor() {
    // Перечисление голосов не требует жеста пользователя, в отличие от
    // AudioContext, — поэтому делается сразу, а не ждёт первого касания.
    this.loadVoices();
  }

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

  /** Вызывать только из действия игрока — клика или нажатия клавиши, — иначе автовоспроизведение запретят. */
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

    this.loadVoices();
  }

  /**
   * Разблокирует Web Audio и голосовые клипы HTML5 по явному нажатию — «Играть»,
   * джойстик и подобное. Реплику, заблокированную автовоспроизведением, повторяет,
   * а не помечает клип мёртвым.
   */
  unlockFromGesture() {
    this.init();
    if (!this.voicePrimed) {
      this.voicePrimed = true;
      const prime = new Audio(`${VOICE_BASE}previews/edge_ru_f.mp3`);
      prime.volume = 0.001;
      void prime.play().catch(() => {});
    }
    const pending = this.pendingTts;
    if (pending) {
      this.pendingTts = null;
      this.tts(pending.text, pending.lang, pending.nick);
    }
  }

  /**
   * Перечисление голосов синтеза.
   *
   * Вынесено из `init()`, потому что `init()` ждёт первого касания (политика
   * автовоспроизведения звука), а перечисление голосов никакого жеста не
   * требует. Пока они были связаны, до первого тапа `_ruVoice` был пустым — и
   * казахская реплика, попавшая в этот промежуток, уходила в никуда, потому
   * что резервный русский голос ещё не найден.
   *
   * `getVoices()` при первом вызове часто возвращает пустой список и
   * досылает голоса событием, поэтому подписка обязательна.
   */
  private loadVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const read = () => {
      this._voices = window.speechSynthesis.getVoices();
      this._ruVoice = this._voices.find((v) => v.lang.toLowerCase().startsWith('ru')) || null;
      this._kkVoice = this._voices.find((v) => v.lang.toLowerCase().startsWith('kk')) || null;
    };
    read();
    window.speechSynthesis.onvoiceschanged = read;
  }

  // ── Эффекты: процедурные, через Web Audio API ─────────────────

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
      case 'stepGrass':
        this.playTone(120 + Math.random() * 55, 0.045, 'triangle', 0.055);
        break;
      case 'stepSnow':
        this.playTone(170 + Math.random() * 40, 0.06, 'triangle', 0.05);
        break;
      case 'stepStone':
        this.playTone(145 + Math.random() * 45, 0.05, 'square', 0.045);
        break;
    }
  }

  // ── Музыка: процедурный фон ───────────────────────────────────

  /** Тема по номеру уровня первого сезона: 0–9 лес, 10–16 лёд. */
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
        /* уже остановлено */
      }
      try {
        n.disconnect();
      } catch {
        /* не важно */
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
    // Мягкий мажорный пэд (до-ми-соль-ля) — тёплое настроение фруктового леса.
    this.startPad([130.81, 164.81, 196.0, 220.0], 'sine', 0.035);
    this.startPad([261.63], 'triangle', 0.018);

    // Изредка — мягкое птичье щебетание.
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
    // Холодный минорный пэд (ля-до-ми-соль) — мягкая зима.
    this.startPad([110.0, 130.81, 164.81, 196.0], 'sine', 0.03);
    this.startPad([329.63], 'triangle', 0.012);

    // Редкие ледяные искорки.
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

  // ── Речь: Web Speech API ──────────────────────────────────────

  /**
   * Загружает манифест озвучки один раз. Если его нет — дёшево: один 404, и игра
   * ведёт себя ровно так же, как до появления пакета.
   */
  loadVoicePack(): Promise<void> {
    if (this.voiceLoad) return this.voiceLoad;
    this.voiceLoad = fetch(`${VOICE_BASE}manifest.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((m: VoiceManifest | null) => {
        this.voiceManifest = m;
      })
      .catch(() => {
        this.voiceManifest = null;
      });
    return this.voiceLoad;
  }

  /** Истина, когда для этого языка доступен записанный пакет. */
  hasVoicePack(lang: 'ru' | 'kk' = 'ru'): boolean {
    if (!this.voiceManifest) return false;
    return Object.values(this.voiceManifest.lines).some((l) => l.lang === lang);
  }

  /**
   * Произнести реплику.
   *
   * Сначала записанный клип, синтезатор браузера — только если клипа для этого
   * текста нет. Этот порядок важнее всего на казахском: Android не поставляет голос
   * `kk-KZ`, поэтому запасной вариант — тишина или русский голос, читающий
   * казахский. Для пятилетнего, который не читает субтитры, это значит, что реплики
   * просто не было.
   *
   * Поиск нормализует текст так же, как извлекатель, поэтому реплика с ником игрока
   * находит клип, записанный без него.
   */
  /** Женский голос (по умолчанию) берётся из `voice/{lang}/`, мужской — из `voice/m/{lang}/`. */
  private _voiceGender: 'f' | 'm' = 'f';

  setVoiceGender(g: 'f' | 'm') {
    if (this._voiceGender === g) return;
    this._voiceGender = g;
    this.voiceMissing.clear();
    this.stopTts();
  }

  getVoiceGender(): 'f' | 'm' {
    return this._voiceGender;
  }

  private voiceClipUrl(lang: 'ru' | 'kk', id: string): string {
    const fmt = this.voiceManifest?.format ?? 'mp3';
    const prefix = this._voiceGender === 'm' ? `m/${lang}` : lang;
    return `${VOICE_BASE}${prefix}/${id}.${fmt}`;
  }

  /** Образцы для прослушивания в настройках: короткие фиксированные реплики, не из пакета миссий. */
  playVoicePreview(lang: 'ru' | 'kk' = 'ru', gender: 'f' | 'm' = this._voiceGender) {
    if (this._muted) return;
    this.stopTts();
    const file = `previews/edge_${lang}_${gender}.mp3`;
    const el = new Audio(`${VOICE_BASE}${file}`);
    el.volume = this._volume;
    this.voiceEl = el;
    el.play().catch(() => {
      if (this.voiceEl === el) this.voiceEl = null;
    });
  }

  tts(text: string, lang: 'ru' | 'kk' = 'ru', nick?: string) {
    if (!this._ttsEnabled || this._muted) return;
    this.stopTts();

    const speak = () => {
      const id = lineId(text, lang, nick);
      const known = this.voiceManifest?.lines[id];
      const missKey = `${this._voiceGender}:${id}`;
      if (known && !this.voiceMissing.has(missKey)) {
        const el = new Audio(this.voiceClipUrl(lang, id));
        el.volume = this._volume;
        this.voiceEl = el;
        el.play().catch((err: DOMException) => {
          if (err?.name === 'NotAllowedError') {
            this.pendingTts = { text, lang, nick };
            if (this.voiceEl === el) this.voiceEl = null;
            return;
          }
          this.voiceMissing.add(missKey);
          if (this.voiceEl === el) this.voiceEl = null;
          if (this._voiceGender === 'm') {
            const fallback = new Audio(`${VOICE_BASE}${lang}/${id}.${this.voiceManifest!.format}`);
            fallback.volume = this._volume;
            this.voiceEl = fallback;
            fallback.play().catch(() => {
              if (this.voiceEl === fallback) this.voiceEl = null;
              this.speakWithBrowser(text, lang);
            });
            return;
          }
          this.speakWithBrowser(text, lang);
        });
        return;
      }
      this.speakWithBrowser(text, lang);
    };

    if (!this.voiceManifest && this.voiceLoad) {
      void this.voiceLoad.finally(speak);
      return;
    }
    speak();
  }

  /**
   * Резервный синтез через браузер, когда готовой озвучки для реплики нет.
   *
   * Казахского голоса в системе почти никогда нет. Замерено здесь же: 180
   * голосов, среди них тамильский, телугу и малайский, — и ни одного kk.
   * Ни Google TTS, ни голоса Apple не ставят kk-KZ по умолчанию.
   *
   * Что происходило раньше: `u.lang = 'kk-KZ'`, голос не назначен, потому что
   * `_kkVoice` пустой, и движок брал какой-нибудь свой по умолчанию — на этой
   * машине русский, на другой английский. Английский голос, читающий казахскую
   * кириллицу, выдаёт кашу, и ребёнок слышит бессмыслицу вместо реплики.
   *
   * Решение взято из avtobus-speak-app (`ExpoTtsProvider`, политика
   * `ru_voice_transliterated`): если казахского голоса нет, читаем русским, но
   * сначала приводим казахские буквы к близким русским. Это честная деградация
   * — звучит с акцентом, но словами. Если нет и русского, молчим: лучше тихо,
   * чем вслух неправдой.
   */
  private speakWithBrowser(text: string, lang: 'ru' | 'kk') {
    if (!('speechSynthesis' in window)) return;

    let spoken = text;
    let voice = lang === 'kk' ? this._kkVoice : this._ruVoice;
    let tag = lang === 'kk' ? 'kk-KZ' : 'ru-RU';

    if (lang === 'kk' && !voice) {
      if (!this._ruVoice) return;
      voice = this._ruVoice;
      tag = 'ru-RU';
      spoken = approximateKazakhForRuVoice(text);
    }

    const u = new SpeechSynthesisUtterance(spoken);
    u.lang = tag;
    u.rate = this._ttsRate;
    u.pitch = this._ttsPitch;
    u.volume = this._volume;
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  }

  /** Есть ли на устройстве настоящий казахский голос. */
  get hasKazakhVoice() {
    return Boolean(this._kkVoice);
  }

  stopTts() {
    if (this.voiceEl) {
      this.voiceEl.pause();
      this.voiceEl.currentTime = 0;
      this.voiceEl = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  isSpeaking() {
    if (this.voiceEl && !this.voiceEl.paused && !this.voiceEl.ended) return true;
    return 'speechSynthesis' in window && window.speechSynthesis.speaking;
  }

  // ── Освобождение ресурсов ─────────────────────────────────────

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

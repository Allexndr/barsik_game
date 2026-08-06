import { useEffect, useRef, useState } from 'react';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { RotateHint } from './ui/RotateHint';
import { DialoguePanel } from './ui/DialoguePanel';
import { useUIStore } from '@/store/useUIStore';
import { useGameStore } from '@/store/useGameStore';
import { Mission0Scene, type L1Hud } from '@/three/scenes/Mission0Scene';
import { markIntroFinished } from '@/three/inventory';
import { Chip } from '@/components/ui/Chip';
import { StepDots } from '@/components/ui/ProgressBar';
import { PlushButton } from '@/components/ui/PlushButton';
import { ConfettiBurst } from '@/components/ui/ConfettiBurst';
import { IconFruit, IconStar, IconPaw } from '@/components/ui/icons';
import { AudioManager } from '@/audio/AudioManager';
import { shouldNarrateHudLine } from '@/audio/narration';
import { SettingsPanel } from '@/components/ui/SettingsPanel';
import './Mission0Screen.css';

/** Level 1 is the first of 5 story chapters shown as journey dots on the outro card. */
const JOURNEY_TOTAL_CHAPTERS = 5;

const emptyHud: L1Hud = {
  phase: 'intro',
  speaker: 'Барсик',
  line: '…',
  objective: '',
  bag: 0,
  questFruits: 0,
  questNeed: 3,
  stars: 0,
  canInteract: false,
  showMoveHint: false,
  showActionHint: false,
  outro: false,
};

export function Mission0Screen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Mission0Scene | null>(null);
  const stickRef = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<L1Hud>(emptyHud);
  const [loading, setLoading] = useState(true);
  const lang = useUIStore((s) => s.lang);
  const setScreen = useUIStore((s) => s.setScreen);
  const muted = useUIStore((s) => s.muted);
  const volume = useUIStore((s) => s.volume);
  const ttsEnabled = useUIStore((s) => s.ttsEnabled);
  const paused = useUIStore((s) => s.paused);
  const setPaused = useUIStore((s) => s.setPaused);
  const setShowSettings = useUIStore((s) => s.setShowSettings);
  const player = useGameStore((s) => s.player);
  const addFriend = useGameStore((s) => s.addFriend);
  const completeLevel = useGameStore((s) => s.completeLevel);

  const finishToMap = () => {
    AudioManager.sfx('click');
    AudioManager.stopTts();
    markIntroFinished();
    addFriend({
      id: 'gardener',
      name: lang === 'kk' ? 'Бағбан' : 'Садовник',
      description:
        lang === 'kk' ? 'Жеміс орманындағы алғашқы дос' : 'Первый друг на поляне Фруктового леса',
      rarity: 'common',
      chapter: 1,
      unlocked: true,
      asset: '',
    });
    const earnedStars = Math.max(hud.stars, 10);
    completeLevel(0, { stars: earnedStars, friendId: 'gardener' });
    AudioManager.stopMusic();
    setScreen('game');
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const initAudio = () => {
      AudioManager.init();
      AudioManager.playMusic('forest');
    };
    window.addEventListener('pointerdown', initAudio, { once: true });
    window.addEventListener('keydown', initAudio, { once: true });
    const scene = new Mission0Scene(canvas);
    sceneRef.current = scene;
    setLoading(true);
    let active = true;
    void scene.init(player?.nick || '', lang, setHud).then(() => {
      if (!active) return;
      if (useUIStore.getState().paused) scene.setPaused(true);
      setLoading(false);
    });
    return () => {
      active = false;
      scene.dispose();
      sceneRef.current = null;
      AudioManager.stopTts();
      AudioManager.stopMusic();
      window.removeEventListener('pointerdown', initAudio);
      window.removeEventListener('keydown', initAudio);
    };
  }, [lang, player?.nick]);

  useEffect(() => {
    const el = stickRef.current;
    if (!el) return;
    let active = false;
    let cx = 0;
    let cy = 0;
    const knob = el.querySelector('.m0-knob') as HTMLDivElement;

    const setJoy = (x: number, y: number) => {
      sceneRef.current?.setJoystick(x, y);
      if (knob) knob.style.transform = `translate(${x * 28}px, ${y * 28}px)`;
    };

    const onStart = (e: PointerEvent) => {
      active = true;
      el.setPointerCapture(e.pointerId);
      const r = el.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
    };
    const onMove = (e: PointerEvent) => {
      if (!active) return;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const len = Math.hypot(dx, dy) || 1;
      const cl = Math.min(1, len / 48);
      setJoy((dx / len) * cl, (dy / len) * cl);
    };
    const onEnd = () => {
      active = false;
      setJoy(0, 0);
    };

    el.addEventListener('pointerdown', onStart);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onEnd);
    el.addEventListener('pointercancel', onEnd);
    return () => {
      el.removeEventListener('pointerdown', onStart);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onEnd);
      el.removeEventListener('pointercancel', onEnd);
    };
  }, []);

  useEffect(() => {
    AudioManager.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    AudioManager.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    AudioManager.setTtsEnabled(ttsEnabled);
  }, [ttsEnabled]);

  useEffect(() => {
    if (paused) AudioManager.stopTts();
    sceneRef.current?.setPaused(paused);
  }, [paused, lang, loading]);

  const prevPhase = useRef('');
  useEffect(() => {
    if (loading || paused) return;
    if (shouldNarrateHudLine(hud.line)) {
      AudioManager.tts(hud.line, lang);
    }
    if (hud.phase !== prevPhase.current) {
      if (hud.phase === 'outro') AudioManager.sfx('levelComplete');
      else if (hud.phase.includes('pick') || hud.phase.includes('help')) AudioManager.sfx('found');
      prevPhase.current = hud.phase;
    }
  }, [hud.line, hud.phase, loading, lang, paused]);

  const prevStars = useRef(0);
  useEffect(() => {
    if (hud.stars > prevStars.current) AudioManager.sfx('collect');
    prevStars.current = hud.stars;
  }, [hud.stars]);

  const prevCanInteract = useRef(false);
  useEffect(() => {
    if (hud.canInteract && !prevCanInteract.current) AudioManager.sfx('tick');
    prevCanInteract.current = hud.canInteract;
  }, [hud.canInteract]);

  const nick = player?.nick || '';
  const showKeys = hud.showMoveHint;
  const showStick = !hud.outro && hud.phase !== 'intro';
  const fruitCount =
    hud.phase === 'help_collect' || hud.phase === 'help_return' || hud.outro
      ? `${hud.questFruits}/${hud.questNeed}`
      : `${hud.bag}`;

  return (
    <div className="m0-screen">
      <canvas ref={canvasRef} className="m0-canvas" />

      <RotateHint lang={lang} />

      {/* Mission 0 is the heaviest scene and the first thing anyone sees, so
          it gets the same real-progress screen as the rest, not a spinner. */}
      {loading ? <LoadingOverlay lang={lang} /> : null}

      <div className="m0-top">
        <div className="m0-title">
          {lang === 'kk' ? 'Алғашқы таң' : 'Первое утро'}
          {nick ? ` · ${nick}` : ''}
        </div>
        <div className="m0-stats">
          <Chip icon={<IconFruit size={16} />} tone="fruit" className="m0-stat">
            {fruitCount}
          </Chip>
          <Chip icon={<IconStar size={16} />} tone="star" className="m0-stat">
            {hud.stars}
          </Chip>
          {!loading && !hud.outro && (
            <button
              type="button"
              className="m0-pause-btn"
              onClick={() => {
                setPaused(true);
                setShowSettings(true);
                AudioManager.sfx('click');
              }}
              aria-label={lang === 'kk' ? 'Кідірту' : 'Пауза'}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {!hud.outro ? (
        <DialoguePanel
          speaker={hud.speaker}
          line={hud.line}
          objective={hud.objective}
          lang={lang}
        />
      ) : null}

      {showKeys ? (
        <div className="m0-keys" aria-hidden>
          <kbd>W</kbd>
          <div className="m0-keys-row">
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd>
          </div>
          <span className="m0-keys-or">{lang === 'kk' ? 'немесе' : 'или'}</span>
          <div className="m0-keys-row">
            <kbd>←</kbd>
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            <kbd>→</kbd>
          </div>
          <span className="m0-keys-or">{lang === 'kk' ? 'секіру' : 'прыжок'}</span>
          <kbd className="m0-key-wide">Space</kbd>
        </div>
      ) : null}

      {hud.showActionHint && !hud.outro ? (
        <button
          type="button"
          className={`m0-action ${hud.canInteract ? 'is-ready' : ''}`}
          onClick={() => {
            AudioManager.sfx('interact');
            sceneRef.current?.tryInteract();
          }}
          aria-label={lang === 'kk' ? 'Әрекет' : 'Действие'}
        >
          <span className="m0-action-paw">
            <IconPaw size={26} />
          </span>
          <span className="m0-action-label">
            {lang === 'kk' ? 'Басу' : 'Нажми'}
            <small className="m0-action-keys">E · Space</small>
          </span>
        </button>
      ) : null}

      {showStick ? (
        <div className="m0-stick" ref={stickRef} aria-label="Joystick">
          <div className="m0-knob" />
        </div>
      ) : (
        <div className="m0-stick m0-stick-hidden" ref={stickRef} aria-hidden>
          <div className="m0-knob" />
        </div>
      )}

      {hud.outro ? (
        <div className="m0-outro">
          <ConfettiBurst active count={36} />
          <div className="m0-outro-card reward-pop">
            <div className="m0-outro-badge">{lang === 'kk' ? '1-деңгей' : 'Уровень 1'}</div>
            <h2 className="m0-outro-title">
              {lang === 'kk' ? 'Керемет!' : 'Отлично получилось!'}
            </h2>
            <p className="m0-outro-line">{hud.line}</p>
            <div className="m0-outro-rewards">
              <Chip icon={<IconFruit size={18} />} tone="fruit" className="m0-reward-pill">
                {hud.questFruits || 3}
              </Chip>
              <Chip icon={<IconStar size={18} />} tone="star" className="m0-reward-pill">
                {Math.max(hud.stars, 10)}
              </Chip>
            </div>
            <div className="m0-progress">
              <div className="m0-progress-label">
                {lang === 'kk' ? 'Жеміс орманы' : 'Фруктовый лес'}
              </div>
              <StepDots total={JOURNEY_TOTAL_CHAPTERS} filled={1} />
            </div>
            <PlushButton variant="primary" size="lg" className="m0-continue" onClick={finishToMap}>
              {lang === 'kk' ? 'Саяхатты жалғастыру' : 'Продолжить путешествие'}
            </PlushButton>
          </div>
        </div>
      ) : null}

      <SettingsPanel />
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { RotateHint } from './ui/RotateHint';
import { CameraLookHint } from './ui/CameraLookHint';
import { DialoguePanel } from './ui/DialoguePanel';
import { useUIStore } from '@/store/useUIStore';
import { useGameStore } from '@/store/useGameStore';
import { type BaseHud } from '@/three/scenes/BaseLevelScene';
import { Chip } from '@/components/ui/Chip';
import { PlushButton } from '@/components/ui/PlushButton';
import { ConfettiBurst } from '@/components/ui/ConfettiBurst';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { IconStar, IconPaw } from '@/components/ui/icons';
import { AudioManager } from '@/audio/AudioManager';
import { shouldNarrateHudLine } from '@/audio/narration';
import { SEASON1_FRIENDS } from '@/utils/season1Friends';
import { SettingsPanel } from '@/components/ui/SettingsPanel';
import './Mission0Screen.css';

export interface ILevelScene {
  init(nick: string, lang: 'ru' | 'kk', onHud: (h: any) => void): Promise<void>;
  setJoystick(x: number, y: number): void;
  setPaused(value: boolean): void;
  jump(): void;
  tryInteract(): void;
  dispose(): void;
}

const emptyHud: BaseHud = {
  phase: 'intro',
  speaker: 'Барсик',
  line: '…',
  objective: '',
  stars: 0,
  canInteract: false,
  showMoveHint: false,
  showActionHint: false,
  outro: false,
};

export interface MissionScreenProps {
  levelId: number;
  levelTitle: { ru: string; kk: string };
  createScene: (canvas: HTMLCanvasElement) => ILevelScene;
  rewardStars: number;
  rewardFriendId?: string;
  rewardFriendName?: { ru: string; kk: string };
}

export function MissionScreen({
  levelId,
  levelTitle,
  createScene,
  rewardStars,
  rewardFriendId,
  rewardFriendName,
}: MissionScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<ILevelScene | null>(null);
  const stickRef = useRef<HTMLDivElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<BaseHud>(emptyHud);
  const [loading, setLoading] = useState(true);
  const [assetsReady, setAssetsReady] = useState(false);
  const lang = useUIStore((s) => s.lang);
  const setScreen = useUIStore((s) => s.setScreen);
  const player = useGameStore((s) => s.player);
  const addFriend = useGameStore((s) => s.addFriend);
  const completeLevel = useGameStore((s) => s.completeLevel);

  const finishToMap = () => {
    AudioManager.sfx('click');
    AudioManager.stopTts();
    AudioManager.stopMusic();
    if (rewardFriendId && rewardFriendName) {
      const catalogFriend = SEASON1_FRIENDS.find((friend) => friend.id === rewardFriendId);
      addFriend({
        id: rewardFriendId,
        name: lang === 'kk' ? rewardFriendName.kk : rewardFriendName.ru,
        description: '',
        rarity: catalogFriend?.rarity ?? 'common',
        chapter: catalogFriend?.chapter ?? (levelId >= 10 ? 2 : 1),
        unlocked: true,
        asset: '',
      });
    }
    const earnedStars = rewardStars + hud.stars;
    completeLevel(levelId, { stars: earnedStars, friendId: rewardFriendId });
    setScreen('game');
  };

  const handlePlayFromLoading = () => {
    AudioManager.sfx('click');
    setLoading(false);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Init audio on first user interaction (autoplay policy)
    const initAudio = () => {
      AudioManager.init();
      AudioManager.playMusic(AudioManager.musicForLevel(levelId));
    };
    window.addEventListener('pointerdown', initAudio, { once: true });
    window.addEventListener('keydown', initAudio, { once: true });
    const scene = createScene(canvas);
    sceneRef.current = scene;
    setLoading(true);
    setAssetsReady(false);
    let active = true;
    void scene.init(player?.nick || '', lang, setHud).then(() => {
      if (!active) return;
      if (useUIStore.getState().paused) scene.setPaused(true);
      // The level does not start until "Играть" is pressed on the loading
      // screen itself — see handlePlayFromLoading.
      setAssetsReady(true);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, player?.nick, levelId]);

  /**
   * Плавающий джойстик.
   *
   * Раньше стик был прибит к кружку в углу и слушал только сам себя: палец,
   * опустившийся в двух сантиметрах мимо, не делал ничего. Ребёнок из этого
   * делает вывод, что игра не слушается, — и это была главная жалоба на
   * управление.
   *
   * Теперь касание в любой точке левой половины поднимает стик под палец:
   * центр там, где палец коснулся, а не там, где нарисован кружок. Радиус
   * отклонения берётся от размера самого стика, поэтому на планшете он
   * больше, а не «тот же в пикселях».
   */
  useEffect(() => {
    const zone = zoneRef.current;
    const el = stickRef.current;
    if (!zone || !el) return;
    let pointer: number | null = null;
    let cx = 0;
    let cy = 0;
    let radius = 48;
    const knob = el.querySelector('.m0-knob') as HTMLDivElement;

    const setJoy = (x: number, y: number) => {
      sceneRef.current?.setJoystick(x, y);
      if (knob) {
        const travel = radius * 0.55;
        knob.style.transform = `translate(${x * travel}px, ${y * travel}px)`;
      }
    };

    const park = () => {
      el.style.left = '';
      el.style.top = '';
      el.style.bottom = '';
      el.classList.remove('is-held');
    };

    const onStart = (e: PointerEvent) => {
      if (pointer !== null) return;
      pointer = e.pointerId;
      zone.setPointerCapture(e.pointerId);
      cx = e.clientX;
      cy = e.clientY;
      const size = el.getBoundingClientRect().width || 110;
      radius = size / 2;
      // Стик встаёт ровно под палец. Координаты пересчитываются относительно
      // зоны: она сама position:absolute, поэтому она и есть система отсчёта
      // для стика, а не экран.
      const zr = zone.getBoundingClientRect();
      el.style.left = `${cx - zr.left - radius}px`;
      el.style.top = `${cy - zr.top - radius}px`;
      el.style.bottom = 'auto';
      el.classList.add('is-held');
      setJoy(0, 0);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const len = Math.hypot(dx, dy) || 1;
      const cl = Math.min(1, len / radius);
      setJoy((dx / len) * cl, (dy / len) * cl);
    };
    const onEnd = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      pointer = null;
      zone.releasePointerCapture?.(e.pointerId);
      setJoy(0, 0);
      park();
    };

    zone.addEventListener('pointerdown', onStart);
    zone.addEventListener('pointermove', onMove);
    zone.addEventListener('pointerup', onEnd);
    zone.addEventListener('pointercancel', onEnd);
    return () => {
      zone.removeEventListener('pointerdown', onStart);
      zone.removeEventListener('pointermove', onMove);
      zone.removeEventListener('pointerup', onEnd);
      zone.removeEventListener('pointercancel', onEnd);
    };
  }, []);

  // Sync muted state from UI store
  const muted = useUIStore((s) => s.muted);
  const volume = useUIStore((s) => s.volume);
  const ttsEnabled = useUIStore((s) => s.ttsEnabled);
  const setShowSettings = useUIStore((s) => s.setShowSettings);
  const paused = useUIStore((s) => s.paused);
  const setPaused = useUIStore((s) => s.setPaused);

  useEffect(() => {
    AudioManager.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    AudioManager.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    AudioManager.setTtsEnabled(ttsEnabled);
  }, [ttsEnabled]);

  // Pause: stop TTS when paused
  useEffect(() => {
    if (paused) AudioManager.stopTts();
    sceneRef.current?.setPaused(paused);
  }, [paused, lang, loading]);

  // TTS on HUD line change + SFX on phase change
  const prevPhase = useRef('');
  useEffect(() => {
    if (loading || paused) return;
    if (shouldNarrateHudLine(hud.line)) {
      AudioManager.tts(hud.line, lang, player?.nick);
    }
    if (hud.phase !== prevPhase.current) {
      if (hud.phase === 'outro') AudioManager.sfx('levelComplete');
      else if (hud.phase.includes('found') || hud.phase.includes('arrived')) AudioManager.sfx('found');
      prevPhase.current = hud.phase;
    }
  }, [hud.line, hud.phase, loading, lang, paused, player?.nick]);

  // SFX on stars change
  const prevStars = useRef(0);
  useEffect(() => {
    if (hud.stars > prevStars.current) {
      AudioManager.sfx('collect');
    }
    prevStars.current = hud.stars;
  }, [hud.stars]);

  // SFX on interact availability
  const prevCanInteract = useRef(false);
  useEffect(() => {
    if (hud.canInteract && !prevCanInteract.current) {
      AudioManager.sfx('tick');
    }
    prevCanInteract.current = hud.canInteract;
  }, [hud.canInteract]);

  const nick = player?.nick || '';
  const showKeys = hud.showMoveHint;
  const showStick = !hud.outro && hud.phase !== 'intro';

  return (
    <div className="m0-screen">
      <canvas ref={canvasRef} className="m0-canvas" />

      {!loading ? <RotateHint lang={lang} /> : null}
      {!loading ? <CameraLookHint lang={lang} /> : null}

      {loading ? (
        <LoadingOverlay lang={lang} assetsReady={assetsReady} onPlay={handlePlayFromLoading} />
      ) : null}

      <div className="m0-top">
        <div className="m0-title">
          {lang === 'kk' ? levelTitle.kk : levelTitle.ru}
          {nick ? ` · ${nick}` : ''}
        </div>
        <div className="m0-stats">
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

      {/* Shared Season 1 levels used to advertise Space in their HUD while
          touch players had no jump input at all. Level 11 makes the defect a
          hard blocker because golden flakes now require a real airborne
          catch; keep the same large right-thumb control as the prologue. */}
      {showStick ? (
        <button
          type="button"
          className="m0-jump"
          onPointerDown={(event) => {
            event.preventDefault();
            sceneRef.current?.jump();
          }}
          aria-label={lang === 'kk' ? 'Секіру' : 'Прыжок'}
        >
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V6" />
            <path d="M6 12l6-6 6 6" />
          </svg>
          <span className="m0-jump-label">{lang === 'kk' ? 'Секіру' : 'Прыжок'}</span>
        </button>
      ) : null}

      {showStick ? (
        <div className="m0-stick-zone" ref={zoneRef} aria-hidden>
          <div className="m0-stick" ref={stickRef} aria-label="Joystick">
            <div className="m0-knob" />
          </div>
        </div>
      ) : (
        <div className="m0-stick-zone m0-stick-hidden" ref={zoneRef} aria-hidden>
          <div className="m0-stick" ref={stickRef}>
            <div className="m0-knob" />
          </div>
        </div>
      )}

      {hud.outro ? (
        <div className="m0-outro">
          <ConfettiBurst active count={36} />
          <div className="m0-outro-card reward-pop">
            <div className="m0-outro-badge">
              {lang === 'kk' ? `${levelId}-деңгей` : `Уровень ${levelId}`}
            </div>
            <h2 className="m0-outro-title">
              {lang === 'kk' ? 'Керемет!' : 'Отлично получилось!'}
            </h2>
            <p className="m0-outro-line">{hud.line}</p>
            <div className="m0-outro-rewards">
              <Chip icon={<IconStar size={18} />} tone="star" className="m0-reward-pill">
                {rewardStars + hud.stars}
              </Chip>
              {rewardFriendId && (
                <Chip icon={<IconPaw size={18} />} tone="success" className="m0-reward-pill">
                  {lang === 'kk' ? 'Жаңа дос!' : 'Новый друг!'}
                </Chip>
              )}
            </div>
            <PlushButton variant="primary" size="lg" className="m0-continue" onClick={finishToMap}>
              {lang === 'kk' ? 'Саяхатты жалғастыру' : 'Продолжить путешествие'}
            </PlushButton>
            {(levelId === 9 || levelId === 16) && (
              <PlushButton
                variant="secondary"
                size="md"
                className="m0-continue"
                onClick={() => {
                  AudioManager.sfx('click');
                  AudioManager.stopTts();
                  AudioManager.stopMusic();
                  const earnedStars = rewardStars + hud.stars;
                  completeLevel(levelId, { stars: earnedStars, friendId: rewardFriendId });
                  useUIStore.getState().setActiveTab('qr');
                  setScreen('game');
                }}
              >
                {lang === 'kk'
                  ? 'QR туралы (орама)'
                  : 'Про QR на упаковке'}
              </PlushButton>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="m0-skip"
          onClick={() => {
            AudioManager.stopTts();
            AudioManager.stopMusic();
            setScreen('game');
          }}
        >
          {lang === 'kk' ? 'Картаға шығу →' : 'Выйти на карту →'}
        </button>
      )}

      <SettingsPanel />
    </div>
  );
}

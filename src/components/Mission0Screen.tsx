import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { useGameStore } from '@/store/useGameStore';
import { Mission0Scene, type L1Hud } from '@/three/scenes/Mission0Scene';
import { Chip } from '@/components/ui/Chip';
import { StepDots } from '@/components/ui/ProgressBar';
import { PlushButton } from '@/components/ui/PlushButton';
import { ConfettiBurst } from '@/components/ui/ConfettiBurst';
import { IconFruit, IconStar, IconPaw } from '@/components/ui/icons';
import { logError } from '@/utils/logger';
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
  const [initFailed, setInitFailed] = useState(false);
  const lang = useUIStore((s) => s.lang);
  const setScreen = useUIStore((s) => s.setScreen);
  const player = useGameStore((s) => s.player);
  const addStars = useGameStore((s) => s.addStars);
  const addFriend = useGameStore((s) => s.addFriend);
  const completeLevel = useGameStore((s) => s.completeLevel);

  const skipToGame = () => {
    try {
      localStorage.setItem('barsik_mission0_done', '1');
    } catch (e) {
      logError('mission0.markDone', e);
    }
    setScreen('game');
  };

  const finishToMap = () => {
    try {
      localStorage.setItem('barsik_mission0_done', '1');
    } catch (e) {
      logError('mission0.markDone', e);
    }
    addStars(Math.max(3, hud.stars || 3));
    addFriend({
      id: 'gardener_l1',
      name: lang === 'kk' ? 'Бағбан' : 'Садовник',
      description:
        lang === 'kk' ? 'Алғашқы дос Фруктовом лесу' : 'Первый друг на поляне Фруктового леса',
      rarity: 'common',
      chapter: 1,
      unlocked: true,
      asset: '',
    });
    completeLevel(0, { stars: Math.max(1, hud.stars) });
    setScreen('game');
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setLoading(true);
    setInitFailed(false);

    let scene: Mission0Scene;
    try {
      scene = new Mission0Scene(canvas);
    } catch (e) {
      // WebGL может быть недоступен (старый браузер / отключено) — не зависаем на спиннере.
      logError('mission0.create', e);
      setLoading(false);
      setInitFailed(true);
      return;
    }
    sceneRef.current = scene;

    scene
      .init(player?.nick || '', lang, setHud)
      .then(() => setLoading(false))
      .catch((e) => {
        logError('mission0.init', e);
        setLoading(false);
        setInitFailed(true);
      });
    return () => {
      scene.dispose();
      sceneRef.current = null;
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

      {loading ? (
        <div className="m0-loader">
          <div className="m0-loader-spin" />
          <span>{lang === 'kk' ? 'Жүктелуде...' : 'Загрузка...'}</span>
        </div>
      ) : null}

      {initFailed ? (
        <div className="m0-loader">
          <span>
            {lang === 'kk'
              ? 'Сахнаны жүктеу мүмкін болмады. Саяхатты жалғастырайық.'
              : 'Не удалось загрузить сцену. Продолжим путешествие.'}
          </span>
          <PlushButton variant="primary" size="lg" onClick={skipToGame}>
            {lang === 'kk' ? 'Жалғастыру' : 'Продолжить'}
          </PlushButton>
        </div>
      ) : null}

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
        </div>
      </div>

      {!hud.outro ? (
        <div className="m0-dialogue">
          <div className="m0-speaker">{hud.speaker}</div>
          <div className="m0-line">{hud.line}</div>
          <div className="m0-objective">{hud.objective}</div>
        </div>
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
        </div>
      ) : null}

      {hud.showActionHint && !hud.outro ? (
        <button
          type="button"
          className={`m0-action ${hud.canInteract ? 'is-ready' : ''}`}
          onClick={() => sceneRef.current?.tryInteract()}
          aria-label={lang === 'kk' ? 'Әрекет' : 'Действие'}
        >
          <span className="m0-action-paw">
            <IconPaw size={26} />
          </span>
          <span className="m0-action-label">
            {lang === 'kk' ? 'Басу' : 'Нажми'}
            <small>E</small>
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
                {hud.stars}
              </Chip>
            </div>
            <div className="m0-progress">
              <div className="m0-progress-label">
                {lang === 'kk' ? 'Фрукттар орманы' : 'Фруктовый лес'}
              </div>
              <StepDots total={JOURNEY_TOTAL_CHAPTERS} filled={1} />
            </div>
            <PlushButton variant="primary" size="lg" className="m0-continue" onClick={finishToMap}>
              {lang === 'kk' ? 'Саяхатты жалғастыру' : 'Продолжить путешествие'}
            </PlushButton>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="m0-skip"
          onClick={skipToGame}
        >
          {lang === 'kk' ? 'Өткізу →' : 'Пропустить →'}
        </button>
      )}
    </div>
  );
}

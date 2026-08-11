import { useCallback, useEffect, useRef, useState } from 'react';
import { onLoadProgress, setLoadProgressLang, type LoadProgress } from '@/three/loadProgress';
import { PlushButton } from './PlushButton';
import './LoadingOverlay.css';

const CW = 480;
const CH = 170;
const GROUND_Y = 132;
const GRAVITY = 1500;
const JUMP_V = -540;
const HERO_X = 50;
const HERO_W = 26;
const HERO_H = 28;

type Obstacle = { x: number; w: number; h: number; kind: 'rock' | 'bush' };

interface RunnerState {
  y: number;
  vy: number;
  jumping: boolean;
  obstacles: Obstacle[];
  t: number;
  score: number;
  best: number;
  speed: number;
  gameOver: boolean;
  nextSpawn: number;
  started: boolean;
}

function freshState(best: number): RunnerState {
  return {
    y: 0, vy: 0, jumping: false, obstacles: [], t: 0, score: 0, best,
    speed: 230, gameOver: false, nextSpawn: 0.9, started: false,
  };
}

/**
 * Loading screen with something to do.
 *
 * The old overlay was a real progress bar plus a Barsik you could pet — a
 * toy, not a game. This is a small pixel runner in the same spirit as the
 * request that prompted it (a dino-style jumper): a rock or a bush every
 * beat or so, one jump key, no lives system. It keeps running after the
 * level itself has finished loading — the point is the level does not
 * start until "Играть" is pressed, so finishing early buys more play, not
 * a wait for a button.
 *
 * No high score is kept between runs. This is a distraction for a loading
 * bar, not a feature; storing state for it would be answering a question
 * nobody asked.
 */
export function LoadingOverlay({
  label,
  lang = 'ru',
  assetsReady = false,
  onPlay,
}: {
  label?: string;
  lang?: 'ru' | 'kk';
  assetsReady?: boolean;
  onPlay?: () => void;
}) {
  const [progress, setProgress] = useState<LoadProgress>({
    loaded: 0, total: 0, ratio: 0, label: '', done: false,
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<RunnerState>(freshState(0));
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setLoadProgressLang(lang);
    return onLoadProgress(setProgress);
  }, [lang]);

  const jump = useCallback(() => {
    const s = stateRef.current;
    if (s.gameOver) {
      const next = freshState(Math.max(s.best, Math.floor(s.score)));
      next.started = true;
      next.jumping = true;
      next.vy = JUMP_V;
      stateRef.current = next;
      return;
    }
    s.started = true;
    if (!s.jumping) {
      s.jumping = true;
      s.vy = JUMP_V;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
    };
    const onPointer = (e: PointerEvent) => {
      e.preventDefault();
      jump();
    };
    window.addEventListener('keydown', onKey);
    canvas.addEventListener('pointerdown', onPointer);

    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = stateRef.current;

      if (s.started && !s.gameOver) {
        s.vy += GRAVITY * dt;
        s.y += s.vy * dt;
        if (s.y >= 0) {
          s.y = 0;
          s.vy = 0;
          s.jumping = false;
        }

        s.t += dt;
        s.score += dt * 12;
        s.speed = 230 + Math.min(220, s.t * 6);

        s.nextSpawn -= dt;
        if (s.nextSpawn <= 0) {
          const kind: Obstacle['kind'] = Math.random() < 0.5 ? 'rock' : 'bush';
          const w = kind === 'rock' ? 16 + Math.random() * 10 : 20 + Math.random() * 12;
          const h = kind === 'rock' ? 20 + Math.random() * 14 : 16 + Math.random() * 8;
          s.obstacles.push({ x: CW + 10, w, h, kind });
          s.nextSpawn = Math.max(0.55, 0.95 + Math.random() * 0.7 - s.t * 0.01);
        }
        for (const o of s.obstacles) o.x -= s.speed * dt;
        s.obstacles = s.obstacles.filter((o) => o.x + o.w > -10);

        const heroBox = {
          x: HERO_X + 5, y: GROUND_Y + s.y - HERO_H + 5, w: HERO_W - 10, h: HERO_H - 7,
        };
        for (const o of s.obstacles) {
          const obBox = { x: o.x, y: GROUND_Y - o.h, w: o.w, h: o.h };
          if (
            heroBox.x < obBox.x + obBox.w &&
            heroBox.x + heroBox.w > obBox.x &&
            heroBox.y < obBox.y + obBox.h &&
            heroBox.y + heroBox.h > obBox.y
          ) {
            s.gameOver = true;
            s.best = Math.max(s.best, Math.floor(s.score));
          }
        }
      }

      draw(ctx, s, lang);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('keydown', onKey);
      canvas.removeEventListener('pointerdown', onPointer);
    };
  }, [jump, lang]);

  const pct = Math.round(progress.ratio * 100);
  const caption = progress.label || label || (lang === 'kk' ? 'Жүктелуде' : 'Загрузка');

  return (
    <div className="loading-overlay">
      <div className="loading-overlay__card">
        <p className="loading-overlay__invite">
          {lang === 'kk' ? 'Кедергілерден секір!' : 'Прыгай через препятствия!'}
        </p>

        <canvas
          ref={canvasRef}
          width={CW}
          height={CH}
          className="loading-runner"
          role="img"
          aria-label={lang === 'kk' ? 'Мини-ойын: секіру' : 'Мини-игра: прыгай через препятствия'}
        />

        <div
          className="loading-overlay__bar"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="loading-overlay__bar-fill" style={{ width: `${pct}%` }} />
        </div>

        <span className="loading-overlay__text">
          {caption}
          {progress.total > 0 ? <em className="loading-overlay__pct"> {pct}%</em> : null}
        </span>

        {assetsReady && onPlay ? (
          <PlushButton
            variant="primary"
            size="lg"
            className="loading-overlay__play"
            onClick={onPlay}
          >
            {lang === 'kk' ? '▶ Ойнау' : '▶ Играть'}
          </PlushButton>
        ) : null}
      </div>
    </div>
  );
}

const SKY_TOP = '#bfe6ff';
const SKY_BOTTOM = '#eef8ea';
const GROUND = '#8fbf6a';
const DIRT = '#c9a76a';

function draw(ctx: CanvasRenderingContext2D, s: RunnerState, lang: 'ru' | 'kk') {
  const sky = ctx.createLinearGradient(0, 0, 0, CH);
  sky.addColorStop(0, SKY_TOP);
  sky.addColorStop(1, SKY_BOTTOM);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CW, CH);

  ctx.fillStyle = GROUND;
  ctx.fillRect(0, GROUND_Y, CW, CH - GROUND_Y);
  ctx.fillStyle = DIRT;
  ctx.fillRect(0, GROUND_Y, CW, 4);

  for (const o of s.obstacles) drawObstacle(ctx, o);
  drawHero(ctx, s);

  ctx.fillStyle = '#2d3436';
  ctx.font = '700 15px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(String(Math.floor(s.score)).padStart(4, '0'), CW - 10, 22);
  if (s.best > 0) {
    ctx.font = '700 10px monospace';
    ctx.fillStyle = '#57636b';
    ctx.fillText(
      (lang === 'kk' ? 'Ең жақсы ' : 'Лучший ') + String(s.best).padStart(4, '0'),
      CW - 10,
      36,
    );
  }

  ctx.textAlign = 'center';
  if (!s.started) {
    ctx.fillStyle = '#2d3436';
    ctx.font = '700 14px sans-serif';
    ctx.fillText(
      lang === 'kk' ? 'Секіру үшін түртіңіз' : 'Тапни, чтобы прыгнуть',
      CW / 2,
      GROUND_Y - 46,
    );
  } else if (s.gameOver) {
    ctx.fillStyle = 'rgba(20, 24, 20, 0.42)';
    ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = '#fff';
    ctx.font = '900 18px sans-serif';
    ctx.fillText(lang === 'kk' ? 'Соқтықты!' : 'Столкнулись!', CW / 2, CH / 2 - 6);
    ctx.font = '700 13px sans-serif';
    ctx.fillText(
      lang === 'kk' ? 'Тағы бастау үшін түртіңіз' : 'Тапни, чтобы начать заново',
      CW / 2,
      CH / 2 + 16,
    );
  }
}

function drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle) {
  const top = GROUND_Y - o.h;
  if (o.kind === 'rock') {
    ctx.fillStyle = '#8a8f96';
    ctx.beginPath();
    ctx.moveTo(o.x, GROUND_Y);
    ctx.lineTo(o.x + o.w * 0.15, top + o.h * 0.2);
    ctx.lineTo(o.x + o.w * 0.55, top);
    ctx.lineTo(o.x + o.w, top + o.h * 0.35);
    ctx.lineTo(o.x + o.w * 0.9, GROUND_Y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#6f7379';
    ctx.fillRect(o.x + o.w * 0.1, GROUND_Y - 4, o.w * 0.8, 4);
  } else {
    ctx.fillStyle = '#4f9d5c';
    ctx.beginPath();
    ctx.ellipse(o.x + o.w / 2, GROUND_Y - o.h / 2, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f8a4c';
    ctx.beginPath();
    ctx.ellipse(o.x + o.w * 0.35, GROUND_Y - o.h * 0.55, o.w * 0.28, o.h * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A blocky Barsik, not a dinosaur — same silhouette language as the 3D hero. */
function drawHero(ctx: CanvasRenderingContext2D, s: RunnerState) {
  const top = GROUND_Y + s.y - HERO_H;
  const x = HERO_X;
  const legPhase = s.jumping ? 0 : Math.floor(s.t * 10) % 2;

  ctx.fillStyle = '#3a3f45';
  ctx.fillRect(x + 3, top + HERO_H - 5, 6, 5 + (legPhase === 0 ? 2 : 0));
  ctx.fillRect(x + HERO_W - 9, top + HERO_H - 5, 6, 5 + (legPhase === 1 ? 2 : 0));

  ctx.fillStyle = '#eef1f4';
  ctx.fillRect(x, top + 8, HERO_W, HERO_H - 13);

  ctx.beginPath();
  ctx.moveTo(x + 2, top + 9);
  ctx.lineTo(x + 6, top);
  ctx.lineTo(x + 10, top + 9);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + HERO_W - 10, top + 9);
  ctx.lineTo(x + HERO_W - 6, top);
  ctx.lineTo(x + HERO_W - 2, top + 9);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#8a8f96';
  ctx.fillRect(x + 5, top + 3, 3, 3);
  ctx.fillRect(x + HERO_W - 12, top + 12, 3, 3);
  ctx.fillRect(x + 9, top + 16, 3, 3);

  ctx.fillStyle = '#2d3436';
  ctx.fillRect(x + HERO_W - 9, top + 12, 3, 3);
}

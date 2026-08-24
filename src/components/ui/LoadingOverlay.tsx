import { useCallback, useEffect, useRef, useState } from 'react';
import { onLoadProgress, setLoadProgressLang, type LoadProgress } from '@/three/loadProgress';
import { PlushButton } from './PlushButton';
import './LoadingOverlay.css';

const CW = 520;
const CH = 200;
const GROUND_Y = 152;
const GRAVITY = 1500;
const JUMP_V = -540;
const HERO_X = 56;
const HERO_W = 36;
const HERO_H = 38;

type Obstacle = { x: number; w: number; h: number; kind: 'rock' | 'bush' | 'stump' };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number };

interface RunnerState {
  y: number;
  vy: number;
  jumping: boolean;
  obstacles: Obstacle[];
  particles: Particle[];
  t: number;
  score: number;
  best: number;
  speed: number;
  gameOver: boolean;
  nextSpawn: number;
  started: boolean;
  justLanded: boolean;
  scroll: number;
}

function freshState(best: number): RunnerState {
  return {
    y: 0, vy: 0, jumping: false, obstacles: [], particles: [],
    t: 0, score: 0, best, speed: 230, gameOver: false, nextSpawn: 0.9,
    started: false, justLanded: false, scroll: 0,
  };
}

/**
 * Loading screen mini-runner — soft-3D plush Barsik hopping stones/bushes
 * while the world loads. Same rules as before (one jump, no lives); visuals
 * match Style Lock / Barsik Hum instead of flat chrome-dino blocks.
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
      burst(next, HERO_X + HERO_W / 2, GROUND_Y - 4, '#fff6c8', 8);
      stateRef.current = next;
      return;
    }
    s.started = true;
    if (!s.jumping) {
      s.jumping = true;
      s.vy = JUMP_V;
      burst(s, HERO_X + HERO_W / 2, GROUND_Y - 2, '#d4e8a8', 5);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

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
        const wasAir = s.jumping;
        s.vy += GRAVITY * dt;
        s.y += s.vy * dt;
        if (s.y >= 0) {
          s.y = 0;
          s.vy = 0;
          s.jumping = false;
          if (wasAir) {
            s.justLanded = true;
            burst(s, HERO_X + HERO_W / 2, GROUND_Y - 1, '#c9e08a', 6);
          }
        }

        s.t += dt;
        s.score += dt * 12;
        s.speed = 230 + Math.min(220, s.t * 6);
        s.scroll += s.speed * dt;

        s.nextSpawn -= dt;
        if (s.nextSpawn <= 0) {
          const roll = Math.random();
          const kind: Obstacle['kind'] =
            roll < 0.38 ? 'rock' : roll < 0.72 ? 'bush' : 'stump';
          const w =
            kind === 'rock' ? 22 + Math.random() * 12
            : kind === 'bush' ? 26 + Math.random() * 14
            : 20 + Math.random() * 8;
          const h =
            kind === 'rock' ? 22 + Math.random() * 14
            : kind === 'bush' ? 20 + Math.random() * 10
            : 28 + Math.random() * 8;
          s.obstacles.push({ x: CW + 14, w, h, kind });
          s.nextSpawn = Math.max(0.55, 0.95 + Math.random() * 0.7 - s.t * 0.01);
        }
        for (const o of s.obstacles) o.x -= s.speed * dt;
        s.obstacles = s.obstacles.filter((o) => o.x + o.w > -14);

        const heroBox = {
          x: HERO_X + 8, y: GROUND_Y + s.y - HERO_H + 8, w: HERO_W - 14, h: HERO_H - 10,
        };
        for (const o of s.obstacles) {
          const pad = o.kind === 'bush' ? 4 : 2;
          const obBox = { x: o.x + pad, y: GROUND_Y - o.h + pad, w: o.w - pad * 2, h: o.h - pad };
          if (
            heroBox.x < obBox.x + obBox.w &&
            heroBox.x + heroBox.w > obBox.x &&
            heroBox.y < obBox.y + obBox.h &&
            heroBox.y + heroBox.h > obBox.y
          ) {
            s.gameOver = true;
            s.best = Math.max(s.best, Math.floor(s.score));
            burst(s, HERO_X + HERO_W / 2, GROUND_Y + s.y - HERO_H / 2, '#ffd4c8', 12);
          }
        }
      } else if (!s.started) {
        s.scroll += 28 * dt;
      }

      for (const p of s.particles) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 280 * dt;
      }
      s.particles = s.particles.filter((p) => p.life > 0);

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

function burst(s: RunnerState, x: number, y: number, color: string, n: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 90;
    s.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 40,
      life: 0.35 + Math.random() * 0.35,
      max: 0.7,
      color,
      r: 2 + Math.random() * 3,
    });
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function draw(ctx: CanvasRenderingContext2D, s: RunnerState, lang: 'ru' | 'kk') {
  // Soft meadow sky
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, '#9fd8ff');
  sky.addColorStop(0.55, '#d4f0ff');
  sky.addColorStop(1, '#eaf8d8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CW, CH);

  drawSun(ctx, s.t);
  drawHills(ctx, s.scroll * 0.18, GROUND_Y - 28, '#b8e08a', 0.55);
  drawHills(ctx, s.scroll * 0.35, GROUND_Y - 10, '#9ecf6e', 0.85);
  drawClouds(ctx, s.scroll * 0.12, s.t);

  // Ground
  const ground = ctx.createLinearGradient(0, GROUND_Y, 0, CH);
  ground.addColorStop(0, '#8fce5a');
  ground.addColorStop(0.35, '#6fad42');
  ground.addColorStop(1, '#4e8a2e');
  ctx.fillStyle = ground;
  ctx.fillRect(0, GROUND_Y, CW, CH - GROUND_Y);

  // Soft path strip
  ctx.fillStyle = '#d9b57a';
  ctx.fillRect(0, GROUND_Y, CW, 7);
  ctx.fillStyle = '#c49a5c';
  ctx.fillRect(0, GROUND_Y + 5, CW, 3);

  // Grass tufts scrolling
  ctx.fillStyle = '#5a9e38';
  for (let i = 0; i < 18; i++) {
    const gx = ((i * 37 - s.scroll * 0.9) % (CW + 40)) - 20;
    const gh = 4 + (i % 3) * 2;
    ctx.beginPath();
    ctx.moveTo(gx, GROUND_Y + 1);
    ctx.quadraticCurveTo(gx + 3, GROUND_Y - gh, gx + 6, GROUND_Y + 1);
    ctx.fill();
  }

  for (const o of s.obstacles) drawObstacle(ctx, o);
  drawHero(ctx, s);

  for (const p of s.particles) {
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Score pill
  const scoreLabel = String(Math.floor(s.score)).padStart(4, '0');
  ctx.font = '800 14px "Nunito", "Segoe UI", sans-serif';
  const sw = ctx.measureText(scoreLabel).width + 22;
  roundRect(ctx, CW - sw - 10, 8, sw, 26, 13);
  ctx.fillStyle = 'rgba(255, 252, 245, 0.92)';
  ctx.fill();
  ctx.fillStyle = '#2d4a3a';
  ctx.textAlign = 'center';
  ctx.fillText(scoreLabel, CW - sw / 2 - 10, 26);

  if (s.best > 0) {
    ctx.font = '700 11px "Nunito", "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(45, 74, 58, 0.75)';
    ctx.textAlign = 'right';
    ctx.fillText(
      (lang === 'kk' ? 'Рекорд ' : 'Рекорд ') + String(s.best).padStart(4, '0'),
      CW - 12,
      48,
    );
  }

  ctx.textAlign = 'center';
  if (!s.started) {
    roundRect(ctx, CW / 2 - 118, GROUND_Y - 58, 236, 32, 16);
    ctx.fillStyle = 'rgba(255, 252, 245, 0.9)';
    ctx.fill();
    ctx.fillStyle = '#2d4a3a';
    ctx.font = '800 13px "Nunito", "Segoe UI", sans-serif';
    ctx.fillText(
      lang === 'kk' ? 'Секіру үшін түртіңіз ✨' : 'Тапни, чтобы прыгнуть ✨',
      CW / 2,
      GROUND_Y - 37,
    );
  } else if (s.gameOver) {
    ctx.fillStyle = 'rgba(30, 48, 40, 0.38)';
    ctx.fillRect(0, 0, CW, CH);
    roundRect(ctx, CW / 2 - 130, CH / 2 - 36, 260, 72, 18);
    ctx.fillStyle = 'rgba(255, 252, 245, 0.95)';
    ctx.fill();
    ctx.fillStyle = '#e17055';
    ctx.font = '900 18px "Nunito", "Segoe UI", sans-serif';
    ctx.fillText(lang === 'kk' ? 'Соқтықты!' : 'Столкнулись!', CW / 2, CH / 2 - 8);
    ctx.fillStyle = '#2d4a3a';
    ctx.font = '700 12px "Nunito", "Segoe UI", sans-serif';
    ctx.fillText(
      lang === 'kk' ? 'Тағы бастау үшін түртіңіз' : 'Тапни, чтобы начать заново',
      CW / 2,
      CH / 2 + 16,
    );
  }
}

function drawSun(ctx: CanvasRenderingContext2D, t: number) {
  const sx = CW - 58;
  const sy = 42 + Math.sin(t * 0.4) * 2;
  const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, 36);
  glow.addColorStop(0, 'rgba(255, 230, 120, 0.85)');
  glow.addColorStop(0.45, 'rgba(255, 210, 90, 0.35)');
  glow.addColorStop(1, 'rgba(255, 210, 90, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(sx, sy, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffe566';
  ctx.beginPath();
  ctx.arc(sx, sy, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.beginPath();
  ctx.arc(sx - 4, sy - 4, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawHills(
  ctx: CanvasRenderingContext2D,
  scroll: number,
  baseY: number,
  color: string,
  alpha: number,
) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  for (let x = -40; x <= CW + 40; x += 28) {
    const nx = x + ((scroll % 280) );
    const h = 18 + Math.sin(nx * 0.018) * 14 + Math.sin(nx * 0.041) * 8;
    ctx.lineTo(x, baseY - h);
  }
  ctx.lineTo(CW, GROUND_Y);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawClouds(ctx: CanvasRenderingContext2D, scroll: number, t: number) {
  const clouds = [
    { x: 40, y: 28, s: 1 },
    { x: 200, y: 18, s: 0.75 },
    { x: 360, y: 34, s: 1.1 },
  ];
  for (const c of clouds) {
    const cx = ((c.x - scroll) % (CW + 120) + CW + 120) % (CW + 120) - 40;
    const bob = Math.sin(t * 0.7 + c.x) * 2;
    drawCloud(ctx, cx, c.y + bob, c.s);
  }
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  const blobs = [
    [0, 0, 14], [16, -4, 18], [34, 0, 14], [10, 6, 12], [24, 6, 12],
  ];
  for (const [dx, dy, r] of blobs) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle) {
  const top = GROUND_Y - o.h;
  if (o.kind === 'rock') {
    // Soft pebble with highlight
    const g = ctx.createRadialGradient(
      o.x + o.w * 0.35, top + o.h * 0.3, 2,
      o.x + o.w * 0.5, top + o.h * 0.5, o.w * 0.7,
    );
    g.addColorStop(0, '#d0d5dc');
    g.addColorStop(0.55, '#9aa3ad');
    g.addColorStop(1, '#6f7780');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(o.x + 2, GROUND_Y);
    ctx.bezierCurveTo(o.x - 2, top + o.h * 0.55, o.x + o.w * 0.2, top - 2, o.x + o.w * 0.55, top);
    ctx.bezierCurveTo(o.x + o.w * 1.05, top + o.h * 0.15, o.x + o.w + 2, top + o.h * 0.55, o.x + o.w - 2, GROUND_Y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(o.x + o.w * 0.35, top + o.h * 0.32, o.w * 0.14, o.h * 0.1, -0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (o.kind === 'bush') {
    const g = ctx.createRadialGradient(
      o.x + o.w * 0.4, top + o.h * 0.35, 4,
      o.x + o.w * 0.5, top + o.h * 0.5, o.w * 0.65,
    );
    g.addColorStop(0, '#8fd96a');
    g.addColorStop(0.6, '#4fad4a');
    g.addColorStop(1, '#2f7a38');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(o.x + o.w / 2, GROUND_Y - o.h * 0.45, o.w * 0.52, o.h * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(o.x + o.w * 0.28, GROUND_Y - o.h * 0.55, o.w * 0.28, o.h * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(o.x + o.w * 0.72, GROUND_Y - o.h * 0.5, o.w * 0.26, o.h * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Berries
    ctx.fillStyle = '#ff7a6e';
    for (const [bx, by] of [[0.4, 0.4], [0.62, 0.55], [0.5, 0.7]] as const) {
      ctx.beginPath();
      ctx.arc(o.x + o.w * bx, GROUND_Y - o.h * by, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Tree stump
    const trunk = ctx.createLinearGradient(o.x, top, o.x + o.w, GROUND_Y);
    trunk.addColorStop(0, '#c9956a');
    trunk.addColorStop(1, '#8a5a36');
    ctx.fillStyle = trunk;
    roundRect(ctx, o.x + o.w * 0.15, top + 6, o.w * 0.7, o.h - 6, 4);
    ctx.fill();
    ctx.fillStyle = '#e8c49a';
    ctx.beginPath();
    ctx.ellipse(o.x + o.w / 2, top + 8, o.w * 0.42, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 70, 40, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(o.x + o.w / 2, top + 8, o.w * 0.22, 3.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Soft contact shadow
  ctx.fillStyle = 'rgba(40, 60, 30, 0.18)';
  ctx.beginPath();
  ctx.ellipse(o.x + o.w / 2, GROUND_Y + 2, o.w * 0.42, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Soft-3D plush snow-leopard cub — Style Lock silhouette. */
function drawHero(ctx: CanvasRenderingContext2D, s: RunnerState) {
  const top = GROUND_Y + s.y - HERO_H;
  const x = HERO_X;
  const legPhase = s.jumping ? 0.5 : (Math.sin(s.t * 14) + 1) / 2;
  const squash = s.jumping ? 0.92 : s.justLanded ? 1.06 : 1;
  s.justLanded = false;

  ctx.save();
  ctx.translate(x + HERO_W / 2, top + HERO_H);
  ctx.scale(1 / squash, squash);
  ctx.translate(-(x + HERO_W / 2), -(top + HERO_H));

  // Shadow
  ctx.fillStyle = 'rgba(40, 60, 30, 0.22)';
  ctx.beginPath();
  ctx.ellipse(
    x + HERO_W / 2,
    GROUND_Y + 3,
    14 * (s.jumping ? 0.65 : 1),
    3.2 * (s.jumping ? 0.65 : 1),
    0, 0, Math.PI * 2,
  );
  ctx.fill();

  // Tail
  ctx.strokeStyle = '#f2f4f7';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const tailWag = s.jumping ? -8 : Math.sin(s.t * 8) * 6;
  ctx.moveTo(x + 4, top + 22);
  ctx.quadraticCurveTo(x - 10, top + 18 + tailWag, x - 6, top + 8 + tailWag * 0.4);
  ctx.stroke();
  ctx.fillStyle = '#8a9098';
  ctx.beginPath();
  ctx.arc(x - 6, top + 8 + tailWag * 0.4, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  ctx.fillStyle = '#e8ebef';
  const liftL = legPhase < 0.5 ? 3 : 0;
  const liftR = legPhase >= 0.5 ? 3 : 0;
  roundRect(ctx, x + 6, top + HERO_H - 10 - liftL, 8, 10 + liftL, 3);
  ctx.fill();
  roundRect(ctx, x + HERO_W - 14, top + HERO_H - 10 - liftR, 8, 10 + liftR, 3);
  ctx.fill();
  ctx.fillStyle = '#3a4048';
  roundRect(ctx, x + 6, top + HERO_H - 4 - liftL, 8, 4, 2);
  ctx.fill();
  roundRect(ctx, x + HERO_W - 14, top + HERO_H - 4 - liftR, 8, 4, 2);
  ctx.fill();

  // Body
  const body = ctx.createRadialGradient(
    x + HERO_W * 0.4, top + 14, 4,
    x + HERO_W * 0.5, top + 20, 22,
  );
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.55, '#eef1f5');
  body.addColorStop(1, '#cfd5dc');
  ctx.fillStyle = body;
  roundRect(ctx, x + 2, top + 10, HERO_W - 4, HERO_H - 16, 12);
  ctx.fill();

  // Spots
  ctx.fillStyle = '#9aa1aa';
  for (const [sx, sy, sr] of [[10, 16, 2.2], [22, 20, 2.5], [14, 24, 1.8]] as const) {
    ctx.beginPath();
    ctx.arc(x + sx, top + sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Head
  const head = ctx.createRadialGradient(x + 14, top + 6, 2, x + 18, top + 10, 14);
  head.addColorStop(0, '#ffffff');
  head.addColorStop(1, '#e4e8ed');
  ctx.fillStyle = head;
  ctx.beginPath();
  ctx.ellipse(x + HERO_W / 2, top + 11, 14, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ears
  ctx.fillStyle = '#eef1f5';
  ctx.beginPath();
  ctx.moveTo(x + 8, top + 8);
  ctx.lineTo(x + 12, top - 2);
  ctx.lineTo(x + 17, top + 8);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + HERO_W - 17, top + 8);
  ctx.lineTo(x + HERO_W - 12, top - 2);
  ctx.lineTo(x + HERO_W - 8, top + 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f7b8c8';
  ctx.beginPath();
  ctx.moveTo(x + 11, top + 7);
  ctx.lineTo(x + 12.5, top + 1);
  ctx.lineTo(x + 15, top + 7);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + HERO_W - 15, top + 7);
  ctx.lineTo(x + HERO_W - 12.5, top + 1);
  ctx.lineTo(x + HERO_W - 11, top + 7);
  ctx.closePath();
  ctx.fill();

  // Eyes + cheek
  ctx.fillStyle = '#2a3238';
  ctx.beginPath();
  ctx.ellipse(x + 14, top + 11, 2.2, 2.6, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 24, top + 11, 2.2, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x + 13.4, top + 10.2, 0.8, 0, Math.PI * 2);
  ctx.arc(x + 23.4, top + 10.2, 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 150, 160, 0.45)';
  ctx.beginPath();
  ctx.ellipse(x + 10, top + 15, 3, 2, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 28, top + 15, 3, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Nose
  ctx.fillStyle = '#f08a9a';
  ctx.beginPath();
  ctx.ellipse(x + 19, top + 15, 2.2, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

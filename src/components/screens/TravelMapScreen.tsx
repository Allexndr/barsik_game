import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useUIStore } from '@/store/useUIStore';
import { Chip } from '@/components/ui/Chip';
import { PlushButton } from '@/components/ui/PlushButton';
import { IconCheck, IconLock, IconMinus, IconPaw, IconPlus } from '@/components/ui/icons';
import { useViewportTier } from '@/hooks/useViewportTier';
import {
  CHAPTER_PATHS,
  DESKTOP_PATHS,
  samplePathProgress,
  samplePathX,
  routePathD,
  pointsToSmoothPathD,
  type PathPoint,
} from './chapterPaths';
import './TravelMapScreen.css';

// В первом сезоне выходят уровни 0…16: Фруктовый лес 0…9 и Ледяная долина 10…16.
// Оставшиеся четыре узла карты — тизеры миров, а не фиктивные играбельные уровни.
const SEASON1_LEVELS = 17;

const CHAPTERS: {
  name: { ru: string; kk: string };
  color: string;
  levels: number;
  bg: string;
  bgDesktop?: string;
  labelFill: string;
}[] = [
  {
    name: { ru: 'Фруктовый лес', kk: 'Жеміс орманы' },
    color: '#2ecc71',
    levels: 10,
    bg: '/assets/map/chapter1_fruit_forest.jpg?v=20260814',
    bgDesktop: '/assets/map/chapter1_fruit_forest_desktop.jpg?v=20260814',
    labelFill: '#2f6b3f',
  },
  {
    name: { ru: 'Ледяная долина', kk: 'Мұз аңғары' },
    color: '#74b9ff',
    levels: 7,
    bg: '/assets/map/chapter2_ice_valley.jpg?v=20260814',
    labelFill: '#2c5a8a',
  },
  {
    name: { ru: 'Горное озеро', kk: 'Тау көлі' },
    color: '#00cec9',
    levels: 1,
    bg: '/assets/map/chapter3_mountain_lake.jpg?v=20260814',
    labelFill: '#0a6b68',
  },
  {
    name: { ru: 'Кок-Тобе', kk: 'Көктөбе' },
    color: '#fdcb6e',
    levels: 1,
    bg: '/assets/map/chapter4_kok_tobe.jpg?v=20260814',
    labelFill: '#8a5a12',
  },
  {
    name: { ru: 'Степь с тюльпанами', kk: 'Қызғалдақ даласы' },
    color: '#ff7675',
    levels: 1,
    bg: '/assets/map/chapter5_tulip_steppe.jpg?v=20260814',
    labelFill: '#8a2e3a',
  },
  {
    name: { ru: 'Город Друзей', kk: 'Достар қаласы' },
    color: '#5fbf7a',
    levels: 1,
    bg: '/assets/map/chapter6_friends_city.jpg?v=20260814',
    labelFill: '#3a2e7a',
  },
];

const CENTER_X = 430;
const AMPLITUDE = 190;
const V_STEP = 68;
const TOP_PAD = 70;
const BOTTOM_PAD = 90;
const LOOKAHEAD = 6;
const BAND_LEFT = CENTER_X - AMPLITUDE - 90;
const BAND_WIDTH = (AMPLITUDE + 90) * 2;
const BG_W = 600;
const BG_H = 900;
const DESKTOP_W = 1600;
const DESKTOP_H = 1066;
const ZOOM_MIN = 1;
const ZOOM_MAX = 2.75;

function clampCenter(
  cx: number,
  cy: number,
  vw: number,
  vh: number,
  mapX0: number,
  mapY0: number,
  mapX1: number,
  mapY1: number,
) {
  const halfW = vw / 2;
  const halfH = vh / 2;
  const minX = mapX0 + halfW;
  const maxX = Math.max(minX, mapX1 - halfW);
  const minY = mapY0 + halfH;
  const maxY = Math.max(minY, mapY1 - halfH);
  return {
    x: Math.min(maxX, Math.max(minX, cx)),
    y: Math.min(maxY, Math.max(minY, cy)),
  };
}

function wideViewSize(aspect: number, zoom: number) {
  if (DESKTOP_W / DESKTOP_H > aspect) {
    const viewH = DESKTOP_H / zoom;
    return { viewW: viewH * aspect, viewH };
  }
  const viewW = DESKTOP_W / zoom;
  return { viewW, viewH: viewW / aspect };
}

function coverFit(imgW: number, imgH: number, boxW: number, boxH: number) {
  const scale = Math.max(boxW / imgW, boxH / imgH);
  const renderW = imgW * scale;
  const renderH = imgH * scale;
  return {
    renderW,
    renderH,
    offsetX: (renderW - boxW) / 2,
    offsetY: (renderH - boxH) / 2,
    xNormToBoxX: (xNorm: number) => xNorm * renderW - (renderW - boxW) / 2,
  };
}

const CHAPTER_COVERS = CHAPTERS.map((ch) =>
  coverFit(BG_W, BG_H, BAND_WIDTH, ch.levels * V_STEP),
);

type Status = 'completed' | 'current' | 'near' | 'fog';

interface Pin {
  id: number;
  x: number;
  y: number;
  status: Status;
  chapterIdx: number;
}

interface ChapterBand {
  idx: number;
  color: string;
  name: string;
  top: number;
  bottom: number;
  labelY: number;
}

function chapterStartIndex(chapterIdx: number) {
  let start = 0;
  for (let i = 0; i < chapterIdx; i++) start += CHAPTERS[i].levels;
  return start;
}

function chapterOfLevel(level: number) {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    if (level < acc + CHAPTERS[i].levels) return i;
    acc += CHAPTERS[i].levels;
  }
  return CHAPTERS.length - 1;
}

function statusFor(globalIndex: number, currentLevel: number): Status {
  const dist = globalIndex - currentLevel;
  if (dist < 0) return 'completed';
  if (dist === 0) return 'current';
  if (dist <= LOOKAHEAD) return 'near';
  return 'fog';
}

/** Телефон: вертикальный серпантин через все главы. */
function buildPortraitPins(currentLevel: number): {
  pins: Pin[];
  bands: ChapterBand[];
  totalHeight: number;
} {
  const pins: Pin[] = [];
  const bands: ChapterBand[] = [];
  let globalIndex = 0;

  CHAPTERS.forEach((ch, chapterIdx) => {
    const chapterTop = TOP_PAD + globalIndex * V_STEP - V_STEP / 2;
    const cover = CHAPTER_COVERS[chapterIdx];
    const path = CHAPTER_PATHS[chapterIdx];
    for (let li = 0; li < ch.levels; li++) {
      const s = ch.levels > 1 ? li / (ch.levels - 1) : 0;
      const x = BAND_LEFT + cover.xNormToBoxX(samplePathX(path, s));
      const y = TOP_PAD + globalIndex * V_STEP;
      pins.push({
        id: globalIndex,
        x,
        y,
        status: statusFor(globalIndex, currentLevel),
        chapterIdx,
      });
      globalIndex++;
    }
    const chapterBottom = TOP_PAD + (globalIndex - 1) * V_STEP + V_STEP / 2;
    bands.push({
      idx: chapterIdx,
      color: ch.color,
      name: ch.name.ru,
      top: chapterTop,
      bottom: chapterBottom,
      labelY: chapterTop + 26,
    });
  });

  return { pins, bands, totalHeight: TOP_PAD + (globalIndex - 1) * V_STEP + BOTTOM_PAD };
}

/** Десктоп и планшет: выбранная глава во весь кадр со всеми пинами на тропе. */
function buildWidePins(currentLevel: number, activeChapterIdx: number): { pins: Pin[]; chapterIdx: number } {
  const ch = CHAPTERS[activeChapterIdx];
  const start = chapterStartIndex(activeChapterIdx);
  const path = DESKTOP_PATHS[activeChapterIdx] ?? DESKTOP_PATHS[0];
  const pins: Pin[] = [];

  for (let li = 0; li < ch.levels; li++) {
    const s = ch.levels > 1 ? li / (ch.levels - 1) : 0;
    const globalId = start + li;
    const p = samplePathProgress(path, s);
    const x = p.x * DESKTOP_W;
    const y = p.y * DESKTOP_H;
    pins.push({
      id: globalId,
      x,
      y,
      status: statusFor(globalId, currentLevel),
      chapterIdx: activeChapterIdx,
    });
  }

  return { pins, chapterIdx: activeChapterIdx };
}

function buildPortraitRouteD(
  portrait: { pins: Pin[] },
  fromPin: number,
  toPin: number,
): string {
  const pins = portrait.pins;
  if (toPin <= fromPin || !pins.length) return '';
  const pts: PathPoint[] = [];

  for (let i = fromPin; i < toPin; i++) {
    const a = pins[i];
    const b = pins[i + 1];
    if (!a || !b) continue;

    if (a.chapterIdx !== b.chapterIdx) {
      if (!pts.length) pts.push({ x: a.x, y: a.y });
      pts.push({ x: b.x, y: b.y });
      continue;
    }

    const ch = CHAPTERS[a.chapterIdx];
    const path = CHAPTER_PATHS[a.chapterIdx];
    const cover = CHAPTER_COVERS[a.chapterIdx];
    const start = pins.findIndex((p) => p.chapterIdx === a.chapterIdx);
    const localA = i - start;
    const localB = i + 1 - start;
    const s0 = ch.levels > 1 ? localA / (ch.levels - 1) : 0;
    const s1 = ch.levels > 1 ? localB / (ch.levels - 1) : 0;
    const steps = 12;
    for (let k = 0; k <= steps; k++) {
      if (k === 0 && pts.length) continue;
      const t = k / steps;
      const s = s0 + (s1 - s0) * t;
      const x = BAND_LEFT + cover.xNormToBoxX(samplePathX(path, s));
      const y = a.y + (b.y - a.y) * t;
      pts.push({ x, y });
    }
  }

  return pointsToSmoothPathD(pts);
}

export function TravelMapScreen() {
  const levelStars = useGameStore((s) => s.levelStars);
  const levelClean = useGameStore((s) => s.levelClean);
  const currentLevel = useGameStore((s) => s.currentLevel);
  const startEpisode = useUIStore((s) => s.startEpisode);
  const lang = useUIStore((s) => s.lang);
  const tier = useViewportTier();
  const wide = tier === 'desktop' || tier === 'tablet';

  const mapLevel = Math.min(Math.max(currentLevel, 0), SEASON1_LEVELS - 1);
  const playerChapterIdx = chapterOfLevel(mapLevel);
  const [selectedChapterIdx, setSelectedChapterIdx] = useState<number>(() => playerChapterIdx);

  useEffect(() => {
    setSelectedChapterIdx(chapterOfLevel(mapLevel));
  }, [mapLevel]);

  const portrait = useMemo(() => buildPortraitPins(mapLevel), [mapLevel]);
  const wideData = useMemo(() => buildWidePins(mapLevel, selectedChapterIdx), [mapLevel, selectedChapterIdx]);

  const pins = wide ? wideData.pins : portrait.pins;
  const bands = portrait.bands;

  const currentPin =
    pins.find((p) => p.id === mapLevel) ??
    pins.find((p) => p.status === 'current') ??
    pins[0] ??
    portrait.pins[0];

  const wideChapterIdx = selectedChapterIdx;
  const portraitBounds = {
    x0: BAND_LEFT,
    y0: bands[0]?.top ?? TOP_PAD - V_STEP / 2,
    x1: BAND_LEFT + BAND_WIDTH,
    y1: bands[bands.length - 1]?.bottom ?? portrait.totalHeight,
  };

  const [zoom, setZoom] = useState(ZOOM_MIN);
  const [center, setCenter] = useState(() =>
    wide
      ? { x: DESKTOP_W / 2, y: DESKTOP_H / 2 }
      : { x: currentPin.x, y: currentPin.y },
  );
  const [isDragging, setIsDragging] = useState(false);
  const [box, setBox] = useState({ w: 390, h: 520 });
  const dragRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setZoom(ZOOM_MIN);
    if (wide) {
      setCenter({ x: DESKTOP_W / 2, y: DESKTOP_H / 2 });
    } else {
      setCenter({ x: currentPin.x, y: currentPin.y });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChapterIdx, wide]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const sync = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setBox({ w: r.width, h: r.height });
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [wide]);

  const aspect = box.w / Math.max(box.h, 1);

  let viewW: number;
  let viewH: number;
  if (wide) {
    ({ viewW, viewH } = wideViewSize(aspect, zoom));
  } else {
    viewW = BAND_WIDTH / zoom;
    viewH = viewW / aspect;
  }

  const safeCenter = wide
    ? clampCenter(center.x, center.y, viewW, viewH, 0, 0, DESKTOP_W, DESKTOP_H)
    : clampCenter(
        center.x, center.y, viewW, viewH,
        portraitBounds.x0, portraitBounds.y0, portraitBounds.x1, portraitBounds.y1,
      );
  const viewBox = `${safeCenter.x - viewW / 2} ${safeCenter.y - viewH / 2} ${viewW} ${viewH}`;

  const handleZoomIn = () =>
    setZoom((z) => {
      const next = Math.min(z + 0.25, ZOOM_MAX);
      if (wide) {
        const { viewW: nw, viewH: nh } = wideViewSize(aspect, next);
        setCenter(clampCenter(currentPin.x, currentPin.y, nw, nh, 0, 0, DESKTOP_W, DESKTOP_H));
      }
      return next;
    });

  const handleZoomOut = () =>
    setZoom((z) => {
      const next = Math.max(z - 0.25, ZOOM_MIN);
      if (wide) {
        const { viewW: nw, viewH: nh } = wideViewSize(aspect, next);
        setCenter(clampCenter(currentPin.x, currentPin.y, nw, nh, 0, 0, DESKTOP_W, DESKTOP_H));
      }
      return next;
    });

  const handleRecenter = () => {
    const myChapter = chapterOfLevel(mapLevel);
    setSelectedChapterIdx(myChapter);
    setZoom(ZOOM_MIN);
    if (wide) {
      setCenter({ x: DESKTOP_W / 2, y: DESKTOP_H / 2 });
    } else {
      setCenter({ x: currentPin.x, y: currentPin.y });
    }
  };

  const seasonDone = currentLevel >= SEASON1_LEVELS;
  const levelLabel = mapLevel + 1;
  const season1Done = Object.keys(levelStars)
    .filter((id) => Number(id) < SEASON1_LEVELS && levelStars[Number(id)] > 0).length;

  const handlePinClick = (level: number) => {
    if (level <= currentLevel && level < SEASON1_LEVELS) startEpisode(level);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    dragRef.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scale = viewW / rect.width;
    const dx = (e.clientX - dragRef.current.x) * scale;
    const dy = (e.clientY - dragRef.current.y) * scale;
    dragRef.current = { x: e.clientX, y: e.clientY };
    setCenter((c) => {
      const next = { x: c.x - dx, y: c.y - dy };
      return wide
        ? clampCenter(next.x, next.y, viewW, viewH, 0, 0, DESKTOP_W, DESKTOP_H)
        : clampCenter(
            next.x, next.y, viewW, viewH,
            portraitBounds.x0, portraitBounds.y0, portraitBounds.x1, portraitBounds.y1,
          );
    });
  };
  const onPointerUp = () => setIsDragging(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => (e.deltaY < 0
        ? Math.min(z + 0.25, ZOOM_MAX)
        : Math.max(z - 0.25, ZOOM_MIN)));
    };
    el.addEventListener('wheel', onWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', onWheelNative);
  }, [wide]);

  const localPins = pins;
  const splitLocal = localPins.findIndex((p) => p.id >= currentLevel);
  const splitIdx = splitLocal < 0 ? localPins.length - 1 : splitLocal;

  const [pathDoneD, pathAheadD] = wide
    ? (() => {
        const norm = DESKTOP_PATHS[selectedChapterIdx] ?? DESKTOP_PATHS[0];
        const toSvg = (p: PathPoint): PathPoint => ({ x: p.x * DESKTOP_W, y: p.y * DESKTOP_H });
        return [
          routePathD(norm, localPins.length, 0, splitIdx, toSvg),
          routePathD(norm, localPins.length, splitIdx, localPins.length - 1, toSvg),
        ];
      })()
    : [
        buildPortraitRouteD(portrait, 0, splitIdx),
        buildPortraitRouteD(portrait, splitIdx, portrait.pins.length - 1),
      ];

  const activeChapterData = CHAPTERS[selectedChapterIdx];
  const currentChapterName =
    lang === 'kk' ? activeChapterData.name.kk : activeChapterData.name.ru;

  const wideCh = CHAPTERS[wideChapterIdx];
  const wideBg = wideCh.bgDesktop ?? wideCh.bg;

  const HERE_TIP_ABOVE_PIN = wide ? 20 : 14;
  const HERE_BUBBLE_SPAN = wide ? 55 : 42;
  const HERE_FLOAT_AMPLITUDE = 6;
  const hereTopBound = wide ? 0 : portraitBounds.y0;
  const hereScale = Math.min(
    1,
    Math.max(
      0.2,
      (currentPin.y - HERE_TIP_ABOVE_PIN - HERE_FLOAT_AMPLITUDE - hereTopBound) / HERE_BUBBLE_SPAN,
    ),
  );

  return (
    <div className={`screen screen-travel screen-travel--${tier} ${wide ? 'is-wide' : ''}`}>
      <div className="travel-chrome travel-header">
        <div className="travel-header-left">
          <h2>{lang === 'kk' ? 'Барсик саяхаты' : 'Путешествие Барсика'}</h2>
          <div className="travel-chapter-switcher">
            <button
              type="button"
              className="chapter-nav-arrow"
              disabled={selectedChapterIdx <= 0}
              onClick={() => setSelectedChapterIdx((i) => Math.max(0, i - 1))}
              aria-label={lang === 'kk' ? 'Алдыңғы биом' : 'Предыдущий биом'}
            >
              ◀
            </button>
            <span className="travel-chapter">{currentChapterName}</span>
            <button
              type="button"
              className="chapter-nav-arrow"
              disabled={selectedChapterIdx >= CHAPTERS.length - 1}
              onClick={() => setSelectedChapterIdx((i) => Math.min(CHAPTERS.length - 1, i + 1))}
              aria-label={lang === 'kk' ? 'Келесі биом' : 'Следующий биом'}
            >
              ▶
            </button>
          </div>
        </div>

        <div className="travel-stats">
          <Chip icon={<IconCheck size={16} />} tone="success">
            {season1Done}/{SEASON1_LEVELS}
          </Chip>
        </div>
      </div>

      {/* Горизонтальный навигатор биомов (все 6 миров с быстрым переходом) */}
      <div className="travel-chrome travel-biome-bar">
        {CHAPTERS.map((ch, idx) => {
          const isSelected = idx === selectedChapterIdx;
          const isPlayerBiome = idx === playerChapterIdx;
          const isUnlocked = idx <= playerChapterIdx;
          const chStart = chapterStartIndex(idx);
          const chEnd = chStart + ch.levels;
          const doneInChapter = Object.keys(levelStars)
            .filter((id) => Number(id) >= chStart && Number(id) < chEnd && levelStars[Number(id)] > 0).length;
          const emoji = idx === 0 ? '🍓' : idx === 1 ? '❄️' : idx === 2 ? '🏔️' : idx === 3 ? '🌲' : idx === 4 ? '🌷' : '🏰';

          return (
            <button
              key={idx}
              type="button"
              className={`biome-pill ${isSelected ? 'is-selected' : ''} ${isPlayerBiome ? 'is-player-here' : ''} ${isUnlocked ? 'is-unlocked' : 'is-locked'}`}
              onClick={() => setSelectedChapterIdx(idx)}
            >
              <span className="biome-pill-emoji">{emoji}</span>
              <span className="biome-pill-name">{lang === 'kk' ? ch.name.kk : ch.name.ru}</span>
              {idx < 2 ? (
                <span className="biome-pill-badge">{doneInChapter}/{ch.levels}</span>
              ) : (
                <span className="biome-pill-badge is-teaser">🔒</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="travel-chrome travel-controls">
        <button
          type="button"
          className="travel-icon-btn travel-icon-btn-wide"
          onClick={handleRecenter}
        >
          {lang === 'kk' ? 'Орталықтандыру' : 'К себе'}
        </button>
        <button
          type="button"
          className="travel-icon-btn"
          onClick={handleZoomOut}
          disabled={zoom <= ZOOM_MIN}
          aria-label={lang === 'kk' ? 'Кішірейту' : 'Отдалить'}
        >
          <IconMinus size={18} />
        </button>
        <button
          type="button"
          className="travel-icon-btn"
          onClick={handleZoomIn}
          disabled={zoom >= ZOOM_MAX}
          aria-label={lang === 'kk' ? 'Үлкейту' : 'Приблизить'}
        >
          <IconPlus size={18} />
        </button>
      </div>

      <div className={`map-stage map-stage--${tier}`}>
        <div
          className={`map-container map-container--chapter-${wideChapterIdx}`}
          ref={containerRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <svg className="map-svg" viewBox={viewBox} preserveAspectRatio="xMidYMid slice">
            {wide ? (
              <image
                href={wideBg}
                x={0}
                y={0}
                width={DESKTOP_W}
                height={DESKTOP_H}
                preserveAspectRatio={wideCh.bgDesktop ? 'none' : 'xMidYMid slice'}
              />
            ) : (
              <>
                <defs>
                  {bands.map((b) => (
                    <clipPath key={`clip-${b.idx}`} id={`chapter-clip-${b.idx}`}>
                      <rect x={BAND_LEFT} y={b.top} width={BAND_WIDTH} height={b.bottom - b.top} />
                    </clipPath>
                  ))}
                </defs>
                {bands.map((b) => {
                  const ch = CHAPTERS[b.idx];
                  const cover = CHAPTER_COVERS[b.idx];
                  const labelW = Math.min(
                    BAND_WIDTH - 24,
                    (lang === 'kk' ? ch.name.kk : b.name).length * 9 + 48,
                  );
                  return (
                    <g key={b.idx}>
                      <image
                        href={ch.bg}
                        x={BAND_LEFT - cover.offsetX}
                        y={b.top - cover.offsetY}
                        width={cover.renderW}
                        height={cover.renderH}
                        clipPath={`url(#chapter-clip-${b.idx})`}
                        preserveAspectRatio="none"
                      />
                      <rect
                        x={BAND_LEFT + 10}
                        y={b.labelY - 18}
                        width={labelW}
                        height="28"
                        rx="14"
                        fill="#fff"
                        opacity="0.88"
                      />
                      <circle cx={BAND_LEFT + 28} cy={b.labelY} r="6" fill={b.color} />
                      <text
                        x={BAND_LEFT + 44}
                        y={b.labelY + 5}
                        className="chapter-label"
                        fill={ch.labelFill}
                      >
                        {lang === 'kk' ? ch.name.kk : b.name}
                      </text>
                    </g>
                  );
                })}
              </>
            )}

            {pathAheadD && (
              <path
                d={pathAheadD}
                fill="none"
                stroke="#74b9ff"
                strokeWidth={wide ? '8' : '5'}
                strokeDasharray={wide ? '6,14' : '3,10'}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.75"
              />
            )}
            {pathDoneD && (
              <path
                d={pathDoneD}
                fill="none"
                stroke="#00b894"
                strokeWidth={wide ? '10' : '6'}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {localPins.map((pin) => {
              const chapterColor = CHAPTERS[pin.chapterIdx].color;
              if (pin.status === 'fog') {
                return (
                  <circle key={pin.id} cx={pin.x} cy={pin.y} r={wide ? 8 : 5} fill="#9bb8c9" opacity="0.4" />
                );
              }

              const r = wide
                ? (pin.status === 'current' ? 36 : 28)
                : (pin.status === 'current' ? 20 : 15);
              const playable = pin.status === 'current' || pin.status === 'completed';
              const pinLabel = lang === 'kk'
                ? `${pin.id + 1}-деңгей, ${pin.status === 'current' ? 'қазіргі' : 'өтілген'}`
                : `Уровень ${pin.id + 1}, ${pin.status === 'current' ? 'текущий' : 'пройден'}`;

              return (
                <g
                  key={pin.id}
                  className={`pin-group pin-${pin.status}`}
                  role={playable ? 'button' : undefined}
                  tabIndex={playable ? 0 : -1}
                  aria-label={playable ? pinLabel : undefined}
                  onClick={() => handlePinClick(pin.id)}
                  onKeyDown={(event) => {
                    if (playable && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      handlePinClick(pin.id);
                    }
                  }}
                  style={{ cursor: pin.status !== 'near' ? 'pointer' : 'default' }}
                >
                  <circle className="pin-hit" cx={pin.x} cy={pin.y} r={r + (wide ? 16 : 10)} />
                  <g className="pin-visual">
                    {pin.status === 'current' && (
                      <circle cx={pin.x} cy={pin.y} r={wide ? '44' : '22'} className="pin-pulse-ring" fill="none" />
                    )}
                    <circle
                      cx={pin.x}
                      cy={pin.y}
                      r={r}
                      fill={
                        pin.status === 'current' ? '#fff' : pin.status === 'near' ? '#e8f4f8' : chapterColor
                      }
                    />
                    <circle
                      cx={pin.x}
                      cy={pin.y}
                      r={r}
                      fill="none"
                      stroke={pin.status === 'current' ? chapterColor : '#fff'}
                      strokeWidth={pin.status === 'current' ? (wide ? 6 : 4) : (wide ? 3 : 2)}
                    />
                    {pin.status === 'completed' && (
                      <g transform={`translate(${pin.x - (wide ? 12 : 7)}, ${pin.y - (wide ? 12 : 7)}) scale(${wide ? 1.0 : 0.6})`}>
                        <IconCheckPath />
                      </g>
                    )}
                    {pin.status === 'completed' && (levelStars[pin.id] ?? 0) > 0 && (
                      <g className="pin-score" pointerEvents="none">
                        <rect
                          x={pin.x - (wide ? 26 : 15)}
                          y={pin.y + r - (wide ? 3 : 1)}
                          width={wide ? 52 : 30}
                          height={wide ? 24 : 15}
                          rx={wide ? 12 : 7.5}
                          className="pin-score-plate"
                        />
                        <text
                          x={pin.x}
                          y={pin.y + r + (wide ? 14 : 10)}
                          textAnchor="middle"
                          className={`pin-score-text${levelClean[pin.id] ? ' is-clean' : ''}`}
                          style={{ fontSize: wide ? '15px' : '11px' }}
                        >
                          {levelClean[pin.id] ? `✦ ${levelStars[pin.id]}` : `★ ${levelStars[pin.id]}`}
                        </text>
                      </g>
                    )}
                    {pin.status === 'near' && (
                      <g transform={`translate(${pin.x - (wide ? 10 : 6)}, ${pin.y - (wide ? 10 : 6)}) scale(${wide ? 0.8 : 0.5})`}>
                        <IconLockPath />
                      </g>
                    )}
                    {pin.status === 'current' && (
                      <text
                        x={pin.x}
                        y={pin.y + (wide ? 8 : 5)}
                        textAnchor="middle"
                        className="pin-number-current"
                        style={{ fontSize: wide ? '22px' : '13px' }}
                        fill={chapterColor}
                      >
                        {pin.id + 1}
                      </text>
                    )}
                  </g>
                </g>
              );
            })}

            {/* Иконка "Ты здесь" над активным пином */}
            {currentPin && currentPin.status === 'current' && (
              <g transform={`translate(${currentPin.x}, ${currentPin.y - (wide ? 60 : 44)})`}>
                <g
                  transform={
                    hereScale < 1 ? `translate(0,30) scale(${hereScale}) translate(0,-30)` : undefined
                  }
                >
                  <g className="pin-here" transform={wide ? 'scale(1.2) translate(0,-5)' : undefined}>
                    <path
                      d="M0 30 C-14 30 -18 16 -18 6 A18 18 0 1 1 18 6 C18 16 14 30 0 30 Z"
                      fill="#2aa8d8"
                      stroke="#fff"
                      strokeWidth="3"
                    />
                    <g transform="translate(-9, -13) scale(0.75)" fill="#fff">
                      <IconPawPath />
                    </g>
                  </g>
                </g>
              </g>
            )}
          </svg>
        </div>
      </div>

      <div className="travel-chrome travel-legend">
        <div className="legend-item">
          <span className="legend-dot legend-dot-done" />
          {lang === 'kk' ? 'Өтілді' : 'Пройдено'}
        </div>
        <div className="legend-item">
          <span className="legend-dot legend-dot-current" />
          {lang === 'kk' ? 'Сен осындасың' : 'Ты здесь'}
        </div>
        <div className="legend-item">
          <IconLock size={14} />
          {lang === 'kk' ? 'Жабық' : 'Скоро откроется'}
        </div>
      </div>

      <div className="travel-chrome travel-cta-dock">
        <PlushButton
          variant="primary"
          size="lg"
          icon={<IconPaw size={22} />}
          onClick={() => handlePinClick(mapLevel)}
        >
          {seasonDone
            ? lang === 'kk'
              ? `${levelLabel}-деңгейді қайта ойнау`
              : `Пройти уровень ${levelLabel} ещё раз`
            : lang === 'kk'
              ? `Ойнау · ${levelLabel}-деңгей`
              : `Играть · Уровень ${levelLabel}`}
        </PlushButton>
      </div>
    </div>
  );
}

function IconCheckPath() {
  return (
    <path
      d="M1 6.5l4 4 8-9"
      fill="none"
      stroke="#fff"
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function IconLockPath() {
  return (
    <g>
      <rect x="1" y="7" width="12" height="8" rx="2.5" fill="#8a86c9" />
      <path
        d="M3.2 7V5.3a3.8 3.8 0 0 1 7.6 0V7"
        fill="none"
        stroke="#8a86c9"
        strokeWidth="1.8"
      />
    </g>
  );
}

function IconPawPath() {
  return (
    <g>
      <ellipse cx="12" cy="15.5" rx="5.4" ry="4.6" />
      <ellipse cx="5.4" cy="9.6" rx="2.1" ry="2.6" />
      <ellipse cx="9.6" cy="6.4" rx="2.1" ry="2.7" />
      <ellipse cx="14.4" cy="6.4" rx="2.1" ry="2.7" />
      <ellipse cx="18.6" cy="9.6" rx="2.1" ry="2.6" />
    </g>
  );
}

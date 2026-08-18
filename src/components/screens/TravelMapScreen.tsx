import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useUIStore } from '@/store/useUIStore';
import { Chip } from '@/components/ui/Chip';
import { PlushButton } from '@/components/ui/PlushButton';
import { IconCheck, IconLock, IconMinus, IconPaw, IconPlus } from '@/components/ui/icons';
import { useViewportTier } from '@/hooks/useViewportTier';
import {
  CHAPTER_PATHS,
  CHAPTER1_DESKTOP_PATH,
  samplePathProgress,
  samplePathX,
  type PathPoint,
} from './chapterPaths';
import './TravelMapScreen.css';

// Season 1 ships levels 0..16: Fruit Forest 0..9 + Ice Valley 10..16.
// The remaining four map nodes are world teasers, not fake playable levels.
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
    bg: '/assets/map/chapter1_fruit_forest.jpg',
    bgDesktop: '/assets/map/chapter1_fruit_forest_desktop.jpg',
    labelFill: '#2f6b3f',
  },
  {
    name: { ru: 'Ледяная долина', kk: 'Мұз аңғары' },
    color: '#74b9ff',
    levels: 7,
    bg: '/assets/map/chapter2_ice_valley.jpg',
    labelFill: '#2c5a8a',
  },
  {
    name: { ru: 'Горное озеро', kk: 'Тау көлі' },
    color: '#00cec9',
    levels: 1,
    bg: '/assets/map/chapter3_mountain_lake.jpg',
    labelFill: '#0a6b68',
  },
  {
    name: { ru: 'Кок-Тобе', kk: 'Көктөбе' },
    color: '#fdcb6e',
    levels: 1,
    bg: '/assets/map/chapter4_kok_tobe.jpg',
    labelFill: '#8a5a12',
  },
  {
    name: { ru: 'Степь с тюльпанами', kk: 'Қызғалдақ даласы' },
    color: '#ff7675',
    levels: 1,
    bg: '/assets/map/chapter5_tulip_steppe.jpg',
    labelFill: '#8a2e3a',
  },
  {
    name: { ru: 'Город Друзей', kk: 'Достар қаласы' },
    color: '#6c5ce7',
    levels: 1,
    bg: '/assets/map/chapter6_friends_city.jpg',
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

/**
 * Keep the camera inside the art — never show empty SVG outside the image.
 *
 * Takes the content's own bounding box (`mapX0..mapX1`, `mapY0..mapY1`)
 * rather than assuming it starts at the origin: the portrait band starts at
 * `BAND_LEFT`, not 0, and its top is the first chapter's clip rect, not 0.
 */
function clampCenter(
  cx: number,
  cy: number,
  vw: number,
  vh: number,
  mapX0: number,
  mapY0: number,
  mapX1: number,
  mapY1: number
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
  // Cover: one axis matches the art, the other crops — no letterbox.
  if (DESKTOP_W / DESKTOP_H > aspect) {
    const viewH = DESKTOP_H / zoom;
    return { viewW: viewH * aspect, viewH };
  }
  const viewW = DESKTOP_W / zoom;
  return { viewW, viewH: viewW / aspect };
}

const DESKTOP_PATHS: (PathPoint[] | null)[] = [
  CHAPTER1_DESKTOP_PATH,
  null,
  null,
  null,
  null,
  null,
];

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
  coverFit(BG_W, BG_H, BAND_WIDTH, ch.levels * V_STEP)
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

/** Phone: vertical serpentine through all chapters. */
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

/** Desktop/tablet: current chapter full-bleed, pins on landscape (or portrait cover) path. */
function buildWidePins(currentLevel: number): { pins: Pin[]; chapterIdx: number } {
  const chapterIdx = chapterOfLevel(currentLevel);
  const ch = CHAPTERS[chapterIdx];
  const start = chapterStartIndex(chapterIdx);
  const path = DESKTOP_PATHS[chapterIdx];
  const pins: Pin[] = [];

  for (let li = 0; li < ch.levels; li++) {
    const s = ch.levels > 1 ? li / (ch.levels - 1) : 0;
    const globalId = start + li;
    let x: number;
    let y: number;
    if (path) {
      const p = samplePathProgress(path, s);
      x = p.x * DESKTOP_W;
      y = p.y * DESKTOP_H;
    } else {
      // Portrait art cover-fitted into landscape frame — sample vertical path onto center band.
      const p = samplePathProgress(CHAPTER_PATHS[chapterIdx], s);
      const cover = coverFit(BG_W, BG_H, DESKTOP_W, DESKTOP_H);
      x = p.x * cover.renderW - cover.offsetX;
      y = p.y * cover.renderH - cover.offsetY;
    }
    pins.push({
      id: globalId,
      x,
      y,
      status: statusFor(globalId, currentLevel),
      chapterIdx,
    });
  }

  return { pins, chapterIdx };
}

export function TravelMapScreen() {
  const levelStars = useGameStore((s) => s.levelStars);
  const currentLevel = useGameStore((s) => s.currentLevel);
  const startEpisode = useUIStore((s) => s.startEpisode);
  const lang = useUIStore((s) => s.lang);
  const tier = useViewportTier();
  const wide = tier === 'desktop' || tier === 'tablet';

  const portrait = useMemo(() => buildPortraitPins(currentLevel), [currentLevel]);
  const wideData = useMemo(() => buildWidePins(currentLevel), [currentLevel]);

  const pins = wide ? wideData.pins : portrait.pins;
  const bands = portrait.bands;
  const currentPin =
    pins.find((p) => p.id === currentLevel) ?? pins[pins.length - 1] ?? portrait.pins[0];
  const wideChapterIdx = wideData.chapterIdx;
  // The portrait band's own bounding box — chapter art is clipped to each
  // band's [top, bottom], so nothing ever renders above the first band's
  // top or below the last one's bottom, whatever the cover-fitted image's
  // own extent is.
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
      : { x: currentPin.x, y: currentPin.y }
  );
  const [isDragging, setIsDragging] = useState(false);
  const [box, setBox] = useState({ w: 390, h: 520 });
  const dragRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setZoom(ZOOM_MIN);
    if (wide) {
      // Full art in frame — don't pan to edge pin (that created green void).
      setCenter({ x: DESKTOP_W / 2, y: DESKTOP_H / 2 });
    } else {
      setCenter({ x: currentPin.x, y: currentPin.y });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLevel, wide]);

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
        portraitBounds.x0, portraitBounds.y0, portraitBounds.x1, portraitBounds.y1
      );
  const viewBox = `${safeCenter.x - viewW / 2} ${safeCenter.y - viewH / 2} ${viewW} ${viewH}`;

  const handleZoomIn = () =>
    setZoom((z) => {
      const next = Math.min(z + 0.25, ZOOM_MAX);
      if (wide) {
        const { viewW: nw, viewH: nh } = wideViewSize(aspect, next);
        // Zoom toward current pin, but stay inside the art.
        setCenter(
          clampCenter(currentPin.x, currentPin.y, nw, nh, 0, 0, DESKTOP_W, DESKTOP_H)
        );
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
    setZoom(ZOOM_MIN);
    if (wide) {
      setCenter({ x: DESKTOP_W / 2, y: DESKTOP_H / 2 });
    } else {
      setCenter({ x: currentPin.x, y: currentPin.y });
    }
  };

  const seasonDone = currentLevel >= SEASON1_LEVELS;
  const levelLabel = Math.min(currentLevel, SEASON1_LEVELS - 1) + 1;
  // Levels actually finished, not levels reachable. This counted unlocked
  // levels while wearing a tick icon, so it always claimed one more than the
  // child had done: standing on an unplayed level 6 it read «6/17».
  const season1Done = Object.keys(levelStars)
    .filter((id) => Number(id) < SEASON1_LEVELS && levelStars[Number(id)] > 0).length;

  const handlePinClick = (level: number) => {
    // Only route to real Season 1 missions; Season 2 pins are locked teasers.
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
            portraitBounds.x0, portraitBounds.y0, portraitBounds.x1, portraitBounds.y1
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
  const pathDone = localPins
    .slice(0, splitIdx + 1)
    .map((p) => `${p.x},${p.y}`)
    .join(' L ');
  const pathAhead = localPins
    .slice(splitIdx)
    .map((p) => `${p.x},${p.y}`)
    .join(' L ');

  const chapterIdx = wide ? wideChapterIdx : currentPin.chapterIdx;
  const currentChapterName =
    lang === 'kk' ? CHAPTERS[chapterIdx].name.kk : CHAPTERS[chapterIdx].name.ru;

  const wideCh = CHAPTERS[wideChapterIdx];
  const wideBg = wideCh.bgDesktop ?? wideCh.bg;
  const wideCover = coverFit(BG_W, BG_H, DESKTOP_W, DESKTOP_H);

  return (
    <div className={`screen screen-travel screen-travel--${tier} ${wide ? 'is-wide' : ''}`}>
      <div className="travel-chrome travel-header">
        <div>
          <h2>{lang === 'kk' ? 'Барсик саяхаты' : 'Путешествие Барсика'}</h2>
          <p className="travel-chapter">{currentChapterName}</p>
        </div>
        {/*
          One chip. The level number was here too, and the big green button at
          the bottom of the same screen already says «Играть · Уровень 6» —
          three sixes on one phone screen, two of them decorative.
        */}
        <div className="travel-stats">
          <Chip icon={<IconCheck size={16} />} tone="success">
            {season1Done}/{SEASON1_LEVELS}
          </Chip>
        </div>
      </div>

      <div className="travel-chrome travel-controls">
        <button type="button" className="travel-icon-btn travel-icon-btn-wide" onClick={handleRecenter}>
          {lang === 'kk' ? 'Орталықтандыру' : 'К себе'}
        </button>
        {/*
          Both directions. There was a + and no −, and the wheel handler
          ignored deltaY > 0 after calling preventDefault, so on a phone the
          only way back out of a zoom was «К себе» — a button that says it
          recentres and does not say it also undoes the zoom.
        */}
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
          className="map-container"
          ref={containerRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <svg className="map-svg" viewBox={viewBox} preserveAspectRatio="xMidYMid slice">
            {wide ? (
              <>
                {wideCh.bgDesktop ? (
                  <image href={wideBg} x={0} y={0} width={DESKTOP_W} height={DESKTOP_H} preserveAspectRatio="none" />
                ) : (
                  <image
                    href={wideCh.bg}
                    x={-wideCover.offsetX}
                    y={-wideCover.offsetY}
                    width={wideCover.renderW}
                    height={wideCover.renderH}
                    preserveAspectRatio="none"
                  />
                )}
              </>
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
                    (lang === 'kk' ? ch.name.kk : b.name).length * 9 + 48
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

            <path
              d={`M ${pathAhead}`}
              fill="none"
              stroke="#c9c2ff"
              strokeWidth="5"
              strokeDasharray="3,10"
              strokeLinecap="round"
              opacity="0.6"
            />
            <path
              d={`M ${pathDone}`}
              fill="none"
              stroke="#00b894"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {localPins.map((pin) => {
              const chapterColor = CHAPTERS[pin.chapterIdx].color;
              if (pin.status === 'fog') {
                return (
                  <circle key={pin.id} cx={pin.x} cy={pin.y} r="5" fill="#c9c2ff" opacity="0.35" />
                );
              }

              return (
                <g
                  key={pin.id}
                  className={`pin-group pin-${pin.status}`}
                  onClick={() => handlePinClick(pin.id)}
                  style={{ cursor: pin.status !== 'near' ? 'pointer' : 'default' }}
                >
                  {pin.status === 'current' && (
                    <circle cx={pin.x} cy={pin.y} r="22" className="pin-pulse-ring" fill="none" />
                  )}
                  <circle
                    cx={pin.x}
                    cy={pin.y}
                    r={pin.status === 'current' ? 20 : 15}
                    fill={
                      pin.status === 'current' ? '#fff' : pin.status === 'near' ? '#e4e1ff' : chapterColor
                    }
                  />
                  <circle
                    cx={pin.x}
                    cy={pin.y}
                    r={pin.status === 'current' ? 20 : 15}
                    fill="none"
                    stroke={pin.status === 'current' ? chapterColor : '#fff'}
                    strokeWidth={pin.status === 'current' ? 4 : 2}
                  />
                  {pin.status === 'completed' && (
                    <g transform={`translate(${pin.x - 7}, ${pin.y - 7}) scale(0.6)`}>
                      <IconCheckPath />
                    </g>
                  )}
                  {pin.status === 'near' && (
                    <g transform={`translate(${pin.x - 6}, ${pin.y - 6}) scale(0.5)`}>
                      <IconLockPath />
                    </g>
                  )}
                  {pin.status === 'current' && (
                    <text
                      x={pin.x}
                      y={pin.y + 5}
                      textAnchor="middle"
                      className="pin-number-current"
                      fill={chapterColor}
                    >
                      {pin.id + 1}
                    </text>
                  )}
                </g>
              );
            })}

            <g transform={`translate(${currentPin.x}, ${currentPin.y - 44})`}>
              <g className="pin-here">
                <path
                  d="M0 30 C-14 30 -18 16 -18 6 A18 18 0 1 1 18 6 C18 16 14 30 0 30 Z"
                  fill="#6c5ce7"
                  stroke="#fff"
                  strokeWidth="3"
                />
                <g transform="translate(-9, -13) scale(0.75)" fill="#fff">
                  <IconPawPath />
                </g>
              </g>
            </g>
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
          onClick={() => handlePinClick(Math.min(currentLevel, SEASON1_LEVELS - 1))}
          disabled={seasonDone}
        >
          {seasonDone
            ? lang === 'kk'
              ? '1-маусым бітті · 2-маусым жақында'
              : 'Сезон 1 пройден · Сезон 2 скоро'
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

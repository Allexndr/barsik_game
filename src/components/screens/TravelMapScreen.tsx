import { useState, useRef } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useUIStore } from '@/store/useUIStore';
import './TravelMapScreen.css';

const TOTAL_LEVELS = 100;
const LEVELS_PER_ROW = 10;

interface Pin {
  id: number;
  status: 'completed' | 'current' | 'locked';
  x: number;
  y: number;
}

export function TravelMapScreen() {
  const unlockedLevels = useGameStore((s) => s.unlockedLevels);
  const currentLevel = useGameStore((s) => s.currentLevel);
  const startEpisode = useUIStore((s) => s.startEpisode);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Генерируем пины для 100 уровней
  const pins: Pin[] = Array.from({ length: TOTAL_LEVELS }).map((_, i) => {
    const row = Math.floor(i / LEVELS_PER_ROW);
    const col = i % LEVELS_PER_ROW;
    const x = col * 80 + 40;
    const y = row * 80 + 40;

    let status: 'completed' | 'current' | 'locked';
    if (i < currentLevel) {
      status = 'completed';
    } else if (i === currentLevel) {
      status = 'current';
    } else {
      status = 'locked';
    }

    return { id: i, status, x, y };
  });

  // Обработка клика на пин
  const handlePinClick = (levelId: number) => {
    if (levelId <= currentLevel) {
      startEpisode(levelId);
    }
  };

  // Zoom In
  const handleZoomIn = () => {
    setZoom((z) => Math.min(z + 0.2, 3));
  };

  // Zoom Out
  const handleZoomOut = () => {
    setZoom((z) => Math.max(z - 0.2, 0.8));
  };

  // Мобильный drag (pan)
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Сброс вида
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="screen screen-travel">
      <div className="travel-header">
        <h2>🗺️ Путешествие Барсика</h2>
        <div className="travel-stats">
          <span className="stat-item">📍 Уровень: <strong>#{currentLevel + 1}/100</strong></span>
          <span className="stat-item">✅ Пройдено: <strong>{unlockedLevels.length}/100</strong></span>
        </div>
      </div>

      <div className="travel-controls">
        <button className="travel-btn" onClick={handleZoomOut}>🔍−</button>
        <button className="travel-btn" onClick={handleReset}>🔄 Сброс</button>
        <button className="travel-btn" onClick={handleZoomIn}>🔍+</button>
      </div>

      <div
        className="map-container"
        ref={mapContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          className="map-svg"
          viewBox="0 0 860 520"
          style={{
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transition: isDragging ? 'none' : 'transform 0.2s',
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
        >
          {/* Фон сетки */}
          <defs>
            <pattern
              id="grid"
              width="80"
              height="80"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 80 0 L 0 0 0 80"
                fill="none"
                stroke="#f0f0f0"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>

          <rect width="860" height="520" fill="url(#grid)" />

          {/* Орнаментальная рамка */}
          <rect
            x="10"
            y="10"
            width="840"
            height="500"
            fill="none"
            stroke="#ddd"
            strokeWidth="2"
            rx="10"
          />

          {/* Пины уровней */}
          {pins.map((pin) => (
            <g key={pin.id}>
              {/* Линия маршрута (опционально) */}
              {pin.id > 0 && pin.id % LEVELS_PER_ROW !== 0 && (
                <line
                  x1={pins[pin.id - 1].x}
                  y1={pins[pin.id - 1].y}
                  x2={pin.x}
                  y2={pin.y}
                  stroke={
                    pins[pin.id - 1].status === 'completed' ? '#27ae60' : '#ddd'
                  }
                  strokeWidth="2"
                  strokeDasharray={
                    pins[pin.id - 1].status !== 'completed' ? '4,4' : 'none'
                  }
                />
              )}

              {/* Пин (кружок уровня) */}
              <circle
                cx={pin.x}
                cy={pin.y}
                r={pin.status === 'current' ? 16 : 12}
                fill={
                  pin.status === 'completed'
                    ? '#27ae60'
                    : pin.status === 'current'
                      ? '#f1c40f'
                      : '#ddd'
                }
                stroke={
                  pin.status === 'current' ? '#f39c12' : 'none'
                }
                strokeWidth={pin.status === 'current' ? 3 : 0}
                className={`pin pin-${pin.status}`}
                onClick={() => handlePinClick(pin.id)}
                style={{
                  cursor: pin.status !== 'locked' ? 'pointer' : 'default',
                  filter:
                    pin.status === 'current'
                      ? 'drop-shadow(0 0 8px rgba(243, 156, 18, 0.8))'
                      : 'none',
                }}
              />

              {/* Номер уровня */}
              <text
                x={pin.x}
                y={pin.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="pin-label"
                fontSize={pin.status === 'current' ? '14' : '11'}
                fontWeight={pin.status === 'current' ? '700' : '600'}
                fill={
                  pin.status === 'locked'
                    ? '#999'
                    : pin.status === 'current'
                      ? '#333'
                      : 'white'
                }
                onClick={() => handlePinClick(pin.id)}
                style={{
                  cursor: pin.status !== 'locked' ? 'pointer' : 'default',
                }}
              >
                {pin.id + 1}
              </text>

              {/* Иконка для текущего уровня */}
              {pin.status === 'current' && (
                <text
                  x={pin.x}
                  y={pin.y - 20}
                  textAnchor="middle"
                  fontSize="16"
                  className="pin-marker"
                >
                  🐯
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      <div className="travel-legend">
        <div className="legend-item">
          <div className="legend-dot" style={{ backgroundColor: '#27ae60' }} />
          <span>Пройдено ({unlockedLevels.length})</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ backgroundColor: '#f1c40f' }} />
          <span>Текущий уровень</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ backgroundColor: '#ddd' }} />
          <span>Заблокировано</span>
        </div>
      </div>
    </div>
  );
}

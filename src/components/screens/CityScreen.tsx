import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { CityScene, getCityStageLabel } from '@/three/scenes/CityScene';
import { Chip } from '@/components/ui/Chip';
import { IconPaw } from '@/components/ui/icons';
import { logError } from '@/utils/logger';
import './CityScreen.css';

export function CityScreen() {
  const friends = useGameStore((s) => s.friends);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CityScene | null>(null);
  const [sceneFailed, setSceneFailed] = useState(false);

  const { label } = getCityStageLabel(friends.length);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    let city: CityScene;
    try {
      city = new CityScene(canvas);
    } catch (e) {
      // WebGL недоступен — показываем текстовый фоллбэк вместо падения экрана.
      logError('city.create', e);
      setSceneFailed(true);
      return;
    }
    setSceneFailed(false);
    sceneRef.current = city;

    const resize = () => {
      const { clientWidth, clientHeight } = wrap;
      city.resize(clientWidth, clientHeight);
    };
    resize();
    city.setCity(friends.map((f) => ({ id: f.id, name: f.name })));
    city.start();

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    return () => {
      ro.disconnect();
      city.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setCity(friends.map((f) => ({ id: f.id, name: f.name })));
  }, [friends]);

  return (
    <div className="screen screen-city">
      <div className="city-header">
        <h2>Город Барсика</h2>
        <div className="city-stage-badge">{label}</div>
      </div>

      <p className="city-hint">
        {friends.length === 0
          ? 'Найди друзей в Путешествии — они поселятся здесь.'
          : `Друзей в городе: ${friends.length}. Город растёт сам, дом обустроишь позже.`}
      </p>

      <div className="city-3d-viewer" ref={wrapRef}>
        <canvas ref={canvasRef} className="city-canvas" />
        {sceneFailed && (
          <p className="city-3d-fallback">
            3D-город не загрузился на этом устройстве, но друзья ниже всё равно здесь.
          </p>
        )}
      </div>

      {friends.length > 0 && (
        <div className="city-friends-strip">
          {friends.map((f) => (
            <Chip key={f.id} icon={<IconPaw size={14} />} tone="neutral" className="city-friend-chip">
              {f.name}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

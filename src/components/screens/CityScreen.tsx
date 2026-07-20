import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { CityScene, getCityStageLabel } from '@/three/scenes/CityScene';
import './CityScreen.css';

export function CityScreen() {
  const friends = useGameStore((s) => s.friends);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CityScene | null>(null);

  const { label } = getCityStageLabel(friends.length);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const city = new CityScene(canvas);
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
      </div>

      {friends.length > 0 && (
        <div className="city-friends-strip">
          {friends.map((f) => (
            <div key={f.id} className="city-friend-chip">
              🐾 {f.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

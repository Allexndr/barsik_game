import { useEffect, useMemo, useRef } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useUIStore } from '@/store/useUIStore';
import { CityScene, getCityStageLabel } from '@/three/scenes/CityScene';
import { Chip } from '@/components/ui/Chip';
import { PlushButton } from '@/components/ui/PlushButton';
import { IconCheck, IconGift, IconPaw } from '@/components/ui/icons';
import { MetaScreenFooter } from '@/components/widgets/MetaScreenFooter';
import { SHOP_ITEMS } from '@/utils/shopCatalog';
import { SEASON1_FRIENDS } from '@/utils/season1Friends';
import './meta-screen.css';
import './CityScreen.css';

export function CityScreen() {
  const friends = useGameStore((s) => s.friends);
  const cityObjects = useGameStore((s) => s.cityObjects);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const lang = useUIStore((s) => s.lang);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CityScene | null>(null);

  const { label } = getCityStageLabel(friends.length, lang);

  const ownedItems = useMemo(
    () => SHOP_ITEMS.filter((item) => cityObjects[item.id]),
    [cityObjects],
  );
  const localizedFriends = useMemo(
    () =>
      friends.map((friend) => {
        const entry = SEASON1_FRIENDS.find((candidate) => candidate.id === friend.id);
        return {
          ...friend,
          name: entry ? (lang === 'kk' ? entry.nameKk : entry.name) : friend.name,
        };
      }),
    [friends, lang],
  );

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
    sceneRef.current?.setCity(
      localizedFriends.map((f) => ({ id: f.id, name: f.name })),
      ownedItems.map((item) => item.id),
    );
  }, [localizedFriends, ownedItems]);

  return (
    <div className="screen screen-city screen-meta">
      <header className="meta-screen-header city-header">
        <div>
          <h2>{lang === 'kk' ? 'Барсик қаласы' : 'Город Барсика'}</h2>
          <p className="meta-screen-sub">
            {lang === 'kk'
              ? 'Саяхаттағы достар осында тұрады. Әшекейлерді Дүкеннен алуға болады.'
              : 'Друзья из Путешествия живут здесь. Украшения — из Магазина.'}
          </p>
        </div>
        <div className="city-stage-badge">{label}</div>
      </header>

      <div className="city-3d-viewer" ref={wrapRef}>
        <canvas ref={canvasRef} className="city-canvas" />
      </div>

      {friends.length > 0 && (
        <section className="city-section">
          <h3 className="city-section-title">{lang === 'kk' ? 'Тұрғындар' : 'Жители'}</h3>
          <div className="city-friends-strip">
            {localizedFriends.map((f) => (
              <Chip key={f.id} icon={<IconPaw size={14} />} tone="neutral" className="city-friend-chip">
                {f.name}
              </Chip>
            ))}
          </div>
        </section>
      )}

      <section className="city-section">
        <div className="city-section-head">
          <h3 className="city-section-title">
            {lang === 'kk' ? 'Сенің әшекейлерің' : 'Твои украшения'}
          </h3>
          {ownedItems.length > 0 && (
            <span className="city-owned-count">
              {ownedItems.length} {lang === 'kk' ? 'дана' : 'шт.'}
            </span>
          )}
        </div>

        {ownedItems.length === 0 ? (
          <div className="city-empty-props">
            <p>
              {lang === 'kk'
                ? 'Әзірге бос. Дүкеннен жұлдыздарға ағаш, шам немесе мойынорағыш ал.'
                : 'Пока пусто. Купи дерево, фонарик или шарф в Магазине за звёзды.'}
            </p>
            <PlushButton variant="secondary" size="md" onClick={() => setActiveTab('shop')}>
              {lang === 'kk' ? 'Дүкенге' : 'В Магазин'}
            </PlushButton>
          </div>
        ) : (
          <div className="city-props-grid">
            {ownedItems.map((item) => (
              <div key={item.id} className="city-prop-card">
                <span className="city-prop-emoji" aria-hidden>
                  <IconGift size={24} />
                </span>
                <span className="city-prop-name">{item.name[lang]}</span>
                <span className="city-prop-owned">
                  <IconCheck size={12} /> {lang === 'kk' ? 'бар' : 'есть'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {friends.length === 0 && (
        <p className="city-hint city-hint-empty">
          {lang === 'kk'
            ? 'Алдымен Саяхаттан достар тап — олар қалада пайда болады.'
            : 'Сначала найди друзей в Путешествии — они появятся в городе.'}
        </p>
      )}

      <MetaScreenFooter
        hint={
          lang === 'kk'
            ? 'Қала достарыңмен және алған заттарыңмен бірге өседі.'
            : 'Город растёт вместе с друзьями и твоими покупками.'
        }
      />
    </div>
  );
}

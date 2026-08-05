import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useUIStore } from '@/store/useUIStore';
import { Chip } from '@/components/ui/Chip';
import { PlushButton } from '@/components/ui/PlushButton';
import { IconCheck, IconStar } from '@/components/ui/icons';
import { MetaScreenFooter } from '@/components/widgets/MetaScreenFooter';
import { createAvatarPreview, type AvatarPreview } from '@/three/avatar/AvatarPreview';
import { WARDROBE, WARDROBE_BY_ID, CATEGORY_LABEL, type WardrobeCategory } from '@/three/avatar/wardrobe';
import './meta-screen.css';
import './ShopScreen.css';

const TABS: Array<WardrobeCategory | 'all'> = [
  'all', 'head', 'face', 'neck', 'back', 'hands', 'feet', 'tail', 'color',
];

/**
 * The dressing room.
 *
 * The old shop sold five city decorations from a list of names: a child could
 * not see what they were buying, and nothing they bought ever appeared on
 * *them*. It is a wardrobe now — forty-four items, and tapping one puts it on
 * the character straight away whether or not it has been bought. Trying before
 * buying is the whole point, so the price only comes up once the child decides
 * to keep the look.
 */
export function ShopScreen() {
  const stars = useGameStore((s) => s.stars);
  const owned = useGameStore((s) => s.cityObjects);
  const outfit = useGameStore((s) => s.outfit);
  const buyItem = useGameStore((s) => s.buyCityObject);
  const setOutfit = useGameStore((s) => s.setOutfit);
  const lang = useUIStore((s) => s.lang);

  const [tab, setTab] = useState<WardrobeCategory | 'all'>('all');
  const [toast, setToast] = useState<string | null>(null);
  /** What the child is looking at right now — owned or not. */
  const [tryOn, setTryOn] = useState<string[]>(outfit);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<AvatarPreview | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const preview = createAvatarPreview(canvas);
    previewRef.current = preview;
    const resize = () => preview.resize(wrap.clientWidth, wrap.clientHeight);
    resize();
    preview.start();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => {
      ro.disconnect();
      preview.dispose();
      previewRef.current = null;
    };
  }, []);

  useEffect(() => {
    previewRef.current?.setOutfit(tryOn);
  }, [tryOn]);

  const items = useMemo(
    () => WARDROBE.filter((i) => tab === 'all' || i.category === tab),
    [tab],
  );

  const say = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2400);
  }, []);

  /** Tap to try. One item per slot; tapping the worn one takes it off. */
  const toggleTry = useCallback((id: string) => {
    const item = WARDROBE_BY_ID.get(id);
    if (!item) return;
    setTryOn((current) => {
      if (current.includes(id)) return current.filter((x) => x !== id);
      const sameSlot = current.filter((x) => {
        const other = WARDROBE_BY_ID.get(x);
        return other ? other.category !== item.category : false;
      });
      return [...sameSlot, id];
    });
  }, []);

  const wearing = useMemo(() => new Set(tryOn), [tryOn]);
  const tryingUnowned = useMemo(
    () => tryOn.filter((id) => !owned[id] && (WARDROBE_BY_ID.get(id)?.cost ?? 0) > 0),
    [tryOn, owned],
  );
  const priceOfLook = tryingUnowned.reduce(
    (sum, id) => sum + (WARDROBE_BY_ID.get(id)?.cost ?? 0), 0,
  );

  const buyLook = useCallback(() => {
    if (!tryingUnowned.length) return;
    if (stars < priceOfLook) {
      say(lang === 'kk'
        ? 'Жұлдыздар жетпейді — Саяхаттан деңгейлерден өт!'
        : 'Не хватает звёзд — пройди уровни в Путешествии!');
      return;
    }
    for (const id of tryingUnowned) buyItem(id, WARDROBE_BY_ID.get(id)?.cost ?? 0);
    setOutfit(tryOn);
    say(lang === 'kk' ? 'Керемет! Барсик киінді.' : 'Отлично! Барсик приоделся.');
  }, [tryingUnowned, priceOfLook, stars, buyItem, setOutfit, tryOn, say, lang]);

  const saveLook = useCallback(() => {
    setOutfit(tryOn);
    say(lang === 'kk' ? 'Киім сақталды' : 'Образ сохранён');
  }, [tryOn, setOutfit, say, lang]);

  const ownedCount = WARDROBE.filter((i) => owned[i.id] || i.cost === 0).length;
  const dirty = tryOn.join('|') !== outfit.join('|');

  return (
    <div className="screen screen-shop screen-meta">
      {/*
        No star chip here. The app header carries the balance on every screen,
        and putting a second identical «★ 200» fifty pixels below the first one
        cost a phone a whole row before the child saw a single item.
      */}
      <header className="meta-screen-header">
        <div>
          <h2>{lang === 'kk' ? 'Киім бөлмесі' : 'Гардероб'}</h2>
          <p className="meta-screen-sub">
            {lang === 'kk'
              ? 'Алдымен көр, содан кейін ал'
              : 'Сначала примерь, потом покупай'}
          </p>
        </div>
      </header>

      <div className="shop-dressing">
        <div className="shop-preview" ref={wrapRef}>
          <canvas ref={canvasRef} className="shop-preview-canvas" />
          <span className="shop-preview-hint">
            {lang === 'kk' ? 'Айналдыру үшін сүйре' : 'Потяни, чтобы покрутить'}
          </span>
        </div>

        <div className="shop-actions">
          {tryingUnowned.length > 0 ? (
            <PlushButton variant="primary" size="md" onClick={buyLook}>
              {lang === 'kk' ? `Алу · ${priceOfLook} ★` : `Купить · ${priceOfLook} ★`}
            </PlushButton>
          ) : (
            <PlushButton variant="primary" size="md" disabled={!dirty} onClick={saveLook}>
              {lang === 'kk' ? 'Киімді сақтау' : 'Сохранить образ'}
            </PlushButton>
          )}
          <span className="shop-owned-count">{ownedCount}/{WARDROBE.length}</span>
        </div>
      </div>

      <div
        className="shop-tabs"
        role="tablist"
        aria-label={lang === 'kk' ? 'Санаттар' : 'Категории'}
      >
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`shop-tab ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}
          >
            {id === 'all' ? (lang === 'kk' ? 'Барлығы' : 'Всё') : CATEGORY_LABEL[id][lang]}
          </button>
        ))}
      </div>

      <div className="shop-grid">
        {items.map((item) => {
          const isOwned = owned[item.id] || item.cost === 0;
          const isWorn = wearing.has(item.id);
          return (
            <button
              key={item.id}
              type="button"
              className={`shop-card rarity-${item.rarity} ${isWorn ? 'is-worn' : ''} ${isOwned ? 'owned' : ''}`}
              onClick={() => toggleTry(item.id)}
              aria-pressed={isWorn}
            >
              <h3>{item.name[lang]}</h3>
              <div className="shop-card-footer">
                {isOwned ? (
                  <span className="shop-owned-badge">
                    <IconCheck size={14} /> {lang === 'kk' ? 'Бар' : 'Есть'}
                  </span>
                ) : (
                  <Chip icon={<IconStar size={14} />} tone="star">{item.cost}</Chip>
                )}
              </div>
              {isWorn && (
                <span className="shop-card-badge">
                  {lang === 'kk' ? 'киілген' : 'надето'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {toast && <div className="shop-toast">{toast}</div>}

      <MetaScreenFooter
        hint={
          lang === 'kk'
            ? 'Кез келген затты тегін көріп көр — жұлдыз тек қалдырғанда керек.'
            : 'Примерить можно всё бесплатно — звёзды нужны, только чтобы оставить.'
        }
      />
    </div>
  );
}

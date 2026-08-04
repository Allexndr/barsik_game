import { useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useUIStore } from '@/store/useUIStore';
import { Chip } from '@/components/ui/Chip';
import { PlushButton } from '@/components/ui/PlushButton';
import { IconCheck, IconGift, IconStar } from '@/components/ui/icons';
import { MetaScreenFooter } from '@/components/widgets/MetaScreenFooter';
import { SHOP_ITEMS, type ShopCategory } from '@/utils/shopCatalog';
import './meta-screen.css';
import './ShopScreen.css';

const TABS: { id: ShopCategory | 'all'; label: { ru: string; kk: string } }[] = [
  { id: 'all', label: { ru: 'Всё', kk: 'Барлығы' } },
  { id: 'city', label: { ru: 'Для города', kk: 'Қалаға' } },
];

export function ShopScreen() {
  const stars = useGameStore((s) => s.stars);
  const cityObjects = useGameStore((s) => s.cityObjects);
  const buyCityObject = useGameStore((s) => s.buyCityObject);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const lang = useUIStore((s) => s.lang);
  const [tab, setTab] = useState<ShopCategory | 'all'>('all');
  const [toast, setToast] = useState<string | null>(null);

  const items = SHOP_ITEMS.filter((item) => tab === 'all' || item.category === tab);
  const ownedCount = Object.keys(cityObjects).filter((id) => cityObjects[id]).length;

  const buy = (id: string, cost: number, name: string) => {
    if (cityObjects[id]) return;
    if (stars < cost) {
      setToast(
        lang === 'kk'
          ? 'Жұлдыздар жетпейді — Саяхаттағы деңгейлерден өт!'
          : 'Не хватает звёзд — пройди уровни в Путешествии!',
      );
      window.setTimeout(() => setToast(null), 2800);
      return;
    }
    buyCityObject(id, cost);
    setToast(lang === 'kk' ? `${name} — енді сенікі!` : `${name} теперь твоё!`);
    window.setTimeout(() => setToast(null), 2200);
  };

  return (
    <div className="screen screen-shop screen-meta">
      <header className="meta-screen-header">
        <div>
          <h2>{lang === 'kk' ? 'Дүкен' : 'Магазин'}</h2>
          <p className="meta-screen-sub">
            {lang === 'kk'
              ? 'Жұлдыздарға қалаға арналған әшекей ал'
              : 'Трать звёзды на украшения города'}
          </p>
        </div>
        <Chip icon={<IconStar size={16} />} tone="star">
          {stars}
        </Chip>
      </header>

      <div
        className="shop-tabs"
        role="tablist"
        aria-label={lang === 'kk' ? 'Дүкен санаттары' : 'Категории магазина'}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`shop-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label[lang]}
          </button>
        ))}
      </div>

      <div className="shop-grid">
        {items.map((item) => {
          const owned = !!cityObjects[item.id];
          const canBuy = !owned && stars >= item.cost;
          return (
            <article key={item.id} className={`shop-card ${owned ? 'owned' : ''}`}>
              <div className="shop-card-emoji" aria-hidden>
                <IconGift size={34} />
              </div>
              <h3>{item.name[lang]}</h3>
              <p className="shop-card-desc">{item.description[lang]}</p>
              <div className="shop-card-footer">
                {owned ? (
                  <span className="shop-owned-badge">
                    <IconCheck size={14} /> {lang === 'kk' ? 'Бар' : 'Есть'}
                  </span>
                ) : (
                  <>
                    <Chip icon={<IconStar size={14} />} tone="star">
                      {item.cost}
                    </Chip>
                    <PlushButton
                      variant={canBuy ? 'secondary' : 'ghost'}
                      size="md"
                      disabled={!canBuy}
                      onClick={() => buy(item.id, item.cost, item.name[lang])}
                    >
                      {lang === 'kk' ? 'Сатып алу' : 'Купить'}
                    </PlushButton>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {ownedCount > 0 && (
        <p className="shop-owned-hint">
          {lang === 'kk' ? `Алынған заттар: ${ownedCount}. Оларды ` : `Куплено предметов: ${ownedCount}. Смотри их в `}
          <button type="button" className="shop-inline-link" onClick={() => setActiveTab('city')}>
            {lang === 'kk' ? 'Қаладан көр' : 'Городе'}
          </button>
          {lang === 'kk' ? '.' : '.'}
        </p>
      )}

      {toast && <div className="shop-toast">{toast}</div>}

      <MetaScreenFooter
        hint={
          lang === 'kk'
            ? 'Жұлдыздар Саяхат деңгейлерінде жиналады.'
            : 'Звёзды зарабатываются в уровнях Путешествия.'
        }
      />
    </div>
  );
}

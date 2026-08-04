import { useState } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { Chip } from '@/components/ui/Chip';
import { PlushButton } from '@/components/ui/PlushButton';
import { IconGift, IconShield, IconStar } from '@/components/ui/icons';
import { MetaScreenFooter } from '@/components/widgets/MetaScreenFooter';
import './meta-screen.css';
import './QRChestScreen.css';

const DEMO_REWARDS = [
  { id: 'qr_berry', name: { ru: 'Ягодка', kk: 'Жидек' }, stars: 40 },
  { id: 'qr_spark', name: { ru: 'Искорка', kk: 'Ұшқын' }, stars: 25 },
  { id: 'qr_scarf', name: { ru: 'Узорный шарф', kk: 'Өрнекті мойынорағыш' }, stars: 20 },
];

export function QRChestScreen() {
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const lang = useUIStore((s) => s.lang);
  const [phase, setPhase] = useState<'idle' | 'opening' | 'reward'>('idle');
  const [reward, setReward] = useState<(typeof DEMO_REWARDS)[0] | null>(null);

  const openChest = () => {
    if (phase !== 'idle') return;
    setPhase('opening');
    window.setTimeout(() => {
      const pick = DEMO_REWARDS[Math.floor(Math.random() * DEMO_REWARDS.length)];
      setReward(pick);
      setPhase('reward');
    }, 1600);
  };

  const reset = () => {
    setPhase('idle');
    setReward(null);
  };

  return (
    <div className="screen screen-qr screen-meta">
      <header className="meta-screen-header">
        <div>
          <h2>{lang === 'kk' ? 'Сиқырлы сандық' : 'Волшебный сундук'}</h2>
          <p className="meta-screen-sub">
            {lang === 'kk'
              ? 'Барсик қаптамасындағы бала мен ата-анаға арналған тосынсый'
              : 'Сюрприз с упаковки Барсика — для ребёнка и родителей'}
          </p>
        </div>
      </header>

      <div className="qr-info-card">
        <div className="qr-info-icon" aria-hidden>
          <IconShield size={22} />
        </div>
        <div>
          <p className="qr-info-title">{lang === 'kk' ? 'Бұл қалай жұмыс істейді' : 'Как это работает'}</p>
          <p className="qr-info-body">
            {lang === 'kk'
              ? 'Қорапта немесе кітапта QR-код болады. Ата-ана оны телефонмен сканерлесе, жұлдыз, дос немесе әшекейі бар сандық ашылады.'
              : 'На коробке или в книге есть QR-код. Родитель сканирует его телефоном — открывается этот сундук с подарком: звёзды, друг или украшение.'}
          </p>
          <p className="qr-info-body qr-info-soft">
            {lang === 'kk'
              ? 'Бұл міндетті емес қосымша сыйлық. Кодсыз да ойнауға болады.'
              : 'Это мягкий бонус, не обязательный для игры. Можно играть и без кода.'}
          </p>
        </div>
      </div>

      <div className={`qr-chest-container phase-${phase}`}>
        {phase === 'idle' && (
          <>
            <div className="chest-visual">
              <IconGift size={48} />
            </div>
            <p className="qr-chest-idle-text">
              {lang === 'kk'
                ? 'Код қаптамада пайда болғанда, ол нағыз сандықты ашады.'
                : 'Когда код будет на упаковке — он откроет настоящий сундук.'}
            </p>
            <PlushButton variant="secondary" size="lg" onClick={openChest}>
              {lang === 'kk' ? 'Қазір байқап көру' : 'Попробовать сейчас'}
            </PlushButton>
          </>
        )}
        {phase === 'opening' && (
          <div className="chest-opening">
            <div className="chest-visual spin">
              <IconGift size={48} />
            </div>
            <p>{lang === 'kk' ? 'Сиқыр ашылып жатыр...' : 'Магия открывается...'}</p>
          </div>
        )}
        {phase === 'reward' && reward && (
          <div className="chest-reward">
            <div className="chest-visual">
              <IconGift size={48} />
            </div>
            <h3>{lang === 'kk' ? 'Уау!' : 'Вау!'}</h3>
            <p className="chest-reward-line">
              {lang === 'kk' ? 'Демо-сыйлық' : 'Демо-награда'}: {reward.name[lang]}{' '}
              <Chip icon={<IconStar size={14} />} tone="star">
                +{reward.stars}
              </Chip>
            </p>
            <p className="qr-info-body qr-info-soft">
              {lang === 'kk'
                ? 'Бұл тек алдын ала көру. Нақты прогресс өзгерген жоқ.'
                : 'Это предпросмотр. Реальный прогресс не изменён.'}
            </p>
            <div className="qr-reward-actions">
              <PlushButton variant="primary" size="lg" onClick={reset}>
                {lang === 'kk' ? 'Жабу' : 'Закрыть'}
              </PlushButton>
              <PlushButton variant="ghost" size="md" onClick={() => setActiveTab('friends')}>
                {lang === 'kk' ? 'Достарға' : 'К друзьям'}
              </PlushButton>
            </div>
          </div>
        )}
      </div>

      <MetaScreenFooter
        hint={
          lang === 'kk'
            ? 'Негізгі достар мен жұлдыздар Саяхат деңгейлерінде.'
            : 'Главные друзья и звёзды — в уровнях Путешествия.'
        }
      />
    </div>
  );
}

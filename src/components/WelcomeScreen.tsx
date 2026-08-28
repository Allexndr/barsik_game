import { useUIStore } from '@/store/useUIStore';
import { useGameStore } from '@/store/useGameStore';
import type { Lang } from '@/i18n';
import { useEffect, useRef, useState } from 'react';
import { SettingsModal } from '@/components/SettingsModal';
import { hasFinishedIntro } from '@/three/inventory';
import { ResponsivePicture } from '@/components/ui/ResponsivePicture';
import './WelcomeScreen.css';

const CompassIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.8 8.2-2.1 5.5-5.5 2.1 2.1-5.5 5.5-2.1Z" />
  </svg>
);

const FriendsIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden>
    <circle cx="8" cy="8" r="3" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M2.8 19c.5-3.3 2.3-5 5.2-5s4.7 1.7 5.2 5M13.4 18.5c.4-2.5 1.7-3.8 3.8-3.8 2.2 0 3.4 1.3 3.8 3.8" />
  </svg>
);

const StarIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden>
    <path d="m12 2.8 2.8 5.7 6.3.9-4.5 4.4 1.1 6.2-5.7-3-5.7 3 1.1-6.2-4.5-4.4 6.3-.9L12 2.8Z" />
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden>
    <path d="M12 2.5 20 6v5.5c0 5.1-3.3 8.4-8 10-4.7-1.6-8-4.9-8-10V6l8-3.5Z" />
    <path d="m8.5 12 2.2 2.2 4.8-5" />
  </svg>
);

function useRevealOnScroll() {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const nodes = root.querySelectorAll<HTMLElement>('[data-reveal]');
    if (!nodes.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nodes.forEach((n) => n.classList.add('is-revealed'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-revealed');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);
  return rootRef;
}

/** Marketing landing — photographic fold · Barsik Hum · brand-first hero. */
export function WelcomeScreen() {
  const setScreen = useUIStore((s) => s.setScreen);
  const lang = useUIStore((s) => s.lang);
  const setLang = useUIStore((s) => s.setLang);
  const patchPlayer = useGameStore((s) => s.patchPlayer);
  const player = useGameStore((s) => s.player);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const rootRef = useRevealOnScroll();

  const pickLang = (next: Lang) => {
    if (next === lang) return;
    setLang(next);
    patchPlayer({ lang: next });
  };

  const play = () => setScreen('quick');
  const continueGame = () => {
    if (!player) {
      play();
      return;
    }
    setScreen(hasFinishedIntro() ? 'game' : 'mission0');
  };

  const copy = lang === 'kk'
    ? {
        navAbout: 'Ойын туралы',
        navWorld: 'Әлемдер',
        navFeatures: 'Мүмкіндіктер',
        navParents: 'Ата-аналарға',
        brandSub: 'LAND',
        eyebrow: 'Қазақстан бойынша саяхат',
        title: 'Жаңа әлемді аш',
        lead: 'Достар тап, тапсырмаларды орында және туған өлкені зертте — Барсикпен бірге.',
        play: 'Ойнау',
        continue: 'Жалғастыру',
        free: 'Тегін · Жарнамасыз · RU / ҚАЗ',
        scroll: 'Әрі қарай',
        aboutKicker: 'Сенің саяхатың',
        aboutTitle: 'Әр қадам — жаңа оқиға',
        aboutText: 'Жеміс орманынан Мұзды алқапқа. Әр деңгейде дос, механика және кішкентай жеңіс.',
        forest: 'Жеміс орманы',
        forestText: 'Алма жина, кірпі мен тиінге көмектес, көпірден өт.',
        ice: 'Мұзды алқап',
        iceText: 'Қар ұста, жұмбақ шеш және тауға көтеріл.',
        city: 'Достар қаласы',
        cityText: 'Жұлдыздарды сыйлыққа айырбастап, қаланы безендір.',
        featureKicker: 'Ойында не бар',
        featureTitle: 'Ойна, үйрен, достас',
        feat1: '17 оқиғалы деңгей',
        feat1Text: 'Іздеу, эскорт, тепе-теңдік және жұмбақтар — қысқа әрі әртүрлі.',
        feat2: 'Нағыз достар',
        feat2Text: 'Әр кейіпкердің өз мінезі мен оқиғасы бар.',
        feat3: 'Жұлдыздар мен сыйлықтар',
        feat3Text: 'Жетістіктерді жина және прогресті бақыла.',
        parentKicker: 'Ата-аналар үшін',
        parentTitle: 'Қауіпсіз және мейірімді',
        parentText: 'Сыртқы жарнамасыз және ойыннан тыс сатып алусыз. Прогресс құрылғыда, тіл — кез келген уақытта.',
        safe1: 'Жарнамасыз',
        safe2: 'RU және ҚАЗ',
        safe3: '3–15 жас',
        flowTitle: 'Қалай бастау',
        flow1: 'Тілді таңда',
        flow2: 'Атын жаз',
        flow3: 'Алғашқы оқиға',
        cta: 'Саяхатқа дайынсың ба?',
        ctaText: 'Бірнеше секунд — және алғашқы оқиға басталады.',
        footer: 'Балаларға арналған мейірімді 3D-саяхат',
        settings: 'Баптаулар',
      }
    : {
        navAbout: 'Об игре',
        navWorld: 'Миры',
        navFeatures: 'Возможности',
        navParents: 'Родителям',
        brandSub: 'LAND',
        eyebrow: 'Большое путешествие по Казахстану',
        title: 'Открывай мир вместе с Барсиком',
        lead: 'Находи друзей, выполняй добрые задания и исследуй удивительные места родного края.',
        play: 'Играть',
        continue: 'Продолжить',
        free: 'Бесплатно · Без рекламы · RU / ҚАЗ',
        scroll: 'Дальше',
        aboutKicker: 'Твоё путешествие',
        aboutTitle: 'Каждый шаг — новая история',
        aboutText: 'От Фруктового леса до Ледяной долины. В каждом уровне — друг, механика и маленькая победа.',
        forest: 'Фруктовый лес',
        forestText: 'Собирай яблоки, помогай ёжику и белочке, переходи мост.',
        ice: 'Ледяная долина',
        iceText: 'Лови снежинки, разгадывай загадки и поднимайся в горы.',
        city: 'Город друзей',
        cityText: 'Меняй звёзды на подарки и украшай Арбат с друзьями.',
        featureKicker: 'Что ждёт в игре',
        featureTitle: 'Играй, учись, дружи',
        feat1: '17 сюжетных уровней',
        feat1Text: 'Поиск, сопровождение, баланс и головоломки — коротко и по-разному.',
        feat2: 'Настоящие друзья',
        feat2Text: 'У каждого героя свой характер и своя история.',
        feat3: 'Звёзды и награды',
        feat3Text: 'Собирай достижения и следи за прогрессом.',
        parentKicker: 'Для родителей',
        parentTitle: 'Безопасная и добрая игра',
        parentText: 'Без внешней рекламы и покупок вне игры. Прогресс на устройстве, язык — в любой момент.',
        safe1: 'Без рекламы',
        safe2: 'RU и ҚАЗ',
        safe3: 'Для 3–15 лет',
        flowTitle: 'Как начать',
        flow1: 'Выбери язык',
        flow2: 'Напиши имя',
        flow3: 'Первая история',
        cta: 'Готов к приключению?',
        ctaText: 'Через несколько секунд начнётся первая история.',
        footer: 'Доброе 3D-приключение для детей',
        settings: 'Настройки',
      };

  return (
    <div className="welcome-screen" ref={rootRef}>
      <header className="welcome-navbar">
        <a className="welcome-brand" href="#top" aria-label="Barsik Land">
          <span className="welcome-brand-paw" aria-hidden />
          <span className="welcome-brand-word">BARSIK</span>
          <span className="welcome-brand-sub">{copy.brandSub}</span>
        </a>

        <nav className="welcome-nav-links" aria-label={lang === 'kk' ? 'Негізгі навигация' : 'Основная навигация'}>
          <a href="#about">{copy.navAbout}</a>
          <a href="#worlds">{copy.navWorld}</a>
          <a href="#features">{copy.navFeatures}</a>
          <a href="#parents">{copy.navParents}</a>
        </nav>

        <div className="welcome-nav-tools">
          <div className="welcome-lang" role="group" aria-label="Language">
            <button type="button" className={lang === 'ru' ? 'active' : ''} onClick={() => pickLang('ru')} aria-pressed={lang === 'ru'}>RU</button>
            <button type="button" className={lang === 'kk' ? 'active' : ''} onClick={() => pickLang('kk')} aria-pressed={lang === 'kk'}>ҚАЗ</button>
          </div>
          <button type="button" className="welcome-settings" onClick={() => setSettingsOpen(true)} aria-label={copy.settings} title={copy.settings}>
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M19.1 12.9c.1-.6.1-1.2 0-1.8l2-1.6-1.9-3.3-2.4 1a8 8 0 0 0-1.6-1l-.4-2.5h-3.8l-.4 2.5a8 8 0 0 0-1.6 1l-2.4-1-1.9 3.3 2 1.6a7 7 0 0 0 0 1.8l-2 1.6 1.9 3.3 2.4-1a8 8 0 0 0 1.6 1l.4 2.5h3.8l.4-2.5a8 8 0 0 0 1.6-1l2.4 1 1.9-3.3-2-1.6ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" />
            </svg>
          </button>
          {player && (
            <button type="button" className="welcome-nav-continue" onClick={continueGame}>
              {copy.continue}
            </button>
          )}
        </div>
      </header>

      <main>
        <section className="welcome-hero" id="top">
          <ResponsivePicture
            className="welcome-hero-image"
            alt=""
            sources={[
              { media: '(min-width: 760px)', src: '/assets/landing/landing_hero_desktop.webp?v=20260825' },
              { media: '(orientation: landscape)', src: '/assets/landing/landing_hero_desktop.webp?v=20260825' },
            ]}
            fallbackSrc="/assets/landing/landing_hero_mobile.webp?v=20260825"
          />
          <div className="welcome-hero-sky" aria-hidden />
          <div className="welcome-hero-veil" aria-hidden />
          <div className="welcome-hero-content">
            <div className="welcome-hero-copy welcome-hero-enter">
              <p className="welcome-hero-brand" aria-label="Barsik Land">
                <span>BARSIK</span>
                <span className="welcome-hero-brand-chip">{copy.brandSub}</span>
              </p>
              <p className="welcome-hero-eyebrow">{copy.eyebrow}</p>
              <h1>{copy.title}</h1>
              <p className="welcome-hero-lead">{copy.lead}</p>
              <div className="welcome-hero-actions">
                <button type="button" className="welcome-play" onClick={play}>
                  <span className="welcome-play-triangle" aria-hidden />
                  {copy.play}
                </button>
                {player && (
                  <button type="button" className="welcome-secondary" onClick={continueGame}>
                    {copy.continue}
                    <span className="welcome-secondary-nick">{player.nick}</span>
                  </button>
                )}
              </div>
              <p className="welcome-hero-note">{copy.free}</p>
            </div>
          </div>
          <a className="welcome-scroll-cue" href="#flow">
            {copy.scroll}
            <span className="welcome-scroll-cue-chevron" aria-hidden />
          </a>
        </section>

        <section className="welcome-flow welcome-section" id="flow" data-reveal>
          <h2 className="welcome-flow-title">{copy.flowTitle}</h2>
          <ol className="welcome-flow-steps">
            <li><span>1</span>{copy.flow1}</li>
            <li><span>2</span>{copy.flow2}</li>
            <li><span>3</span>{copy.flow3}</li>
          </ol>
        </section>

        <section className="welcome-about welcome-section" id="about" data-reveal>
          <div className="welcome-section-heading">
            <p>{copy.aboutKicker}</p>
            <h2>{copy.aboutTitle}</h2>
            <span>{copy.aboutText}</span>
          </div>

          <div className="welcome-world-grid" id="worlds">
            <article className="welcome-world-card welcome-world-card--forest" data-reveal>
              <img src="/assets/map/chapter1_fruit_forest_desktop.jpg?v=20260824" alt="" />
              <div><span>01</span><h3>{copy.forest}</h3><p>{copy.forestText}</p></div>
            </article>
            <article className="welcome-world-card welcome-world-card--ice" data-reveal>
              <img src="/assets/map/chapter2_ice_valley.jpg?v=20260824" alt="" />
              <div><span>02</span><h3>{copy.ice}</h3><p>{copy.iceText}</p></div>
            </article>
            <article className="welcome-world-card welcome-world-card--city" data-reveal>
              <img src="/assets/map/chapter6_friends_city.jpg?v=20260824" alt="" />
              <div><span>03</span><h3>{copy.city}</h3><p>{copy.cityText}</p></div>
            </article>
          </div>
        </section>

        <section className="welcome-features welcome-section" id="features" data-reveal>
          <div className="welcome-section-heading welcome-section-heading-light">
            <p>{copy.featureKicker}</p>
            <h2>{copy.featureTitle}</h2>
          </div>
          <div className="welcome-feature-grid">
            <article data-reveal>
              <div className="welcome-feature-icon"><CompassIcon /></div>
              <strong>17</strong>
              <h3>{copy.feat1}</h3>
              <p>{copy.feat1Text}</p>
            </article>
            <article data-reveal>
              <div className="welcome-feature-icon"><FriendsIcon /></div>
              <strong>12+</strong>
              <h3>{copy.feat2}</h3>
              <p>{copy.feat2Text}</p>
            </article>
            <article data-reveal>
              <div className="welcome-feature-icon"><StarIcon /></div>
              <strong>★</strong>
              <h3>{copy.feat3}</h3>
              <p>{copy.feat3Text}</p>
            </article>
          </div>
        </section>

        <section className="welcome-parents welcome-section" id="parents" data-reveal>
          <div className="welcome-parent-card">
            <div className="welcome-parent-shield"><ShieldIcon /></div>
            <div className="welcome-parent-copy">
              <p>{copy.parentKicker}</p>
              <h2>{copy.parentTitle}</h2>
              <span>{copy.parentText}</span>
              <ul>
                <li><b>✓</b>{copy.safe1}</li>
                <li><b>✓</b>{copy.safe2}</li>
                <li><b>✓</b>{copy.safe3}</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="welcome-final-cta" data-reveal>
          <div>
            <h2>{copy.cta}</h2>
            <p>{copy.ctaText}</p>
            <button type="button" className="welcome-play" onClick={play}>
              <span className="welcome-play-triangle" aria-hidden />
              {copy.play}
            </button>
          </div>
        </section>
      </main>

      <footer className="welcome-footer">
        <a className="welcome-brand welcome-brand-footer" href="#top">
          <span className="welcome-brand-paw" aria-hidden />
          <span className="welcome-brand-word">BARSIK</span>
        </a>
        <p>© 2026 Barsik Land · {copy.footer}</p>
        <button type="button" onClick={() => setSettingsOpen(true)}>{copy.settings}</button>
      </footer>

      <div className="welcome-sticky-cta" role="region" aria-label={copy.play}>
        <button type="button" className="welcome-play" onClick={play}>
          <span className="welcome-play-triangle" aria-hidden />
          {copy.play}
        </button>
        {player && (
          <button type="button" className="welcome-secondary" onClick={continueGame}>
            {copy.continue}
          </button>
        )}
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

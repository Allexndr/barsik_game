import { useUIStore } from '@/store/useUIStore';
import { useGameStore } from '@/store/useGameStore';
import type { Lang } from '@/i18n';
import { useEffect, useRef, useState } from 'react';
import { SettingsModal } from '@/components/SettingsModal';
import { hasFinishedIntro } from '@/three/inventory';
import { ResponsivePicture } from '@/components/ui/ResponsivePicture';
import './WelcomeScreen.css';

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

/**
 * Marketing landing — photographic fold · Barsik Hum · anti-slop redesign.
 * Keeps AI hero + brand photos; drops indigo/violet, 3-card feature grid, emoji chrome.
 */
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
        brandSub: 'LAND',
        title: 'Жаңа әлемді аш',
        lead: 'Достар тап, тапсырмаларды орында, туған өлкені зертте — Барсикпен.',
        play: 'Ойнау',
        continue: 'Жалғастыру',
        free: 'Тегін · Жарнамасыз · RU / ҚАЗ',
        scroll: 'Әрі қарай',
        meetTitle: 'Бұл — Барсик',
        meetText: 'Жұмсақ ирбис, жасыл худи, сары көзілдірік. Достық саяхаттың жүрегі.',
        worldsTitle: 'Үш әлем',
        forest: 'Жеміс орманы',
        forestText: 'Алма жина, кірпі мен тиінге көмектес.',
        ice: 'Мұзды алқап',
        iceText: 'Қар ұста, жұмбақ шеш, тауға шық.',
        city: 'Достар қаласы',
        cityText: 'Жұлдыздарды сыйлыққа айырбастап, Арбатты безендір.',
        flowTitle: 'Қалай бастау',
        flow1: 'Тілді таңда',
        flow2: 'Атын жаз',
        flow3: 'Алғашқы оқиға',
        parentTitle: 'Ата-аналарға',
        parentText: 'Сыртқы жарнамасыз және ойыннан тыс сатып алусыз. Прогресс құрылғыда.',
        safe1: 'Жарнамасыз',
        safe2: 'RU және ҚАЗ',
        safe3: '3–15 жас',
        cta: 'Саяхатқа дайынсың ба?',
        ctaText: 'Бірнеше секунд — және алғашқы оқиға басталады.',
        footer: 'Балаларға арналған мейірімді 3D-саяхат',
        settings: 'Баптаулар',
        navWorld: 'Әлемдер',
        navParents: 'Ата-аналар',
      }
    : {
        brandSub: 'LAND',
        title: 'Открывай мир вместе с Барсиком',
        lead: 'Находи друзей, выполняй добрые задания и исследуй родной край.',
        play: 'Играть',
        continue: 'Продолжить',
        free: 'Бесплатно · Без рекламы · RU / ҚАЗ',
        scroll: 'Дальше',
        meetTitle: 'Это Барсик',
        meetText: 'Мягкий ирбис в зелёном худи и жёлтых очках — сердце доброго путешествия.',
        worldsTitle: 'Три мира',
        forest: 'Фруктовый лес',
        forestText: 'Собирай яблоки, помогай ёжику и белочке.',
        ice: 'Ледяная долина',
        iceText: 'Лови снежинки, разгадывай загадки, поднимайся в горы.',
        city: 'Город друзей',
        cityText: 'Меняй звёзды на подарки и украшай Арбат с друзьями.',
        flowTitle: 'Как начать',
        flow1: 'Выбери язык',
        flow2: 'Напиши имя',
        flow3: 'Первая история',
        parentTitle: 'Для родителей',
        parentText: 'Без внешней рекламы и покупок вне игры. Прогресс остаётся на устройстве.',
        safe1: 'Без рекламы',
        safe2: 'RU и ҚАЗ',
        safe3: 'Для 3–15 лет',
        cta: 'Готов к приключению?',
        ctaText: 'Через несколько секунд начнётся первая история.',
        footer: 'Доброе 3D-приключение для детей',
        settings: 'Настройки',
        navWorld: 'Миры',
        navParents: 'Родителям',
      };

  const worlds = [
    {
      id: 'forest',
      title: copy.forest,
      text: copy.forestText,
      img: '/assets/map/chapter1_fruit_forest_desktop.jpg?v=20260824',
      tone: 'forest' as const,
    },
    {
      id: 'ice',
      title: copy.ice,
      text: copy.iceText,
      img: '/assets/map/chapter2_ice_valley.jpg?v=20260824',
      tone: 'ice' as const,
    },
    {
      id: 'city',
      title: copy.city,
      text: copy.cityText,
      img: '/assets/map/chapter6_friends_city.jpg?v=20260824',
      tone: 'city' as const,
    },
  ];

  return (
    <div className="welcome-screen" ref={rootRef}>
      <header className="welcome-navbar">
        <a className="welcome-brand" href="#top" aria-label="Barsik Land">
          <span className="welcome-brand-paw" aria-hidden />
          <span className="welcome-brand-word">BARSIK</span>
          <span className="welcome-brand-sub">{copy.brandSub}</span>
        </a>

        <nav className="welcome-nav-links" aria-label={lang === 'kk' ? 'Негізгі навигация' : 'Основная навигация'}>
          <a href="#meet">{copy.meetTitle}</a>
          <a href="#worlds">{copy.navWorld}</a>
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
              { media: '(min-width: 760px)', src: '/assets/landing/landing_hero_desktop.webp?v=20260826' },
              { media: '(orientation: landscape)', src: '/assets/landing/landing_hero_desktop.webp?v=20260826' },
            ]}
            fallbackSrc="/assets/landing/landing_hero_mobile.webp?v=20260826"
          />
          <div className="welcome-hero-sky" aria-hidden />
          <div className="welcome-hero-veil" aria-hidden />
          <div className="welcome-hero-content">
            <div className="welcome-hero-copy welcome-hero-enter">
              <p className="welcome-hero-brand" aria-label="Barsik Land">
                <span>BARSIK</span>
                <span className="welcome-hero-brand-chip">{copy.brandSub}</span>
              </p>
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
          <a className="welcome-scroll-cue" href="#meet">
            {copy.scroll}
            <span className="welcome-scroll-cue-chevron" aria-hidden />
          </a>
        </section>

        <section className="welcome-meet" id="meet" data-reveal>
          <figure className="welcome-meet-figure">
            <img
              src="/assets/brand/barsik_trio_kazakh.jpg?v=20260826"
              alt=""
              width={1200}
              height={900}
              loading="lazy"
              decoding="async"
            />
            <figcaption>
              <h2>{copy.meetTitle}</h2>
              <p>{copy.meetText}</p>
            </figcaption>
          </figure>
          <div className="welcome-meet-strip" aria-hidden="true">
            <img src="/assets/brand/barsik_mascot_sign.jpg?v=20260826" alt="" loading="lazy" decoding="async" />
            <img src="/assets/brand/barsik_cap_sign.jpg?v=20260826" alt="" loading="lazy" decoding="async" />
            <img src="/assets/brand/barsik_brand_extra.jpg?v=20260826" alt="" loading="lazy" decoding="async" />
          </div>
        </section>

        <section className="welcome-worlds welcome-section" id="worlds" data-reveal>
          <header className="welcome-section-heading">
            <h2>{copy.worldsTitle}</h2>
          </header>
          <div className="welcome-world-stack">
            {worlds.map((world, i) => (
              <article
                key={world.id}
                className={`welcome-world-row welcome-world-row--${world.tone}${i % 2 === 1 ? ' is-flip' : ''}`}
                data-reveal
              >
                <div className="welcome-world-media">
                  <img src={world.img} alt="" loading="lazy" decoding="async" />
                </div>
                <div className="welcome-world-copy">
                  <span className="welcome-world-index" aria-hidden>{String(i + 1).padStart(2, '0')}</span>
                  <h3>{world.title}</h3>
                  <p>{world.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="welcome-flow welcome-section" id="flow" data-reveal>
          <h2 className="welcome-flow-title">{copy.flowTitle}</h2>
          <ol className="welcome-flow-steps">
            <li><span>1</span>{copy.flow1}</li>
            <li><span>2</span>{copy.flow2}</li>
            <li><span>3</span>{copy.flow3}</li>
          </ol>
        </section>

        <section className="welcome-parents welcome-section" id="parents" data-reveal>
          <div className="welcome-parent-band">
            <div className="welcome-parent-shield" aria-hidden>
              <ShieldIcon />
            </div>
            <div className="welcome-parent-copy">
              <h2>{copy.parentTitle}</h2>
              <p>{copy.parentText}</p>
              <ul>
                <li>{copy.safe1}</li>
                <li>{copy.safe2}</li>
                <li>{copy.safe3}</li>
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

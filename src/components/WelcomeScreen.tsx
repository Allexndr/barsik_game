import { useUIStore } from '@/store/useUIStore';
import { useGameStore } from '@/store/useGameStore';
import type { Lang } from '@/i18n';
import { useState } from 'react';
import { SettingsModal } from '@/components/SettingsModal';
import { hasFinishedIntro } from '@/three/inventory';
import './WelcomeScreen.css';

/**
 * Season 1 welcome — kids UX:
 * one composition, brand-first Barsik, one primary CTA in the thumb zone.
 * Marketing bloat cut; worlds + parent safety stay below the fold.
 */
export function WelcomeScreen() {
  const setScreen = useUIStore((s) => s.setScreen);
  const lang = useUIStore((s) => s.lang);
  const setLang = useUIStore((s) => s.setLang);
  const patchPlayer = useGameStore((s) => s.patchPlayer);
  const player = useGameStore((s) => s.player);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
    const { currentLevel, season1Complete } = useGameStore.getState();
    if (!hasFinishedIntro()) {
      setScreen('mission0');
      return;
    }
    useUIStore.setState({ activeTab: 'travel', showEpisode: false, episodeId: null });
    if (season1Complete || currentLevel >= 17) {
      setScreen('game');
      return;
    }
    useUIStore.getState().startEpisode(Math.max(0, Math.min(16, currentLevel)));
  };

  const copy = lang === 'kk'
    ? {
        play: 'Ойнау',
        continue: 'Жалғастыру',
        free: 'Тегін · Жарнамасыз · RU / ҚАЗ',
        lead: 'Достар тап, тапсырмаларды орында — Барсикпен Қазақстан бойынша.',
        forest: 'Жеміс орманы',
        ice: 'Мұзды алқап',
        city: 'Арбат · Достар',
        parent: 'Ата-аналарға: жарнамасыз, сатып алусыз, RU және ҚАЗ.',
        settings: 'Баптаулар',
        worlds: 'Үш әлем',
      }
    : {
        play: 'Играть',
        continue: 'Продолжить',
        free: 'Бесплатно · Без рекламы · RU / ҚАЗ',
        lead: 'Найди друзей и добрые задания — путешествие по Казахстану с Барсиком.',
        forest: 'Фруктовый лес',
        ice: 'Ледяная долина',
        city: 'Арбат · Друзья',
        parent: 'Для родителей: без рекламы и покупок в игре. RU и ҚАЗ.',
        settings: 'Настройки',
        worlds: 'Три мира',
      };

  return (
    <div className="welcome-screen welcome-screen--compact">
      <header className="welcome-navbar welcome-navbar--slim">
        <a className="welcome-brand" href="#top" aria-label="Barsik Land">
          <span className="welcome-brand-paw" aria-hidden />
          <span className="welcome-brand-word">BARSIK</span>
        </a>
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
        </div>
      </header>

      <main>
        <section className="welcome-hero welcome-hero--mascot" id="top">
          <div className="welcome-hero-sky" aria-hidden />
          <div className="welcome-hero-stage">
            <img
              className="welcome-mascot"
              src="/assets/brand/barsik_trio_kazakh.jpg"
              alt="Барсик"
              width={640}
              height={640}
              decoding="async"
            />
            <div className="welcome-hero-copy">
              <p className="welcome-hero-brand" aria-label="Barsik Land">
                <span>BARSIK</span>
              </p>
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
        </section>

        <section className="welcome-worlds-slim" aria-label={copy.worlds}>
          <article>
            <img src="/assets/map/chapter1_fruit_forest_desktop.jpg?v=20260825" alt="" />
            <h2>{copy.forest}</h2>
          </article>
          <article>
            <img src="/assets/map/chapter2_ice_valley.jpg?v=20260825" alt="" />
            <h2>{copy.ice}</h2>
          </article>
          <article>
            <img src="/assets/brand/barsik_trio_kazakh.jpg" alt="" />
            <h2>{copy.city}</h2>
          </article>
        </section>

        <p className="welcome-parent-line">{copy.parent}</p>
      </main>

      <footer className="welcome-footer welcome-footer--slim">
        <p>© 2026 Barsik Land</p>
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

import { useUIStore } from '@/store/useUIStore';
import { useGameStore } from '@/store/useGameStore';
import { t as translate, type Lang } from '@/i18n';
import { useState } from 'react';
import { SettingsModal } from '@/components/SettingsModal';
import { ResponsivePicture } from '@/components/ui/ResponsivePicture';
import './WelcomeScreen.css';

/** Стартовый экран: фон cover + UI кодом (адаптив под любой экран). */
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

  return (
    <div className="welcome-screen">
      <ResponsivePicture
        className="welcome-bg"
        alt=""
        /* Desktop/tablet: wide hero. Phone: portrait hero. Same Barsik scene, different crop. */
        sources={[
          { media: '(min-width: 900px)', src: '/assets/landing/landing_hero_desktop.png' },
          { media: '(min-width: 600px) and (orientation: landscape)', src: '/assets/landing/landing_hero_desktop.png' },
        ]}
        fallbackSrc="/assets/landing/landing_hero_mobile.png"
      />
      <div className="welcome-veil" aria-hidden />

      <div className="welcome-ui">
        <div className="welcome-lang" role="group" aria-label="Language">
          <button
            type="button"
            className={`welcome-lang-btn ${lang === 'ru' ? 'active' : ''}`}
            onClick={() => pickLang('ru')}
            aria-pressed={lang === 'ru'}
          >
            RU
          </button>
          <button
            type="button"
            className={`welcome-lang-btn ${lang === 'kk' ? 'active' : ''}`}
            onClick={() => pickLang('kk')}
            aria-pressed={lang === 'kk'}
          >
            ҚАЗ
          </button>
        </div>

        <header className="welcome-titles">
          <p className="welcome-eyebrow">{translate(lang, 'welcome.start')}</p>
          <h1 className="welcome-logo" aria-label="BARSIK">
            BARSIK
          </h1>
        </header>

        {/* прозрачная зона под персонажами — клики не мешают */}
        <div className="welcome-spacer" aria-hidden />

        <div className="welcome-actions">
          <button
            type="button"
            className="welcome-btn-side welcome-btn-settings"
            aria-label={translate(lang, 'welcome.settings')}
            title={translate(lang, 'welcome.settings')}
            onClick={() => setSettingsOpen(true)}
          >
            <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden>
              <path
                fill="currentColor"
                d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.59.24-1.13.55-1.62.94l-2.39-.96a.5.5 0 0 0-.6.22L2.72 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.84 14.58a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.43.34.68.22l2.39-.96c.49.39 1.03.7 1.62.94l.36 2.54c.05.24.25.42.49.42h3.8c.24 0 .44-.18.49-.42l.36-2.54c.59-.24 1.13-.55 1.62-.94l2.39.96c.25.12.54.02.68-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"
              />
            </svg>
          </button>

          <button
            type="button"
            className="welcome-btn-play"
            onClick={() => setScreen('quick')}
          >
            {translate(lang, 'welcome.play')}
          </button>

          <button
            type="button"
            className="welcome-btn-side welcome-btn-profile"
            aria-label={player ? (lang === 'kk' ? 'Жалғастыру' : 'Продолжить') : translate(lang, 'welcome.profile')}
            title={player ? (lang === 'kk' ? 'Жалғастыру' : 'Продолжить') : translate(lang, 'welcome.profile')}
            onClick={() => {
              if (player) {
                setScreen(localStorage.getItem('barsik_mission0_done') === '1' ? 'game' : 'mission0');
              } else {
                setScreen('quick');
              }
            }}
          >
            {player ? (
              <span className="welcome-btn-continue" aria-hidden>
                ▶
              </span>
            ) : (
              <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden>
                <path
                  fill="currentColor"
                  d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v1.2c0 .7.5 1.2 1.2 1.2h16.8c.7 0 1.2-.5 1.2-1.2v-1.2c0-3.2-6.4-4.8-9.6-4.8z"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useUIStore } from '@/store/useUIStore';
import { t } from '@/i18n';
import { SettingsModal } from '@/components/SettingsModal';
import { IconStar, IconGear, IconMore } from '@/components/ui/icons';
import './NavBar.css';

export function NavBar() {
  const player = useGameStore((s) => s.player);
  const stars = useGameStore((s) => s.stars);
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const lang = useUIStore((s) => s.lang);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const tabs = [
    { id: 'travel', label: t(lang, 'nav.travel'), icon: 'nav_travel' },
    { id: 'friends', label: t(lang, 'nav.friends'), icon: 'nav_friends' },
    { id: 'city', label: t(lang, 'nav.city'), icon: 'nav_city' },
    { id: 'shop', label: t(lang, 'nav.shop'), icon: 'nav_shop' },
    { id: 'leaderboard', label: t(lang, 'nav.leaderboard'), icon: 'nav_leaderboard' },
    { id: 'qr', label: t(lang, 'nav.qr'), icon: 'nav_qr' },
  ] as const;
  const primaryTabs = tabs.slice(0, 3);
  const utilityTabs = tabs.slice(3);
  const moreIsActive = utilityTabs.some((tab) => tab.id === activeTab);

  useEffect(() => {
    if (!moreOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [moreOpen]);

  const pickTab = (id: (typeof tabs)[number]['id']) => {
    setActiveTab(id);
    setMoreOpen(false);
  };

  return (
    <>
      <nav className="navbar" aria-label="Main navigation">
        <div className="navbar-left">
          <div className="logo">BARSIK</div>
        </div>

        <div className="navbar-center">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              onClick={() => pickTab(tab.id)}
            >
              <img
                className="nav-tab-icon"
                src={`/assets/ui/${tab.icon}.png`}
                alt=""
                aria-hidden
                draggable={false}
              />
              <span className="nav-tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="navbar-right">
          <div className="stars-counter">
            <IconStar className="star-icon" size={20} />
            <span className="star-value">{stars}</span>
          </div>

          <button
            type="button"
            className="player-avatar player-avatar-btn"
            onClick={() => setSettingsOpen(true)}
            aria-label={t(lang, 'welcome.settings')}
          >
            <div className="avatar-circle">{player?.nick.charAt(0).toUpperCase()}</div>
            <span className="player-nick">{player?.nick}</span>
          </button>

          <button
            className="btn-settings"
            type="button"
            aria-label={t(lang, 'welcome.settings')}
            onClick={() => setSettingsOpen(true)}
          >
            <IconGear size={22} />
          </button>
        </div>
      </nav>
      <nav className="navbar-mobile" aria-label="Mobile navigation">
        {primaryTabs.map((tab) => (
          <button
            key={`mobile-${tab.id}`}
            type="button"
            className={`nav-tab mobile ${activeTab === tab.id ? 'active' : ''}`}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            onClick={() => pickTab(tab.id)}
          >
            <img
              className="nav-tab-icon"
              src={`/assets/ui/${tab.icon}.png`}
              alt=""
              aria-hidden
              draggable={false}
            />
            <span className="nav-tab-label">{tab.label}</span>
          </button>
        ))}
        <button
          type="button"
          className={`nav-tab mobile nav-tab-more ${moreOpen || moreIsActive ? 'active' : ''}`}
          aria-current={moreIsActive ? 'page' : undefined}
          aria-expanded={moreOpen}
          aria-controls="hub-more-menu"
          onClick={() => setMoreOpen((open) => !open)}
        >
          <span className="nav-tab-more-icon" aria-hidden="true"><IconMore size={26} /></span>
          <span className="nav-tab-label">{t(lang, 'nav.more')}</span>
        </button>
      </nav>

      {moreOpen && (
        <>
          <button
            type="button"
            className="mobile-nav-scrim"
            aria-label={t(lang, 'nav.more.close')}
            onClick={() => setMoreOpen(false)}
          />
          <aside id="hub-more-menu" className="mobile-more-menu animate-slide-up" aria-label={t(lang, 'nav.more.menu')}>
            <p className="mobile-more-title">{t(lang, 'nav.more.menu')}</p>
            <div className="mobile-more-actions">
              {utilityTabs.map((tab) => (
                <button
                  key={`more-${tab.id}`}
                  type="button"
                  className={`mobile-more-action ${activeTab === tab.id ? 'active' : ''}`}
                  aria-current={activeTab === tab.id ? 'page' : undefined}
                  onClick={() => pickTab(tab.id)}
                >
                  <img className="mobile-more-action-icon" src={`/assets/ui/${tab.icon}.png`} alt="" aria-hidden draggable={false} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </aside>
        </>
      )}

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

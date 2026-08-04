import { useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useUIStore } from '@/store/useUIStore';
import { t } from '@/i18n';
import { SettingsModal } from '@/components/SettingsModal';
import { IconStar, IconGear } from '@/components/ui/icons';
import './NavBar.css';

export function NavBar() {
  const player = useGameStore((s) => s.player);
  const stars = useGameStore((s) => s.stars);
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const lang = useUIStore((s) => s.lang);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const tabs = [
    { id: 'travel', label: t(lang, 'nav.travel'), icon: 'nav_travel' },
    { id: 'friends', label: t(lang, 'nav.friends'), icon: 'nav_friends' },
    { id: 'city', label: t(lang, 'nav.city'), icon: 'nav_city' },
    { id: 'shop', label: t(lang, 'nav.shop'), icon: 'nav_shop' },
    { id: 'leaderboard', label: t(lang, 'nav.leaderboard'), icon: 'nav_leaderboard' },
    { id: 'qr', label: t(lang, 'nav.qr'), icon: 'nav_qr' },
  ] as const;

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
              onClick={() => setActiveTab(tab.id)}
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
        {tabs.map((tab) => (
          <button
            key={`mobile-${tab.id}`}
            type="button"
            className={`nav-tab mobile ${activeTab === tab.id ? 'active' : ''}`}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            onClick={() => setActiveTab(tab.id)}
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
      </nav>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

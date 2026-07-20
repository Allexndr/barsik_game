import { useUIStore } from '@/store/useUIStore';
import { useGameStore } from '@/store/useGameStore';
import { t, type Lang } from '@/i18n';
import './SettingsModal.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: Props) {
  const lang = useUIStore((s) => s.lang);
  const setLang = useUIStore((s) => s.setLang);
  const setScreen = useUIStore((s) => s.setScreen);
  const endEpisode = useUIStore((s) => s.endEpisode);
  const clearSession = useGameStore((s) => s.clearSession);
  const patchPlayer = useGameStore((s) => s.patchPlayer);
  const player = useGameStore((s) => s.player);

  if (!open) return null;

  const pickLang = (next: Lang) => {
    setLang(next);
    patchPlayer({ lang: next });
  };

  const exitToStart = () => {
    endEpisode();
    clearSession();
    useUIStore.setState({
      currentScreen: 'welcome',
      activeTab: 'travel',
      softGate: null,
      sessionPlayMs: 0,
    });
    onClose();
    setScreen('welcome');
  };

  return (
    <div
      className="settings-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t(lang, 'settings.title')}
      onClick={onClose}
    >
      <div className="settings-card animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="settings-head">
          <h2>{t(lang, 'settings.title')}</h2>
          <button type="button" className="settings-x" onClick={onClose} aria-label={t(lang, 'settings.close')}>
            ✕
          </button>
        </div>

        {player && (
          <p className="settings-nick">
            {player.nick}
          </p>
        )}

        <div className="settings-row">
          <span>{t(lang, 'settings.lang')}</span>
          <div className="settings-lang" role="group">
            <button
              type="button"
              className={lang === 'ru' ? 'active' : ''}
              onClick={() => pickLang('ru')}
            >
              RU
            </button>
            <button
              type="button"
              className={lang === 'kk' ? 'active' : ''}
              onClick={() => pickLang('kk')}
            >
              ҚАЗ
            </button>
          </div>
        </div>

        <div className="settings-row muted">
          <span>{t(lang, 'settings.sound')}</span>
          <span className="settings-soon">{t(lang, 'settings.soon')}</span>
        </div>

        <button type="button" className="settings-exit" onClick={exitToStart}>
          {t(lang, 'settings.exit')}
        </button>
        <p className="settings-hint">{t(lang, 'settings.exit.hint')}</p>
      </div>
    </div>
  );
}

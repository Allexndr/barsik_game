import { useState } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { useGameStore } from '@/store/useGameStore';
import { t, type Lang } from '@/i18n';
import { PlushButton } from '@/components/ui/PlushButton';
import { IconClose, IconShield, IconSoundOff, IconSoundOn } from '@/components/ui/icons';
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
  const muted = useUIStore((s) => s.muted);
  const toggleMuted = useUIStore((s) => s.toggleMuted);
  const clearSession = useGameStore((s) => s.clearSession);
  const patchPlayer = useGameStore((s) => s.patchPlayer);
  const player = useGameStore((s) => s.player);
  const [parentOpen, setParentOpen] = useState(false);

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
      className="smodal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t(lang, 'settings.title')}
      onClick={onClose}
    >
      <div className="smodal-card animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="smodal-head">
          <h2>{t(lang, 'settings.title')}</h2>
          <button type="button" className="smodal-x" onClick={onClose} aria-label={t(lang, 'settings.close')}>
            <IconClose size={16} />
          </button>
        </div>

        {player && <p className="smodal-nick">{player.nick}</p>}

        <div className="smodal-row">
          <span>{t(lang, 'settings.lang')}</span>
          <div className="smodal-lang" role="group">
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

        <div className="smodal-row">
          <span>{t(lang, 'settings.sound')}</span>
          <button
            type="button"
            className={`smodal-mute ${muted ? 'is-muted' : ''}`}
            onClick={toggleMuted}
            aria-pressed={muted}
          >
            {muted ? <IconSoundOff size={18} /> : <IconSoundOn size={18} />}
            {muted ? t(lang, 'settings.mute.on') : t(lang, 'settings.mute.off')}
          </button>
        </div>

        <button
          type="button"
          className="smodal-parent"
          onClick={() => setParentOpen((v) => !v)}
          aria-expanded={parentOpen}
        >
          <IconShield size={16} />
          {t(lang, 'settings.parent')}
        </button>
        {parentOpen && <p className="smodal-parent-body">{t(lang, 'settings.parent.body')}</p>}

        <PlushButton variant="danger" className="smodal-exit" onClick={exitToStart}>
          {t(lang, 'settings.exit')}
        </PlushButton>
        <p className="smodal-hint">{t(lang, 'settings.exit.hint')}</p>
      </div>
    </div>
  );
}

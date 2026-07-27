import { useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useUIStore } from '@/store/useUIStore';
import type { Player } from '@/types';
import { t } from '@/i18n';
import { registerNick, validateNick } from '@/utils/nicks';
import { STORAGE_KEYS, isFlagSet } from '@/utils/storage';
import { PlushButton } from '@/components/ui/PlushButton';
import { IconChevronLeft, IconCheck } from '@/components/ui/icons';
import './QuickStartScreen.css';

export function QuickStartScreen() {
  const [nick, setNick] = useState('');
  const [gender, setGender] = useState<'boy' | 'girl'>('boy');
  const [error, setError] = useState('');
  const [suggestion, setSuggestion] = useState('');

  const setPlayer = useGameStore((s) => s.setPlayer);
  const setScreen = useUIStore((s) => s.setScreen);
  const lang = useUIStore((s) => s.lang);

  const start = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateNick(nick, lang);
    if (!check.ok) {
      setError(check.message || '');
      setSuggestion(check.suggestion || '');
      return;
    }

    registerNick(nick);

    const player: Player = {
      id: `player_${Date.now()}`,
      nick: nick.trim(),
      gender,
      ageCategory: '',
      phone: '',
      email: '',
      lang,
      level: 0,
      stars: 0,
      createdAt: new Date().toISOString(),
      profileStage: 'guest_nick',
      playStartedAt: new Date().toISOString(),
    };

    setPlayer(player);
    useUIStore.setState({ sessionPlayMs: 0 });
    const done = isFlagSet(STORAGE_KEYS.mission0Done);
    setScreen(done ? 'game' : 'mission0');
  };

  return (
    <div className="quick-screen">
      <div className="quick-card animate-slide-up">
        <button type="button" className="quick-back" onClick={() => setScreen('welcome')}>
          <IconChevronLeft size={16} />
          {t(lang, 'quick.back').replace('← ', '')}
        </button>

        <h1>{t(lang, 'quick.title')}</h1>
        <p className="quick-sub">{t(lang, 'quick.sub')}</p>

        <form onSubmit={start} className="quick-form">
          <label className="quick-label" htmlFor="quick-nick">
            {t(lang, 'quick.nick')}
          </label>
          <input
            id="quick-nick"
            className="quick-input"
            value={nick}
            maxLength={16}
            autoFocus
            autoComplete="nickname"
            placeholder={t(lang, 'quick.placeholder')}
            onChange={(e) => {
              setNick(e.target.value);
              setError('');
              setSuggestion('');
            }}
          />
          {error && (
            <p className="quick-error">
              {error}
              {suggestion && (
                <>
                  {' · '}
                  <button
                    type="button"
                    className="quick-suggest"
                    onClick={() => {
                      setNick(suggestion);
                      setError('');
                      setSuggestion('');
                    }}
                  >
                    {t(lang, 'nick.take')} «{suggestion}»
                  </button>
                </>
              )}
            </p>
          )}

          <p className="quick-label">{t(lang, 'quick.gender')}</p>
          <div className="quick-gender">
            <button
              type="button"
              className={`quick-gender-card ${gender === 'boy' ? 'active' : ''}`}
              onClick={() => setGender('boy')}
              aria-pressed={gender === 'boy'}
            >
              <span className="quick-gender-face quick-gender-face-boy" aria-hidden>
                <BarsikFace />
              </span>
              <span className="quick-gender-name">{t(lang, 'quick.boy')}</span>
              {gender === 'boy' && (
                <span className="quick-gender-check">
                  <IconCheck size={14} />
                </span>
              )}
            </button>
            <button
              type="button"
              className={`quick-gender-card ${gender === 'girl' ? 'active' : ''}`}
              onClick={() => setGender('girl')}
              aria-pressed={gender === 'girl'}
            >
              <span className="quick-gender-face quick-gender-face-girl" aria-hidden>
                <BarsikFace bow />
              </span>
              <span className="quick-gender-name">{t(lang, 'quick.girl')}</span>
              {gender === 'girl' && (
                <span className="quick-gender-check">
                  <IconCheck size={14} />
                </span>
              )}
            </button>
          </div>

          <PlushButton type="submit" variant="primary" size="lg" className="quick-go">
            {t(lang, 'quick.go')}
          </PlushButton>
        </form>
      </div>
    </div>
  );
}

/** Minimal soft-3D cub silhouette placeholder — swap for real character art per DESIGN.md when ready. */
function BarsikFace({ bow }: { bow?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden>
      <ellipse cx="32" cy="36" rx="22" ry="20" fill="#f4f1ff" />
      <ellipse cx="16" cy="18" rx="8" ry="9" fill="#f4f1ff" />
      <ellipse cx="48" cy="18" rx="8" ry="9" fill="#f4f1ff" />
      <circle cx="24" cy="34" r="3.2" fill="#3a2e7a" />
      <circle cx="40" cy="34" r="3.2" fill="#3a2e7a" />
      <ellipse cx="32" cy="42" rx="4.5" ry="3.2" fill="#ff9f9e" />
      {bow ? (
        <path
          d="M10 12l6 4-6 4-2-4z M6 12l-6 4 6 4 2-4z"
          fill="#ff7675"
          transform="translate(4 -6)"
        />
      ) : null}
    </svg>
  );
}

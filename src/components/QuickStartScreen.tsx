import { useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useUIStore } from '@/store/useUIStore';
import type { Player } from '@/types';
import { t } from '@/i18n';
import { registerNick, validateNick } from '@/utils/nicks';
import { hasFinishedIntro } from '@/three/inventory';
import { PlushButton } from '@/components/ui/PlushButton';
import { IconChevronLeft, IconCheck } from '@/components/ui/icons';
import { registerAccount, toPlayer } from '@/net/account';
import { migrateProgress } from '@/utils/progressMigration';
import './QuickStartScreen.css';

export function QuickStartScreen() {
  const [nick, setNick] = useState('');
  const [gender, setGender] = useState<'boy' | 'girl'>('boy');
  const [error, setError] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  const setPlayer = useGameStore((s) => s.setPlayer);
  const setScreen = useUIStore((s) => s.setScreen);
  const lang = useUIStore((s) => s.lang);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateNick(nick, lang);
    if (!check.ok) {
      setError(check.message || '');
      setSuggestion(check.suggestion || '');
      return;
    }
    if (!/^\d{4,8}$/.test(pin)) {
      setError(lang === 'kk' ? '4–8 саннан тұратын код енгіз' : 'Введи код из 4–8 цифр');
      return;
    }

    registerNick(nick);
    setBusy(true);
    try {
      const account = await registerAccount({ nick: nick.trim(), pin, gender, lang });
      const player = { ...toPlayer(account.user), playStartedAt: new Date().toISOString() } satisfies Player;
      // Новый аккаунт никогда не наследует общий старый ключ браузера.
      useGameStore.getState().resetProgress();
      setPlayer(player);
      if (account.progress) useGameStore.setState({ player, ...migrateProgress(account.progress) });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : '';
      setError(code === 'nick_taken'
        ? t(lang, 'nick.taken')
        : lang === 'kk' ? 'Серверге қосылу мүмкін болмады' : 'Не удалось создать аккаунт. Попробуй ещё раз');
      setBusy(false);
      return;
    }
    setBusy(false);
    useUIStore.setState({ sessionPlayMs: 0 });
    setScreen(hasFinishedIntro() ? 'game' : 'mission0');
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
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'quick-nick-error' : undefined}
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
            <p id="quick-nick-error" className="quick-error" role="alert">
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

          <label className="quick-label" htmlFor="quick-pin">
            {lang === 'kk' ? 'Құпия код (4–8 сан)' : 'Код доступа (4–8 цифр)'}
          </label>
          <p className="quick-pin-hint">
            {lang === 'kk'
              ? 'Өзіңе оңай 4–8 сан ойлап тап та, есте сақта. Код прогресті басқа құрылғыда ашуға көмектеседі.'
              : 'Придумай 4–8 цифр, которые легко запомнить. Код поможет открыть свой прогресс на другом устройстве.'}
          </p>
          <input
            id="quick-pin"
            className="quick-input"
            value={pin}
            minLength={4}
            maxLength={8}
            inputMode="numeric"
            type="password"
            autoComplete="new-password"
            placeholder="••••"
            onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
          />

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

          <PlushButton type="submit" variant="primary" size="lg" className="quick-go" disabled={busy}>
            {busy ? (lang === 'kk' ? 'Сақталуда…' : 'Сохраняем…') : t(lang, 'quick.go')}
          </PlushButton>
        </form>
      </div>
    </div>
  );
}

/** Минимальный силуэт котёнка вместо модели — заменить настоящей графикой по DESIGN.md, когда она будет. */
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

import { useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useUIStore } from '@/store/useUIStore';
import type { Player } from '@/types';
import { t } from '@/i18n';
import { registerNick, validateNick } from '@/utils/nicks';
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
    const done = localStorage.getItem('barsik_mission0_done') === '1';
    setScreen(done ? 'game' : 'mission0');
  };

  return (
    <div className="quick-screen">
      <div className="quick-card animate-slide-up">
        <button type="button" className="quick-back" onClick={() => setScreen('welcome')}>
          {t(lang, 'quick.back')}
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
              className={gender === 'boy' ? 'active' : ''}
              onClick={() => setGender('boy')}
            >
              {t(lang, 'quick.boy')}
            </button>
            <button
              type="button"
              className={gender === 'girl' ? 'active' : ''}
              onClick={() => setGender('girl')}
            >
              {t(lang, 'quick.girl')}
            </button>
          </div>

          <button type="submit" className="quick-go">
            {t(lang, 'quick.go')}
          </button>
        </form>
      </div>
    </div>
  );
}

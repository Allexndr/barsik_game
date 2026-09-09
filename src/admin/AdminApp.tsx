import { useCallback, useState } from 'react';
import { AdminError, clearCredentials, getActor, getToken, setCredentials } from './api';
import { OverviewPanel } from './panels/OverviewPanel';
import { PlayersPanel } from './panels/PlayersPanel';
import { BoardPanel } from './panels/BoardPanel';
import { ContentPanel } from './panels/ContentPanel';
import { AuditPanel } from './panels/AuditPanel';
import './admin.css';

/**
 * Админка.
 *
 * Живёт отдельным входом (`?admin=1`) и грузится лениво, поэтому в детский
 * бандл не попадает ни байта, пока панель не открыли.
 *
 * Вход — access token Supabase Auth. Сервер проверяет identity и admin claim;
 * браузер только пересылает токен и не принимает решение о правах.
 */

type Tab = 'overview' | 'players' | 'board' | 'content' | 'audit';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Обзор' },
  { id: 'players', label: 'Игроки' },
  { id: 'board', label: 'Рейтинг' },
  { id: 'content', label: 'Контент' },
  { id: 'audit', label: 'Журнал' },
];

export function AdminApp() {
  const [authed, setAuthed] = useState(Boolean(getToken()));
  const [tab, setTab] = useState<Tab>('overview');
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<Record<string, boolean> | null>(null);

  const onError = useCallback((e: unknown) => {
    if (e instanceof AdminError) {
      setError(e.message);
      if (e.config) setConfig(e.config);
      if (e.status === 401) {
        clearCredentials();
        setAuthed(false);
      }
      return;
    }
    setError(e instanceof Error ? e.message : String(e));
  }, []);

  if (!authed) return <Login onDone={() => { setError(null); setAuthed(true); }} />;

  return (
    <div className="adm">
      <div className="adm-shell">
        <header className="adm-head">
          <h1>Барсик · админка</h1>
          <span className="adm-who">{getActor() || 'admin'}</span>
          <div className="adm-spacer" />
          <button
            className="adm-btn"
            onClick={() => { clearCredentials(); setAuthed(false); }}
          >
            Выйти
          </button>
        </header>

        <nav className="adm-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`adm-tab ${tab === t.id ? 'is-on' : ''}`}
              onClick={() => { setError(null); setTab(t.id); }}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {error ? (
          <div className="adm-error">
            <div>{error}</div>
            {config ? (
              <div style={{ marginTop: 8 }}>
                <b>Что настроено:</b>{' '}
                SUPABASE_URL — {config.supabaseUrl ? 'да' : 'нет'}, SUPABASE_SERVICE_ROLE_KEY —{' '}
                {config.serviceKey ? 'да' : 'нет'}, identity auth — {config.identityAuth ? 'да' : 'нет'}.
                Переменные задаются в настройках проекта Vercel и применяются после передеплоя.
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === 'overview' ? <OverviewPanel onError={onError} /> : null}
        {tab === 'players' ? <PlayersPanel onError={onError} /> : null}
        {tab === 'board' ? <BoardPanel onError={onError} /> : null}
        {tab === 'content' ? <ContentPanel /> : null}
        {tab === 'audit' ? <AuditPanel onError={onError} /> : null}
      </div>
    </div>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [token, setToken] = useState('');
  const [actor, setActor] = useState(getActor());

  return (
    <div className="adm">
      <div className="adm-shell">
        <form
          className="adm-card adm-login"
          onSubmit={(e) => {
            e.preventDefault();
            if (!token.trim()) return;
            setCredentials(token.trim(), actor.trim() || 'admin');
            onDone();
          }}
        >
          <h2>Вход в админку</h2>
          <label htmlFor="adm-actor">Кто вы</label>
          <input
            id="adm-actor"
            className="adm-input"
            placeholder="имя — попадёт в журнал"
            value={actor}
            onChange={(e) => setActor(e.target.value)}
          />
          <label htmlFor="adm-token">Access token Supabase</label>
          <input
            id="adm-token"
            className="adm-input"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <div style={{ marginTop: 16 }}>
            <button className="adm-btn go" type="submit">Войти</button>
          </div>
          <p className="adm-note" style={{ marginTop: 16 }}>
            Вставьте access token пользователя Supabase Auth с правами администратора.
            Сервер проверит сессию и admin claim; токен хранится только до закрытия вкладки.
          </p>
        </form>
      </div>
    </div>
  );
}

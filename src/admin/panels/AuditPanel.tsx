import { useCallback, useEffect, useState } from 'react';
import { adminApi, type AuditEntry } from '../api';

const LABEL: Record<string, string> = {
  patch: 'правка сейва',
  delete: 'удаление сейва',
  hide: 'скрытие из рейтинга',
  unhide: 'возврат в рейтинг',
};

/**
 * Журнал.
 *
 * Только чтение: журнал, который можно править из той же панели, журналом не
 * является. Каждая запись правки несёт снимок «до», поэтому по журналу можно
 * восстановить исходное состояние сейва вручную.
 */
export function AuditPanel({ onError }: { onError: (e: unknown) => void }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(true);
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(() => {
    setBusy(true);
    adminApi
      .audit()
      .then((d) => { setEntries(d.entries); setMissing(Boolean(d.missingTable)); })
      .catch(onError)
      .finally(() => setBusy(false));
  }, [onError]);

  useEffect(load, [load]);

  return (
    <div className="adm-card">
      <h2>Журнал действий</h2>
      <div className="adm-row" style={{ marginBottom: 12 }}>
        <button className="adm-btn" onClick={load} disabled={busy}>
          {busy ? 'Загружаю…' : 'Обновить'}
        </button>
        <span className="adm-note">{entries.length} записей</span>
      </div>

      {missing ? (
        <p className="adm-note">
          Таблицы журнала нет. Запустите <code>supabase/admin_schema.sql</code> в SQL-редакторе
          Supabase — до этого действия выполняются, но следа не оставляют.
        </p>
      ) : null}

      <div className="adm-scroll">
        <table className="adm-table">
          <thead>
            <tr><th>Когда</th><th>Кто</th><th>Что</th><th>Игрок</th><th /></tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="adm-note">{new Date(e.at).toLocaleString('ru-RU')}</td>
                <td>{e.actor}</td>
                <td>
                  <span className={`adm-tag ${e.action === 'delete' ? 'bad' : e.action === 'hide' ? 'warn' : ''}`}>
                    {LABEL[e.action] ?? e.action}
                  </span>
                </td>
                <td><code>{e.player_key ?? '—'}</code></td>
                <td>
                  <button className="adm-btn" onClick={() => setOpen(open === e.id ? null : e.id)}>
                    {open === e.id ? 'Скрыть' : 'Подробно'}
                  </button>
                </td>
              </tr>
            ))}
            {!entries.length && !busy ? (
              <tr><td colSpan={5} className="adm-note">Пока пусто.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {open !== null ? (
        <pre className="adm-json" style={{ marginTop: 12 }}>
          {JSON.stringify(entries.find((e) => e.id === open)?.details ?? {}, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

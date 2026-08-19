import { useCallback, useEffect, useState } from 'react';
import { adminApi, type BoardRow } from '../api';

/**
 * Модерация рейтинга.
 *
 * Здесь живёт запись «Игрок» с 1486 звёздами за 91 уровень и 18 друзей в
 * сезоне, где уровней 17 и друзей 9. Она попала в базу в окно, когда anon
 * держал полный доступ на запись, и стоит первой: каждый ребёнок видит её как
 * результат, который надо побить.
 *
 * Действие — скрыть, а не удалить. Если завтра окажется, что это чей-то
 * настоящий сейв после миграции, вернуть его будет неоткуда; удаление живёт
 * отдельно, во вкладке «Игроки», и требует отдельного подтверждения.
 */
export function BoardPanel({ onError }: { onError: (e: unknown) => void }) {
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [onlyProblems, setOnlyProblems] = useState(false);

  const load = useCallback(() => {
    setBusy(true);
    adminApi
      .board()
      .then((d) => setRows(d.rows))
      .catch(onError)
      .finally(() => setBusy(false));
  }, [onError]);

  useEffect(load, [load]);

  const toggle = async (row: BoardRow) => {
    const next = !row.hidden;
    const reason = next
      ? window.prompt(
          'Почему скрываем? Это попадёт в журнал.',
          row.impossible.join('; ') || 'накрутка',
        )
      : '';
    if (next && reason === null) return;
    setWorking(row.player_key);
    try {
      const { row: updated } = await adminApi.setHidden(row.player_key, next, reason ?? '');
      setRows((list) => list.map((r) => (r.player_key === row.player_key ? updated : r)));
    } catch (e) {
      onError(e);
    } finally {
      setWorking(null);
    }
  };

  const shown = onlyProblems ? rows.filter((r) => r.impossible.length || r.hidden) : rows;
  const problems = rows.filter((r) => r.impossible.length && !r.hidden).length;

  return (
    <div className="adm-card">
      <h2>Рейтинг</h2>
      <div className="adm-row" style={{ marginBottom: 12 }}>
        <button className="adm-btn" onClick={load} disabled={busy}>
          {busy ? 'Загружаю…' : 'Обновить'}
        </button>
        <label className="adm-row" style={{ gap: 6 }}>
          <input
            type="checkbox"
            checked={onlyProblems}
            onChange={(e) => setOnlyProblems(e.target.checked)}
          />
          <span className="adm-note">только проблемные и скрытые</span>
        </label>
        <div className="adm-spacer" style={{ flex: 1 }} />
        {problems > 0 ? (
          <span className="adm-tag bad">{problems} невозможных строк видны детям</span>
        ) : (
          <span className="adm-tag good">невозможных строк в выдаче нет</span>
        )}
      </div>

      <div className="adm-scroll">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Имя</th>
              <th>Ключ</th>
              <th className="num">Уровни</th>
              <th className="num">Друзья</th>
              <th className="num">Звёзды</th>
              <th>Проблема</th>
              <th>Действие</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.player_key} style={r.hidden ? { opacity: 0.55 } : undefined}>
                <td>{r.name ?? '—'}</td>
                <td><code>{r.player_key}</code></td>
                <td className="num">{r.levels ?? 0}</td>
                <td className="num">{r.friends ?? 0}</td>
                <td className="num">{r.total_stars ?? r.stars ?? 0}</td>
                <td>
                  {r.hidden ? (
                    <span className="adm-tag">скрыта: {r.hidden_reason || 'без причины'}</span>
                  ) : r.impossible.length ? (
                    <span className="adm-tag bad">{r.impossible.join('; ')}</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  <button
                    className={`adm-btn ${r.hidden ? 'go' : 'warn'}`}
                    onClick={() => toggle(r)}
                    disabled={working === r.player_key}
                  >
                    {working === r.player_key ? '…' : r.hidden ? 'Вернуть' : 'Скрыть'}
                  </button>
                </td>
              </tr>
            ))}
            {!shown.length && !busy ? (
              <tr><td colSpan={7} className="adm-note">Пусто.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="adm-note" style={{ marginTop: 12 }}>
        Скрытие обратимо и пишется в журнал. Удаление сейва — во вкладке «Игроки»: оно необратимо,
        поэтому вынесено отдельно.
      </p>
    </div>
  );
}

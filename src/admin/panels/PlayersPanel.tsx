import { useCallback, useEffect, useState } from 'react';
import { adminApi, type PlayerRow } from '../api';

/**
 * Поддержка игрока.
 *
 * §17.8 спеки: просмотр прогресса, восстановление сейва, блокировка
 * злоупотреблений. Правка идёт по одному полю за раз и требует причины —
 * причина уходит в журнал вместе со снимком «до», чтобы правку можно было
 * откатить и чтобы на вопрос «куда делся прогресс ребёнка» был ответ.
 */
export function PlayersPanel({ onError }: { onError: (e: unknown) => void }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<PlayerRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Record<string, unknown> | null>(null);
  const [field, setField] = useState('levels');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const search = useCallback(
    (term: string) => {
      setBusy(true);
      adminApi
        .players(term)
        .then((d) => setRows(d.players))
        .catch(onError)
        .finally(() => setBusy(false));
    },
    [onError],
  );

  useEffect(() => search(''), [search]);

  const openPlayer = async (key: string) => {
    try {
      const { player } = await adminApi.player(key);
      setOpen(player);
      setField('levels');
      setValue('');
      setReason('');
    } catch (e) {
      onError(e);
    }
  };

  const save = async () => {
    if (!open) return;
    const key = String(open.player_key ?? '');
    if (!reason.trim()) {
      onError(new Error('Укажите причину: она уходит в журнал и без неё правку не откатить.'));
      return;
    }
    const raw = value.trim();
    const parsed = raw === '' ? null : Number.isNaN(Number(raw)) ? raw : Number(raw);
    setSaving(true);
    try {
      const { player } = await adminApi.patchPlayer(key, { [field]: parsed }, reason.trim());
      if (player) setOpen(player);
      search(q);
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!open) return;
    const key = String(open.player_key ?? '');
    const typed = window.prompt(
      `Удаление необратимо: прогресс ребёнка исчезнет.\nЧтобы подтвердить, введите ключ целиком:\n${key}`,
      '',
    );
    if (typed !== key) return;
    try {
      await adminApi.deletePlayer(key);
      setOpen(null);
      search(q);
    } catch (e) {
      onError(e);
    }
  };

  return (
    <>
      <div className="adm-card">
        <h2>Игроки</h2>
        <form
          className="adm-row"
          onSubmit={(e) => { e.preventDefault(); search(q); }}
        >
          <input
            className="adm-input"
            style={{ maxWidth: 320 }}
            placeholder="Имя или ключ игрока"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="adm-btn go" type="submit" disabled={busy}>
            {busy ? 'Ищу…' : 'Найти'}
          </button>
          <span className="adm-note">{rows.length} строк</span>
        </form>

        <div className="adm-scroll" style={{ marginTop: 12 }}>
          <table className="adm-table">
            <thead>
              <tr>
                <th>Имя</th><th>Ключ</th>
                <th className="num">Уровни</th><th className="num">Друзья</th><th className="num">Звёзды</th>
                <th>Последний заход</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.player_key}>
                  <td>{r.name ?? '—'}</td>
                  <td><code>{r.player_key}</code></td>
                  <td className="num">{r.levels ?? 0}</td>
                  <td className="num">{r.friends ?? 0}</td>
                  <td className="num">{r.total_stars ?? r.stars ?? 0}</td>
                  <td className="adm-note">
                    {r.updated_at ? new Date(r.updated_at).toLocaleString('ru-RU') : '—'}
                  </td>
                  <td>
                    <button className="adm-btn" onClick={() => openPlayer(r.player_key)}>Открыть</button>
                  </td>
                </tr>
              ))}
              {!rows.length && !busy ? (
                <tr><td colSpan={7} className="adm-note">Ничего не найдено.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {open ? (
        <div className="adm-card">
          <h2>Сейв: {String(open.name ?? '—')}</h2>
          <p className="adm-note">
            Ключ <code>{String(open.player_key)}</code>. Ниже — сейв как он лежит в базе, целиком.
          </p>
          <pre className="adm-json">{JSON.stringify(open, null, 2)}</pre>

          <h3>Правка</h3>
          <div className="adm-row">
            <select className="adm-input" style={{ maxWidth: 190 }} value={field} onChange={(e) => setField(e.target.value)}>
              <option value="levels">levels</option>
              <option value="friends">friends</option>
              <option value="stars">stars</option>
              <option value="total_stars">total_stars</option>
              <option value="name">name</option>
            </select>
            <input
              className="adm-input"
              style={{ maxWidth: 190 }}
              placeholder="Новое значение"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <input
              className="adm-input"
              style={{ maxWidth: 320 }}
              placeholder="Причина (уйдёт в журнал)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <button className="adm-btn go" onClick={save} disabled={saving}>
              {saving ? 'Сохраняю…' : 'Сохранить'}
            </button>
          </div>

          <h3>Опасное</h3>
          <div className="adm-row">
            <button className="adm-btn bad" onClick={remove}>Удалить сейв</button>
            <span className="adm-note">
              Необратимо. Потребует ввести ключ целиком. Снимок удалённого уходит в журнал.
            </span>
          </div>

          <div style={{ marginTop: 14 }}>
            <button className="adm-btn" onClick={() => setOpen(null)}>Закрыть</button>
          </div>
        </div>
      ) : null}
    </>
  );
}

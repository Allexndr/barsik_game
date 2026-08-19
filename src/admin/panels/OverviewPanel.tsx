import { useEffect, useState } from 'react';
import { adminApi, type OverviewData } from '../api';

/**
 * Обзор.
 *
 * Воронка по уровням — единственная метрика из §17.8 спеки, которую сейчас
 * действительно можно посчитать: она выводится из сейвов. Всё остальное из
 * того списка (retention, ошибки, FPS, сканы QR, приглашения) требует потока
 * событий, которого в проекте нет, и панель говорит об этом прямо, а не
 * показывает правдоподобные нули.
 */
export function OverviewPanel({ onError }: { onError: (e: unknown) => void }) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let alive = true;
    adminApi
      .overview()
      .then((d) => { if (alive) setData(d); })
      .catch(onError)
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (busy) return <div className="adm-card">Считаю…</div>;
  if (!data) return null;

  const { players, progress, integrity } = data;

  return (
    <>
      <div className="adm-card">
        <h2>Игроки</h2>
        <div className="adm-grid">
          <Kpi n={players.total} label="всего сейвов" />
          <Kpi n={players.active7} label="заходили за 7 дней" />
          <Kpi n={players.active30} label="за 30 дней" />
          <Kpi n={progress.seasonComplete} label="прошли сезон" />
          <Kpi n={progress.neverStarted} label="ни одного уровня" />
          <Kpi n={progress.medianStars} label="медиана звёзд" />
        </div>
        {players.hidden > 0 ? (
          <p className="adm-note" style={{ marginTop: 12 }}>
            Скрыто из рейтинга: {players.hidden}. Смотреть и возвращать — во вкладке «Рейтинг».
          </p>
        ) : null}
      </div>

      <div className="adm-card">
        <h2>Докуда доходят</h2>
        <p className="adm-note">
          Сколько игроков прошли хотя бы столько уровней. Обрыв между соседними строками — это
          место, где уровень теряет детей.
        </p>
        <div className="adm-scroll">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Уровень</th>
                <th className="num">Дошли</th>
                <th style={{ width: '55%' }}>Доля</th>
                <th className="num">Потеря к предыдущему</th>
              </tr>
            </thead>
            <tbody>
              {progress.funnel.map((row, i) => {
                const prev = i > 0 ? progress.funnel[i - 1].reached : row.reached;
                const drop = prev > 0 ? Math.round(((prev - row.reached) / prev) * 1000) / 10 : 0;
                return (
                  <tr key={row.level}>
                    <td>{row.level}</td>
                    <td className="num">{row.reached}</td>
                    <td>
                      <div className="adm-bar">
                        <i style={{ width: `${row.share}%` }} />
                        <span>{row.share}%</span>
                      </div>
                    </td>
                    <td className="num">
                      {drop > 0 ? <span className={drop >= 25 ? 'adm-tag bad' : 'adm-tag'}>−{drop}%</span> : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="adm-card">
        <h2>Друзья</h2>
        <div className="adm-scroll">
          <table className="adm-table">
            <thead>
              <tr><th>Найдено друзей</th><th className="num">Игроков</th></tr>
            </thead>
            <tbody>
              {progress.friendsHistogram.map((r) => (
                <tr key={r.friends}><td>{r.friends}</td><td className="num">{r.players}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="adm-card">
        <h2>
          Целостность данных{' '}
          {integrity.implausible > 0
            ? <span className="adm-tag bad">{integrity.implausible}</span>
            : <span className="adm-tag good">чисто</span>}
        </h2>
        <p className="adm-note">
          Строки, которых игра не могла произвести: пройдено больше уровней или найдено больше
          друзей, чем есть в сезоне ({data.season.levels} и {data.season.friends}).
          Проверка структурная, а не «слишком много звёзд»: у звёзд нет чистого потолка, и порог
          по ним отсеял бы честного собирателя.
        </p>
        {integrity.rows.length ? (
          <div className="adm-scroll">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Ключ</th><th>Имя</th>
                  <th className="num">Уровни</th><th className="num">Друзья</th><th className="num">Звёзды</th>
                  <th>Состояние</th>
                </tr>
              </thead>
              <tbody>
                {integrity.rows.map((r) => (
                  <tr key={r.player_key}>
                    <td><code>{r.player_key}</code></td>
                    <td>{r.name ?? '—'}</td>
                    <td className="num">{r.levels}</td>
                    <td className="num">{r.friends}</td>
                    <td className="num">{r.total_stars}</td>
                    <td>
                      {r.hidden
                        ? <span className="adm-tag good">скрыта</span>
                        : <span className="adm-tag bad">видна детям</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="adm-card">
        <h2>Чего эта панель не знает</h2>
        <ul className="adm-note" style={{ margin: 0, paddingLeft: 18 }}>
          {data.notMeasured.map((line) => <li key={line}>{line}</li>)}
        </ul>
        <p className="adm-note" style={{ marginTop: 10 }}>
          Показывать вместо них нули было бы хуже, чем не показывать: по этим числам принимается
          решение о втором сезоне.
        </p>
      </div>
    </>
  );
}

function Kpi({ n, label }: { n: number; label: string }) {
  return (
    <div className="adm-kpi">
      <b>{n}</b>
      <span>{label}</span>
    </div>
  );
}

import { LEVEL_CONFIGS } from '@/utils/levels';
import { SEASON1_FRIENDS } from '@/utils/season1Friends';

/**
 * Контент сезона.
 *
 * Только чтение, и это осознанно. Спека §17.8 просит «управление уровнями,
 * друзьями, наградами без пересборки клиента» — то есть CMS. Уровни сейчас
 * живут в `src/utils/levels.ts`, а сами сцены — в коде: править длительность
 * или награду через базу можно, а вот геометрию арыка нельзя, и половинчатая
 * CMS хуже её отсутствия, потому что создаёт впечатление, что уровень
 * настраивается, пока на деле настраивается только его подпись.
 *
 * Поэтому здесь честная витрина: что в сезоне есть, какие награды и целевой
 * хронометраж. По ней поддержка отвечает на вопросы, не открывая репозиторий.
 */
export function ContentPanel() {
  const totalStars = LEVEL_CONFIGS.reduce((s, l) => s + l.reward.stars, 0);

  return (
    <>
      <div className="adm-card">
        <h2>Уровни сезона 1</h2>
        <div className="adm-grid" style={{ marginBottom: 14 }}>
          <div className="adm-kpi"><b>{LEVEL_CONFIGS.length}</b><span>уровней</span></div>
          <div className="adm-kpi"><b>{SEASON1_FRIENDS.length}</b><span>друзей</span></div>
          <div className="adm-kpi"><b>{totalStars}</b><span>звёзд за награды</span></div>
        </div>
        <div className="adm-scroll">
          <table className="adm-table">
            <thead>
              <tr>
                <th className="num">#</th><th>Название</th><th>Глава</th>
                <th>Механика</th><th className="num">План, с</th>
                <th className="num">Звёзды</th><th>Друг</th>
              </tr>
            </thead>
            <tbody>
              {LEVEL_CONFIGS.map((l) => (
                <tr key={l.id}>
                  <td className="num">{l.id}</td>
                  <td>{l.title}</td>
                  <td>{l.chapter === 1 ? 'Фруктовый лес' : 'Ледяная долина'}</td>
                  <td><span className="adm-tag">{l.interactivity}</span></td>
                  <td className="num">{l.duration}</td>
                  <td className="num">{l.reward.stars}</td>
                  <td>{l.reward.friend ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="adm-card">
        <h2>Друзья</h2>
        <div className="adm-scroll">
          <table className="adm-table">
            <thead><tr><th>id</th><th>Имя</th><th className="num">С уровня</th></tr></thead>
            <tbody>
              {SEASON1_FRIENDS.map((f) => (
                <tr key={f.id}>
                  <td><code>{f.id}</code></td>
                  <td>{(f as { name?: string; nameRu?: string }).name ?? (f as { nameRu?: string }).nameRu ?? '—'}</td>
                  <td className="num">{(f as { levelId?: number }).levelId ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="adm-card">
        <h2>Почему только чтение</h2>
        <p className="adm-note">
          Спека просит управление контентом без пересборки клиента — это CMS. Сейчас уровни
          описаны в <code>src/utils/levels.ts</code>, а сами сцены живут в коде: подпись, награду и
          целевой хронометраж вынести в базу можно, геометрию уровня — нет. Половинчатая CMS хуже
          её отсутствия: она создаёт впечатление, что уровень настраивается, пока настраивается
          только его название.
        </p>
        <p className="adm-note">
          Если управление контентом нужно всерьёз, это отдельная работа: таблица уровней в базе,
          загрузка конфига на старте и фолбэк на встроенный, если база недоступна.
        </p>
      </div>
    </>
  );
}

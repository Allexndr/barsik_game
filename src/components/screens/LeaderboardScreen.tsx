import { useCallback, useEffect, useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useUIStore } from '@/store/useUIStore';
import { Chip } from '@/components/ui/Chip';
import { PlushButton } from '@/components/ui/PlushButton';
import { IconFriends, IconStar } from '@/components/ui/icons';
import { MetaScreenFooter } from '@/components/widgets/MetaScreenFooter';
import { fetchLeaderboard, type LeaderboardRow } from '@/utils/leaderboard';
import './meta-screen.css';
import './LeaderboardScreen.css';

type LoadState = 'loading' | 'ready' | 'error' | 'empty';

export function LeaderboardScreen() {
  const player = useGameStore((s) => s.player);
  const stars = useGameStore((s) => s.stars);
  const friends = useGameStore((s) => s.friends);
  const lang = useUIStore((s) => s.lang);

  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [state, setState] = useState<LoadState>('loading');

  const load = useCallback(async () => {
    setState('loading');
    try {
      const data = await fetchLeaderboard(15);
      setRows(data);
      setState(data.length === 0 ? 'empty' : 'ready');
    } catch {
      setRows([]);
      setState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const youIndex = rows.findIndex(
    (r) => player?.nick && r.name.toLowerCase() === player.nick.toLowerCase(),
  );

  return (
    <div className="screen screen-leaderboard screen-meta">
      <header className="meta-screen-header">
        <div>
          <h2>{lang === 'kk' ? 'Достар рейтингі' : 'Рейтинг друзей'}</h2>
          <p className="meta-screen-sub">
            {lang === 'kk'
              ? '1-маусымда кім көбірек жұлдыз жинады'
              : 'Кто собрал больше звёзд в Сезоне 1'}
          </p>
        </div>
      </header>

      <div className="leaderboard-you">
        <span className="leaderboard-you-label">{lang === 'kk' ? 'Қазір сен' : 'Ты сейчас'}</span>
        <div className="leaderboard-you-stats">
          <Chip icon={<IconStar size={14} />} tone="star">
            {stars}
          </Chip>
          <Chip icon={<IconFriends size={14} />} tone="neutral">
            {friends.length} {lang === 'kk' ? 'дос' : 'друзей'}
          </Chip>
        </div>
      </div>

      <div className="leaderboard-panel">
        {state === 'loading' && (
          <div className="leaderboard-state">
            <div className="leaderboard-spinner" aria-hidden />
            <p>{lang === 'kk' ? 'Рейтинг жүктелуде...' : 'Загружаем рейтинг...'}</p>
          </div>
        )}

        {state === 'error' && (
          <div className="leaderboard-state">
            <p>
              {lang === 'kk'
                ? 'Рейтинг жүктелмеді. Интернетті тексеріп, қайталап көр.'
                : 'Не удалось загрузить рейтинг. Проверь интернет и попробуй ещё.'}
            </p>
            <PlushButton variant="secondary" onClick={() => void load()}>
              {lang === 'kk' ? 'Қайталау' : 'Повторить'}
            </PlushButton>
          </div>
        )}

        {state === 'empty' && (
          <div className="leaderboard-state">
            <p>
              {lang === 'kk'
                ? 'Рейтинг әзірге бос — деңгейлерден бірінші болып өт!'
                : 'Пока рейтинг пуст — будь первым, кто пройдёт уровни!'}
            </p>
          </div>
        )}

        {state === 'ready' && (
          <ol className="leaderboard-list">
            {rows.map((row, i) => {
              const score = row.total_stars ?? row.stars ?? 0;
              const isYou = i === youIndex;
              return (
                <li
                  key={`${row.name}-${i}`}
                  className={`leaderboard-row ${isYou ? 'is-you' : ''}`}
                >
                  <span className="leaderboard-rank">{i + 1}</span>
                  <div className="leaderboard-name-wrap">
                    <span className="leaderboard-name">{row.name}</span>
                    {isYou && (
                      <span className="leaderboard-you-tag">{lang === 'kk' ? 'сен' : 'ты'}</span>
                    )}
                  </div>
                  <span className="leaderboard-score">
                    <IconStar size={14} />
                    {score}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <MetaScreenFooter
        hint={
          lang === 'kk'
            ? 'Ортақ рейтинг онлайн жүктеледі, ал сенің жетістігің осы құрылғыда сақталады.'
            : 'Общий рейтинг загружается онлайн, а твой прогресс хранится на этом устройстве.'
        }
      />
    </div>
  );
}

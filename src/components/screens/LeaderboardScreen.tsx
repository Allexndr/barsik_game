import { useCallback, useEffect, useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useUIStore } from '@/store/useUIStore';
import { Chip } from '@/components/ui/Chip';
import { PlushButton } from '@/components/ui/PlushButton';
import { IconFriends, IconStar } from '@/components/ui/icons';
import { MetaScreenFooter } from '@/components/widgets/MetaScreenFooter';
import { fetchLeaderboard, scoreOf, type LeaderboardRow } from '@/utils/leaderboard';
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

  // Place the player by their own star count rather than by looking for their
  // name in the table. There is no submit path in the game — leaderboard.ts
  // only reads — so a child could play the whole season and never appear, and
  // the screen would keep showing them a ranking they cannot be part of.
  // Ranking locally against the fetched rows is honest and always works.
  const nick = player?.nick?.trim() || (lang === 'kk' ? 'Сен' : 'Ты');
  const others = rows.filter(
    (r) => !player?.nick || r.name.trim().toLowerCase() !== player.nick.trim().toLowerCase(),
  );
  const youIndex = others.filter((r) => scoreOf(r) > stars).length;
  const board: Array<LeaderboardRow & { isYou?: boolean }> = [
    ...others.slice(0, youIndex),
    { name: nick, stars, total_stars: stars, levels: 0, friends: friends.length, isYou: true },
    ...others.slice(youIndex),
  ];
  // Who is directly above, and by how much — a target beats a static table.
  const ahead = others[youIndex - 1];
  const gap = ahead ? scoreOf(ahead) - stars : 0;
  // Only promise an overtake that is actually within reach. A whole-season
  // level is worth 10–30 stars, so about two levels' worth is a goal; the top
  // of this table currently holds an impossible 1486, and «набери ещё 1366»
  // is not encouragement, it is a wall.
  const REACHABLE = 60;
  const canCatch = Boolean(ahead) && gap <= REACHABLE;

  // A child with 120 stars has no use for a table led by someone with 1486.
  // Show the podium separately and then the player's own neighbourhood, which
  // is the part they can move within.
  // Hidden when the player is already inside the top three — the window below
  // is then showing the same names, and a list printed twice reads as a bug.
  const podium = youIndex >= 3 ? others.slice(0, 3) : [];
  const WINDOW = 3;
  const from = Math.max(0, youIndex - WINDOW);
  const near = board.slice(from, youIndex + WINDOW + 1);
  const nearStartRank = from + 1;

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
        <span className="leaderboard-you-label">
          {state === 'ready'
            ? lang === 'kk' ? `${youIndex + 1}-орын` : `${youIndex + 1}-е место`
            : lang === 'kk' ? 'Қазір сен' : 'Ты сейчас'}
        </span>
        <div className="leaderboard-you-stats">
          <Chip icon={<IconStar size={14} />} tone="star">
            {stars}
          </Chip>
          <Chip icon={<IconFriends size={14} />} tone="neutral">
            {friends.length} {lang === 'kk' ? 'дос' : 'друзей'}
          </Chip>
        </div>
      </div>

      {state === 'ready' && (
        <p className="leaderboard-target">
          {!ahead
            ? lang === 'kk' ? 'Сен бірінші орындасың! 🏆' : 'Ты на первом месте! 🏆'
            : canCatch
              ? lang === 'kk'
                ? `${ahead.name} озып тұр — тағы ${gap} жұлдыз жина!`
                : `Впереди ${ahead.name} — ещё ${gap} ${starWord(gap)}, и ты обойдёшь!`
              : lang === 'kk'
                ? 'Әр деңгей — жаңа жұлдыздар. Жоғары көтеріл!'
                : 'Каждый уровень — новые звёзды. Поднимайся выше!'}
        </p>
      )}

      {state === 'ready' && podium.length > 0 && (
        <div className="leaderboard-podium">
          <span className="leaderboard-podium-label">
            {lang === 'kk' ? 'Маусым көшбасшылары' : 'Лидеры сезона'}
          </span>
          <ol>
            {podium.map((row, i) => (
              <li key={`${row.name}-podium-${i}`}>
                <span className={`leaderboard-medal medal-${i + 1}`}>{i + 1}</span>
                <span className="leaderboard-name">{row.name}</span>
                <span className="leaderboard-score">
                  <IconStar size={12} />
                  {scoreOf(row)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

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
            {near.map((row, i) => {
              const score = scoreOf(row);
              const isYou = Boolean(row.isYou);
              return (
                <li
                  key={`${row.name}-${i}`}
                  className={`leaderboard-row ${isYou ? 'is-you' : ''}`}
                >
                  <span className="leaderboard-rank">{nearStartRank + i}</span>
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
            ? 'Орның осы құрылғыдағы жұлдыздарың бойынша есептеледі.'
            : 'Твоё место считается по звёздам с этого устройства.'
        }
      />
    </div>
  );
}

/** «1 звезду», «2 звезды», «5 звёзд» — a child notices when this is wrong. */
function starWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'звезду';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'звезды';
  return 'звёзд';
}

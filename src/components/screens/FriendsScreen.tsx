import { useCallback, useRef, useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { IconPaw } from '@/components/ui/icons';
import '@/components/ui/motion.css';
import './FriendsScreen.css';

const FRIEND_META: Record<string, { role: string; rarity: string; blurb: string }> = {
  putalo: { role: 'Фотограф леса', rarity: 'rare', blurb: 'Ловит моменты и учит замечать детали.' },
  gardener: { role: 'Садовник', rarity: 'common', blurb: 'Знает каждое яблоко в лесу.' },
  gardener_l1: { role: 'Садовник', rarity: 'common', blurb: 'Помог с первым утром в лесу.' },
  ice_sculptor: { role: 'Мастер льда', rarity: 'common', blurb: 'Лепит снежных друзей.' },
  snowman: { role: 'Снежный друг', rarity: 'rare', blurb: 'Тёплый даже в мороз.' },
  ice_friend: { role: 'Ледяной друг', rarity: 'rare', blurb: 'Сверкает на солнце.' },
  rare_friend_1: { role: 'Фруктовый сюрприз', rarity: 'legend', blurb: 'Самый сочный секрет леса.' },
};

export function FriendsScreen() {
  const friends = useGameStore((s) => s.friends);

  return (
    <div className="screen screen-friends">
      <div className="friends-header">
        <h2>Мои Друзья</h2>
        <span className="friends-count">Собрано: {friends.length}</span>
      </div>

      {friends.length === 0 ? (
        <div className="friend-card-placeholder">
          Пока нет друзей. Пройди уровни в Путешествии!
        </div>
      ) : (
        <div className="friends-grid">
          {friends.map((f) => {
            const meta = FRIEND_META[f.id] ?? {
              role: 'Друг Барсика',
              rarity: f.rarity,
              blurb: 'Вместе веселее!',
            };
            return (
              <FriendTiltCard
                key={f.id}
                name={f.name === `Friend ${f.id}` ? prettyName(f.id) : f.name}
                role={meta.role}
                rarity={meta.rarity}
                blurb={meta.blurb}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function FriendTiltCard({
  name,
  role,
  rarity,
  blurb,
}: {
  name: string;
  role: string;
  rarity: string;
  blurb: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [flipped, setFlipped] = useState(false);

  const onMove = useCallback((e: React.PointerEvent) => {
    if (flipped) return;
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: py * -10, y: px * 12 });
  }, [flipped]);

  const onLeave = useCallback(() => {
    if (!flipped) setTilt({ x: 0, y: 0 });
  }, [flipped]);

  const transform = flipped
    ? 'rotateY(180deg)'
    : `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`;

  return (
    <div
      className="friend-tilt-wrap"
      ref={wrapRef}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      <button
        type="button"
        className={`friend-tilt-inner ${flipped ? 'is-flipped' : ''} rarity-${rarity}`}
        style={{ transform }}
        onClick={() => {
          setFlipped((v) => !v);
          setTilt({ x: 0, y: 0 });
        }}
        aria-label={flipped ? `${name}: свернуть` : `${name}: подробнее`}
      >
        <div className={`friend-face friend-face-front friend-card rarity-${rarity}`}>
          <div className="friend-avatar">
            <IconPaw size={28} />
          </div>
          <h3>{name}</h3>
          <p className="friend-role">{role}</p>
          <span className="friend-rarity">{rarityLabel(rarity)}</span>
          <div className="friend-flip-hint">нажми</div>
        </div>
        <div className={`friend-face friend-face-back rarity-${rarity}`}>
          <div className="friend-avatar">
            <IconPaw size={28} />
          </div>
          <h3>{name}</h3>
          <p className="friend-role">{blurb}</p>
          <div className="friend-flip-hint">назад</div>
        </div>
      </button>
    </div>
  );
}

function prettyName(id: string): string {
  const map: Record<string, string> = {
    putalo: 'Путало',
    gardener: 'Садовник',
    gardener_l1: 'Садовник',
    ice_sculptor: 'Мастер льда',
    snowman: 'Снеговик',
    ice_friend: 'Ледяной друг',
    rare_friend_1: 'Ягодка',
  };
  return map[id] ?? id;
}

function rarityLabel(r: string): string {
  if (r === 'legend') return 'Легендарный';
  if (r === 'rare') return 'Редкий';
  return 'Обычный';
}

import { useCallback, useRef, useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useUIStore } from '@/store/useUIStore';
import { Chip } from '@/components/ui/Chip';
import { IconPaw } from '@/components/ui/icons';
import { FriendPortrait } from '@/components/widgets/FriendPortrait';
import { MetaScreenFooter } from '@/components/widgets/MetaScreenFooter';
import { SEASON1_FRIENDS, isFriendUnlocked } from '@/utils/season1Friends';
import '@/components/ui/motion.css';
import './meta-screen.css';
import './FriendsScreen.css';

export function FriendsScreen() {
  const friends = useGameStore((s) => s.friends);
  const lang = useUIStore((s) => s.lang);
  const unlockedIds = friends.map((f) => f.id);
  const unlockedCount = SEASON1_FRIENDS.filter((f) =>
    isFriendUnlocked(f.id, unlockedIds),
  ).length;
  // Point at the next specific friend rather than saying "find the rest".
  // The old hint was the same sentence no matter how far along you were, and
  // it repeated what nine locked cards were already saying.
  const next = SEASON1_FRIENDS.find((f) => !isFriendUnlocked(f.id, unlockedIds));
  const hint = !next
    ? lang === 'kk'
      ? 'Барлық достар табылды! 1-маусым толық жиналды.'
      : 'Все друзья найдены! Сезон 1 собран полностью.'
    : lang === 'kk'
      ? `Келесі: ${next.nameKk} — ${next.levelId + 1}-деңгей.`
      : `Следующий: ${next.name} — уровень ${next.levelId + 1}.`;

  return (
    <div className="screen screen-friends screen-meta">
      <header className="meta-screen-header">
        <div>
          <h2>{lang === 'kk' ? 'Менің достарым' : 'Мои друзья'}</h2>
          <p className="meta-screen-sub">
            {lang === 'kk'
              ? '1-маусым — Саяхаттан барлық достарды тап'
              : 'Сезон 1 — найди всех в Путешествии'}
          </p>
        </div>
        <Chip icon={<IconPaw size={14} />} tone="neutral">
          {unlockedCount}/{SEASON1_FRIENDS.length}
        </Chip>
      </header>

      <div className="friends-grid">
        {SEASON1_FRIENDS.map((entry) => {
          const unlocked = isFriendUnlocked(entry.id, unlockedIds);
          return (
            <FriendTiltCard
              key={entry.id}
              id={entry.id}
              name={lang === 'kk' ? entry.nameKk : entry.name}
              role={lang === 'kk' ? entry.roleKk : entry.role}
              rarity={entry.rarity}
              blurb={lang === 'kk' ? entry.blurbKk : entry.blurb}
              unlocked={unlocked}
              levelLabel={entry.levelId + 1}
              lang={lang}
            />
          );
        })}
      </div>

      <MetaScreenFooter hint={hint} />
    </div>
  );
}

function FriendTiltCard({
  id,
  name,
  role,
  rarity,
  blurb,
  unlocked,
  levelLabel,
  lang,
}: {
  id: string;
  name: string;
  role: string;
  rarity: string;
  blurb: string;
  unlocked: boolean;
  levelLabel: number;
  lang: 'ru' | 'kk';
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [flipped, setFlipped] = useState(false);

  const onMove = useCallback(
    (e: React.PointerEvent) => {
      if (!unlocked || flipped) return;
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      setTilt({ x: py * -10, y: px * 12 });
    },
    [flipped, unlocked],
  );

  const onLeave = useCallback(() => {
    if (!flipped) setTilt({ x: 0, y: 0 });
  }, [flipped]);

  const transform = flipped
    ? 'rotateY(180deg)'
    : `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`;

  if (!unlocked) {
    // One silhouette and one level number. The card used to repeat the same
    // sentence and the same "На карту" button on every locked friend — nine
    // copies of one instruction, which is noise, not guidance. The screen says
    // it once, in the footer.
    return (
      <div className="friend-tilt-wrap">
        <div className="friend-card friend-card-locked">
          <div className="friend-avatar friend-avatar-locked">
            <FriendPortrait id={id} locked size={64} />
          </div>
          <h3>{name}</h3>
          <p className="friend-role">
            {lang === 'kk' ? `${levelLabel}-деңгей` : `Уровень ${levelLabel}`}
          </p>
        </div>
      </div>
    );
  }

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
        aria-label={
          flipped
            ? `${name}: ${lang === 'kk' ? 'жабу' : 'свернуть'}`
            : `${name}: ${lang === 'kk' ? 'толығырақ' : 'подробнее'}`
        }
      >
        <div className={`friend-face friend-face-front friend-card rarity-${rarity}`}>
          <div className="friend-avatar">
            <FriendPortrait id={id} size={64} />
          </div>
          <h3>{name}</h3>
          <p className="friend-role">{role}</p>
          <span className="friend-rarity">{rarityLabel(rarity, lang)}</span>
          <div className="friend-flip-hint">{lang === 'kk' ? 'бас' : 'нажми'}</div>
        </div>
        <div className={`friend-face friend-face-back rarity-${rarity}`}>
          <div className="friend-avatar friend-avatar-sm">
            <FriendPortrait id={id} size={44} />
          </div>
          <h3>{name}</h3>
          <p className="friend-role">{blurb}</p>
          <div className="friend-flip-hint">{lang === 'kk' ? 'артқа' : 'назад'}</div>
        </div>
      </button>
    </div>
  );
}

function rarityLabel(r: string, lang: 'ru' | 'kk'): string {
  if (r === 'legend') return lang === 'kk' ? 'Аңызға айналған' : 'Легендарный';
  if (r === 'rare') return lang === 'kk' ? 'Сирек' : 'Редкий';
  return lang === 'kk' ? 'Қарапайым' : 'Обычный';
}

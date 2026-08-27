import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useUIStore } from '@/store/useUIStore';
import { Chip } from '@/components/ui/Chip';
import { IconPaw } from '@/components/ui/icons';
import { FriendPortrait } from '@/components/widgets/FriendPortrait';
import { MetaScreenFooter } from '@/components/widgets/MetaScreenFooter';
import { SEASON1_FRIENDS, isFriendUnlocked, type Season1FriendEntry } from '@/utils/season1Friends';
import { createFriendPreview, type FriendPreview } from '@/three/avatar/FriendPreview';
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
  const next = SEASON1_FRIENDS.find((f) => !isFriendUnlocked(f.id, unlockedIds));
  const hint = !next
    ? lang === 'kk'
      ? 'Барлық достар табылды! 1-маусым толық жиналды.'
      : 'Все друзья найдены! Сезон 1 собран полностью.'
    : lang === 'kk'
      ? `Келесі: ${next.nameKk} — ${next.levelId + 1}-деңгей.`
      : `Следующий: ${next.name} — уровень ${next.levelId + 1}.`;

  const [inspect, setInspect] = useState<Season1FriendEntry | null>(null);

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
              unlocked={unlocked}
              levelLabel={entry.levelId + 1}
              lang={lang}
              onInspect={() => setInspect(entry)}
            />
          );
        })}
      </div>

      <MetaScreenFooter hint={hint} />

      {inspect && (
        <FriendInspectModal
          entry={inspect}
          lang={lang}
          onClose={() => setInspect(null)}
        />
      )}
    </div>
  );
}

function FriendTiltCard({
  id,
  name,
  role,
  rarity,
  unlocked,
  levelLabel,
  lang,
  onInspect,
}: {
  id: string;
  name: string;
  role: string;
  rarity: string;
  unlocked: boolean;
  levelLabel: number;
  lang: 'ru' | 'kk';
  onInspect: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const onMove = useCallback(
    (e: React.PointerEvent) => {
      if (!unlocked) return;
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      setTilt({ x: py * -10, y: px * 12 });
    },
    [unlocked],
  );

  const onLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
  }, []);

  if (!unlocked) {
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
        className={`friend-tilt-inner rarity-${rarity}`}
        style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
        onClick={onInspect}
        aria-label={`${name}: ${lang === 'kk' ? '3D қарау' : 'осмотреть в 3D'}`}
      >
        <div className={`friend-face friend-face-front friend-card rarity-${rarity}`}>
          <div className="friend-avatar">
            <FriendPortrait id={id} size={64} />
          </div>
          <h3>{name}</h3>
          <p className="friend-role">{role}</p>
          <span className="friend-rarity">{rarityLabel(rarity, lang)}</span>
          <div className="friend-flip-hint" aria-hidden>
            ↻ {lang === 'kk' ? '3D' : '3D'}
          </div>
        </div>
      </button>
    </div>
  );
}

function FriendInspectModal({
  entry,
  lang,
  onClose,
}: {
  entry: Season1FriendEntry;
  lang: 'ru' | 'kk';
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<FriendPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const name = lang === 'kk' ? entry.nameKk : entry.name;
  const blurb = lang === 'kk' ? entry.blurbKk : entry.blurb;
  const role = lang === 'kk' ? entry.roleKk : entry.role;

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const preview = createFriendPreview(canvas);
    previewRef.current = preview;
    const resize = () => preview.resize(stage.clientWidth, stage.clientHeight);
    resize();
    preview.start();
    const ro = new ResizeObserver(resize);
    ro.observe(stage);
    setLoading(true);
    void preview.setFriend(entry.id).then(() => {
      if (previewRef.current === preview) setLoading(false);
    });
    return () => {
      ro.disconnect();
      preview.dispose();
      previewRef.current = null;
    };
  }, [entry.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="friend-inspect" role="dialog" aria-modal="true" aria-label={name}>
      <button type="button" className="friend-inspect-backdrop" aria-label={lang === 'kk' ? 'Жабу' : 'Закрыть'} onClick={onClose} />
      <div className="friend-inspect-card">
        <header className="friend-inspect-head">
          <div>
            <h3>{name}</h3>
            <p>{role}</p>
          </div>
          <button type="button" className="friend-inspect-close" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="friend-inspect-stage" ref={stageRef}>
          <canvas ref={canvasRef} className="friend-inspect-canvas" />
          {loading && (
            <div className="friend-inspect-loading">
              {lang === 'kk' ? 'Жүктелуде…' : 'Загрузка…'}
            </div>
          )}
        </div>
        <p className="friend-inspect-hint">
          {lang === 'kk' ? 'Сүйреп бұр — досыңды жан-жақтан қара' : 'Тяни пальцем — крути друга и смотри со всех сторон'}
        </p>
        <p className="friend-inspect-blurb">{blurb}</p>
      </div>
    </div>
  );
}

function rarityLabel(r: string, lang: 'ru' | 'kk'): string {
  if (r === 'legend') return lang === 'kk' ? 'Аңызға айналған' : 'Легендарный';
  if (r === 'rare') return lang === 'kk' ? 'Сирек' : 'Редкий';
  return lang === 'kk' ? 'Қарапайым' : 'Обычный';
}

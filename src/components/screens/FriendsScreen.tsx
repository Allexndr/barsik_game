import { useGameStore } from '@/store/useGameStore';
import './FriendsScreen.css';

const FRIEND_META: Record<string, { role: string; rarity: string }> = {
  putalo: { role: 'Фотограф леса', rarity: 'rare' },
  gardener: { role: 'Садовник', rarity: 'common' },
  ice_sculptor: { role: 'Мастер льда', rarity: 'common' },
  snowman: { role: 'Снежный друг', rarity: 'rare' },
  ice_friend: { role: 'Ледяной друг', rarity: 'rare' },
  rare_friend_1: { role: 'Фруктовый сюрприз', rarity: 'legend' },
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
            const meta = FRIEND_META[f.id] ?? { role: 'Друг Барсика', rarity: f.rarity };
            return (
              <article key={f.id} className={`friend-card rarity-${meta.rarity}`}>
                <div className="friend-avatar">🐾</div>
                <h3>{f.name === `Friend ${f.id}` ? prettyName(f.id) : f.name}</h3>
                <p className="friend-role">{meta.role}</p>
                <span className="friend-rarity">{rarityLabel(meta.rarity)}</span>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function prettyName(id: string): string {
  const map: Record<string, string> = {
    putalo: 'Путало',
    gardener: 'Садовник',
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

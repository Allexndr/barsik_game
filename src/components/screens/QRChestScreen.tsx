import { useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import './QRChestScreen.css';

const DEMO_REWARDS = [
  { id: 'qr_berry', name: 'Ягодка', stars: 40 },
  { id: 'qr_spark', name: 'Искорка', stars: 25 },
  { id: 'qr_scarf', name: 'Узорный шарф', stars: 20 },
];

export function QRChestScreen() {
  const addFriend = useGameStore((s) => s.addFriend);
  const addStars = useGameStore((s) => s.addStars);
  const friends = useGameStore((s) => s.friends);
  const [phase, setPhase] = useState<'idle' | 'opening' | 'reward'>('idle');
  const [reward, setReward] = useState<(typeof DEMO_REWARDS)[0] | null>(null);

  const openChest = () => {
    if (phase !== 'idle') return;
    setPhase('opening');
    setTimeout(() => {
      const pick = DEMO_REWARDS[Math.floor(Math.random() * DEMO_REWARDS.length)];
      const already = friends.some((f) => f.id === pick.id);
      if (!already) {
        addFriend({
          id: pick.id,
          name: pick.name,
          description: 'QR-сюрприз',
          rarity: 'rare',
          chapter: 0,
          unlocked: true,
          asset: '',
        });
      }
      addStars(pick.stars);
      setReward(pick);
      setPhase('reward');
    }, 1600);
  };

  const reset = () => {
    setPhase('idle');
    setReward(null);
  };

  return (
    <div className="screen screen-qr">
      <h2>Волшебный сундук QR</h2>
      <p className="qr-hint">
        Пока упаковки не выпущены — демо-открытие. Позже сюда придёт код с продукта.
      </p>

      <div className={`qr-chest-container phase-${phase}`}>
        {phase === 'idle' && (
          <>
            <div className="chest-visual">🎁</div>
            <button className="btn-open-chest" onClick={openChest}>
              Открыть демо-сундук
            </button>
          </>
        )}
        {phase === 'opening' && (
          <div className="chest-opening">
            <div className="chest-visual spin">✨🎁✨</div>
            <p>Магия открывается...</p>
          </div>
        )}
        {phase === 'reward' && reward && (
          <div className="chest-reward">
            <div className="chest-visual">🎉</div>
            <h3>Вау!</h3>
            <p>
              {reward.name} · +{reward.stars} ⭐
            </p>
            <button className="btn-open-chest" onClick={reset}>
              Закрыть
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { Chip } from '@/components/ui/Chip';
import { PlushButton } from '@/components/ui/PlushButton';
import { IconGift, IconStar } from '@/components/ui/icons';
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
            <div className="chest-visual">
              <IconGift size={48} />
            </div>
            <PlushButton variant="secondary" size="lg" onClick={openChest}>
              Открыть демо-сундук
            </PlushButton>
          </>
        )}
        {phase === 'opening' && (
          <div className="chest-opening">
            <div className="chest-visual spin">
              <IconGift size={48} />
            </div>
            <p>Магия открывается...</p>
          </div>
        )}
        {phase === 'reward' && reward && (
          <div className="chest-reward">
            <div className="chest-visual">
              <IconGift size={48} />
            </div>
            <h3>Вау!</h3>
            <p className="chest-reward-line">
              {reward.name}{' '}
              <Chip icon={<IconStar size={14} />} tone="star">
                +{reward.stars}
              </Chip>
            </p>
            <PlushButton variant="primary" size="lg" onClick={reset}>
              Закрыть
            </PlushButton>
          </div>
        )}
      </div>
    </div>
  );
}

import { MissionScreen } from './MissionScreen';
import { Level9Scene } from '@/three/scenes/Level9Scene';

export function Mission9Screen() {
  return (
    <MissionScreen
      levelId={9}
      levelTitle={{ ru: 'QR-сундук', kk: 'QR-сандық' }}
      createScene={(canvas) => new Level9Scene(canvas)}
      rewardStars={30}
      rewardFriendId="yagodka_rare"
      rewardFriendName={{ ru: 'Ягодка', kk: 'Жидек' }}
    />
  );
}

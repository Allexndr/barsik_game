import { MissionScreen } from './MissionScreen';
import { Mission1Scene } from '@/three/scenes/Mission1Scene';

export function Mission1Screen() {
  return (
    <MissionScreen
      levelId={1}
      levelTitle={{ ru: 'Первый друг', kk: 'Алғашқы дос' }}
      createScene={(canvas) => new Mission1Scene(canvas)}
      rewardStars={15}
      rewardFriendId="aya"
      rewardFriendName={{ ru: 'Айя', kk: 'Айя' }}
    />
  );
}

import { MissionScreen } from './MissionScreen';
import { Level3Scene } from '@/three/scenes/Level3Scene';

export function Mission3Screen() {
  return (
    <MissionScreen
      levelId={3}
      levelTitle={{ ru: 'Потерявшийся ёжик', kk: 'Жоғалған кірпі' }}
      createScene={(canvas) => new Level3Scene(canvas)}
      rewardStars={20}
      rewardFriendId="hedgehog"
      rewardFriendName={{ ru: 'Ёжик', kk: 'Кірпі' }}
    />
  );
}

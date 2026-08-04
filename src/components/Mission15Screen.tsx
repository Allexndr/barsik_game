import { MissionScreen } from './MissionScreen';
import { Level15Scene } from '@/three/scenes/Level15Scene';

export function Mission15Screen() {
  return (
    <MissionScreen
      levelId={15}
      levelTitle={{ ru: 'Спасти снеговика', kk: 'Аққаланы құтқару' }}
      createScene={(canvas) => new Level15Scene(canvas)}
      rewardStars={20}
      rewardFriendId="snowman"
      rewardFriendName={{ ru: 'Снеговик', kk: 'Аққала' }}
    />
  );
}

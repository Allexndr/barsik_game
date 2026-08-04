import { MissionScreen } from './MissionScreen';
import { Level7Scene } from '@/three/scenes/Level7Scene';

export function Mission7Screen() {
  return (
    <MissionScreen
      levelId={7}
      levelTitle={{ ru: 'Встреча с Путало', kk: 'Путаломен кездесу' }}
      createScene={(canvas) => new Level7Scene(canvas)}
      rewardStars={25}
      rewardFriendId="putalo"
      rewardFriendName={{ ru: 'Путало', kk: 'Путало' }}
    />
  );
}

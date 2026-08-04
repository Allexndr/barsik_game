import { MissionScreen } from './MissionScreen';
import { Level5Scene } from '@/three/scenes/Level5Scene';

export function Mission5Screen() {
  return (
    <MissionScreen
      levelId={5}
      levelTitle={{ ru: 'Корзина для белочки', kk: 'Тиінге арналған себет' }}
      createScene={(canvas) => new Level5Scene(canvas)}
      rewardStars={18}
      rewardFriendId="squirrel"
      rewardFriendName={{ ru: 'Белочка', kk: 'Тиін' }}
    />
  );
}

import { MissionScreen } from './MissionScreen';
import { Level13Scene } from '@/three/scenes/Level13Scene';

export function Mission13Screen() {
  return (
    <MissionScreen
      levelId={13}
      levelTitle={{ ru: 'Ледяные скульптуры', kk: 'Мұз мүсіндері' }}
      createScene={(canvas) => new Level13Scene(canvas)}
      rewardStars={16}
      rewardFriendId="ice_master"
      rewardFriendName={{ ru: 'Мастер льда', kk: 'Мұз шебері' }}
    />
  );
}

import { MissionScreen } from './MissionScreen';
import { Level16Scene } from '@/three/scenes/Level16Scene';

export function Mission16Screen() {
  return (
    <MissionScreen
      levelId={16}
      levelTitle={{ ru: 'Зимний QR-сундук', kk: 'Қысқы QR-сандық' }}
      createScene={(canvas) => new Level16Scene(canvas)}
      rewardStars={30}
      rewardFriendId="ice_friend_rare"
      rewardFriendName={{ ru: 'Ледяной друг', kk: 'Мұз досы' }}
    />
  );
}

import { MissionScreen } from './MissionScreen';
import { Level12Scene } from '@/three/scenes/Level12Scene';

export function Mission12Screen() {
  return (
    <MissionScreen
      levelId={12}
      levelTitle={{ ru: 'Ледяная тропа', kk: 'Мұзды жол' }}
      createScene={(canvas) => new Level12Scene(canvas)}
      rewardStars={20}
    />
  );
}

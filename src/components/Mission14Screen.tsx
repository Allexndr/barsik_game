import { MissionScreen } from './MissionScreen';
import { Level14Scene } from '@/three/scenes/Level14Scene';

export function Mission14Screen() {
  return (
    <MissionScreen
      levelId={14}
      levelTitle={{ ru: 'Поделись теплом', kk: 'Жылылықты бөліс' }}
      createScene={(canvas) => new Level14Scene(canvas)}
      rewardStars={22}
    />
  );
}

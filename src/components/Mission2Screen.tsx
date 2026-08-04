import { MissionScreen } from './MissionScreen';
import { Level2Scene } from '@/three/scenes/Level2Scene';

export function Mission2Screen() {
  return (
    <MissionScreen
      levelId={2}
      levelTitle={{ ru: 'Яблоневый сад', kk: 'Алма бағы' }}
      createScene={(canvas) => new Level2Scene(canvas)}
      rewardStars={12}
    />
  );
}

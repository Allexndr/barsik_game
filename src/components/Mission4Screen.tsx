import { MissionScreen } from './MissionScreen';
import { Level4Scene } from '@/three/scenes/Level4Scene';

export function Mission4Screen() {
  return (
    <MissionScreen
      levelId={4}
      levelTitle={{ ru: 'Качающийся мостик', kk: 'Тербелмелі көпір' }}
      createScene={(canvas) => new Level4Scene(canvas)}
      rewardStars={15}
    />
  );
}

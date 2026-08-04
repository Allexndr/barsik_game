import { MissionScreen } from './MissionScreen';
import { Level6Scene } from '@/three/scenes/Level6Scene';

export function Mission6Screen() {
  return (
    <MissionScreen
      levelId={6}
      levelTitle={{ ru: 'Лесная загадка', kk: 'Орман жұмбағы' }}
      createScene={(canvas) => new Level6Scene(canvas)}
      rewardStars={16}
    />
  );
}

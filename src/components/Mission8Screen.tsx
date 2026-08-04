import { MissionScreen } from './MissionScreen';
import { Level8Scene } from '@/three/scenes/Level8Scene';

export function Mission8Screen() {
  return (
    <MissionScreen
      levelId={8}
      levelTitle={{ ru: 'Лесной праздник', kk: 'Орман мерекесі' }}
      createScene={(canvas) => new Level8Scene(canvas)}
      rewardStars={20}
    />
  );
}

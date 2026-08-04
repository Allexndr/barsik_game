import { MissionScreen } from './MissionScreen';
import { Level11Scene } from '@/three/scenes/Level11Scene';

export function Mission11Screen() {
  return (
    <MissionScreen
      levelId={11}
      levelTitle={{ ru: 'Первые снежинки', kk: 'Алғашқы қар ұлпалары' }}
      createScene={(canvas) => new Level11Scene(canvas)}
      rewardStars={18}
    />
  );
}

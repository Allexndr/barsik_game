import { MissionScreen } from './MissionScreen';
import { Level10Scene } from '@/three/scenes/Level10Scene';

export function Mission10Screen() {
  return (
    <MissionScreen
      levelId={10}
      levelTitle={{ ru: 'Прощание с лесом', kk: 'Орманмен қоштасу' }}
      createScene={(canvas) => new Level10Scene(canvas)}
      rewardStars={15}
    />
  );
}

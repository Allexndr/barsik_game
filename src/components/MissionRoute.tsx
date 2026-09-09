import { lazy, type ComponentType } from 'react';
import { MISSIONS, type MissionDef } from './missions';

/**
 * Экраны уровней 1–16, по одному на номер.
 *
 * До этого на каждый уровень существовал свой файл `MissionNScreen.tsx`, а в
 * `App.tsx` — своя `lazy`-константа и своя ветка в разметке: шестнадцать копий
 * одного и того же, различавшихся только номером. Теперь различия лежат
 * данными в `missions.ts`.
 *
 * Компоненты собираются один раз при загрузке модуля, а не в рендере: иначе
 * React считал бы их новыми на каждой отрисовке и перемонтировал уровень.
 * Внутри `lazy` стоят динамические импорты, поэтому и `MissionScreen`, и сама
 * сцена по-прежнему уезжают в отдельный чанк и не попадают в стартовый бандл.
 */
function screenFor(levelId: number, def: MissionDef): ComponentType {
  return lazy(async () => {
    const [{ MissionScreen }, Scene] = await Promise.all([
      import('./MissionScreen'),
      def.loadScene(),
    ]);
    return {
      default: () => (
        <MissionScreen
          levelId={levelId}
          levelTitle={def.title}
          createScene={(canvas) => new Scene(canvas)}
          rewardStars={def.rewardStars}
          rewardFriendId={def.friendId}
          rewardFriendName={def.friendName}
        />
      ),
    };
  });
}

const ROUTES: Record<number, ComponentType> = Object.fromEntries(
  Object.entries(MISSIONS).map(([id, def]) => [Number(id), screenFor(Number(id), def)]),
);

/** Экран уровня по номеру. Сам компонент берётся из готовой таблицы. */
export function MissionRoute({ levelId }: { levelId: number }) {
  const Screen = ROUTES[levelId];
  return Screen ? <Screen /> : null;
}

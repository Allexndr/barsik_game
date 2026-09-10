import * as THREE from 'three';
import type { AvatarLook, BarsikAvatar } from './BarsikAvatar';
import { WARDROBE_BY_ID, PAIRED_FEET, PAIRED_HANDS } from './wardrobe';

const SOCKETS = [
  'head', 'face', 'neck', 'back', 'handL', 'handR', 'tail', 'footL', 'footR',
] as const;

/**
 * Надевает на аватар набор вещей из гардероба.
 *
 * Вынесено из примерочной, потому что наряд обязан выглядеть одинаково везде, где
 * появляется Барсик. Раньше это жило только в превью магазина, и одежда, за
 * которую ребёнок платил звёздами, существовала ровно на одном экране: купил
 * корону, вышел из магазина — и её нет. Теперь это зовёт всё, что рисует Барсика.
 *
 * Возвращает построенные меши, чтобы вызывающий мог освободить их перед следующим
 * переодеванием: сам аватар ими не владеет.
 */
export function dressAvatar(
  avatar: BarsikAvatar,
  itemIds: string[],
  baseLook: AvatarLook,
): THREE.Object3D[] {
  // Сначала сбрасываются цвета, иначе снятие перекраски оставляет предыдущую:
  // палитра — это состояние, а не меш.
  avatar.setLook(baseLook);
  avatar.setBodyWear({ hoodie: false, jeans: false });
  for (const socket of SOCKETS) avatar.equip(socket, null);

  const worn: THREE.Object3D[] = [];
  for (const id of itemIds) {
    const item = WARDROBE_BY_ID.get(id);
    if (!item) continue;
    if (item.bodyWear) {
      avatar.setBodyWear(item.bodyWear);
    }
    if (item.look) {
      avatar.setLook(item.look);
      continue;
    }
    if (!item.build || !item.socket) continue;

    const mesh = item.build();
    avatar.equip(item.socket, mesh);
    worn.push(mesh);

    // Обувь и варежки идут парами; каталог называет одно гнездо, а вторая сторона
    // отзеркаливается здесь, чтобы не дублировать каждую запись.
    if (PAIRED_FEET.has(id)) {
      const other = item.build();
      avatar.equip('footR', other);
      worn.push(other);
    } else if (PAIRED_HANDS.has(id)) {
      const other = item.build();
      avatar.equip('handR', other);
      worn.push(other);
    }
  }
  return worn;
}

/** Отсоединяет и освобождает меши, возвращённые {@link dressAvatar}. */
export function undressAvatar(worn: THREE.Object3D[]) {
  for (const o of worn) {
    o.parent?.remove(o);
    o.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) m?.dispose();
    });
  }
}

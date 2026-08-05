import * as THREE from 'three';
import type { AvatarLook, BarsikAvatar } from './BarsikAvatar';
import { WARDROBE_BY_ID, PAIRED_FEET, PAIRED_HANDS } from './wardrobe';

const SOCKETS = [
  'head', 'face', 'neck', 'back', 'handL', 'handR', 'tail', 'footL', 'footR',
] as const;

/**
 * Put a set of wardrobe items on an avatar.
 *
 * Lifted out of the dressing room because the outfit has to look the same
 * wherever Barsik appears. It lived only in the shop preview, which meant the
 * clothes a child paid stars for existed on exactly one screen — buy a crown,
 * leave the shop, and it is gone. Anything that renders Barsik calls this.
 *
 * Returns the meshes it built so the caller can dispose them before dressing
 * again; the avatar itself does not own them.
 */
export function dressAvatar(
  avatar: BarsikAvatar,
  itemIds: string[],
  baseLook: AvatarLook,
): THREE.Object3D[] {
  // Colours reset first, or removing a recolour leaves the previous one on:
  // the palette is state, not a mesh.
  avatar.setLook(baseLook);
  for (const socket of SOCKETS) avatar.equip(socket, null);

  const worn: THREE.Object3D[] = [];
  for (const id of itemIds) {
    const item = WARDROBE_BY_ID.get(id);
    if (!item) continue;
    if (item.look) {
      avatar.setLook(item.look);
      continue;
    }
    if (!item.build || !item.socket) continue;

    const mesh = item.build();
    avatar.equip(item.socket, mesh);
    worn.push(mesh);

    // Footwear and mittens come in pairs; the catalogue names one socket and
    // the other side is mirrored here rather than duplicating every entry.
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

/** Detach and free meshes returned by {@link dressAvatar}. */
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

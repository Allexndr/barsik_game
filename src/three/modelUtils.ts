import * as THREE from 'three';

/** Масштабирует загруженную модель так, чтобы высота её габаритов совпала с `h`, и ставит на y = 0. */
export function fitHeight(root: THREE.Object3D, h: number) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  root.scale.multiplyScalar(h / Math.max(size.y, 0.001));
  const b2 = new THREE.Box3().setFromObject(root);
  root.position.y -= b2.min.y;
}

/**
 * Масштабирует так, чтобы наибольший габарит объекта совпал с `s`.
 * Использовать для широких плоских моделей — камней, брёвен: подгонка по одной
 * высоте раздувает их до размеров утёса.
 */
export function fitMaxSize(root: THREE.Object3D, s: number) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const largest = Math.max(size.x, size.y, size.z, 0.001);
  root.scale.multiplyScalar(s / largest);
  const b2 = new THREE.Box3().setFromObject(root);
  root.position.y -= b2.min.y;
}

/**
 * Height of the display plinth a generated character is standing on, as a
 * fraction of the model's total height. 0 when there is no plinth.
 *
 * Returned as a fraction on purpose: the mesh's world scale is not settled at
 * the point a loader wants this answer (the model is not in the scene graph
 * yet, so matrixWorld is stale), and reading it there silently mixes local and
 * world units. A fraction is the same number in both.
 *
 * Meshy hands back figures posed on a little presentation slab. It is welded
 * into the same mesh as the character, with the same material, so it cannot be
 * removed by deleting a child — and in game it reads as every friend standing
 * on a gold trophy base.
 *
 * Found by the *step* in vertex density, not by its level. A plinth is a few
 * quads spanning the full footprint, and it ends in a flat top, so the slab
 * above it jumps by an order of magnitude — Aya goes 154 → 1243 across that
 * line, Путало 82 → 1049. A real body has no such edge: the hedgehog's
 * densest bottom transition is 3× and the squirrel's is 1.5×.
 *
 * Absolute density alone does not separate them. The hedgehog's bottom slab is
 * as sparse as Aya's, so any threshold low enough to catch Путало's base also
 * buries the hedgehog to the knees. The width guard is kept as well: a plinth
 * spans the model's whole footprint, so a bird on thin legs cannot qualify.
 */
export function measurePlinthFraction(root: THREE.Object3D): number {
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry?.attributes?.position) meshes.push(m);
  });
  if (meshes.length !== 1) return 0; // отделяемая подставка — это уже другая задача

  const mesh = meshes[0];
  const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
  mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox!;
  const h = bb.max.y - bb.min.y;
  if (h <= 0) return 0;

  const SLABS = 20;
  const counts = new Array(SLABS).fill(0);
  const widths = new Array(SLABS).fill(0);
  const cx = (bb.max.x + bb.min.x) / 2;
  const cz = (bb.max.z + bb.min.z) / 2;
  for (let i = 0; i < pos.count; i++) {
    const slab = Math.min(SLABS - 1, Math.floor(((pos.getY(i) - bb.min.y) / h) * SLABS));
    counts[slab]++;
    widths[slab] = Math.max(widths[slab], Math.hypot(pos.getX(i) - cx, pos.getZ(i) - cz));
  }

  const widest = Math.max(...widths);
  const maxSlab = Math.floor(SLABS * 0.3); // постамент никогда не занимает трети персонажа

  // Накопительно, а не послойно. Коробка постамента оставляет между нижней и
  // верхней гранью целые пустые слои, и послойные отношения принимают эти пропуски
  // за ступеньку: слой Айи из двух вершин дал 77× против её настоящей границы в 8×.
  let top = 0;
  let below = 0;
  for (let i = 1; i <= maxSlab; i++) {
    const next = below + counts[i - 1];
    if (next > pos.count * 0.04) break;
    // У пустых слоёв нет ширины, по которой можно судить, поэтому они пропускаются,
    // а не проваливают проверку.
    if (counts[i - 1] > 0 && widths[i - 1] < widest * 0.6) break;
    below = next;
    top = i;
  }
  if (top === 0) return 0;

  // Слой выше обязан быть заметно плотнее среднего по подставке: такая граница и
  // есть плоский верх постамента, и её никогда не бывает у тела.
  if (counts[top] < 5 * (below / top)) return 0;

  const fraction = top / SLABS;
  return fraction < 0.05 ? 0 : fraction;
}

/** Ставит нижнюю точку объекта на `base` — высоту рельефа или 0 для плоскости. */
export function groundY(o: THREE.Object3D, base = 0) {
  const b = new THREE.Box3().setFromObject(o);
  o.position.y += base - b.min.y;
}

export function disposeObject3DResources(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    const renderable = object as THREE.Mesh | THREE.Points;
    if (renderable.geometry) geometries.add(renderable.geometry);
    if (!renderable.material) return;
    const objectMaterials = Array.isArray(renderable.material)
      ? renderable.material
      : [renderable.material];
    for (const material of objectMaterials) {
      if (!material) continue;
      materials.add(material);
      for (const key of Object.keys(material) as (keyof THREE.Material)[]) {
        const value = (material as unknown as Record<string, unknown>)[key as string] as
          | THREE.Texture
          | undefined;
        if (value?.isTexture) textures.add(value);
      }
    }
  });
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}

/**
 * Спасает меш, приехавший вообще без материала.
 *
 * Примитив glTF может не указывать `material`, и тогда GLTFLoader выдаёт ему
 * значение по умолчанию из three.js: `MeshStandardMaterial` с **`metalness: 1`**
 * и без карты окружения. Полностью металлическая поверхность показывает только то,
 * что отражает, а отражать нечего — и она рисуется чисто чёрной. Двое персонажей
 * сезона приходят именно такими: у `s1_owl.glb` и `s1_rabbit.glb` значится
 * `materials: 0, textures: 0`, — и вместо совы уровень показывал чёрный силуэт,
 * стоящий в траве, что в игре для пятилетних выглядит ровно так тревожно, как
 * звучит.
 *
 * Проверка намеренно узкая: металличность ровно 1, шероховатость ровно 1, белый
 * базовый цвет и полное отсутствие карт — это значение по умолчанию у загрузчика,
 * а не то, что задаёт художник. Металлы, собранные кодом в этом проекте — золотые
 * печати, отделка сундука, — сюда не попадают.
 */
export function repairDefaultMaterial(mesh: THREE.Mesh) {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const mat of mats) {
    const std = mat as THREE.MeshStandardMaterial;
    if (!std?.isMeshStandardMaterial) continue;

    // Решение принимается до любых изменений. Ограничение ниже обнуляет
    // металличность, а эта проверка спрашивает, *была* ли она равна 1: прочитанная
    // после, она не сработала бы больше никогда.
    const bare =
      std.metalness === 1 &&
      std.roughness === 1 &&
      !std.map && !std.metalnessMap && !std.roughnessMap && !std.normalMap &&
      std.color.getHex() === 0xffffff;

    // ── Металл, которому нечего отражать ─────────────────────────
    // Карты окружения в этой игре нет нигде, поэтому металлическая поверхность
    // ничего не отражает и рисуется чёрной или почти чёрной. Все модели CC0 и
    // Kenney в проекте приходят с `metallicFactor: 1` — проверено чтением блоков
    // материалов glTF, — и именно поэтому в траве раз за разом появлялся чёрный
    // силуэт.
    //
    // AssetKit и нулевая миссия давно ограничивают это через
    // `normalizeKitMaterial`. А `loadGlb`, который грузит весь реквизит и всех
    // персонажей на уровнях 1–16, — нет. Цвет и все текстуры остаются ровно такими,
    // как их сделали; меняется только отражательность.
    // Карта металличности не спасает: она лишь модулирует коэффициент, и без
    // окружения, которое можно отразить, освещённый результат всё равно тёмный, —
    // так говорящий пенёк на L6 и оказался чёрной щепкой при четырёх текстурах. В
    // этой игре ничто не должно выглядеть металлом.
    if (std.metalness > 0 && !std.envMap) {
      std.metalness = 0;
      if (std.roughness > 0.95) std.roughness = 0.85;
      std.needsUpdate = true;
    }

    if (!bare) continue;
    // Матовый и не совсем белый: читается нетекстурированной игрушкой, а не дырой в
    // мире, и при этом остаётся очевидной заглушкой для того, кто её ищет.
    std.metalness = 0;
    std.roughness = 0.85;
    std.color.setHex(0xd8cfc2);
    std.needsUpdate = true;
  }
}

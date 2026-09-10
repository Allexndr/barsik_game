import * as THREE from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { disposeObject3DResources, fitHeight, fitMaxSize, groundY, repairDefaultMaterial } from './modelUtils';
import { normalizeKitMaterial } from './kitPalette';

/**
 * Наборы моделей CC0 (Kenney), из которых собран мир Барсика.
 * У всех наборов один стилизованный низкополигональный язык, поэтому их смешение
 * в одной сцене всё равно читается единым художественным решением.
 */
export type KitPack =
  | 'nature'
  | 'miniforest'
  | 'food'
  | 'holiday'
  | 'survival'
  | 'platformer'
  | 'city'
  | 'town'
  | 'pets';

const KIT_BASE = '/assets/models/kits/';

export interface SpawnOptions {
  /** Масштабировать модель так, чтобы высота её габаритов совпала с этим значением. */
  height?: number;
  /** Масштабировать так, чтобы наибольший габарит совпал с этим значением. Предпочтительно для камней и брёвен. */
  maxSize?: number;
  /** Равномерный масштаб, применяемый, если не заданы ни `height`, ни `maxSize`. */
  scale?: number;
  position?: [number, number, number];
  rotationY?: number;
  /** После масштабирования поставить модель на y = 0. По умолчанию включено. */
  ground?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

function prepareKitModel(root: THREE.Object3D) {
  const seen = new Set<THREE.Material>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // Загрузчик наборов не проходит через `loadGlb`, поэтому примитив без материала
    // сохранил бы металличность 1 по умолчанию и рисовался бы здесь чёрным, хотя
    // везде остальное это уже чинится.
    repairDefaultMaterial(mesh);
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!material || seen.has(material)) continue;
      seen.add(material);
      normalizeKitMaterial(material);
    }
  });
}

/**
 * Кеш моделей на сцену. Каждый файл загружается и нормализуется один раз, а потом
 * выдаётся клонами, которые делят геометрию, материалы и текстуры. Принадлежит
 * сцене: `dispose()` освобождает все загруженные шаблоны.
 */
export class AssetKit {
  private templates = new Map<string, Promise<THREE.Object3D | null>>();
  private loaded: THREE.Object3D[] = [];

  constructor(private readonly loader: GLTFLoader) {}

  private url(pack: KitPack, name: string) {
    return `${KIT_BASE}${pack}/${name}.glb`;
  }

  private template(pack: KitPack, name: string): Promise<THREE.Object3D | null> {
    const url = this.url(pack, name);
    const cached = this.templates.get(url);
    if (cached) return cached;

    const pending = (async () => {
      try {
        const gltf = await Promise.race([
          this.loader.loadAsync(url),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`timeout ${url}`)), 12000),
          ),
        ]);
        prepareKitModel(gltf.scene);
        this.loaded.push(gltf.scene);
        return gltf.scene;
      } catch {
        return null;
      }
    })();

    this.templates.set(url, pending);
    return pending;
  }

  /** Прогреть кеш до старта уровня, чтобы первая расстановка не дала рывка. */
  async preload(models: Array<[KitPack, string]>) {
    await Promise.all(models.map(([pack, name]) => this.template(pack, name)));
  }

  /** Поставленный клон модели из набора или null, если файла нет. */
  async spawn(pack: KitPack, name: string, opts: SpawnOptions = {}): Promise<THREE.Object3D | null> {
    const template = await this.template(pack, name);
    if (!template) return null;

    const instance = template.clone(true);
    if (opts.height !== undefined) fitHeight(instance, opts.height);
    else if (opts.maxSize !== undefined) fitMaxSize(instance, opts.maxSize);
    else if (opts.scale !== undefined) instance.scale.setScalar(opts.scale);

    if (opts.position) instance.position.set(...opts.position);
    if (opts.rotationY !== undefined) instance.rotation.y = opts.rotationY;
    if (opts.ground !== false) groundY(instance);

    if (opts.castShadow === false || opts.receiveShadow === false) {
      instance.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (opts.castShadow === false) mesh.castShadow = false;
        if (opts.receiveShadow === false) mesh.receiveShadow = false;
      });
    }
    return instance;
  }

  /**
   * Массовый разброс — деревья, камни, трава — с одним шаблоном на имя.
   * Возвращает поставленные клоны, чтобы вызывающий мог навесить коллайдеры.
   */
  async scatter(
    pack: KitPack,
    names: readonly string[],
    placements: Array<{ x: number; z: number; height?: number; maxSize?: number; rotationY?: number }>,
  ): Promise<THREE.Object3D[]> {
    const templates = await Promise.all(names.map((name) => this.template(pack, name)));
    const usable = templates.filter((t): t is THREE.Object3D => Boolean(t));
    if (!usable.length) return [];

    const placed: THREE.Object3D[] = [];
    placements.forEach((p, index) => {
      const instance = usable[index % usable.length].clone(true);
      if (p.height !== undefined) fitHeight(instance, p.height);
      else if (p.maxSize !== undefined) fitMaxSize(instance, p.maxSize);
      instance.position.set(p.x, 0, p.z);
      instance.rotation.y = p.rotationY ?? Math.random() * Math.PI * 2;
      groundY(instance);
      placed.push(instance);
    });
    return placed;
  }

  dispose() {
    for (const template of this.loaded) disposeObject3DResources(template);
    this.loaded.length = 0;
    this.templates.clear();
  }
}

import * as THREE from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { disposeObject3DResources, fitHeight, fitMaxSize, groundY, repairDefaultMaterial } from './modelUtils';
import { normalizeKitMaterial } from './kitPalette';

/**
 * CC0 model kits (Kenney) that make up the Barsik world.
 * Every pack shares one stylized low-poly language, so mixing packs
 * within a scene still reads as a single art direction.
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
  /** Scale the model so its bounding box height matches this value. */
  height?: number;
  /** Scale so the largest dimension matches this value. Prefer for rocks and logs. */
  maxSize?: number;
  /** Uniform scale applied when neither `height` nor `maxSize` is given. */
  scale?: number;
  position?: [number, number, number];
  rotationY?: number;
  /** Rest the model on y=0 after scaling. Defaults to true. */
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
    // The kit loader does not go through `loadGlb`, so a primitive with no
    // material would keep the loader's metalness-1 default and render black
    // here even though it is repaired everywhere else.
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
 * Per-scene model cache. Each model file is fetched and normalised once,
 * then handed out as clones that share geometry, materials and textures.
 * Owned by the scene: `dispose()` releases every template it loaded.
 */
export class AssetKit {
  private templates = new Map<string, Promise<THREE.Object3D | null>>();
  private loaded: THREE.Object3D[] = [];
  private disposed = false;

  constructor(private readonly loader: GLTFLoader) {}

  private url(pack: KitPack, name: string) {
    return `${KIT_BASE}${pack}/${name}.glb`;
  }

  private template(pack: KitPack, name: string): Promise<THREE.Object3D | null> {
    if (this.disposed) return Promise.resolve(null);
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
        // A scene can leave while GLTFLoader is still fetching. It is not
        // enough to clear `loaded` in dispose(): without this guard a late
        // template would push itself into an unreachable cache and retain its
        // textures forever. Release the source scene before returning null;
        // callers consequently never create a late clone.
        if (this.disposed) {
          disposeObject3DResources(gltf.scene);
          return null;
        }
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

  /** Warm the cache before a level starts so first placement does not stutter. */
  async preload(models: Array<[KitPack, string]>) {
    if (this.disposed) return;
    await Promise.all(models.map(([pack, name]) => this.template(pack, name)));
  }

  /** A placed clone of a kit model, or null when the file is unavailable. */
  async spawn(pack: KitPack, name: string, opts: SpawnOptions = {}): Promise<THREE.Object3D | null> {
    if (this.disposed) return null;
    const template = await this.template(pack, name);
    if (!template || this.disposed) return null;

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
   * Repeated scatter (trees, rocks, grass) sharing one template per name.
   * Returns the placed clones so callers can register colliders.
   */
  async scatter(
    pack: KitPack,
    names: readonly string[],
    placements: Array<{ x: number; z: number; height?: number; maxSize?: number; rotationY?: number }>,
  ): Promise<THREE.Object3D[]> {
    if (this.disposed) return [];
    const templates = await Promise.all(names.map((name) => this.template(pack, name)));
    if (this.disposed) return [];
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
    if (this.disposed) return;
    this.disposed = true;
    for (const template of this.loaded) disposeObject3DResources(template);
    this.loaded.length = 0;
    this.templates.clear();
  }
}

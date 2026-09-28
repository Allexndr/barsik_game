import * as THREE from 'three';
import { createBarsikAvatar, type AvatarLook, type AvatarPose, type BarsikAvatar } from './BarsikAvatar';
import { dressAvatar, undressAvatar } from './dressAvatar';
import { getRenderQualityProfile, resolveRenderQualityTier } from '../renderQuality';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { CHARS, loadCharModel } from '../scenes/BaseLevelScene';

/**
 * Отрисовщик примерочной.
 *
 * Магазин, где нельзя увидеть вещь на своём персонаже, — это список названий, а
 * весь смысл процедурного аватара в том, что примерка не должна стоить ничего:
 * ни загрузки, ни крутилки, ни ожидания. Надевание здесь — синхронная сборка
 * меша, измеряемая долями миллисекунды, и ребёнок пролистывает сорок вещей так
 * быстро, как двигает пальцем.
 *
 * Намеренно собственный крошечный отрисовщик, а не сцена уровня: нужны один
 * персонаж, три источника света и поворотный круг, а гонять полный конвейер
 * качества за списком магазина значит впустую тратить батарею телефона.
 *
 * Для отчётов и проверки: `?shopHero=meshy` ставит на круг GLB из Meshy вместо
 * процедурного аватара.
 */
export interface AvatarPreview {
  avatar: BarsikAvatar;
  /** Применяет набор идентификаторов купленных и выбранных вещей. Порядок не важен. */
  setOutfit(itemIds: string[]): void;
  setPose(pose: AvatarPose): void;
  /** Поддержка перетаскивания: круг можно крутить рукой. */
  spinBy(delta: number): void;
  resize(width: number, height: number): void;
  start(): void;
  dispose(): void;
}

const SHOP_HERO_CANDIDATES = [
  'barsik_cool_rigged.glb',
  'barsik_rigged.glb',
  'barsik.glb',
  'barsik_quality.glb',
  'barsik_meshy_static.glb',
];

function wantsMeshyShopHero(): boolean {
  if (typeof location === 'undefined') return true;
  const v = new URLSearchParams(location.search).get('shopHero');
  if (v === 'avatar' || v === 'capsule' || v === 'procedural') return false;
  return true;
}

export function createAvatarPreview(canvas: HTMLCanvasElement): AvatarPreview {
  const isMobile =
    typeof window !== 'undefined'
    && (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 760);
  const profile = getRenderQualityProfile(resolveRenderQualityTier(isMobile), isMobile);
  const useMeshyGlb = wantsMeshyShopHero();

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: profile.antialias,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, profile.maxPixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = profile.shadowSoft
    ? THREE.PCFSoftShadowMap
    : THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  // Камера для примерочной
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
  camera.position.set(0, 0.95, 3.15);
  camera.lookAt(0, 0.8, 0);

  // Трёхточечная схема с тем же соотношением ключевого, заполняющего и контрового
  // света, что на уровнях: надетая вещь не должна выглядеть как из другой игры,
  // стоит выйти из магазина.
  const key = new THREE.DirectionalLight(0xfff6e8, 2.1);
  key.position.set(2.4, 4, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 12;
  const fill = new THREE.DirectionalLight(0xdcecff, 0.55);
  fill.position.set(-3, 2, 1.5);
  const rim = new THREE.DirectionalLight(0xffffff, 0.9);
  rim.position.set(-1.2, 2.6, -3.4);
  scene.add(key, fill, rim, new THREE.AmbientLight(0xffffff, 0.35));

  // Мягкий диск, принимающий тень, чтобы персонаж стоял на чём-то, а не парил в
  // пустоте.
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(1.5, 40),
    new THREE.ShadowMaterial({ opacity: 0.18 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const turntable = new THREE.Group();
  scene.add(turntable);

  const avatar = createBarsikAvatar({ height: 1.1 });
  if (!useMeshyGlb) {
    turntable.add(avatar.root);
  }

  const baseLook: AvatarLook = avatar.getLook();
  let raf = 0;
  let disposed = false;
  const spin = 0.35;
  let manualSpin = 0;
  let lastSpinAt = 0;
  const clock = new THREE.Clock();
  /** Меши текущего наряда; удаляются при его смене. */
  let worn: THREE.Object3D[] = [];
  let meshyRoot: THREE.Object3D | null = null;
  const mixers: THREE.AnimationMixer[] = [];

  function clearWorn() {
    undressAvatar(worn);
    worn = [];
  }

  function updateCameraFraming() {
    const targetObj = meshyRoot ?? (turntable.children.length > 0 ? turntable : null);
    if (!targetObj) return;
    const box = new THREE.Box3().setFromObject(targetObj);
    const size = new THREE.Vector3();
    box.getSize(size);
    // Полная высота модели с ушами/головным убором около 1.15м
    const totalHeight = Math.max(size.y, 1.15);
    const totalWidth = Math.max(size.x, size.z, 0.65);

    const fovRad = (camera.fov * Math.PI) / 180;
    const halfTan = Math.tan(fovRad / 2);
    const aspect = camera.aspect > 0.1 ? camera.aspect : 1;

    // Комфортное заполнение кадра примерочной без обрезки ушей и шапки на любых экранах
    const distY = ((totalHeight / 2) / halfTan) * 2.5;
    const distX = ((totalWidth / 2) / (halfTan * aspect)) * 2.1;
    const dist = Math.max(5.0, distY, distX);

    // Геометрический центр персонажа (от подошвы до верхушки шапки)
    const centerY = totalHeight * 0.48;
    camera.position.set(0, centerY, dist);
    camera.lookAt(0, centerY, 0);
    camera.updateProjectionMatrix();
  }

  if (useMeshyGlb) {
    const loader = createGameGltfLoader();
    void (async () => {
      for (const file of SHOP_HERO_CANDIDATES) {
        if (disposed) return;
        const preferStatic = /meshy_static|quality/i.test(file);
        const model = await loadCharModel(loader, file, 1.05, { preferStatic });
        if (!model) continue;
        if (disposed) return;
        turntable.add(model);
        meshyRoot = model;
        avatar.root.visible = false;
        const hostMixer = model.userData.animMixer as THREE.AnimationMixer | undefined;
        if (hostMixer) mixers.push(hostMixer);
        updateCameraFraming();
        console.info(`[shop] Hero GLB mounted: ${CHARS}${file}`);
        return;
      }
      console.error('[shop] Canonical hero GLB could not be loaded');
    })();
  }

  const preview: AvatarPreview = {
    avatar,

    setOutfit(itemIds) {
      if (useMeshyGlb && meshyRoot) return;
      clearWorn();
      worn = dressAvatar(avatar, itemIds, baseLook);
    },

    setPose(pose) {
      if (useMeshyGlb && meshyRoot) return;
      avatar.setPose(pose);
    },

    spinBy(delta) {
      manualSpin += delta;
      lastSpinAt = performance.now();
    },

    resize(width, height) {
      if (width < 2 || height < 2) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      updateCameraFraming();
    },

    start() {
      const loop = () => {
        if (disposed) return;
        raf = requestAnimationFrame(loop);
        const dt = Math.min(clock.getDelta(), 0.05);
        const t = clock.elapsedTime;
        // Круг вращается сам, но после перетаскивания замирает на мгновение, чтобы
        // ребёнок рассмотрел ту сторону, к которой повернул.
        const idleSpin = performance.now() - lastSpinAt > 1600 ? spin * dt : 0;
        turntable.rotation.y += idleSpin + manualSpin;
        manualSpin = 0;
        if (!(useMeshyGlb && meshyRoot)) {
          avatar.update(dt, t);
        }
        for (const m of mixers) m.update(dt);
        renderer.render(scene, camera);
      };
      clock.start();
      loop();
    },

    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      clearWorn();
      if (meshyRoot) {
        turntable.remove(meshyRoot);
        meshyRoot = null;
      }
      mixers.length = 0;
      avatar.dispose();
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      renderer.dispose();
    },
  };

  // Превращает касание или перетаскивание мышью по холсту во вращение.
  let dragging = false;
  let lastX = 0;
  const down = (e: PointerEvent) => {
    dragging = true;
    lastX = e.clientX;
    canvas.setPointerCapture?.(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (!dragging) return;
    preview.spinBy((e.clientX - lastX) * 0.01);
    lastX = e.clientX;
  };
  const up = (e: PointerEvent) => {
    dragging = false;
    canvas.releasePointerCapture?.(e.pointerId);
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  const baseDispose = preview.dispose;
  preview.dispose = () => {
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', up);
    baseDispose();
  };

  return preview;
}

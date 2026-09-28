import * as THREE from 'three';
import { loadCharModel, loadGlb } from '../scenes/BaseLevelScene';
import { fitHeight, groundY } from '../modelUtils';
import { CAST_CHAR_GLB, CAST_PROP_GLB } from '../castModels';
import { getRenderQualityProfile, resolveRenderQualityTier } from '../renderQuality';
import { createGameGltfLoader } from '../createGameGltfLoader';

/**
 * Просмотр собранного друга первого сезона на поворотном круге.
 *
 * Та же задача, что у AvatarPreview в магазине, но здесь состав — это GLB из Meshy
 * и Tripo (или мягкая капсула-заглушка), а не процедурный Барсик из гардероба.
 */

export interface FriendPreview {
  /** Меняет показываемого друга. Завершается, когда меш встал на круг. */
  setFriend(id: string): Promise<void>;
  spinBy(delta: number): void;
  resize(width: number, height: number): void;
  start(): void;
  dispose(): void;
}

/** Файл персонажа в /chars или абсолютный адрес предмета — например, для снеговика. */
function friendModelSpec(id: string): { kind: 'char'; file: string } | { kind: 'prop'; url: string } | null {
  const char = CAST_CHAR_GLB[id as keyof typeof CAST_CHAR_GLB];
  if (char) return { kind: 'char', file: char };
  const prop = CAST_PROP_GLB[id as keyof typeof CAST_PROP_GLB];
  if (prop) return { kind: 'prop', url: `/assets/models/props/${prop}` };
  return null;
}

function makeStandIn(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.32, 0.5, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0xfab1a0, roughness: 0.55 }),
  );
  body.position.y = 0.7;
  body.castShadow = true;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 14, 14),
    new THREE.MeshStandardMaterial({ color: 0xffeaa7, roughness: 0.55 }),
  );
  head.position.y = 1.4;
  head.castShadow = true;
  g.add(body, head);
  return g;
}

export function createFriendPreview(canvas: HTMLCanvasElement): FriendPreview {
  const isMobile =
    typeof window !== 'undefined'
    && (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 760);
  const profile = getRenderQualityProfile(resolveRenderQualityTier(isMobile), isMobile);

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
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
  camera.position.set(0, 1.05, 3.4);
  camera.lookAt(0, 0.85, 0);

  const key = new THREE.DirectionalLight(0xfff6e8, 2.1);
  key.position.set(2.4, 4, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
  const fill = new THREE.DirectionalLight(0xdcecff, 0.55);
  fill.position.set(-3, 2, 1.5);
  const rim = new THREE.DirectionalLight(0xffffff, 0.9);
  rim.position.set(-1.2, 2.6, -3.4);
  scene.add(key, fill, rim, new THREE.AmbientLight(0xffffff, 0.4));

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(1.6, 40),
    new THREE.ShadowMaterial({ opacity: 0.2 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const turntable = new THREE.Group();
  scene.add(turntable);

  const loader = createGameGltfLoader();
  let current: THREE.Object3D | null = null;
  let loadToken = 0;
  let raf = 0;
  let disposed = false;
  const spin = 0.4;
  let manualSpin = 0;
  let lastSpinAt = 0;
  const clock = new THREE.Clock();
  const mixers: THREE.AnimationMixer[] = [];

  function clearModel() {
    for (const m of mixers) m.stopAllAction();
    mixers.length = 0;
    if (current) {
      turntable.remove(current);
      current = null;
    }
  }

  function updateCameraFraming() {
    if (!current) return;
    const box = new THREE.Box3().setFromObject(current);
    const size = new THREE.Vector3();
    box.getSize(size);

    // Персонаж стоит на земле (y >= 0); если у меша был утопленный постамент,
    // не включаем подземную часть в расчёт центра взгляда.
    const minY = Math.max(box.min.y, 0);
    const maxY = Math.max(box.max.y, minY + 0.6);
    const targetY = (minY + maxY) / 2;
    const modelHeight = maxY - minY;
    const modelWidth = Math.max(size.x, size.z, 0.5);

    // Рассчитываем дистанцию камеры так, чтобы модель занимала комфортные ~45-50% высоты
    // кадра и полностью помещалась со всеми ушами, шляпами, реквизитом и анимацией.
    const fovRad = (camera.fov * Math.PI) / 180;
    const halfTan = Math.tan(fovRad / 2);
    const aspect = camera.aspect > 0.1 ? camera.aspect : 1;

    const distY = ((modelHeight / 2) / halfTan) * 2.0;
    const distX = ((modelWidth / 2) / (halfTan * aspect)) * 1.9;
    const dist = Math.max(3.3, distY, distX);

    // Камера центрирована по высоте персонажа со свободным пространством сверху и снизу
    camera.position.set(0, targetY + 0.1, dist);
    camera.lookAt(0, targetY, 0);
  }

  async function mount(id: string) {
    const token = ++loadToken;
    clearModel();
    const spec = friendModelSpec(id);
    let model: THREE.Object3D | null = null;
    if (spec?.kind === 'char') {
      model = await loadCharModel(loader, spec.file, 0.78);
    } else if (spec?.kind === 'prop') {
      const gltf = await loadGlb(loader, spec.url);
      if (gltf) {
        fitHeight(gltf.scene, 0.75);
        groundY(gltf.scene, 0);
        model = gltf.scene;
      }
    }
    if (disposed || token !== loadToken) return;
    if (!model) {
      model = makeStandIn();
      fitHeight(model, 0.78);
      groundY(model, 0);
    }

    // Предпочитаем Idle, если у обёртки уже есть микшер от loadCharModel.
    const hostMixer = model.userData.animMixer as THREE.AnimationMixer | undefined;
    if (hostMixer) mixers.push(hostMixer);

    if (spec?.kind !== 'char') {
      groundY(model, 0);
    }

    turntable.add(model);
    current = model;
    updateCameraFraming();
  }

  const preview: FriendPreview = {
    setFriend: mount,

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
        const idleSpin = performance.now() - lastSpinAt > 1400 ? spin * dt : 0;
        turntable.rotation.y += idleSpin + manualSpin;
        manualSpin = 0;
        for (const m of mixers) m.update(dt);
        renderer.render(scene, camera);
      };
      clock.start();
      loop();
    },

    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      clearModel();
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      renderer.dispose();
    },
  };

  let dragging = false;
  let lastX = 0;
  const down = (e: PointerEvent) => {
    dragging = true;
    lastX = e.clientX;
    canvas.setPointerCapture?.(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (!dragging) return;
    preview.spinBy((e.clientX - lastX) * 0.012);
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

import * as THREE from 'three';
import { createBarsikAvatar, type AvatarLook, type AvatarPose, type BarsikAvatar } from './BarsikAvatar';
import { WARDROBE_BY_ID, PAIRED_FEET, PAIRED_HANDS } from './wardrobe';

/**
 * The dressing-room renderer.
 *
 * A shop where you cannot see the thing on your character is a list of names,
 * and the whole reason the avatar is procedural is that trying something on
 * should cost nothing — no download, no loading spinner, no waiting. Equipping
 * here is a synchronous mesh build measured in fractions of a millisecond, so
 * the child can tap through forty items as fast as they can move their finger.
 *
 * Deliberately its own tiny renderer rather than a level scene: it needs one
 * character, three lights and a turntable, and running a full quality pipeline
 * behind a shop list would cost a phone real battery for nothing.
 */
export interface AvatarPreview {
  avatar: BarsikAvatar;
  /** Apply a set of owned/selected item ids. Order does not matter. */
  setOutfit(itemIds: string[]): void;
  setPose(pose: AvatarPose): void;
  /** Drag support: spin the turntable by hand. */
  spinBy(delta: number): void;
  resize(width: number, height: number): void;
  start(): void;
  dispose(): void;
}

export function createAvatarPreview(canvas: HTMLCanvasElement): AvatarPreview {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
  camera.position.set(0, 1.05, 4.1);
  camera.lookAt(0, 0.78, 0);

  // Three-point rig: the same key/fill/rim ratio the levels use, so an item
  // does not look like a different game once it is worn outside the shop.
  const key = new THREE.DirectionalLight(0xfff6e8, 2.1);
  key.position.set(2.4, 4, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 12;
  const fill = new THREE.DirectionalLight(0xdcecff, 0.55);
  fill.position.set(-3, 2, 1.5);
  const rim = new THREE.DirectionalLight(0xffffff, 0.9);
  rim.position.set(-1.2, 2.6, -3.4);
  scene.add(key, fill, rim, new THREE.AmbientLight(0xffffff, 0.35));

  // A soft disc to catch the shadow, so the character is standing on
  // something rather than floating in a void.
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(1.5, 40),
    new THREE.ShadowMaterial({ opacity: 0.18 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const turntable = new THREE.Group();
  scene.add(turntable);

  const avatar = createBarsikAvatar({ height: 1.45 });
  turntable.add(avatar.root);

  const baseLook: AvatarLook = avatar.getLook();
  let raf = 0;
  let disposed = false;
  const spin = 0.35;
  let manualSpin = 0;
  let lastSpinAt = 0;
  const clock = new THREE.Clock();
  /** Meshes built for the current outfit, disposed when it changes. */
  let worn: THREE.Object3D[] = [];

  function clearWorn() {
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
    worn = [];
  }

  const preview: AvatarPreview = {
    avatar,

    setOutfit(itemIds) {
      clearWorn();
      // Colours reset to the default first, or removing a recolour would
      // leave the previous one on: the palette is state, not a mesh.
      avatar.setLook(baseLook);
      for (const socket of ['head', 'face', 'neck', 'back', 'handL', 'handR', 'tail', 'footL', 'footR'] as const) {
        avatar.equip(socket, null);
      }

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

        // Footwear and mittens come in pairs; the catalogue names one socket
        // and the other foot is mirrored here rather than duplicating every
        // entry in the shop list.
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
    },

    setPose(pose) {
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
    },

    start() {
      const loop = () => {
        if (disposed) return;
        raf = requestAnimationFrame(loop);
        const dt = Math.min(clock.getDelta(), 0.05);
        const t = clock.elapsedTime;
        // Idle turntable, paused for a moment after a drag so the child can
        // look at the side they turned to.
        const idleSpin = performance.now() - lastSpinAt > 1600 ? spin * dt : 0;
        turntable.rotation.y += idleSpin + manualSpin;
        manualSpin = 0;
        avatar.update(dt, t);
        renderer.render(scene, camera);
      };
      clock.start();
      loop();
    },

    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      clearWorn();
      avatar.dispose();
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      renderer.dispose();
    },
  };

  // Turn a touch or mouse drag on the canvas into a spin.
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

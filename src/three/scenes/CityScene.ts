import * as THREE from 'three';
import { CAST_CHAR_GLB } from '../castModels';
import { fitHeight, groundY } from '../modelUtils';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { placeMany, placeAmbientCritters } from '../s1Place';

export type CityStage = 'early' | 'growing' | 'full';

export interface CityFriendMarker {
  id: string;
  name: string;
  x: number;
  z: number;
  color: number;
}

function stageFromFriends(count: number): CityStage {
  if (count >= 6) return 'full';
  if (count >= 2) return 'growing';
  return 'early';
}

function makeHouse(color: number, x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1, 1.2),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7 }),
  );
  body.position.y = 0.5;
  body.castShadow = true;
  g.add(body);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(1, 0.7, 4),
    new THREE.MeshStandardMaterial({ color: 0xe17055, roughness: 0.8 }),
  );
  roof.position.y = 1.35;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);

  g.position.set(x, 0, z);
  return g;
}

function makeTree(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.16, 0.8, 8),
    new THREE.MeshStandardMaterial({ color: 0x8b5a2b }),
  );
  trunk.position.y = 0.4;
  g.add(trunk);

  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x55a630, roughness: 0.85 }),
  );
  crown.position.y = 1.1;
  g.add(crown);

  g.position.set(x, 0, z);
  return g;
}

function makeFountain(): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.3, 0.35, 24),
    new THREE.MeshStandardMaterial({ color: 0x74b9ff }),
  );
  base.position.y = 0.18;
  g.add(base);

  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.25, 1.2, 12),
    new THREE.MeshStandardMaterial({ color: 0xdfe6e9 }),
  );
  column.position.y = 0.9;
  g.add(column);

  const water = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x81ecec, transparent: true, opacity: 0.8 }),
  );
  water.position.y = 1.6;
  g.add(water);
  g.position.set(0, 0, 0);
  return g;
}

function makeLamp(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 1.8, 8),
    new THREE.MeshStandardMaterial({ color: 0x4f5261, roughness: 0.75 }),
  );
  pole.position.y = 0.9;
  const light = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 12, 10),
    new THREE.MeshStandardMaterial({
      color: 0xffe59a,
      emissive: 0xffcc66,
      emissiveIntensity: 1.2,
    }),
  );
  light.position.y = 1.85;
  g.add(pole, light);
  g.position.set(x, 0, z);
  return g;
}

function makeBench(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0xa86f42, roughness: 0.9 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.15, 0.5), wood);
  seat.position.y = 0.55;
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.65, 0.12), wood);
  back.position.set(0, 0.9, 0.2);
  for (const side of [-0.55, 0.55]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.12), wood);
    leg.position.set(side, 0.28, 0);
    g.add(leg);
  }
  seat.castShadow = true;
  back.castShadow = true;
  g.add(seat, back);
  g.position.set(x, 0, z);
  return g;
}

function makeFriendMarker(marker: CityFriendMarker): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.28, 0.45, 6, 12),
    new THREE.MeshStandardMaterial({ color: marker.color, roughness: 0.55 }),
  );
  body.position.y = 0.7;
  body.castShadow = true;
  g.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 14, 14),
    new THREE.MeshStandardMaterial({ color: 0xffeaa7 }),
  );
  head.position.y = 1.35;
  g.add(head);

  g.position.set(marker.x, 0, marker.z);
  g.userData.friendId = marker.id;
  g.userData.bobPhase = Math.random() * Math.PI * 2;
  return g;
}

const FRIEND_COLORS = [0x6c5ce7, 0x00b894, 0xfd79a8, 0xfdcb6e, 0x0984e3, 0xe17055];

function disposeObject(root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) material?.dispose();
  });
}

export class CityScene {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  private animId = 0;
  private friendMeshes: THREE.Object3D[] = [];
  private world = new THREE.Group();
  private clock = new THREE.Clock();
  private disposed = false;
  private cityGen = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    const mobile =
      window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xb8e0ff);
    this.scene.fog = new THREE.Fog(0xb8e0ff, 18, 42);

    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
    this.camera.position.set(8, 9, 12);
    this.camera.lookAt(0, 0.5, 0);

    const hemi = new THREE.HemisphereLight(0xfff1c1, 0x7ed56f, 0.85);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 1.05);
    sun.position.set(6, 12, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    this.scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(14, 48),
      new THREE.MeshStandardMaterial({ color: 0x7cba5f, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Soft mountains (KZ vibe)
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(
        new THREE.ConeGeometry(2.2 + Math.random(), 3 + Math.random() * 2, 5),
        new THREE.MeshStandardMaterial({ color: 0xa0b4c8, flatShading: true }),
      );
      const a = (i / 6) * Math.PI * 2;
      m.position.set(Math.cos(a) * 16, 0.5, Math.sin(a) * 16);
      this.scene.add(m);
    }

    this.scene.add(this.world);
  }

  resize(width: number, height: number) {
    if (width < 1 || height < 1) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  setCity(friends: { id: string; name: string }[], ownedObjects: string[] = []) {
    const gen = ++this.cityGen;
    while (this.world.children.length) {
      const child = this.world.children[0];
      this.world.remove(child);
      disposeObject(child);
    }
    this.friendMeshes = [];

    const stage = stageFromFriends(friends.length);

    // Always: home + trees
    this.world.add(makeHouse(0x6c5ce7, -3.5, -2.5));
    this.world.add(makeTree(-5.5, 1));
    this.world.add(makeTree(5.2, -1.5));

    if (stage !== 'early') {
      this.world.add(makeHouse(0x00b894, 3.2, -2.8));
      this.world.add(makeHouse(0xfd79a8, -2.2, 3.5));
      this.world.add(makeTree(4.5, 3.2));
    }

    if (stage === 'full') {
      this.world.add(makeHouse(0xfdcb6e, 4.5, 2.8));
      this.world.add(makeHouse(0x0984e3, -4.8, 2.2));
      this.world.add(makeTree(-1.5, -4.5));
      this.world.add(makeTree(2.2, 5));
      // Plaza ring
      const plaza = new THREE.Mesh(
        new THREE.RingGeometry(2.2, 3.2, 32),
        new THREE.MeshStandardMaterial({ color: 0xf8e9c0, side: THREE.DoubleSide }),
      );
      plaza.rotation.x = -Math.PI / 2;
      plaza.position.y = 0.02;
      this.world.add(plaza);
    }

    if (ownedObjects.includes('city_tree')) this.world.add(makeTree(0.8, -4.6));
    if (ownedObjects.includes('city_lamp')) {
      this.world.add(makeLamp(-1.8, 1.8), makeLamp(1.8, 1.8));
    }
    if (ownedObjects.includes('city_bench')) this.world.add(makeBench(3.5, 1.3));
    if (ownedObjects.includes('city_fountain')) this.world.add(makeFountain());

    const loader = createGameGltfLoader();
    // Laconic S1 city dressing
    void placeMany(this.world as unknown as THREE.Scene, loader, [
      { key: 'party_table', opts: { x: 0, z: -3.2, maxSize: 1.6 } },
      { key: 'lantern', opts: { x: -2.4, z: -1.5, maxSize: 0.55 } },
      { key: 'lantern', opts: { x: 2.4, z: -1.5, maxSize: 0.55 } },
      { key: 'mushroom', opts: { x: -3.8, z: 0.5, maxSize: 0.4 } },
      { key: 'wood_sign', opts: { x: 0, z: 3.5, maxSize: 1.1, rotY: Math.PI } },
      { key: 'bench', opts: { x: 3.2, z: 1.5, maxSize: 1.2, rotY: -0.5 } },
      { key: 'fence', opts: { x: -4.5, z: 2.2, maxSize: 1.3, rotY: 0.3 } },
      { key: 'present', opts: { x: 1.2, z: -2.5, maxSize: 0.4 } },
      { key: 'flag', opts: { x: -1.5, z: 3.2, maxSize: 1.0 } },
    ]).then((objs) => {
      if (this.disposed || gen !== this.cityGen) {
        for (const o of objs) this.world.remove(o);
      }
    });
    void placeAmbientCritters(this.world as unknown as THREE.Scene, loader, [
      { key: 'fox', x: 4.2, z: -2.5, rotY: -1.2, h: 0.7 },
      { key: 'rabbit', x: -4.0, z: -2.2, rotY: 0.8, h: 0.55 },
      { key: 'owl', x: 3.5, z: 2.8, rotY: -2.4, h: 0.6 },
      { key: 'bee', x: -2.8, z: -3.5, rotY: 0.4, h: 0.35 },
    ]);

    friends.forEach((f, i) => {
      const a = (i / Math.max(friends.length, 1)) * Math.PI * 2;
      const r = 2.8 + (i % 3) * 0.4;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const color = FRIEND_COLORS[i % FRIEND_COLORS.length];
      const marker = makeFriendMarker({ id: f.id, name: f.name, x, z, color });
      this.world.add(marker);
      this.friendMeshes.push(marker);

      const file = CAST_CHAR_GLB[f.id];
      if (!file) return;
      void loader.loadAsync(`/assets/models/chars/${file}`).then((gltf) => {
        if (this.disposed || gen !== this.cityGen) return;
        fitHeight(gltf.scene, f.id === 'hedgehog' || f.id === 'squirrel' ? 0.85 : 1.1);
        gltf.scene.position.set(x, 0, z);
        groundY(gltf.scene);
        gltf.scene.userData.friendId = f.id;
        gltf.scene.userData.bobPhase = Math.random() * Math.PI * 2;
        gltf.scene.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        });
        this.world.remove(marker);
        const idx = this.friendMeshes.indexOf(marker);
        if (idx >= 0) this.friendMeshes[idx] = gltf.scene;
        this.world.add(gltf.scene);
      }).catch(() => { /* keep capsule */ });
    });
  }

  start() {
    const loop = () => {
      if (this.disposed) return;
      this.animId = requestAnimationFrame(loop);
      const t = this.clock.getElapsedTime();

      this.camera.position.x = 8 + Math.sin(t * 0.15) * 1.2;
      this.camera.lookAt(0, 0.5, 0);

      this.friendMeshes.forEach((m) => {
        const phase = m.userData.bobPhase as number;
        m.position.y = Math.sin(t * 2 + phase) * 0.08;
        m.rotation.y = Math.sin(t * 0.6 + phase) * 0.25;
      });

      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animId);
    disposeObject(this.scene);
    this.renderer.dispose();
  }
}

export function getCityStageLabel(
  friendCount: number,
  lang: 'ru' | 'kk' = 'ru',
): { stage: CityStage; label: string } {
  const stage = stageFromFriends(friendCount);
  if (stage === 'full') {
    return { stage, label: lang === 'kk' ? 'BARSIK Достар қаласы' : 'Город Друзей BARSIK' };
  }
  if (stage === 'growing') {
    return { stage, label: lang === 'kk' ? 'Қала өсіп келеді' : 'Город растёт' };
  }
  return {
    stage,
    label: lang === 'kk' ? 'Қаланы енді салып жатырмыз' : 'Только начали строить город',
  };
}

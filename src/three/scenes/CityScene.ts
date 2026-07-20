import * as THREE from 'three';

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

export class CityScene {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  private animId = 0;
  private friendMeshes: THREE.Group[] = [];
  private world = new THREE.Group();
  private clock = new THREE.Clock();
  private disposed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

  setCity(friends: { id: string; name: string }[]) {
    while (this.world.children.length) {
      this.world.remove(this.world.children[0]);
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
      this.world.add(makeFountain());
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

    friends.forEach((f, i) => {
      const a = (i / Math.max(friends.length, 1)) * Math.PI * 2;
      const r = 2.8 + (i % 3) * 0.4;
      const marker = makeFriendMarker({
        id: f.id,
        name: f.name,
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        color: FRIEND_COLORS[i % FRIEND_COLORS.length],
      });
      this.world.add(marker);
      this.friendMeshes.push(marker);
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
    this.renderer.dispose();
  }
}

export function getCityStageLabel(friendCount: number): { stage: CityStage; label: string } {
  const stage = stageFromFriends(friendCount);
  if (stage === 'full') return { stage, label: 'Город Друзей BARSIK' };
  if (stage === 'growing') return { stage, label: 'Город растёт' };
  return { stage, label: 'Только начали строить город' };
}

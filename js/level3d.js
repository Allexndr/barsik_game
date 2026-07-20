/**
 * Level3D — 3D lane-runner (лес).
 * Устойчивая загрузка: локальный Three, fallback-геометрия если GLB не открылся.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BASE = 'assets/models/cc0/';

function makeTree() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.22, 1.2, 6),
    new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 1 })
  );
  trunk.position.y = 0.6;
  trunk.castShadow = true;
  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0x2ecc71, roughness: 0.85 })
  );
  crown.position.y = 1.55;
  crown.castShadow = true;
  g.add(trunk, crown);
  return g;
}

function makeRock() {
  const m = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.55, 0),
    new THREE.MeshStandardMaterial({ color: 0x95a5a6, roughness: 1 })
  );
  m.castShadow = true;
  m.scale.set(1, 0.7, 1);
  return m;
}

function makeFlower() {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.04, 0.4, 5),
    new THREE.MeshStandardMaterial({ color: 0x27ae60 })
  );
  stem.position.y = 0.2;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xe74c3c, roughness: 0.6 })
  );
  head.position.y = 0.45;
  g.add(stem, head);
  return g;
}

const Level3D = {
  _running: false,
  _raf: 0,
  _renderer: null,
  _scene: null,
  _camera: null,
  _clock: null,
  _root: null,
  _barsik: null,
  _world: null,
  _lane: 1,
  _speed: 10,
  _dist: 0,
  _stars: 0,
  _jumpV: 0,
  _y: 0,
  _alive: true,
  _spawned: [],
  _poolT: 0,
  _onHud: null,
  _onEnd: null,
  _onKey: null,
  _templates: null,

  async mount(container, { onHud, onEnd } = {}) {
    this.unmount();
    this._onHud = onHud;
    this._onEnd = onEnd;
    this._lane = 1;
    this._speed = 10;
    this._dist = 0;
    this._stars = 0;
    this._jumpV = 0;
    this._y = 0;
    this._alive = true;
    this._spawned = [];
    this._poolT = 0;

    const status = (msg) => {
      container.innerHTML = `<div class="hub3d-loading">${msg}</div>`;
    };
    status('Готовим 3D…');

    const w = Math.max(container.clientWidth || 360, 2);
    const h = Math.max(container.clientHeight || 520, 2);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      status('WebGL недоступен в этом браузере');
      throw e;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87d6ff);
    scene.fog = new THREE.Fog(0x87d6ff, 25, 70);

    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    camera.position.set(0, 4.2, 8);

    scene.add(new THREE.HemisphereLight(0xfff5e8, 0x5aad3a, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(4, 12, 6);
    sun.castShadow = true;
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 200),
      new THREE.MeshStandardMaterial({ color: 0x6bcf6b, roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -80;
    ground.receiveShadow = true;
    scene.add(ground);

    const world = new THREE.Group();
    scene.add(world);
    this._world = world;

    const loader = new GLTFLoader();
    const loadOrNull = async (file) => {
      try {
        const gltf = await Promise.race([
          loader.loadAsync(BASE + file),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout ' + file)), 8000)),
        ]);
        gltf.scene.traverse((c) => {
          if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
        });
        return gltf.scene;
      } catch (e) {
        console.warn('Level3D GLB skip', file, e);
        return null;
      }
    };

    status('Грузим лес…');
    // briefly show status then canvas already shown — update via overlay not needed
    let treeA = await loadOrNull('tree_oak.glb');
    let treeB = await loadOrNull('tree_pineDefaultA.glb');
    let rockGlb = await loadOrNull('rock_largeA.glb');
    let rockSmall = await loadOrNull('rock_smallA.glb');
    let flowerGlb = await loadOrNull('flower_redA.glb');

    if (!treeA) treeA = makeTree();
    if (!treeB) treeB = makeTree();
    const rockSide = rockGlb || makeRock();

    for (let i = 0; i < 20; i++) {
      const z = -i * 8 - 4;
      const t1 = treeA.clone();
      t1.position.set(-5.5 - (i % 3) * 0.4, 0, z);
      t1.scale.setScalar(0.9 + (i % 3) * 0.1);
      world.add(t1);
      const t2 = treeB.clone();
      t2.position.set(5.5 + (i % 3) * 0.35, 0, z - 3);
      t2.scale.setScalar(0.85 + (i % 4) * 0.08);
      world.add(t2);
      if (i % 4 === 0) {
        const r = rockSide.clone();
        r.position.set((i % 2 ? 1 : -1) * 4.2, 0, z - 1.5);
        r.scale.setScalar(0.55);
        world.add(r);
      }
    }

    const tex = await new THREE.TextureLoader().loadAsync('assets/barsik_run.png').catch(() => null);
    let barsik;
    if (tex) {
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
      barsik = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), mat);
    } else {
      barsik = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0xf5f6fa })
      );
    }
    barsik.position.set(0, 0.75, 0);
    scene.add(barsik);
    this._barsik = barsik;

    this._renderer = renderer;
    this._scene = scene;
    this._camera = camera;
    this._clock = new THREE.Clock();
    this._root = container;
    this._templates = {
      rock: rockSmall || makeRock(),
      flower: flowerGlb || makeFlower(),
    };

    this._bindInput(renderer.domElement);
    this.start();
    // first frame immediately
    this._renderer.render(this._scene, this._camera);
  },

  _laneX(lane) {
    return (lane - 1) * 2.2;
  },

  _bindInput(el) {
    let sx = 0, sy = 0;
    const down = (e) => {
      const p = e.touches ? e.touches[0] : e;
      sx = p.clientX; sy = p.clientY;
    };
    const up = (e) => {
      const p = e.changedTouches ? e.changedTouches[0] : e;
      const dx = p.clientX - sx;
      const dy = p.clientY - sy;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 28) {
        if (dx < 0) this._lane = Math.max(0, this._lane - 1);
        else this._lane = Math.min(2, this._lane + 1);
      } else if (dy < -36 || (Math.abs(dx) < 20 && Math.abs(dy) < 20)) {
        if (this._y < 0.05) this._jumpV = 7.5;
      }
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('touchstart', down, { passive: true });
    el.addEventListener('touchend', up);
    this._onKey = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') this._lane = Math.max(0, this._lane - 1);
      if (e.key === 'ArrowRight' || e.key === 'd') this._lane = Math.min(2, this._lane + 1);
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') {
        if (this._y < 0.05) this._jumpV = 7.5;
      }
    };
    window.addEventListener('keydown', this._onKey);
  },

  start() {
    if (this._running) return;
    this._running = true;
    const loop = () => {
      if (!this._running) return;
      this._raf = requestAnimationFrame(loop);
      this._tick();
    };
    loop();
  },

  stop() {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  },

  _spawnObstacle() {
    const kind = Math.random() < 0.55 ? 'rock' : 'flower';
    const lane = Math.floor(Math.random() * 3);
    const obj = this._templates[kind].clone();
    obj.position.set(this._laneX(lane), 0, -this._dist - 35);
    obj.scale.setScalar(kind === 'rock' ? 1.4 : 1.8);
    obj.userData = { kind, lane, hit: false };
    this._world.add(obj);
    this._spawned.push(obj);
  },

  _tick() {
    if (!this._alive || !this._renderer) return;
    const dt = Math.min(this._clock.getDelta(), 0.05);
    this._speed = Math.min(16, this._speed + dt * 0.15);
    this._dist += this._speed * dt;

    this._jumpV -= 22 * dt;
    this._y += this._jumpV * dt;
    if (this._y < 0) { this._y = 0; this._jumpV = 0; }

    const tx = this._laneX(this._lane);
    if (this._barsik) {
      this._barsik.position.x += (tx - this._barsik.position.x) * Math.min(1, dt * 12);
      this._barsik.position.y = 0.75 + this._y;
      this._barsik.position.z = 0;
      this._barsik.quaternion.copy(this._camera.quaternion);
    }

    this._world.position.z = this._dist;

    this._poolT -= dt;
    if (this._poolT <= 0) {
      this._spawnObstacle();
      this._poolT = 1.1 + Math.random() * 0.7;
    }

    for (const obj of this._spawned) {
      if (obj.userData.hit) continue;
      const wz = obj.position.z + this._world.position.z;
      if (wz > -1.2 && wz < 1.2 && obj.userData.lane === this._lane && this._y < 0.9) {
        obj.userData.hit = true;
        if (obj.userData.kind === 'flower') {
          this._stars += 1;
          obj.visible = false;
        } else {
          this._alive = false;
          this.stop();
          if (this._onEnd) this._onEnd({ stars: this._stars, dist: Math.floor(this._dist) });
        }
      }
      if (wz > 8) obj.userData.hit = true;
    }

    this._camera.position.x += ((this._barsik ? this._barsik.position.x * 0.35 : 0) - this._camera.position.x) * 0.08;
    this._camera.position.y = 4.0 + this._y * 0.15;
    this._camera.lookAt(this._barsik ? this._barsik.position.x : 0, 1.2 + this._y, -4);

    if (this._onHud) this._onHud({ stars: this._stars, dist: Math.floor(this._dist) });

    if (this._dist > 180) {
      this._alive = false;
      this.stop();
      if (this._onEnd) this._onEnd({ stars: this._stars + 5, dist: Math.floor(this._dist), win: true });
    }

    this._renderer.render(this._scene, this._camera);
  },

  resize() {
    if (!this._renderer || !this._root || !this._camera) return;
    const w = this._root.clientWidth;
    const h = this._root.clientHeight;
    if (w < 2 || h < 2) return;
    this._camera.aspect = w / h;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(w, h, false);
  },

  unmount() {
    this.stop();
    if (this._onKey) window.removeEventListener('keydown', this._onKey);
    this._onKey = null;
    if (this._renderer) {
      this._renderer.dispose();
      if (this._renderer.domElement?.parentNode) {
        this._renderer.domElement.parentNode.removeChild(this._renderer.domElement);
      }
    }
    this._renderer = null;
    this._scene = null;
    this._templates = null;
    this._barsik = null;
    this._world = null;
  },
};

window.Level3D = Level3D;
export default Level3D;

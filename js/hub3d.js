/**
 * Hub3D — браузерный 3D-хаб «Город / дом Барсика»
 * Three.js + Kenney CC0 GLB + billboard Барсика (наши PNG).
 * Без Blender GUI. Экспорт: window.Hub3D
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BASE = 'assets/models/cc0/';

const Hub3D = {
  _ready: false,
  _running: false,
  _raf: 0,
  _renderer: null,
  _scene: null,
  _camera: null,
  _clock: null,
  _barsik: null,
  _root: null,
  _drag: { active: false, x: 0, yaw: 0.55 },
  _loaders: null,

  async mount(container) {
    if (!container) return;
    this.unmount();

    const w = container.clientWidth || 360;
    const h = container.clientHeight || 420;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa8e6ff);
    scene.fog = new THREE.Fog(0xa8e6ff, 18, 42);

    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 80);
    camera.position.set(7.5, 5.2, 9.5);

    const hemi = new THREE.HemisphereLight(0xfff0e8, 0x7ec850, 1.05);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff5e6, 1.35);
    sun.position.set(8, 14, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 40;
    sun.shadow.camera.left = -12;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 12;
    sun.shadow.camera.bottom = -12;
    scene.add(sun);

    // Ground
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(16, 48),
      new THREE.MeshStandardMaterial({ color: 0x7ed56f, roughness: 0.92, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Soft path
    const path = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 10),
      new THREE.MeshStandardMaterial({ color: 0xe8d5a3, roughness: 1 })
    );
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.02, 2);
    path.receiveShadow = true;
    scene.add(path);

    // Cute house (original procedural — наш ассет)
    const house = this._makeHouse();
    house.position.set(0, 0, -2.2);
    scene.add(house);

    const loader = new GLTFLoader();
    this._loaders = loader;

    const place = async (file, pos, scale = 1, rotY = 0) => {
      try {
        const gltf = await Promise.race([
          loader.loadAsync(BASE + file),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
        ]);
        const obj = gltf.scene;
        obj.traverse((c) => {
          if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
          }
        });
        obj.position.set(pos[0], pos[1], pos[2]);
        obj.scale.setScalar(scale);
        obj.rotation.y = rotY;
        scene.add(obj);
        return obj;
      } catch (e) {
        console.warn('Hub3D: skip', file, e);
        return null;
      }
    };

    // Kenney CC0 nature + furniture accents
    await Promise.all([
      place('tree_oak.glb', [-5.5, 0, -1.5], 1.1),
      place('tree_pineDefaultA.glb', [5.8, 0, -2.2], 1.0),
      place('tree_detailed.glb', [-4.2, 0, 4.5], 0.85),
      place('tree_default.glb', [4.5, 0, 5.0], 0.9),
      place('tree_cone.glb', [-6.2, 0, 2.0], 0.95),
      place('rock_largeA.glb', [3.2, 0, 1.2], 0.7, 0.4),
      place('rock_smallA.glb', [-2.8, 0, 3.5], 1.2, -0.3),
      place('flower_redA.glb', [1.6, 0, 3.8], 1.4),
      place('flower_yellowA.glb', [-1.4, 0, 4.2], 1.4),
      place('flower_redA.glb', [2.4, 0, -0.5], 1.2),
      place('campfire_stones.glb', [-3.5, 0, 0.8], 1.0),
      place('plantSmall1.glb', [1.8, 0, -1.0], 1.3),
      place('plantSmall2.glb', [-1.9, 0, -0.8], 1.2),
      place('chair.glb', [2.6, 0, -1.6], 1.0, Math.PI * 0.85),
      place('table.glb', [3.4, 0, -2.4], 0.9, 0.2),
    ]);

    // Barsik billboard (наши PNG — бренд)
    const barsik = await this._makeBarsikBillboard();
    barsik.position.set(0.3, 0.15, 1.6);
    scene.add(barsik);
    this._barsik = barsik;

    this._renderer = renderer;
    this._scene = scene;
    this._camera = camera;
    this._clock = new THREE.Clock();
    this._root = container;
    this._ready = true;

    this._bindInput(renderer.domElement);
    this.start();
  },

  _makeHouse() {
    const g = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xfff6e8, roughness: 0.75, metalness: 0.05 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xff8fab, roughness: 0.65, metalness: 0 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x6c5ce7, roughness: 0.5 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.4, 2.8), wallMat);
    body.position.y = 1.2;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.6, 4), roofMat);
    roof.position.y = 3.15;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    g.add(roof);

    const door = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.35, 0.12), trimMat);
    door.position.set(0, 0.7, 1.42);
    g.add(door);

    const winL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.08), new THREE.MeshStandardMaterial({ color: 0x74b9ff, roughness: 0.3, emissive: 0x0984e3, emissiveIntensity: 0.15 }));
    winL.position.set(-1.0, 1.45, 1.42);
    const winR = winL.clone();
    winR.position.x = 1.0;
    g.add(winL, winR);

    return g;
  },

  async _makeBarsikBillboard() {
    const group = new THREE.Group();
    const tex = await new THREE.TextureLoader().loadAsync('assets/barsik_idle.png');
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), mat);
    mesh.position.y = 0.85;
    group.add(mesh);
    group.userData.plane = mesh;
    return group;
  },

  _bindInput(el) {
    const onDown = (e) => {
      this._drag.active = true;
      this._drag.x = (e.touches ? e.touches[0].clientX : e.clientX);
    };
    const onMove = (e) => {
      if (!this._drag.active) return;
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      const dx = x - this._drag.x;
      this._drag.x = x;
      this._drag.yaw -= dx * 0.005;
      this._drag.yaw = Math.max(-0.9, Math.min(1.4, this._drag.yaw));
    };
    const onUp = () => { this._drag.active = false; };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointerleave', onUp);
    el.addEventListener('touchstart', onDown, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onUp);
  },

  start() {
    if (!this._ready || this._running) return;
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

  _tick() {
    const t = this._clock.getElapsedTime();
    const yaw = this._drag.yaw;
    const r = 12.5;
    const camY = 5.0 + Math.sin(t * 0.35) * 0.15;
    this._camera.position.set(
      Math.sin(yaw) * r,
      camY,
      Math.cos(yaw) * r
    );
    this._camera.lookAt(0, 1.2, -0.5);

    if (this._barsik) {
      const plane = this._barsik.userData.plane;
      this._barsik.position.y = 0.15 + Math.sin(t * 2.2) * 0.06;
      if (plane) {
        plane.quaternion.copy(this._camera.quaternion); // billboard face cam
      }
    }

    this._renderer.render(this._scene, this._camera);
  },

  resize() {
    if (!this._renderer || !this._root) return;
    const w = this._root.clientWidth;
    const h = this._root.clientHeight;
    if (w < 2 || h < 2) return;
    this._camera.aspect = w / h;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(w, h, false);
  },

  unmount() {
    this.stop();
    if (this._renderer) {
      this._renderer.dispose();
      if (this._renderer.domElement && this._renderer.domElement.parentNode) {
        this._renderer.domElement.parentNode.removeChild(this._renderer.domElement);
      }
    }
    this._renderer = null;
    this._scene = null;
    this._camera = null;
    this._barsik = null;
    this._ready = false;
  },
};

window.Hub3D = Hub3D;
export default Hub3D;

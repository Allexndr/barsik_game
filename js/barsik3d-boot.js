/**
 * barsik3d-boot.js — Barsik Town hub + story episodes (NOT lane-runner).
 * GDD v2: main menu = 3D town; levels = explore / find / help.
 */
(function () {
  function paint(el, html) {
    if (el) el.innerHTML = html;
  }
  function fail(where, err) {
    const msg = (err && err.message) ? err.message : String(err || 'unknown');
    console.error('[barsik3d]', where, err);
    window.__BARSIK3D_ERR = where + ': ' + msg;
    paint(document.getElementById('hub3d-root'),
      '<div class="hub3d-loading">Ошибка 3D (город)<br><small>' + msg + '</small></div>');
    paint(document.getElementById('level3d-root'),
      '<div class="hub3d-loading">Ошибка 3D (эпизод)<br><small>' + msg + '</small></div>');
  }

  function makeTree(THREE) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.22, 1.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 1 })
    );
    trunk.position.y = 0.6;
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x2d9e5a, roughness: 0.9, flatShading: true })
    );
    crown.position.y = 1.55;
    g.add(trunk, crown);
    return g;
  }

  function makeHouse(THREE) {
    const g = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xfff6e8, roughness: 0.75 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xff6b6b, roughness: 0.65 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xe17055, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.4, 2.8), wallMat);
    body.position.y = 1.2;
    body.castShadow = true;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.6, 4), roofMat);
    roof.position.y = 3.15;
    roof.rotation.y = Math.PI / 4;
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.35, 0.12), trimMat);
    door.position.set(0, 0.7, 1.42);
    g.add(body, roof, door);
    return g;
  }

  function makeBoard(THREE) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 2.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x6d4c41 })
    );
    post.position.y = 1.1;
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.4, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xffeaa7, roughness: 0.7 })
    );
    board.position.y = 2.0;
    const pin = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xe74c3c, emissive: 0xc0392b, emissiveIntensity: 0.35 })
    );
    pin.position.set(0.4, 2.15, 0.1);
    g.add(post, board, pin);
    g.userData.hotspot = 'travel';
    return g;
  }

  function makeChest(THREE) {
    const g = new THREE.Group();
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.7, 0.8),
      new THREE.MeshStandardMaterial({ color: 0xd4a017, metalness: 0.35, roughness: 0.4 })
    );
    box.position.y = 0.35;
    const lid = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.2, 0.85),
      new THREE.MeshStandardMaterial({ color: 0xf1c40f, metalness: 0.4, roughness: 0.35 })
    );
    lid.position.y = 0.8;
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.18),
      new THREE.MeshStandardMaterial({ color: 0x00cec9, emissive: 0x00b894, emissiveIntensity: 0.5 })
    );
    gem.position.set(0, 1.05, 0);
    g.add(box, lid, gem);
    g.userData.hotspot = 'qr';
    return g;
  }

  function makeLamp(THREE) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 2.0, 6),
      new THREE.MeshStandardMaterial({ color: 0x636e72 })
    );
    pole.position.y = 1.0;
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xff7675, emissive: 0xd63031, emissiveIntensity: 0.55 })
    );
    lamp.position.y = 2.15;
    g.add(pole, lamp);
    g.userData.hotspot = 'friends';
    return g;
  }

  function makeApple(THREE) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xe74c3c, roughness: 0.55 })
    );
    body.position.y = 0.28;
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0x27ae60 })
    );
    leaf.position.set(0.1, 0.5, 0);
    g.add(body, leaf);
    g.userData.kind = 'apple';
    return g;
  }

  function makeWeb(THREE) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xdfe6e9, transparent: true, opacity: 0.75, roughness: 0.9 });
    for (let i = 0; i < 5; i++) {
      const strand = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.8, 0.04), mat);
      strand.position.set((i - 2) * 0.25, 0.9, 0);
      strand.rotation.z = (i - 2) * 0.08;
      g.add(strand);
    }
    g.userData.kind = 'web';
    return g;
  }

  function makeFriendMarker(THREE, color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 12, 12),
      new THREE.MeshStandardMaterial({ color: color || 0xff9ff3, roughness: 0.6 })
    );
    body.position.y = 0.55;
    const earL = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), body.material);
    earL.position.set(-0.28, 0.95, 0);
    const earR = earL.clone();
    earR.position.x = 0.28;
    g.add(body, earL, earR);
    g.userData.kind = 'aya';
    return g;
  }

  async function loadBarsikBillboard(THREE, path) {
    const tex = await new THREE.TextureLoader().loadAsync(path).catch(() => null);
    const barsik = new THREE.Group();
    if (tex && tex.image) {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      // Keep PNG aspect — NEVER force square (portrait idle was stretched fat)
      const iw = tex.image.naturalWidth || tex.image.width || 1;
      const ih = tex.image.naturalHeight || tex.image.height || 1;
      const aspect = iw / Math.max(ih, 1);
      const height = 1.9;
      const width = height * aspect;
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, alphaTest: 0.05 })
      );
      plane.position.y = height * 0.5;
      barsik.add(plane);
      barsik.userData.plane = plane;
    } else {
      const s = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 14, 14),
        new THREE.MeshStandardMaterial({ color: 0xf5f6fa })
      );
      s.position.y = 0.55;
      barsik.add(s);
    }
    return barsik;
  }

  function createHub(THREE) {
    const Hub3D = {
      _running: false, _raf: 0, _renderer: null, _scene: null, _camera: null,
      _clock: null, _barsik: null, _root: null, _ray: null, _hotspots: [],
      _drag: { active: false, x: 0, yaw: 0.45, moved: false },
      _onHotspot: null, _state: null,

      async mount(container, opts) {
        opts = opts || {};
        this._onHotspot = opts.onHotspot || null;
        this._state = opts.state || null;
        this.unmount();
        const w = Math.max(container.clientWidth || 360, 2);
        const h = Math.max(container.clientHeight || 420, 2);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
        renderer.setSize(w, h, false);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = true;
        renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
        container.innerHTML = '';
        container.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x7ec8f5);
        scene.fog = new THREE.Fog(0xb8e4ff, 22, 52);
        const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 80);
        scene.add(new THREE.HemisphereLight(0xfff8f0, 0x4a9e3e, 0.95));
        const sun = new THREE.DirectionalLight(0xfff3d6, 1.55);
        sun.position.set(6, 16, 8);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far = 40;
        sun.shadow.camera.left = -14;
        sun.shadow.camera.right = 14;
        sun.shadow.camera.top = 14;
        sun.shadow.camera.bottom = -14;
        scene.add(sun);
        scene.add(new THREE.AmbientLight(0xffffff, 0.25));

        // Soft sky dome tint
        const sky = new THREE.Mesh(
          new THREE.SphereGeometry(40, 24, 16),
          new THREE.MeshBasicMaterial({ color: 0x9fd9ff, side: THREE.BackSide })
        );
        scene.add(sky);

        const ground = new THREE.Mesh(
          new THREE.CircleGeometry(18, 48),
          new THREE.MeshStandardMaterial({ color: 0x6fd36a, roughness: 0.92 })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        const plaza = new THREE.Mesh(
          new THREE.CircleGeometry(5.5, 36),
          new THREE.MeshStandardMaterial({ color: 0xe8d5a3, roughness: 1 })
        );
        plaza.rotation.x = -Math.PI / 2;
        plaza.position.y = 0.03;
        scene.add(plaza);

        const house = makeHouse(THREE);
        house.position.set(0, 0, -4.2);
        house.userData.hotspot = 'home';
        scene.add(house);

        const board = makeBoard(THREE);
        board.position.set(4.2, 0, 1.2);
        board.rotation.y = -0.5;
        scene.add(board);

        const chest = makeChest(THREE);
        chest.position.set(-4.0, 0, 1.5);
        scene.add(chest);

        const lamp = makeLamp(THREE);
        lamp.position.set(-2.2, 0, -1.5);
        scene.add(lamp);

        const banner = new THREE.Mesh(
          new THREE.BoxGeometry(3.6, 0.7, 0.1),
          new THREE.MeshStandardMaterial({ color: 0xff7675, emissive: 0xd63031, emissiveIntensity: 0.2 })
        );
        banner.position.set(0, 3.6, -3.5);
        scene.add(banner);

        [[-7, -2], [7, -3], [-6, 5], [6, 4.5], [-8, 2], [5, -6]].forEach((p, i) => {
          const t = makeTree(THREE);
          t.position.set(p[0], 0, p[1]);
          t.scale.setScalar(0.9 + (i % 3) * 0.12);
          scene.add(t);
        });

        const barsik = await loadBarsikBillboard(THREE, 'assets/barsik_idle.png');
        barsik.position.set(0.2, 0, 1.4);
        scene.add(barsik);

        const hasAya = this._state && (this._state.friends || []).includes('aya');
        if (hasAya) {
          const aya = makeFriendMarker(THREE, 0xff9ff3);
          aya.position.set(-2.5, 0, -1.2);
          scene.add(aya);
        }

        this._hotspots = [house, board, chest, lamp];
        this._ray = new THREE.Raycaster();
        this._renderer = renderer;
        this._scene = scene;
        this._camera = camera;
        this._clock = new THREE.Clock();
        this._barsik = barsik;
        this._root = container;

        const el = renderer.domElement;
        const onDown = (e) => {
          this._drag.active = true;
          this._drag.moved = false;
          this._drag.x = e.touches ? e.touches[0].clientX : e.clientX;
        };
        const onMove = (e) => {
          if (!this._drag.active) return;
          const x = e.touches ? e.touches[0].clientX : e.clientX;
          const dx = x - this._drag.x;
          if (Math.abs(dx) > 4) this._drag.moved = true;
          this._drag.yaw -= dx * 0.005;
          this._drag.x = x;
          this._drag.yaw = Math.max(-1.1, Math.min(1.3, this._drag.yaw));
        };
        const onUp = (e) => {
          if (!this._drag.active) return;
          this._drag.active = false;
          if (this._drag.moved) return;
          const rect = el.getBoundingClientRect();
          const cx = (e.changedTouches ? e.changedTouches[0].clientX : e.clientX) - rect.left;
          const cy = (e.changedTouches ? e.changedTouches[0].clientY : e.clientY) - rect.top;
          const mouse = new THREE.Vector2((cx / rect.width) * 2 - 1, -(cy / rect.height) * 2 + 1);
          this._ray.setFromCamera(mouse, this._camera);
          const hits = this._ray.intersectObjects(this._hotspots, true);
          if (hits.length && this._onHotspot) {
            let obj = hits[0].object;
            while (obj && !obj.userData.hotspot) obj = obj.parent;
            if (obj && obj.userData.hotspot) this._onHotspot(obj.userData.hotspot);
          }
        };
        el.addEventListener('pointerdown', onDown);
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerup', onUp);
        el.addEventListener('pointerleave', () => { this._drag.active = false; });

        this.start();
      },

      start() {
        if (this._running) return;
        this._running = true;
        const loop = () => {
          if (!this._running) return;
          this._raf = requestAnimationFrame(loop);
          const t = this._clock.getElapsedTime();
          const yaw = this._drag.yaw;
          const r = 13;
          this._camera.position.set(Math.sin(yaw) * r, 5.2 + Math.sin(t * 0.35) * 0.12, Math.cos(yaw) * r);
          this._camera.lookAt(0, 1.4, -1);
          if (this._barsik) {
            this._barsik.position.y = Math.sin(t * 2.2) * 0.05;
            if (this._barsik.userData.plane) this._barsik.userData.plane.quaternion.copy(this._camera.quaternion);
          }
          this._renderer.render(this._scene, this._camera);
        };
        loop();
      },

      stop() {
        this._running = false;
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = 0;
      },

      resize() {
        if (!this._renderer || !this._root) return;
        const w = this._root.clientWidth, h = this._root.clientHeight;
        if (w < 2 || h < 2) return;
        this._camera.aspect = w / h;
        this._camera.updateProjectionMatrix();
        this._renderer.setSize(w, h, false);
      },

      unmount() {
        this.stop();
        if (this._renderer) {
          this._renderer.dispose();
          this._renderer.domElement?.parentNode?.removeChild(this._renderer.domElement);
        }
        this._renderer = null;
        this._scene = null;
      },
    };
    return Hub3D;
  }

  /** Story explore episode — tap apples / web / Aya */
  function createEpisode(THREE) {
    const Episode3D = {
      _running: false, _raf: 0, _renderer: null, _scene: null, _camera: null,
      _clock: null, _root: null, _barsik: null, _ray: null, _targets: [],
      _episodeId: null, _collected: 0, _need: 3, _phase: 'collect',
      _onHud: null, _onLine: null, _onComplete: null,
      _drag: { active: false, x: 0, yaw: 0.2, moved: false },

      async mount(container, opts) {
        opts = opts || {};
        this.unmount();
        this._episodeId = opts.episodeId || 'ep2_apples';
        this._onHud = opts.onHud || null;
        this._onLine = opts.onLine || null;
        this._onComplete = opts.onComplete || null;
        this._collected = 0;
        this._need = this._episodeId === 'ep6_aya' ? 0 : 3;
        this._phase = this._episodeId === 'ep6_aya' ? 'find_aya' : 'collect';
        this._targets = [];

        paint(container, '<div class="hub3d-loading">Собираем лес…</div>');
        const w = Math.max(container.clientWidth || 360, 2);
        const h = Math.max(container.clientHeight || 520, 2);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
        renderer.setSize(w, h, false);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
        container.innerHTML = '';
        container.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x7ec8ff);
        scene.fog = new THREE.Fog(0x7ec8ff, 18, 40);
        const camera = new THREE.PerspectiveCamera(48, w / h, 0.1, 80);
        scene.add(new THREE.HemisphereLight(0xfff5e8, 0x5aad3a, 1.15));
        const sun = new THREE.DirectionalLight(0xffffff, 1.15);
        sun.position.set(5, 12, 4);
        scene.add(sun);

        const ground = new THREE.Mesh(
          new THREE.CircleGeometry(22, 40),
          new THREE.MeshStandardMaterial({ color: 0x5fbf5a, roughness: 0.95 })
        );
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);

        const path = new THREE.Mesh(
          new THREE.PlaneGeometry(2.4, 16),
          new THREE.MeshStandardMaterial({ color: 0xe8d5a3, roughness: 1 })
        );
        path.rotation.x = -Math.PI / 2;
        path.position.set(0, 0.02, -4);
        scene.add(path);

        for (let i = 0; i < 14; i++) {
          const t = makeTree(THREE);
          const side = i % 2 === 0 ? -1 : 1;
          t.position.set(side * (3.8 + (i % 4) * 0.4), 0, -i * 1.1);
          t.scale.setScalar(0.85 + (i % 3) * 0.15);
          scene.add(t);
        }

        const barsik = await loadBarsikBillboard(THREE, 'assets/barsik_idle.png');
        barsik.position.set(0, 0.1, 2.2);
        scene.add(barsik);

        if (this._episodeId === 'ep2_apples') {
          const positions = [[-1.8, -1.5], [1.6, -3.2], [-0.3, -5.5], [2.0, -7.0]];
          positions.forEach((p, i) => {
            if (i >= this._need) return;
            const apple = makeApple(THREE);
            apple.position.set(p[0], 0, p[1]);
            apple.userData.collectible = true;
            scene.add(apple);
            this._targets.push(apple);
          });
          if (this._onLine) {
            this._onLine({ who: 'Барсик', ru: 'Кто-то грыз яблоки… совсем крошечный!', kk: 'Біреу алмаларды тістеген…' });
          }
        } else if (this._episodeId === 'ep6_aya') {
          const web = makeWeb(THREE);
          web.position.set(0, 0, -4.5);
          web.userData.clearable = true;
          scene.add(web);
          this._targets.push(web);
          const aya = makeFriendMarker(THREE, 0xff9ff3);
          aya.position.set(0.2, 0, -4.8);
          aya.visible = false;
          aya.userData.aya = true;
          scene.add(aya);
          this._aya = aya;
          if (this._onLine) {
            this._onLine({ who: 'Барсик', ru: 'Слышу голос… Кто-то запутался!', kk: 'Дауыс естимін…' });
          }
        }

        this._ray = new THREE.Raycaster();
        this._renderer = renderer;
        this._scene = scene;
        this._camera = camera;
        this._clock = new THREE.Clock();
        this._root = container;
        this._barsik = barsik;

        const el = renderer.domElement;
        const onDown = (e) => {
          this._drag.active = true;
          this._drag.moved = false;
          this._drag.x = e.touches ? e.touches[0].clientX : e.clientX;
        };
        const onMove = (e) => {
          if (!this._drag.active) return;
          const x = e.touches ? e.touches[0].clientX : e.clientX;
          const dx = x - this._drag.x;
          if (Math.abs(dx) > 4) this._drag.moved = true;
          this._drag.yaw -= dx * 0.006;
          this._drag.x = x;
          this._drag.yaw = Math.max(-0.8, Math.min(0.8, this._drag.yaw));
        };
        const onUp = (e) => {
          if (!this._drag.active) return;
          this._drag.active = false;
          if (this._drag.moved) return;
          const rect = el.getBoundingClientRect();
          const cx = (e.changedTouches ? e.changedTouches[0].clientX : e.clientX) - rect.left;
          const cy = (e.changedTouches ? e.changedTouches[0].clientY : e.clientY) - rect.top;
          const mouse = new THREE.Vector2((cx / rect.width) * 2 - 1, -(cy / rect.height) * 2 + 1);
          this._ray.setFromCamera(mouse, this._camera);
          const hits = this._ray.intersectObjects(this._targets.filter((t) => t.visible), true);
          if (!hits.length) return;
          let obj = hits[0].object;
          while (obj && !obj.userData.collectible && !obj.userData.clearable && !obj.userData.aya) {
            obj = obj.parent;
          }
          if (!obj) return;
          this._tap(obj);
        };
        el.addEventListener('pointerdown', onDown);
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerup', onUp);

        this._emitHud();
        this.start();
      },

      _tap(obj) {
        if (obj.userData.collectible && this._phase === 'collect') {
          obj.visible = false;
          obj.userData.collectible = false;
          this._collected += 1;
          this._emitHud();
          if (typeof Sound !== 'undefined') Sound.star && Sound.star();
          if (this._collected >= this._need) {
            this._phase = 'done';
            if (this._onLine) {
              this._onLine({ who: 'Барсик', ru: 'Следы ведут глубже в лес!', kk: 'Іздер орманға апарады!' });
            }
            setTimeout(() => {
              if (this._onComplete) this._onComplete({ episodeId: this._episodeId, stars: 5 + this._collected });
            }, 900);
          }
          return;
        }
        if (obj.userData.clearable && this._phase === 'find_aya') {
          obj.visible = false;
          if (this._aya) {
            this._aya.visible = true;
            this._targets.push(this._aya);
          }
          this._phase = 'talk_aya';
          if (this._onLine) {
            this._onLine({
              who: 'Айя',
              ru: 'Я запуталась в нитях Путало… Спасибо! Можно я буду твоим другом?',
              kk: 'Мен Путалоның жіптеріне оранып қалдым… Достасайық па?',
            });
          }
          this._emitHud();
          return;
        }
        if (obj.userData.aya && this._phase === 'talk_aya') {
          this._phase = 'done';
          if (this._onLine) {
            this._onLine({
              who: 'Айя',
              ru: 'В городе буду ждать у ягодного фонаря. Если понадоблюсь — позови!',
              kk: 'Қалада жидек шамының жанында күтемін!',
            });
          }
          setTimeout(() => {
            if (this._onComplete) {
              this._onComplete({ episodeId: this._episodeId, stars: 15, unlockFriend: 'aya' });
            }
          }, 1100);
        }
      },

      _emitHud() {
        if (!this._onHud) return;
        let goal = 'Исследуй лес';
        if (this._episodeId === 'ep2_apples') goal = 'Яблоки: ' + this._collected + '/' + this._need;
        if (this._episodeId === 'ep6_aya') {
          if (this._phase === 'find_aya') goal = 'Развей паутину Путало';
          else if (this._phase === 'talk_aya') goal = 'Поговори с Айей';
          else goal = 'Готово!';
        }
        this._onHud({ goal: goal, collected: this._collected, need: this._need });
      },

      start() {
        if (this._running) return;
        this._running = true;
        const loop = () => {
          if (!this._running) return;
          this._raf = requestAnimationFrame(loop);
          const t = this._clock.getElapsedTime();
          const yaw = this._drag.yaw;
          const r = 9.5;
          this._camera.position.set(Math.sin(yaw) * r, 4.2, 4 + Math.cos(yaw) * 3);
          this._camera.lookAt(0, 1.0, -3);
          if (this._barsik && this._barsik.userData.plane) {
            this._barsik.userData.plane.quaternion.copy(this._camera.quaternion);
            this._barsik.position.y = 0.1 + Math.sin(t * 2) * 0.04;
          }
          this._targets.forEach((o) => {
            if (o.visible && o.userData.collectible) o.position.y = Math.sin(t * 3 + o.position.x) * 0.08;
          });
          this._renderer.render(this._scene, this._camera);
        };
        loop();
      },

      stop() {
        this._running = false;
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = 0;
      },

      resize() {
        if (!this._renderer || !this._root) return;
        const w = this._root.clientWidth, h = this._root.clientHeight;
        if (w < 2 || h < 2) return;
        this._camera.aspect = w / h;
        this._camera.updateProjectionMatrix();
        this._renderer.setSize(w, h, false);
      },

      unmount() {
        this.stop();
        if (this._renderer) {
          this._renderer.dispose();
          this._renderer.domElement?.parentNode?.removeChild(this._renderer.domElement);
        }
        this._renderer = null;
        this._scene = null;
        this._targets = [];
        this._aya = null;
      },
    };
    return Episode3D;
  }

  async function boot() {
    console.log('[barsik3d] boot…');
    try {
      const THREE = await import('/vendor/three/three.module.js');
      window.THREE = THREE;
      window.Hub3D = createHub(THREE);
      window.Episode3D = createEpisode(THREE);
      window.Level3D = window.Episode3D; // compat alias
      window.__BARSIK3D_READY = true;
      console.log('[barsik3d] READY Hub3D+Episode3D');
      const city = document.getElementById('screen-city');
      if (city && city.classList.contains('active') && typeof renderCity === 'function' && typeof S !== 'undefined') {
        renderCity(S);
      }
    } catch (e) {
      fail('boot', e);
    }
  }

  boot();
})();

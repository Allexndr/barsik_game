import * as THREE from 'three';
import {
  BaseLevelScene,
  type BaseHud,
  mountain,
  zoneDisc,
  spawnPad,
  questMarker,
  butterfly,
  bush,
  tulip,
  hill,
  skyDome,
  pathArrow,
  placeWoodSign,
  loadCharModel,
  loadPropModel,
} from './BaseLevelScene';
import { AudioManager } from '@/audio/AudioManager';
import { groundY } from '../modelUtils';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { placeMany, placeAmbientCritters } from '../s1Place';
import { CAST_PROP_GLB, KEY_ACORN, readFlag, writeFlag } from '../castModels';

/**
 * Level 10 «QR-сундук» — GDD Chapter 1 Level 9:
 * Puzzle/reward mechanic. Use the acorn key (from Level 5) to open the chest.
 * Inside: stars, rare friend "Ягодка", and map to Chapter 2.
 */

export type L10Phase = 'intro' | 'seals' | 'approach' | 'unlock' | 'open' | 'outro';

export interface L10Hud extends BaseHud {
  hasAcornKey: boolean;
  chestOpen: boolean;
  spareKeyGiven: boolean;
  sealsDone: number;
  sealsTotal: number;
}

function makeChest(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8, metalness: 0.1 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.3, metalness: 0.7, emissive: 0xffd700, emissiveIntensity: 0.2 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 1.0), woodMat);
  body.position.y = 0.4;
  body.castShadow = true;

  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 1.0), woodMat);
  lid.position.y = 0.95;
  lid.castShadow = true;
  lid.userData.isLid = true;

  // Gold trim
  const trim1 = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.05, 1.02), goldMat);
  trim1.position.y = 0.2;
  const trim2 = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.05, 1.02), goldMat);
  trim2.position.y = 0.7;

  // Acorn-shaped lock
  const lockCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    goldMat,
  );
  lockCap.position.set(0, 0.85, 0.52);
  const lockBody = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.6, emissive: 0xf39c12, emissiveIntensity: 0.3 }));
  lockBody.position.set(0, 0.75, 0.52);

  // Glow ring
  const glow = new THREE.Mesh(
    new THREE.RingGeometry(1.0, 1.5, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.02;

  g.add(body, lid, trim1, trim2, lockCap, lockBody, glow);
  g.position.set(x, 0, z);
  g.userData.lid = lid;
  g.userData.glow = glow;
  g.userData.lockCap = lockCap;
  g.userData.lockBody = lockBody;
  return g;
}

function makeAcornKeyFloat(x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const capMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 1 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.8, emissive: 0xf39c12, emissiveIntensity: 0.4 });

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
  cap.position.y = 0.1;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), bodyMat);
  body.position.y = -0.02;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 4), capMat);
  stem.position.y = 0.2;

  g.add(cap, body, stem);
  g.position.set(x, y, z);
  return g;
}

export class Level9Scene extends BaseLevelScene {
  private phase: L10Phase = 'intro';
  private onHud: ((h: L10Hud) => void) | null = null;
  private introI = 0;
  private nextAt = 0;
  private chest: THREE.Group | null = null;
  private acornKey: THREE.Object3D | null = null;
  private chestOpen = false;
  private lidOpenTime = 0;
  private hasAcornKey = false;
  private spareKeyGiven = false;
  private butterflies: THREE.Group[] = [];
  private yagodka: THREE.Object3D | null = null;
  private seals: THREE.Object3D[] = [];
  private sealsDone = 0;
  private readonly sealsTotal = 3;

  protected currentPhase() { return this.phase; }

  protected onMovementHintDismiss() {
    this.pushHud();
  }

  tryInteract() {
    if (this.phase === 'seals') {
      const t = this.interactTarget;
      if (!t?.userData.isSeal || t.userData.done) return;
      t.userData.done = true;
      t.visible = false;
      this.sealsDone += 1;
      this.stars += 3;
      this.spawnSparks(t.position, 12, [0xffd700, 0x00cec9]);
      AudioManager.sfx('interact');
      if (this.sealsDone >= this.sealsTotal) {
        this.phase = 'approach';
        this.spawnSparks(this.chest?.position ?? this.hero.position, 18, [0xffd700, 0xff9f43]);
        AudioManager.sfx('found');
      }
      this.pushHud();
      return;
    }

    if (this.phase !== 'approach') return;
    if (!this.interactTarget || !this.chest) return;
    if (!this.hasAcornKey) {
      this.pushHud();
      return;
    }

    // Unlock the chest
    this.phase = 'unlock';
    this.stars += 10;
    this.spawnSparks(this.chest.position, 16, [0xffd700, 0x00cec9]);
    AudioManager.sfx('success');
    this.nextAt = performance.now() + 1500;
    this.pushHud();
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L10Hud) => void) {
    this.nick = nick || 'друг';
    this.lang = lang;
    this.onHud = onHud;

    this.hasAcornKey = readFlag(KEY_ACORN);
    if (!this.hasAcornKey && import.meta.env.DEV) {
      this.spareKeyGiven = true;
      writeFlag(KEY_ACORN, true);
      this.hasAcornKey = true;
    }

    const loader = createGameGltfLoader();

    this.camera.position.set(0, 6, 14);
    await this.setupForestEnvironment(loader, { flatRadius: 19, flatCenterZ: -12 });
    this.scene.add(skyDome());
    this.setupClouds(5, 26, 50);

    this.scene.add(hill(-22, -15, 10, 1.2));
    this.scene.add(hill(24, -25, 12, 1.4));

    for (const [x, z, h, w] of [
      [-40, -60, 20, 14],
      [0, -70, 26, 18],
      [38, -55, 22, 15],
    ] as const) {
      this.scene.add(mountain(x, z, h, w));
    }

    // Zone disc
    this.scene.add(zoneDisc(0, 4, 5, 0xffd700, 0.03));
    this.scene.add(zoneDisc(0, -4, 4, 0xffd700, 0.04));
    this.scene.add(spawnPad(0, 4));
    this.scene.add(await placeWoodSign(loader, -2.5, 2, 0.3, 0xffd700));

    // Chest — Meshy Discover treasure_chest → Kenney kit → procedural.
    // Lid animation stays procedural: GLB chests are single meshes, so we
    // keep a thin gold lid overlay for the open sequence.
    this.chest = makeChest(0, -4);
    const kit = this.assetKit(loader);
    const meshyChest = await loadPropModel(loader, 'treasure_chest.glb', { maxSize: 1.6 });
    const kitChest = meshyChest
      ? null
      : await kit.spawn('platformer', 'chest', {
          maxSize: 1.6,
          position: [0, 0, -4],
          rotationY: Math.PI,
        });
    const chestVisual = meshyChest ?? kitChest;
    if (chestVisual) {
      for (const child of [...this.chest.children]) {
        if (child === this.chest.userData.glow) continue;
        if (child === this.chest.userData.lid) continue;
        if (child === this.chest.userData.lockCap) continue;
        if (child === this.chest.userData.lockBody) continue;
        this.chest.remove(child);
      }
      if (meshyChest) {
        meshyChest.rotation.y = Math.PI;
        groundY(meshyChest);
      }
      this.chest.add(chestVisual);
    }
    this.scene.add(this.chest);
    this.colliders.push({ kind: 'circle', x: 0, z: -4, r: 1.2 });

    // Three golden seals — must gather before the acorn key works (depth beat)
    for (const [x, z] of [[-7, 1], [7, 0], [-2, -9]] as const) {
      const seal = new THREE.Group();
      const disk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.28, 0.08, 16),
        new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.65, roughness: 0.3, emissive: 0xffb300, emissiveIntensity: 0.35 }),
      );
      disk.position.y = 0.4;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.4, 0.65, 20),
        new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      seal.add(disk, ring);
      seal.position.set(x, 0, z);
      seal.userData.isSeal = true;
      seal.userData.done = false;
      this.seals.push(seal);
      this.scene.add(seal);
      this.scene.add(zoneDisc(x, z, 2, 0xffd700, 0.025));
    }

    // Quest marker above chest
    const marker = questMarker(0xffd700, 0xff9f43);
    marker.position.set(0, 0, -4);
    this.scene.add(marker);

    // Acorn key — gen acorn → golden_key → Kenney → procedural
    const meshyKey =
      (await loadPropModel(loader, CAST_PROP_GLB.acorn_key, { maxSize: 0.55 })) ??
      (await loadPropModel(loader, 'golden_key.glb', { maxSize: 0.55 }));
    if (meshyKey) {
      meshyKey.position.set(0, 2.5, -4);
      this.acornKey = meshyKey;
    } else {
      const kitKey = await kit.spawn('platformer', 'key', {
        maxSize: 0.55,
        position: [0, 2.5, -4],
        ground: false,
      });
      this.acornKey = kitKey ?? makeAcornKeyFloat(0, 2.5, -4);
    }
    this.scene.add(this.acornKey);

    // Path arrows
    for (let i = 0; i < 4; i++) {
      const a = pathArrow(0, 3 - i * 1.5, 0);
      this.pathArrows.push(a);
      this.scene.add(a);
    }

    // Decorations
    for (let i = 0; i < 10; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = 2 - (i / 10) * 10;
      this.scene.add(bush(side * (5 + Math.random() * 3), z));
    }
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = 2 - (i / 8) * 10;
      this.scene.add(tulip(side * 4, z, [0xe74c3c, 0xf1c40f, 0xfd79a8, 0xa29bfe][i % 4]));
    }

    // Butterflies
    for (let i = 0; i < 4; i++) {
      const bf = butterfly((Math.random() - 0.5) * 12, -3 - Math.random() * 6, [0xff7675, 0x74b9ff, 0xfdcb6e][i % 3]);
      this.butterflies.push(bf);
      this.scene.add(bf);
    }

    await this.loadTrees(loader, 15, 20, -12, 4.0);
    await this.loadProps(loader, 5, 4, 20, -14);

    await placeMany(this.scene, loader, [
      { key: 'map_scroll', opts: { x: -3.2, z: -2, maxSize: 0.6, y: 0.15 } },
      { key: 'lantern', opts: { x: 3.5, z: -1.5, maxSize: 0.7 } },
      { key: 'pinecone', opts: { x: 2.2, z: 1.5, maxSize: 0.3 } },
    ]);
    await placeAmbientCritters(this.scene, loader, [
      { key: 'squirrel', x: 5, z: -6, rotY: -1.0, h: 0.9 },
      { key: 'owl', x: -6, z: -5, rotY: 0.7, h: 0.7 },
    ]);

    this.hero.position.set(0, 0, 4);
    this.scene.add(this.hero);
    if (!(await this.loadHero(loader))) return;
    this.activate(() => {
      this.setupGuideArrow();
      this.setupQuality();
      this.bindKeys();
      this.resize();
      addEventListener('resize', this.resize);

      this.phase = 'intro';
      this.introI = 0;
      this.nextAt = performance.now() + 600;
      this.pushHud();
      this.loop();
    });
  }

  private pushHud() {
    const n = this.nick;
    let speaker = 'Барсик';
    let line = '';
    let objective = '';
    const p = this.phase;

    if (p === 'intro') {
      const lines = !this.hasAcornKey
        ? [
            this.copy('Сундук в конце леса!', 'Орман соңындағы сандық!'),
            this.copy(`Нужен жёлудь-ключ от белочки (уровень 5), ${n}.`, `Тиіннің жаңғақ-кілті керек (5-деңгей), ${n}.`),
            this.copy('Вернись к белочке или открой уровень 5!', 'Тиінге орал немесе 5-деңгейді аш!'),
          ]
        : [
            this.copy('Сундук охраняют три золотые печати!', 'Сандықты үш алтын мөр қорғайды!'),
            this.copy(`Собери печати вокруг поляны, ${n}.`, `Алаңдағы мөрлерді жина, ${n}.`),
            this.copy('Потом жёлудь-ключ откроет замок!', 'Сосын жаңғақ-кілт құлыпты ашады!'),
          ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = !this.hasAcornKey
        ? this.copy('Нужен жёлудь-ключ (ур. 5)', 'Жаңғақ-кілт керек (5-деңгей)')
        : this.copy('🥇 Собери 3 печати', '🥇 3 мөр жина');
    } else if (p === 'seals') {
      line = this.copy('Ищи золотые круги у кустов — это печати сундука.', 'Бұталардағы алтын шеңберлерді ізде — сандық мөрлері.');
      objective = this.copy(`🥇 Печати: ${this.sealsDone}/${this.sealsTotal}`, `🥇 Мөр: ${this.sealsDone}/${this.sealsTotal}`);
    } else if (p === 'approach') {
      line = this.hasAcornKey
        ? this.copy('Печати на месте! Жёлудь-ключ подходит — открой сундук!', 'Мөрлер орнында! Жаңғақ-кілт сәйкес — сандықты аш!')
        : this.copy('Без жёлудь-ключа сундук не откроется.', 'Жаңғақ-кілтсіз сандық ашылмайды.');
      objective = this.hasAcornKey
        ? (this.isMobile
          ? this.copy('Нажми лапку, чтобы открыть', 'Ашу үшін табан түймесін бас')
          : this.copy('Нажми E, чтобы открыть', 'Ашу үшін E пернесін бас'))
        : this.copy('Найди ключ на уровне 5', 'Кілтті 5-деңгейден тап');
    } else if (p === 'unlock') {
      speaker = this.copy('Белочка', 'Тиін');
      line = this.copy('Мой жёлудь открыл сундук! Ура!', 'Менің жаңғағым сандықты ашты! Ура!');
      objective = this.copy('🔓 Сундук открывается...', '🔓 Сандық ашылуда...');
    } else if (p === 'open') {
      line = this.copy('Звёзды! Редкий друг «Ягодка»! И карта к горам!', 'Жұлдыздар! Сирек дос «Жидек»! Тауға карта!');
      objective = this.copy('🎉 Сундук открыт!', '🎉 Сандық ашылды!');
    } else if (p === 'outro') {
      speaker = this.copy('Айя', 'Айя');
      line = this.copy('Снег! Я никогда не видела снег! Пора прощаться с лесом и идти к горам!', 'Қар! Мен қар көрмегем! Орманмен қоштасып, тауға бару уақыты!');
      objective = this.copy('🗺️ Карта к Ледяной долине!', '🗺️ Мұзды аңғарға карта!');
    }

    this.onHud?.({
      phase: p,
      speaker,
      line,
      objective,
      hasAcornKey: this.hasAcornKey,
      spareKeyGiven: this.spareKeyGiven,
      chestOpen: this.chestOpen,
      sealsDone: this.sealsDone,
      sealsTotal: this.sealsTotal,
      stars: this.stars,
      canInteract: Boolean(this.interactTarget),
      showMoveHint: !this.hasTakenFirstStep && (p === 'intro' || p === 'seals'),
      showActionHint: Boolean(this.interactTarget),
      outro: p === 'outro',
    });
  }

  private nearestInteract(): THREE.Object3D | null {
    if (this.phase === 'seals') {
      const hp = this.hero.position;
      let best: THREE.Object3D | null = null;
      let bestD = 2.4;
      for (const s of this.seals) {
        if (s.userData.done) continue;
        const d = hp.distanceTo(s.position);
        if (d < bestD) { bestD = d; best = s; }
      }
      return best;
    }
    if (!this.chest || this.chestOpen) return null;
    const d = this.hero.position.distanceTo(this.chest.position);
    if (d < 2.5 && this.phase === 'approach') return this.chest;
    return null;
  }

  private objectiveWorldPos(): THREE.Vector3 | null {
    if (this.phase === 'seals') {
      const next = this.seals.find((s) => !s.userData.done);
      return next?.position.clone() ?? null;
    }
    if (this.chest && (this.phase === 'intro' || this.phase === 'approach')) {
      return this.chest.position.clone();
    }
    return null;
  }

  protected loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.renderPausedFrame()) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();

    // Intro progression
    if (this.phase === 'intro' && now > this.nextAt) {
      this.introI += 1;
      if (this.introI >= 3) {
        this.phase = this.hasAcornKey ? 'seals' : 'approach';
        this.nextAt = now + 500;
        this.pushHud();
      } else {
        this.nextAt = now + 2400;
        this.pushHud();
      }
    }

    // Unlock → open transition
    if (this.phase === 'unlock' && now > this.nextAt) {
      this.phase = 'open';
      this.chestOpen = true;
      this.lidOpenTime = now;
      this.stars += 20;
      this.spawnSparks(this.chest!.position, 50, [0xffd700, 0xff6b6b]);
      this.spawnSparks(this.chest!.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 30, [0x00cec9, 0xa29bfe]);
      AudioManager.sfx('success');

      // Rare friend «Ягодка» pops from the chest when Meshy model is present
      if (!this.yagodka) {
        void loadCharModel(createGameGltfLoader(), 'yagodka.glb', 1.1).then((friend) => {
          if (!friend || !this.chest || this.disposed) return;
          friend.position.copy(this.chest.position);
          friend.position.y = 0;
          friend.position.z += 1.2;
          groundY(friend);
          this.yagodka = friend;
          this.scene.add(friend);
          this.spawnSparks(friend.position, 20, [0xfd79a8, 0xffd700]);
        });
      }

      // Animate lid opening
      if (this.chest) {
        const lid = this.chest.userData.lid as THREE.Mesh;
        lid.userData.opening = true;
        // Hide acorn key (used)
        if (this.acornKey) this.acornKey.visible = false;
        // Hide lock
        const lockCap = this.chest.userData.lockCap as THREE.Mesh;
        const lockBody = this.chest.userData.lockBody as THREE.Mesh;
        lockCap.visible = false;
        lockBody.visible = false;
      }

      this.nextAt = now + 3000;
      this.pushHud();
    }

    // Open → outro transition
    if (this.phase === 'open' && now > this.nextAt) {
      this.phase = 'outro';
      this.pushHud();
    }

    const canMove = !['intro', 'outro'].includes(this.phase);
    this.updateMovement(dt, canMove, this.baseSpeed, -12, 12, -12, 8);

    // Chest glow pulse
    if (this.chest) {
      const glow = this.chest.userData.glow as THREE.Mesh;
      (glow.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(now * 0.003) * 0.15;

      // Lid opening animation
      const lid = this.chest.userData.lid as THREE.Mesh;
      if (lid.userData.opening) {
        const elapsed = now - this.lidOpenTime;
        if (elapsed < 800) {
          lid.rotation.x = -Math.PI * 0.6 * (elapsed / 800);
          lid.position.y = 0.95 + Math.sin((elapsed / 800) * Math.PI) * 0.3;
        } else {
          lid.rotation.x = -Math.PI * 0.6;
          lid.position.y = 1.1;
        }
      }
    }

    // Acorn key bobbing
    if (this.acornKey && this.acornKey.visible) {
      this.acornKey.position.y = 2.5 + Math.sin(now * 0.003) * 0.15;
      this.acornKey.rotation.y += dt * 1.5;
    }

    // Butterflies
    for (const b of this.butterflies) {
      const ph = (b.userData.phase as number) + now * 0.001;
      b.position.x = (b.userData.ox as number) + Math.sin(ph) * 1.5;
      b.position.z = (b.userData.oz as number) + Math.cos(ph * 0.8) * 1.5;
      b.position.y = 1.2 + Math.sin(ph * 1.5) * 0.4;
      b.rotation.y = ph;
    }

    // Guide arrow
    const obj = this.objectiveWorldPos();
    this.updateGuideArrow(now, obj, ['intro', 'outro', 'unlock', 'open']);

    // Interaction detection
    const prev = this.interactTarget;
    this.interactTarget = this.nearestInteract();
    if (prev !== this.interactTarget) this.pushHud();

    this.updateAmbient(dt, now);

    // Camera
    if (this.phase === 'intro') {
      const idx = Math.min(this.introI, 2);
      const introPos = [
        new THREE.Vector3(0, 6, 14),
        new THREE.Vector3(0, 5.5, 12),
        new THREE.Vector3(0, 5, 10),
      ];
      const introLook = [
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 1, -2),
        new THREE.Vector3(0, 0.5, -4),
      ];
      this.camera.position.lerp(introPos[idx], 1 - Math.pow(0.02, dt));
      this.camera.lookAt(introLook[idx]);
    } else {
      const target = new THREE.Vector3(this.hero.position.x * 0.3, 5.5, this.hero.position.z + 9);
      this.camera.position.lerp(target, 1 - Math.pow(0.0015, dt));
      this.camera.lookAt(this.hero.position.x * 0.2, 1.2, this.hero.position.z - 2);
    }

    this.renderFrame();
  };
}

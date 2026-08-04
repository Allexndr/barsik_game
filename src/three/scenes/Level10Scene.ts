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
  makeGrassTexture,
  loadCharModel,
  loadPropModel,
  placeWoodSign,
} from './BaseLevelScene';
import { groundY } from '../modelUtils';
import { createPlushSquirrel, createPlushHedgehog } from '../PlushAnimals';
import { createPlushCharacter } from '../PlushCharacter';
import { ZHULDYZ_LOOK } from '../characterLooks';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { placeMany, placeAmbientCritters } from '../s1Place';

/**
 * Level 11 «Прощание с лесом» — GDD Level 10:
 * Explore + farewell. Visit 4 familiar places, say goodbye to NPCs.
 * Circular route with bonus stars.
 */

export type L11Phase = 'intro' | 'gifts' | 'farewell' | 'outro';

export interface L11Hud extends BaseHud {
  farewellDone: number;
  farewellTotal: number;
  giftsDone: number;
  giftsTotal: number;
  carryingGift: boolean;
}

interface FarewellSpot {
  pos: THREE.Vector3;
  npcName: string;
  npcNameKk: string;
  farewellRu: string;
  farewellKk: string;
  done: boolean;
  gifted: boolean;
  marker: THREE.Group;
}

function makeSnowman(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), snowMat);
  bottom.position.y = 0.6;
  bottom.castShadow = true;
  const mid = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), snowMat);
  mid.position.y = 1.4;
  mid.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), snowMat);
  head.position.y = 1.95;
  head.castShadow = true;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 6), new THREE.MeshStandardMaterial({ color: 0xff6f00 }));
  nose.position.set(0, 1.95, 0.3);
  nose.rotation.x = Math.PI / 2;
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), new THREE.MeshStandardMaterial({ color: 0x333 }));
  eyeL.position.set(0.1, 2.02, 0.27);
  const eyeR = eyeL.clone();
  eyeR.position.x = -0.1;
  g.add(bottom, mid, head, nose, eyeL, eyeR);
  g.position.set(x, 0, z);
  return g;
}

export class Level10Scene extends BaseLevelScene {
  private phase: L11Phase = 'intro';
  private onHud: ((h: L11Hud) => void) | null = null;
  private introI = 0;
  private nextAt = 0;
  private spots: FarewellSpot[] = [];
  private farewellDone = 0;
  private readonly farewellTotal = 4;
  private activeFarewell: FarewellSpot | null = null;
  private farewellUntil = 0;
  private butterflies: THREE.Group[] = [];
  private trailMeshes: THREE.Mesh[] = [];
  private giftPile: THREE.Object3D | null = null;
  private giftsDone = 0;
  private readonly giftsTotal = 4;
  private carryingGift = false;
  private carryingMesh: THREE.Mesh | null = null;

  protected currentPhase() { return this.phase; }

  protected onMovementHintDismiss() {
    this.pushHud();
  }

  tryInteract() {
    if (this.phase === 'gifts') {
      if (this.interactTarget === this.giftPile && !this.carryingGift && this.giftsDone < this.giftsTotal) {
        this.carryingGift = true;
        this.giftsDone += 1;
        const berry = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 10, 10),
          new THREE.MeshStandardMaterial({ color: 0xe84393, emissive: 0xad1457, emissiveIntensity: 0.45 }),
        );
        berry.position.set(0.25, 1.45, 0);
        this.carryingMesh = berry;
        this.hero.add(berry);
        this.spawnSparks(this.giftPile!.position, 8, [0xe84393, 0xffd700]);
        this.phase = 'farewell';
        this.pushHud();
        return;
      }
    }

    if (this.phase !== 'farewell') return;
    const t = this.interactTarget;
    if (!t) return;
    const spot = this.spots.find(s => s.marker === t && !s.done);
    if (!spot) return;

    if (!spot.gifted) {
      if (!this.carryingGift) {
        this.phase = 'gifts';
        this.pushHud();
        return;
      }
      spot.gifted = true;
      this.carryingGift = false;
      if (this.carryingMesh) {
        this.hero.remove(this.carryingMesh);
        this.carryingMesh.geometry.dispose();
        (this.carryingMesh.material as THREE.Material).dispose();
        this.carryingMesh = null;
      }
      this.stars += 2;
      this.spawnSparks(spot.pos, 10, [0xe84393, 0xf1c40f]);
      this.activeFarewell = spot;
      this.farewellUntil = performance.now() + 1600;
      // After gift, still need farewell hug on same spot
      this.pushHud();
      return;
    }

    spot.done = true;
    this.farewellDone++;
    this.activeFarewell = spot;
    this.farewellUntil = performance.now() + 2200;
    this.stars += 3;
    this.spawnSparks(spot.pos, 12, [0xf1c40f, 0xa29bfe]);
    spot.marker.visible = false;
    if (this.farewellDone >= this.farewellTotal) {
      this.phase = 'outro';
      this.stars += 3;
      this.spawnSparks(new THREE.Vector3(0, 2, 0), 20, [0xffd700, 0x00cec9]);
    } else if (this.giftsDone < this.giftsTotal) {
      this.phase = 'gifts';
    }
    this.pushHud();
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L11Hud) => void) {
    this.nick = nick || 'друг';
    this.lang = lang;
    this.onHud = onHud;
    const loader = createGameGltfLoader();

    this.camera.position.set(0, 8, 18);
    this.setupLighting(0x90a4ae, 0xfff8e7);
    this.setupGround(makeGrassTexture());
    this.scene.add(skyDome('#5c8a9e', '#8ab8c8', '#d0e8f0'));
    this.setupClouds(5, 26, 50);

    this.scene.add(hill(-22, -15, 10, 1.2));
    this.scene.add(hill(24, -25, 12, 1.4));

    for (const [x, z, h, w] of [
      [-40, -60, 20, 14],
      [38, -55, 22, 15],
    ] as const) {
      this.scene.add(mountain(x, z, h, w));
    }

    this.scene.add(zoneDisc(0, 6, 5, 0x81c784, 0.025));
    this.scene.add(spawnPad(0, 6));
    this.scene.add(await placeWoodSign(loader, -2.5, 4, 0.3, 0x81c784));

    // Berry gift basket in the center — pick one gift before each farewell
    this.giftPile = new THREE.Group();
    const basket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.65, 0.45, 12),
      new THREE.MeshStandardMaterial({ color: 0xc47a3a, roughness: 0.9 }),
    );
    basket.position.y = 0.22;
    this.giftPile.add(basket);
    for (let i = 0; i < 4; i++) {
      const berry = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xe84393, emissive: 0xad1457, emissiveIntensity: 0.35 }),
      );
      berry.position.set(Math.cos((i / 4) * Math.PI * 2) * 0.25, 0.5, Math.sin((i / 4) * Math.PI * 2) * 0.25);
      this.giftPile.add(berry);
    }
    this.giftPile.position.set(0, 0, -4);
    this.giftPile.userData.isGiftPile = true;
    this.scene.add(this.giftPile);
    this.scene.add(zoneDisc(0, -4, 2.5, 0xe84393, 0.03));

    // 4 farewell spots — circular route revisiting known places
    const spotConfigs: [number, number, string, string, string, string, string | null][] = [
      [-6, 0, 'Садовник', 'Бағбан', 'Береги наш сад, Барсик. Мы будем ждать!', 'Бағбаны сақта, Барсик. Күтеміз!', 'zhuldyz.glb'],
      [6, -2, 'Пенёк', 'Түпкі', 'Приходи — загадки не кончаются!', 'Кел — жұмбақтар бітпейді!', null],
      [-5, -8, 'Ёжик', 'Кірпі', 'Спасибо, что нашёл меня тогда!', 'Сол кезде мені тапқаның үшін рахмет!', 'hedgehog.glb'],
      [5, -10, 'Белочка', 'Тиін', 'Жёлудь сработал! Увидимся в горах!', 'Жаңғақ жарамды! Тауда кездесеміз!', 'squirrel.glb'],
    ];

    for (let i = 0; i < spotConfigs.length; i++) {
      const [x, z, nameRu, nameKk, farewellRu, farewellKk, glbFile] = spotConfigs[i];
      const marker = questMarker(0xf1c40f, 0xff9f43);
      marker.position.set(x, 0, z);
      this.scene.add(marker);
      this.spots.push({
        pos: new THREE.Vector3(x, 0, z),
        npcName: nameRu,
        npcNameKk: nameKk,
        farewellRu,
        farewellKk,
        done: false,
        gifted: false,
        marker,
      });
      this.colliders.push({ kind: 'circle', x, z, r: 1.0 });

      let npc: THREE.Object3D | null = null;
      if (glbFile) {
        npc = await loadCharModel(loader, glbFile, glbFile.includes('hedgehog') || glbFile.includes('squirrel') ? 0.95 : 1.25);
      }
      if (!npc) {
        if (i === 0) npc = createPlushCharacter({ ...ZHULDYZ_LOOK, height: 1.2 });
        else if (i === 2) npc = createPlushHedgehog();
        else if (i === 3) npc = createPlushSquirrel();
        else {
          // Stump stand-in for Пенёк
          const stump = new THREE.Group();
          const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.45, 0.55, 0.55, 10),
            new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 1 }),
          );
          trunk.position.y = 0.28;
          stump.add(trunk);
          npc = stump;
        }
      }
      npc.position.set(x + 0.9, 0, z);
      npc.rotation.y = Math.atan2(-x, -z);
      groundY(npc);
      this.scene.add(npc);
    }

    // Glowing trail between spots (circular revisit path)
    for (let i = 0; i < this.spots.length; i++) {
      const a = this.spots[i].pos;
      const b = this.spots[(i + 1) % this.spots.length].pos;
      const steps = 4;
      for (let s = 1; s <= steps; s++) {
        const t = s / (steps + 1);
        const trail = new THREE.Mesh(
          new THREE.CircleGeometry(0.35, 12),
          new THREE.MeshBasicMaterial({ color: 0x81c784, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
        );
        trail.rotation.x = -Math.PI / 2;
        trail.position.set(a.x + (b.x - a.x) * t, 0.04, a.z + (b.z - a.z) * t);
        this.trailMeshes.push(trail);
        this.scene.add(trail);
      }
    }

    // Snowman near exit (foreshadowing winter)
    const snowGlb = await loadPropModel(loader, 'snowman.glb', { height: 1.5 });
    if (snowGlb) {
      snowGlb.position.set(0, 0, -14);
      groundY(snowGlb);
      this.scene.add(snowGlb);
    } else {
      this.scene.add(makeSnowman(0, -14));
    }

    // Decorations
    for (let i = 0; i < 12; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = 4 - (i / 12) * 16;
      this.scene.add(bush(side * (7 + Math.random() * 3), z));
    }
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = 4 - (i / 8) * 16;
      this.scene.add(tulip(side * 5, z, [0xe74c3c, 0xf1c40f, 0xfd79a8, 0xa29bfe][i % 4]));
    }

    for (let i = 0; i < 4; i++) {
      const bf = butterfly((Math.random() - 0.5) * 14, -4 - Math.random() * 8, [0xff7675, 0x74b9ff, 0xfdcb6e][i % 3]);
      this.butterflies.push(bf);
      this.scene.add(bf);
    }

    await this.loadTrees(loader, 18, 22, -14, 4.0);
    await this.loadProps(loader, 5, 4, 22, -16);

    // Farewell clearing — stump landmark + forest friends peeking
    await placeMany(this.scene, loader, [
      { key: 'stump', opts: { x: -4.5, z: -2, maxSize: 1.2 } },
      { key: 'mushroom', opts: { x: -3.2, z: -1.2, maxSize: 0.4 } },
      { key: 'berry', opts: { x: 5, z: -4, maxSize: 0.35 } },
      { key: 'map_scroll', opts: { x: 0, z: -8, maxSize: 0.55, y: 0.12 } },
    ]);
    await placeAmbientCritters(this.scene, loader, [
      { key: 'fox', x: 6.5, z: -6, rotY: -1.2, h: 0.85 },
      { key: 'rabbit', x: -7, z: -8, rotY: 0.5, h: 0.7 },
      { key: 'owl', x: 8, z: 0, rotY: -2.0, h: 0.7 },
    ]);

    this.hero.position.set(0, 0, 6);
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
      const lines = [
        this.copy('Пора прощаться с лесом...', 'Орманмен қоштасу уақыты...'),
        this.copy(`Сначала возьми ягодный подарок из корзины, ${n}.`, `Алдымен себеттен жидектік сыйлық ал, ${n}.`),
        this.copy('Каждому другу — подарок, потом тёплое прощание!', 'Әр досқа — сыйлық, сосын жылы қоштасу!'),
      ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = this.copy('🎁 Возьми подарок из корзины', '🎁 Себеттен сыйлық ал');
    } else if (p === 'gifts') {
      line = this.carryingGift
        ? this.copy('Отнеси ягоду другу со звёздочкой!', 'Жидекті жұлдызды досқа апар!')
        : this.copy('Подойди к корзине и возьми ягодный подарок.', 'Себетке жақындап, жидектік сыйлық ал.');
      objective = this.copy(
        `🎁 Подарки: ${this.giftsDone}/${this.giftsTotal}${this.carryingGift ? ' · несёшь' : ''}`,
        `🎁 Сыйлық: ${this.giftsDone}/${this.giftsTotal}${this.carryingGift ? ' · көтеріп келесің' : ''}`,
      );
    } else if (p === 'farewell') {
      if (this.activeFarewell && performance.now() < this.farewellUntil) {
        speaker = this.lang === 'kk' ? this.activeFarewell.npcNameKk : this.activeFarewell.npcName;
        line = this.activeFarewell.gifted && !this.activeFarewell.done
          ? this.copy('Спасибо за ягоду! Обними на прощание!', 'Жидек үшін рахмет! Қоштасуға құшақта!')
          : (this.lang === 'kk' ? this.activeFarewell.farewellKk : this.activeFarewell.farewellRu);
      } else {
        this.activeFarewell = null;
        const next = this.spots.find(s => !s.done);
        const name = next ? (this.lang === 'kk' ? next.npcNameKk : next.npcName) : '';
        line = this.carryingGift
          ? this.copy(`Отдай подарок: ${name}`, `Сыйлықты бер: ${name}`)
          : name
            ? this.copy(`Попрощайся с: ${name}`, `Қоштас: ${name}`)
            : this.copy('Все друзья попрощались!', 'Барлық достар қоштасты!');
      }
      objective = this.copy(`👋 Прощание: ${this.farewellDone}/${this.farewellTotal}`, `👋 Қоштасу: ${this.farewellDone}/${this.farewellTotal}`);
    } else if (p === 'outro') {
      speaker = this.copy('Садовник', 'Бағбан');
      line = this.copy(
        'До свидания, Барсик! За горами — снег и новые приключения!',
        'Сау бол, Барсик! Таулардың артында — қар және жаңа оқиғалар!',
      );
      objective = this.copy('❄️ Дорога к Ледяной долине', '❄️ Мұзды аңғарға жол');
    }

    this.onHud?.({
      phase: p,
      speaker,
      line,
      objective,
      farewellDone: this.farewellDone,
      farewellTotal: this.farewellTotal,
      giftsDone: this.giftsDone,
      giftsTotal: this.giftsTotal,
      carryingGift: this.carryingGift,
      stars: this.stars,
      canInteract: Boolean(this.interactTarget),
      showMoveHint: !this.hasTakenFirstStep && (p === 'intro' || p === 'gifts'),
      showActionHint: Boolean(this.interactTarget),
      outro: p === 'outro',
    });
  }

  private nearestInteract(): THREE.Object3D | null {
    const hp = this.hero.position;
    let best: THREE.Object3D | null = null;
    let bestD = 2.5;

    if ((this.phase === 'gifts' || this.phase === 'farewell') && !this.carryingGift && this.giftPile && this.giftsDone < this.giftsTotal) {
      const d = hp.distanceTo(this.giftPile.position);
      if (d < bestD) { bestD = d; best = this.giftPile; }
    }

    for (const spot of this.spots) {
      if (spot.done) continue;
      const d = hp.distanceTo(spot.pos);
      if (d >= bestD) continue;
      if (this.phase === 'farewell' && this.carryingGift && !spot.gifted) {
        bestD = d; best = spot.marker;
      } else if (this.phase === 'farewell' && !this.carryingGift && spot.gifted) {
        bestD = d; best = spot.marker;
      }
    }

    return best;
  }

  private objectiveWorldPos(): THREE.Vector3 | null {
    if (this.phase === 'gifts' && !this.carryingGift && this.giftPile) {
      return this.giftPile.position.clone();
    }
    if (this.phase === 'gifts' || this.phase === 'farewell') {
      const hp = this.hero.position;
      let best: THREE.Vector3 | null = null;
      let bestD = Infinity;
      for (const spot of this.spots) {
        if (spot.done) continue;
        if (this.carryingGift && spot.gifted) continue;
        if (!this.carryingGift && !spot.gifted && this.phase === 'farewell') continue;
        const d = hp.distanceTo(spot.pos);
        if (d < bestD) { bestD = d; best = spot.pos.clone(); }
      }
      return best;
    }
    return null;
  }

  protected loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.renderPausedFrame()) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();

    if (this.phase === 'intro' && now > this.nextAt) {
      this.introI += 1;
      if (this.introI >= 3) {
        this.phase = 'gifts';
        this.nextAt = now + 500;
        this.pushHud();
      } else {
        this.nextAt = now + 2400;
        this.pushHud();
      }
    }

    const canMove = !['intro', 'outro'].includes(this.phase);
    this.updateMovement(dt, canMove, this.baseSpeed, -12, 12, -16, 8);

    for (const b of this.butterflies) {
      const ph = (b.userData.phase as number) + now * 0.001;
      b.position.x = (b.userData.ox as number) + Math.sin(ph) * 1.5;
      b.position.z = (b.userData.oz as number) + Math.cos(ph * 0.8) * 1.5;
      b.position.y = 1.2 + Math.sin(ph * 1.5) * 0.4;
      b.rotation.y = ph;
    }

    for (const t of this.trailMeshes) {
      (t.material as THREE.MeshBasicMaterial).opacity = 0.2 + Math.sin(now * 0.003 + t.position.x) * 0.15;
    }

    for (const spot of this.spots) {
      if (!spot.done) {
        spot.marker.position.y = Math.sin(now * 0.004 + spot.pos.x) * 0.08;
      }
    }

    if (this.activeFarewell && now > this.farewellUntil) {
      this.activeFarewell = null;
      this.pushHud();
    }

    const obj = this.objectiveWorldPos();
    this.updateGuideArrow(now, obj, ['intro', 'outro']);

    const prev = this.interactTarget;
    this.interactTarget = this.nearestInteract();
    if (prev !== this.interactTarget) this.pushHud();

    this.updateAmbient(dt, now);

    if (this.phase === 'intro') {
      const idx = Math.min(this.introI, 2);
      const introPos = [new THREE.Vector3(0, 8, 18), new THREE.Vector3(0, 7, 15), new THREE.Vector3(0, 6, 12)];
      const introLook = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, -3), new THREE.Vector3(0, 0.5, -6)];
      this.camera.position.lerp(introPos[idx], 1 - Math.pow(0.02, dt));
      this.camera.lookAt(introLook[idx]);
    } else {
      const target = new THREE.Vector3(this.hero.position.x * 0.3, 6, this.hero.position.z + 10);
      this.camera.position.lerp(target, 1 - Math.pow(0.0015, dt));
      this.camera.lookAt(this.hero.position.x * 0.2, 1.2, this.hero.position.z - 3);
    }

    this.renderFrame();
  };
}

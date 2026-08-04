import * as THREE from 'three';
import {
  BaseLevelScene,
  type BaseHud,
  zoneDisc,
  spawnPad,
  questMarker,
  pathArrow,
  loadCharModel,
  loadPropModel,
  placeWoodSign,
} from './BaseLevelScene';
import { KEY_ICE, writeFlag, CAST_PROP_GLB } from '../castModels';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { placeMany } from '../s1Place';

/**
 * Level 13 «Ледяные скульптуры» — GDD Level 13:
 * Find 5 ice shards, deliver to ice master. Progressive Barsik sculpture.
 */

export type L13Phase = 'intro' | 'search' | 'outro';

export interface L13Hud extends BaseHud {
  shardsFound: number;
  shardsDelivered: number;
  shardsTotal: number;
  carrying: boolean;
}

interface IceShard {
  mesh: THREE.Object3D;
  picked: boolean;
}

function makeIceShard(x: number, z: number, tpl?: THREE.Object3D | null): IceShard {
  let mesh: THREE.Object3D;
  if (tpl) {
    mesh = tpl.clone(true);
    mesh.position.set(x, 0.45, z);
  } else {
    mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28),
      new THREE.MeshStandardMaterial({
        color: 0x4fc3f7, emissive: 0x4fc3f7, emissiveIntensity: 0.55,
        transparent: true, opacity: 0.88,
      }),
    );
    mesh.position.set(x, 0.45, z);
    mesh.castShadow = true;
  }
  return { mesh, picked: false };
}

function makeSculpture(): THREE.Group {
  const g = new THREE.Group();
  const iceMat = new THREE.MeshStandardMaterial({
    color: 0xb3e5fc, roughness: 0.15, metalness: 0.25, transparent: true, opacity: 0.85,
  });
  const parts: THREE.Mesh[] = [];
  // Body, head, ears — revealed 1/5 per shard
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), iceMat);
  body.position.y = 0.55;
  body.visible = false;
  parts.push(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), iceMat);
  head.position.y = 1.15;
  head.visible = false;
  parts.push(head);
  const earL = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 6), iceMat);
  earL.position.set(0.22, 1.35, 0);
  earL.visible = false;
  parts.push(earL);
  const earR = earL.clone();
  earR.position.x = -0.22;
  earR.visible = false;
  parts.push(earR);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 6), iceMat);
  tail.position.set(0, 0.45, -0.35);
  tail.rotation.x = Math.PI / 3;
  tail.visible = false;
  parts.push(tail);
  g.add(...parts);
  g.userData.parts = parts;
  return g;
}

export class Level13Scene extends BaseLevelScene {
  private phase: L13Phase = 'intro';
  private onHud: ((h: L13Hud) => void) | null = null;
  private introI = 0;
  private nextAt = 0;
  private shards: IceShard[] = [];
  private shardsDelivered = 0;
  private readonly shardsTotal = 5;
  private carrying = false;
  private masterPos = new THREE.Vector3(0, 0, -8);
  private master: THREE.Object3D | null = null;
  private masterMarker: THREE.Object3D | null = null;
  private sculpture: THREE.Group | null = null;
  private iceKey: THREE.Object3D | null = null;

  protected currentPhase() { return this.phase; }

  protected onMovementHintDismiss() {
    this.pushHud();
  }

  tryInteract() {
    if (this.phase !== 'search') return;
    const t = this.interactTarget;
    if (!t) return;

    const shard = this.shards.find(s => s.mesh === t && !s.picked);
    if (shard && !this.carrying) {
      shard.picked = true;
      shard.mesh.visible = false;
      this.carrying = true;
      this.stars += 1;
      this.spawnSparks(shard.mesh.position, 8, [0x4fc3f7, 0xe1f5fe]);
      this.pushHud();
      return;
    }

    if (this.carrying && t === this.masterMarker) {
      this.carrying = false;
      this.shardsDelivered++;
      this.stars += 3;
      this.updateSculpture();
      this.spawnSparks(this.masterPos, 12, [0x4fc3f7, 0xffd700]);
      if (this.shardsDelivered >= this.shardsTotal) {
        this.phase = 'outro';
        this.stars += 6;
        if (this.iceKey) this.iceKey.visible = true;
        writeFlag(KEY_ICE, true);
        this.spawnSparks(this.masterPos, 24, [0xffd700, 0x00cec9]);
      }
      this.pushHud();
    }
  }

  private updateSculpture() {
    if (!this.sculpture) return;
    const parts = this.sculpture.userData.parts as THREE.Mesh[];
    for (let i = 0; i < parts.length; i++) {
      parts[i].visible = i < this.shardsDelivered;
    }
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L13Hud) => void) {
    this.nick = nick || 'друг';
    this.lang = lang;
    this.onHud = onHud;
    const loader = createGameGltfLoader();

    this.camera.position.set(0, 7, 16);
    await this.setupWinterEnvironment(loader);

    this.scene.add(zoneDisc(0, 4, 6, 0xe1f5fe, 0.03));
    this.scene.add(zoneDisc(0, -8, 4, 0x4fc3f7, 0.04));
    this.scene.add(spawnPad(0, 4));
    this.scene.add(await placeWoodSign(loader, -2.5, 2, 0.3, 0xe1f5fe));

    const podium = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.3, 0.35, 12),
      new THREE.MeshStandardMaterial({ color: 0xb0bec5, roughness: 0.8 }),
    );
    podium.position.copy(this.masterPos);
    podium.position.y = 0.17;
    this.scene.add(podium);
    this.colliders.push({ kind: 'circle', x: 0, z: -8, r: 1.3 });

    // Ice master NPC — Meshy when ready
    const masterGlb = await loadCharModel(loader, 'ice_master.glb', 1.35);
    if (masterGlb) {
      masterGlb.position.set(-1.4, 0, -7.2);
      this.master = masterGlb;
      this.scene.add(masterGlb);
    }

    // Optional ice rabbit prop beside podium
    const iceRabbit = await loadPropModel(loader, 'ice_rabbit.glb', { height: 0.9 });
    if (iceRabbit) {
      iceRabbit.position.set(1.5, 0, -7.5);
      this.scene.add(iceRabbit);
    }

    this.sculpture = makeSculpture();
    this.sculpture.position.copy(this.masterPos);
    this.sculpture.position.y = 0.35;
    this.scene.add(this.sculpture);

    this.masterMarker = questMarker(0x4fc3f7, 0x81d4fa);
    this.masterMarker.position.copy(this.masterPos);
    this.scene.add(this.masterMarker);

    // Ice key reward (for L16) — gen ice key → procedural
    const iceKeyGlb =
      (await loadPropModel(loader, CAST_PROP_GLB.ice_key_prop, { maxSize: 0.55 })) ??
      (await loadPropModel(loader, CAST_PROP_GLB.golden_key, { maxSize: 0.5 }));
    if (iceKeyGlb) {
      this.iceKey = iceKeyGlb;
      this.iceKey.position.set(0.8, 1.6, -8);
    } else {
      this.iceKey = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.18),
        new THREE.MeshStandardMaterial({ color: 0x4fc3f7, emissive: 0x81d4fa, emissiveIntensity: 0.8 }),
      );
      this.iceKey.position.set(0.8, 1.6, -8);
    }
    this.iceKey.visible = false;
    this.scene.add(this.iceKey);

    const crystalTpl = await loadPropModel(loader, CAST_PROP_GLB.ice_crystal, { maxSize: 0.5 });
    const positions: [number, number][] = [
      [-8, 0], [8, -2], [-7, -6], [7, -10], [0, -14],
    ];
    for (const [x, z] of positions) {
      const shard = makeIceShard(x, z, crystalTpl);
      this.shards.push(shard);
      this.scene.add(shard.mesh);
      const a = pathArrow(x * 0.3, z + 1.5, Math.atan2(-8 - z, -x));
      this.pathArrows.push(a);
      this.scene.add(a);
    }

    await placeMany(this.scene, loader, [
      { key: 'pine_tree', opts: { x: -10, z: -4, maxSize: 2.5 } },
      { key: 'rock_snow', opts: { x: 9, z: -8, maxSize: 1.4 } },
      { key: 'snowflake', opts: { x: -4, z: -12, maxSize: 0.45, y: 1.3 } },
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
      const lines = [
        this.copy('Мастер льда!', 'Мұз шебері!'),
        this.copy(`Найди 5 ледяных осколков, ${n}!`, `5 мұз сынығын тап, ${n}!`),
        this.isMobile
          ? this.copy('Подними лапкой → отнеси мастеру. Скульптура растёт!', 'Табанмен көтер → шеберге әкел. Мүсін өседі!')
          : this.copy('Подними (E) → отнеси мастеру (E). Скульптура растёт!', 'Көтер (E) → шеберге әкел (E). Мүсін өседі!'),
      ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = this.copy('Найди 5 осколков, отнеси мастеру', '5 мұз сынығын тап, шеберге әкел');
    } else if (p === 'search') {
      if (this.carrying) {
        line = this.copy('Неси осколок к мастеру!', 'Мұз сынығын шеберге әкел!');
        objective = this.isMobile
          ? this.copy(`Отнеси мастеру и нажми лапку · ${this.shardsDelivered}/${this.shardsTotal}`, `Шеберге әкеліп, табанды бас · ${this.shardsDelivered}/${this.shardsTotal}`)
          : this.copy(`Отнеси мастеру (E) · ${this.shardsDelivered}/${this.shardsTotal}`, `Шеберге әкел (E) · ${this.shardsDelivered}/${this.shardsTotal}`);
      } else {
        line = this.copy(`Скульптура: ${this.shardsDelivered}/${this.shardsTotal}`, `Мүсін: ${this.shardsDelivered}/${this.shardsTotal}`);
        objective = this.copy(`💎 ${this.shardsDelivered}/${this.shardsTotal} доставлено`, `💎 ${this.shardsDelivered}/${this.shardsTotal} жеткізілді`);
      }
    } else if (p === 'outro') {
      speaker = this.copy('Мастер льда', 'Мұз шебері');
      line = this.copy('Скульптура Барсика готова! Вам нужен тёплый шарф для друга!', 'Барсик мүсіні дайын! Досқа жылы шарф керек!');
      objective = this.copy('🔑 Ледяной ключ — на зимний сундук!', '🔑 Мұз кілті — қысқы сандыққа!');
    }

    this.onHud?.({
      phase: p, speaker, line, objective,
      shardsFound: this.shards.filter(s => s.picked).length,
      shardsDelivered: this.shardsDelivered,
      shardsTotal: this.shardsTotal,
      carrying: this.carrying,
      stars: this.stars,
      canInteract: Boolean(this.interactTarget),
      showMoveHint: !this.hasTakenFirstStep && p === 'intro',
      showActionHint: Boolean(this.interactTarget),
      outro: p === 'outro',
    });
  }

  private nearestInteract(): THREE.Object3D | null {
    const hp = this.hero.position;
    if (this.carrying) {
      if (hp.distanceTo(this.masterPos) < 2.8) return this.masterMarker;
    } else {
      for (const shard of this.shards) {
        if (shard.picked) continue;
        if (hp.distanceTo(shard.mesh.position) < 2.2) return shard.mesh;
      }
    }
    return null;
  }

  private objectiveWorldPos(): THREE.Vector3 | null {
    if (this.phase !== 'search') return null;
    if (this.carrying) return this.masterPos.clone();
    const hp = this.hero.position;
    let best: THREE.Vector3 | null = null;
    let bestD = Infinity;
    for (const shard of this.shards) {
      if (shard.picked) continue;
      const d = hp.distanceTo(shard.mesh.position);
      if (d < bestD) { bestD = d; best = shard.mesh.position.clone(); }
    }
    return best;
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
        this.phase = 'search';
        this.pushHud();
      } else {
        this.nextAt = now + 2600;
        this.pushHud();
      }
    }

    const canMove = !['intro', 'outro'].includes(this.phase);
    this.updateMovement(dt, canMove, this.baseSpeed, -12, 12, -18, 8);

    for (const shard of this.shards) {
      if (!shard.picked) {
        shard.mesh.rotation.y += dt * 2;
        shard.mesh.position.y = 0.45 + Math.sin(now * 0.003 + shard.mesh.position.x) * 0.12;
      }
    }

    if (this.iceKey?.visible) {
      this.iceKey.rotation.y += dt * 2;
      this.iceKey.position.y = 1.6 + Math.sin(now * 0.004) * 0.1;
    }

    if (this.master) {
      this.master.position.y = Math.sin(now * 0.002) * 0.03;
    }
    if (this.sculpture && this.shardsDelivered > 0) {
      this.sculpture.rotation.y = Math.sin(now * 0.001) * 0.08;
    }

    this.updateGuideArrow(now, this.objectiveWorldPos(), ['intro', 'outro']);

    const prev = this.interactTarget;
    this.interactTarget = this.nearestInteract();
    if (prev !== this.interactTarget) this.pushHud();

    this.updateAmbient(dt, now);

    if (this.phase === 'intro') {
      const idx = Math.min(this.introI, 2);
      const introPos = [new THREE.Vector3(0, 7, 16), new THREE.Vector3(0, 6, 14), new THREE.Vector3(0, 5, 12)];
      const introLook = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, -4), new THREE.Vector3(0, 0.5, -8)];
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

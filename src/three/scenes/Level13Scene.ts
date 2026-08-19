import * as THREE from 'three';
import {
  BaseLevelScene, type BaseHud, zoneDisc, spawnPad, questMarker,
  loadCharModel, loadPropModel, placeWoodSign,
} from './BaseLevelScene';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { placeAmbientCritters } from '../s1Place';
import { CAST_PROP_GLB, KEY_ICE, writeFlag } from '../castModels';
import { AudioManager } from '@/audio/AudioManager';

/**
 * Level 13 «Ледяные скульптуры» — GDD Level 13.
 *
 * Three acts rather than one flat fetch loop:
 *   learn  — one shard close by, master demonstrating;
 *   gather — four more from across a wide field, statue building 1/5→5/5;
 *   polish — circle the finished statue and work three faces, which shows
 *            it from every side and pays off with the ice key for L16.
 *
 * The polish act deliberately uses a different verb from the two fetch
 * acts. Repeating "carry five more things" would have added minutes
 * without adding a second thing to learn.
 */

export type L13Phase = 'intro' | 'learn' | 'gather' | 'polish' | 'outro';

export interface L13Hud extends BaseHud {
  shardsDelivered: number;
  shardsTotal: number;
  polished: number;
  polishTotal: number;
  carrying: boolean;
}

/** First shard sits close and in view; the rest are a real walk. */
const SHARDS: Array<[x: number, z: number]> = [
  [-6, -3],
  [14, -9],
  [-15, -14],
  [11, -24],
  [-9, -27],
];

/** Working faces around the statue, so the player circles it. */
const POLISH_STATIONS: Array<[x: number, z: number]> = [
  [2.6, -8],
  [-2.6, -8],
  [0, -11.2],
];

interface IceShard {
  mesh: THREE.Object3D;
  marker: THREE.Object3D;
  picked: boolean;
}

function makeSculpture(): THREE.Group {
  const g = new THREE.Group();
  const iceMat = new THREE.MeshStandardMaterial({
    color: 0xb3e5fc, roughness: 0.15, metalness: 0.25, transparent: true, opacity: 0.85,
  });
  const parts: THREE.Mesh[] = [];
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 12), iceMat);
  body.position.y = 0.72;
  parts.push(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.44, 14, 12), iceMat);
  head.position.y = 1.58;
  parts.push(head);
  const earL = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 6), iceMat);
  earL.position.set(0.3, 1.88, 0);
  parts.push(earL);
  const earR = earL.clone();
  earR.position.x = -0.3;
  parts.push(earR);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 6), iceMat);
  tail.position.set(0, 0.6, -0.5);
  tail.rotation.x = Math.PI / 3;
  parts.push(tail);
  for (const p of parts) {
    p.visible = false;
    p.castShadow = true;
  }
  g.add(...parts);
  g.userData.parts = parts;
  g.userData.iceMat = iceMat;
  return g;
}

export class Level13Scene extends BaseLevelScene {
  private phase: L13Phase = 'intro';
  private onHud: ((h: L13Hud) => void) | null = null;
  private introI = 0;
  private nextAt = 0;
  private shards: IceShard[] = [];
  private shardsDelivered = 0;
  private readonly shardsTotal = SHARDS.length;
  private polished = 0;
  private readonly polishTotal = POLISH_STATIONS.length;
  private polishRings: THREE.Mesh[] = [];
  private carrying = false;
  private carriedShard: IceShard | null = null;
  private masterPos = new THREE.Vector3(0, 0, -9);
  private master: THREE.Object3D | null = null;
  private masterMarker: THREE.Object3D | null = null;
  private sculpture: THREE.Group | null = null;
  private iceKey: THREE.Object3D | null = null;
  private beatMsg: { ru: string; kk: string } | null = null;
  private beatUntil = 0;

  protected currentPhase() { return this.phase; }

  protected onMovementHintDismiss() {
    this.pushHud();
  }

  private get isFetchPhase() {
    return this.phase === 'learn' || this.phase === 'gather';
  }

  private setBeat(ru: string, kk: string) {
    this.beatMsg = { ru, kk };
    this.beatUntil = performance.now() + 5000;
  }

  tryInteract() {
    const t = this.interactTarget;
    if (!t) return;

    if (this.phase === 'polish') {
      const idx = this.polishRings.indexOf(t as THREE.Mesh);
      if (idx < 0 || this.polishRings[idx].userData.done) return;
      this.polishRings[idx].userData.done = true;
      this.polishRings[idx].visible = false;
      this.polished++;
      this.stars += 3;
      this.spawnSparks(this.polishRings[idx].position, 14, [0xb3e5fc, 0xffffff]);
      AudioManager.sfx('sparkle');
      this.brightenSculpture();
      if (this.polished >= this.polishTotal) {
        this.phase = 'outro';
        this.stars += 8;
        if (this.iceKey) this.iceKey.visible = true;
        writeFlag(KEY_ICE, true);
        this.spawnSparks(this.masterPos, 28, [0xffd700, 0x00cec9]);
        AudioManager.sfx('levelComplete');
      }
      this.pushHud();
      return;
    }

    if (!this.isFetchPhase) return;

    if (!this.carrying) {
      const shard = this.shards.find((s) => s.mesh === t && !s.picked);
      if (!shard) return;
      shard.picked = true;
      shard.mesh.visible = false;
      shard.marker.visible = false;
      this.carrying = true;
      this.carriedShard = shard;
      this.stars += 1;
      this.spawnSparks(shard.mesh.position, 8, [0x4fc3f7, 0xe1f5fe]);
      AudioManager.sfx('collect');
      this.pushHud();
      return;
    }

    if (t !== this.masterMarker) return;
    this.carrying = false;
    this.carriedShard = null;
    this.shardsDelivered++;
    this.stars += 3;
    this.updateSculpture();
    this.spawnSparks(this.masterPos, 14, [0x4fc3f7, 0xffd700]);
    AudioManager.sfx('success');

    if (this.shardsDelivered === 1 && this.phase === 'learn') {
      this.phase = 'gather';
      this.setBeat(
        'Отлично! Осталось четыре — они разлетелись далеко по долине.',
        'Жарайсың! Тағы төртеу қалды — олар алқапқа алыс шашылған.',
      );
    } else if (this.shardsDelivered >= this.shardsTotal) {
      this.phase = 'polish';
      this.setBeat(
        'Скульптура готова, но лёд тусклый. Обойди её и отполируй с трёх сторон!',
        'Мүсін дайын, бірақ мұз күңгірт. Айналып өтіп, үш жағынан жылтырат!',
      );
      for (const ring of this.polishRings) ring.visible = true;
    }
    this.pushHud();
  }

  private updateSculpture() {
    if (!this.sculpture) return;
    const parts = this.sculpture.userData.parts as THREE.Mesh[];
    for (let i = 0; i < parts.length; i++) parts[i].visible = i < this.shardsDelivered;
  }

  /** Each polished face lifts the ice from dull to lit. */
  private brightenSculpture() {
    if (!this.sculpture) return;
    const mat = this.sculpture.userData.iceMat as THREE.MeshStandardMaterial;
    const t = this.polished / this.polishTotal;
    mat.opacity = 0.85 + t * 0.12;
    mat.roughness = 0.15 - t * 0.1;
    mat.emissive = new THREE.Color(0x4fc3f7);
    mat.emissiveIntensity = t * 0.45;
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L13Hud) => void) {
    this.nick = nick || 'друг';
    this.lang = lang;
    this.onHud = onHud;
    const loader = createGameGltfLoader();

    this.camera.position.set(0, 8, 17);
    this.reserve(0, -9, 6);
    for (const [x, z] of SHARDS) this.reserve(x, z, 3);

    await this.setupWinterEnvironment(loader, {
      decorCount: 42,
      decorCenterZ: -14,
      terrain: {
        relief: 0.95,
        rimHeight: 3.6,
        playHalfExtent: 34,
        seed: 13,
        features: [
          { kind: 'flat', x: 0, z: -13, r: 24 },
          { kind: 'mound', x: -25, z: -20, r: 10, height: 2.6 },
          { kind: 'mound', x: 26, z: -16, r: 11, height: 3.0 },
        ],
      },
    });

    this.scene.add(zoneDisc(0, 5, 3.6, 0xe1f5fe, this.groundHeightAt(0, 5) + 0.04));
    const pad = spawnPad(0, 5);
    this.snapToGround(pad);
    this.scene.add(pad);
    this.scene.add(await placeWoodSign(loader, -3, 3.5, 0.3, 0xe1f5fe));

    // ── Master's workspace ───────────────────────────────────────
    this.masterPos.y = this.groundHeightAt(0, -9);
    this.scene.add(zoneDisc(0, -9, 4.6, 0x4fc3f7, this.masterPos.y + 0.05));

    const podium = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.45, 0.4, 14),
      new THREE.MeshStandardMaterial({ color: 0xb0bec5, roughness: 0.8 }),
    );
    podium.position.set(0, this.masterPos.y + 0.2, -9);
    podium.castShadow = true;
    podium.receiveShadow = true;
    this.scene.add(podium);
    this.colliders.push({ kind: 'circle', x: 0, z: -9, r: 1.4 });

    const masterGlb = await loadCharModel(loader, 'ice_master.glb', 1.4);
    if (masterGlb) {
      masterGlb.position.set(-2.1, 0, -7.6);
      this.snapToGround(masterGlb);
      masterGlb.lookAt(0, masterGlb.position.y, -9);
      this.master = masterGlb;
      this.scene.add(masterGlb);
      // The podium collider (0,-9, r1.4) doesn't reach him — he stands
      // 2.5m off its centre — so without his own circle he was the one
      // solid-looking figure in the level a player could walk straight
      // through.
      this.colliders.push({ kind: 'circle', x: -2.1, z: -7.6, r: 0.55 });
    }

    this.sculpture = makeSculpture();
    this.sculpture.position.set(0, this.masterPos.y + 0.4, -9);
    this.scene.add(this.sculpture);

    this.masterMarker = questMarker(0x4fc3f7, 0x81d4fa);
    this.masterMarker.position.copy(this.masterPos);
    this.masterMarker.visible = false;
    this.scene.add(this.masterMarker);

    // ── Polish stations, revealed in the last act ────────────────
    for (const [x, z] of POLISH_STATIONS) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.85, 28),
        new THREE.MeshBasicMaterial({
          color: 0xb3e5fc, transparent: true, opacity: 0.75,
          side: THREE.DoubleSide, depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, this.groundHeightAt(x, z) + 0.06, z);
      ring.userData.done = false;
      ring.visible = false;
      this.polishRings.push(ring);
      this.scene.add(ring);
    }

    // ── Ice key for L16 ──────────────────────────────────────────
    const iceKeyGlb =
      (await loadPropModel(loader, CAST_PROP_GLB.ice_key_prop, { maxSize: 0.6 })) ??
      (await loadPropModel(loader, CAST_PROP_GLB.golden_key, { maxSize: 0.55 }));
    this.iceKey = iceKeyGlb ?? new THREE.Mesh(
      new THREE.OctahedronGeometry(0.2),
      new THREE.MeshStandardMaterial({ color: 0x4fc3f7, emissive: 0x81d4fa, emissiveIntensity: 0.8 }),
    );
    this.iceKey.position.set(1.2, this.masterPos.y + 2.1, -9);
    this.iceKey.visible = false;
    this.scene.add(this.iceKey);

    // ── Shards ───────────────────────────────────────────────────
    // Крупнее: с игровой камеры в девяти метрах предмет меньше двух третей
    // метра ребёнок не опознаёт как «то, что надо взять». Тот же класс, что
    // яблоки на L2, только тонуть здесь не в чем — снег без высокой травы.
    const crystalTpl = await loadPropModel(loader, CAST_PROP_GLB.ice_crystal, { maxSize: 0.82 });
    for (const [x, z] of SHARDS) {
      const y = this.groundHeightAt(x, z);
      let mesh: THREE.Object3D;
      if (crystalTpl) {
        mesh = crystalTpl.clone(true);
      } else {
        mesh = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.3),
          new THREE.MeshStandardMaterial({
            color: 0x4fc3f7, emissive: 0x4fc3f7, emissiveIntensity: 0.55,
            transparent: true, opacity: 0.9,
          }),
        );
        mesh.castShadow = true;
      }
      mesh.position.set(x, y + 0.5, z);
      mesh.userData.baseY = y + 0.5;
      const marker = questMarker(0xe3f2fd, 0x90caf9);
      marker.position.set(x, y, z);
      marker.scale.setScalar(0.6);
      marker.visible = false;
      this.shards.push({ mesh, marker, picked: false });
      this.scene.add(mesh, marker);
    }

    await this.placeProps(loader, [
      { key: 'pine_tree', opts: { x: -12, z: -6, maxSize: 3.0 } },
      { key: 'pine_tree', opts: { x: 15, z: -19, maxSize: 2.7 } },
      { key: 'pine_tree', opts: { x: -20, z: -25, maxSize: 3.2 } },
      { key: 'rock_snow', opts: { x: 10, z: -5, maxSize: 1.5 } },
      { key: 'rock_snow', opts: { x: -17, z: -9, maxSize: 1.3 } },
      { key: 'snow_pile', opts: { x: 6, z: -17, maxSize: 1.3 } },
      { key: 'snow_pile', opts: { x: -6, z: -21, maxSize: 1.2 } },
      { key: 'ice_rabbit', opts: { x: 2.4, z: -7.2, maxSize: 0.9 } },
      { key: 'snowflake', opts: { x: -4, z: -16, maxSize: 0.5, y: 1.3 } },
    ]);
    await placeAmbientCritters(this.scene, loader, [
      { key: 'penguin', x: 7, z: -12, rotY: -1.2, h: 0.75 },
      { key: 'polar', x: -11, z: -18, rotY: 0.5, h: 0.95 },
      { key: 'rabbit', x: 12, z: -28, rotY: 1.8, h: 0.7 },
    ]);

    this.hero.position.set(0, this.groundHeightAt(0, 5), 5);
    // This level is a serpentine, not a field: its beats sit alternately left
    // and right going down. Drawing that as an actual route, then walling it,
    // is what stops it reading as a clearing with things scattered in it.
    this.derivePathFromRooms({ x: 0, z: 5 });
    await this.enclosePath(loader);

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

    if (this.beatMsg && performance.now() < this.beatUntil && p !== 'intro') {
      line = this.copy(this.beatMsg.ru, this.beatMsg.kk);
    }

    if (p === 'intro') {
      const lines = [
        this.copy('Мастер льда!', 'Мұз шебері!'),
        this.copy(`Он лепит скульптуру, ${n}, но не хватает льда.`, `Ол мүсін жасайды, ${n}, бірақ мұз жетпейді.`),
        this.isMobile
          ? this.copy('Вон блестит осколок — подними лапкой и неси мастеру.', 'Әне сынық жарқырайды — табанмен көтеріп, шеберге апар.')
          : this.copy('Вон блестит осколок — подними (E) и неси мастеру.', 'Әне сынық жарқырайды — көтер (E) де шеберге апар.'),
      ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = this.copy('❄️ Принеси первый осколок', '❄️ Бірінші сынықты әкел');
    } else if (p === 'learn' || p === 'gather') {
      if (!line) {
        line = this.carrying
          ? this.copy('Неси осколок мастеру!', 'Сынықты шеберге апар!')
          : this.copy(`Осколков: ${this.shardsDelivered}/${this.shardsTotal}`, `Сынықтар: ${this.shardsDelivered}/${this.shardsTotal}`);
      }
      objective = this.copy(
        `❄️ ${this.shardsDelivered}/${this.shardsTotal} осколков`,
        `❄️ ${this.shardsDelivered}/${this.shardsTotal} сынық`,
      );
    } else if (p === 'polish') {
      if (!line) {
        line = this.copy(
          'Встань в светящийся круг и отполируй лёд!',
          'Жарқыраған шеңберге тұрып, мұзды жылтырат!',
        );
      }
      objective = this.copy(
        `✨ Отполировано: ${this.polished}/${this.polishTotal}`,
        `✨ Жылтыратылды: ${this.polished}/${this.polishTotal}`,
      );
    } else if (p === 'outro') {
      speaker = this.copy('Мастер льда', 'Мұз шебері');
      line = this.copy(
        'Красота! Держи ледяной ключ. А теперь — Айе нужен тёплый шарф.',
        'Керемет! Мұз кілтін ал. Ал енді — Айяға жылы орамал керек.',
      );
      objective = this.copy('🔑 Ледяной ключ получен!', '🔑 Мұз кілті алынды!');
    }

    this.onHud?.({
      phase: p, speaker, line, objective,
      shardsDelivered: this.shardsDelivered,
      shardsTotal: this.shardsTotal,
      polished: this.polished,
      polishTotal: this.polishTotal,
      carrying: this.carrying,
      stars: this.stars,
      canInteract: Boolean(this.interactTarget),
      showMoveHint: !this.hasTakenFirstStep && (p === 'intro' || p === 'learn'),
      showActionHint: Boolean(this.interactTarget),
      outro: p === 'outro',
    });
  }

  private nearestInteract(): THREE.Object3D | null {
    const hp = this.hero.position;
    if (this.phase === 'polish') {
      for (const ring of this.polishRings) {
        if (ring.userData.done) continue;
        if (hp.distanceTo(ring.position) < 1.6) return ring;
      }
      return null;
    }
    if (!this.isFetchPhase) return null;
    if (this.carrying) {
      return hp.distanceTo(this.masterPos) < 3.0 ? this.masterMarker : null;
    }
    for (const shard of this.shards) {
      if (shard.picked) continue;
      if (hp.distanceTo(shard.mesh.position) < 2.4) return shard.mesh;
    }
    return null;
  }

  private objectiveWorldPos(): THREE.Vector3 | null {
    if (this.phase === 'polish') {
      for (const ring of this.polishRings) {
        if (!ring.userData.done) return ring.position.clone();
      }
      return null;
    }
    if (!this.isFetchPhase) return null;
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
      if (this.introI >= 3) this.phase = 'learn';
      else this.nextAt = now + 2600;
      this.pushHud();
    }

    const canMove = this.isFetchPhase || this.phase === 'polish';
    this.updateMovement(dt, canMove, this.baseSpeed, -30, 30, -34, 10);

    // Idle motion so the workspace feels inhabited.
    if (this.master) {
      this.master.rotation.y += Math.sin(now * 0.0009) * 0.0015;
      this.master.position.y = this.groundHeightAt(this.master.position.x, this.master.position.z)
        + Math.sin(now * 0.0022) * 0.015;
    }
    for (const shard of this.shards) {
      if (shard.picked) continue;
      shard.mesh.rotation.y += dt * 1.8;
      shard.mesh.position.y = (shard.mesh.userData.baseY as number)
        + Math.sin(now * 0.003 + shard.mesh.position.x) * 0.1;
    }
    if (this.carrying && this.carriedShard) {
      this.carriedShard.mesh.visible = true;
      this.carriedShard.mesh.position.set(
        this.hero.position.x,
        this.hero.position.y + 1.5 + Math.sin(now * 0.005) * 0.05,
        this.hero.position.z,
      );
    }
    if (this.iceKey?.visible) {
      this.iceKey.rotation.y += dt * 1.4;
      this.iceKey.position.y = this.masterPos.y + 2.1 + Math.sin(now * 0.003) * 0.1;
    }
    for (const ring of this.polishRings) {
      if (ring.userData.done || !ring.visible) continue;
      const m = ring.material as THREE.MeshBasicMaterial;
      m.opacity = 0.55 + Math.sin(now * 0.004 + ring.position.x) * 0.22;
    }

    // Only the live objective is beaconed — a field of lit markers points
    // nowhere and turns the valley into a forest of lollipops.
    const objective = this.objectiveWorldPos();
    for (const shard of this.shards) {
      shard.marker.visible = !shard.picked
        && !this.carrying
        && Boolean(objective)
        && shard.mesh.position.distanceTo(objective!) < 0.01;
    }
    if (this.masterMarker) this.masterMarker.visible = this.carrying;

    this.updateGuideArrow(now, objective, ['intro', 'outro']);

    const prev = this.interactTarget;
    this.interactTarget = this.nearestInteract();
    if (prev !== this.interactTarget) this.pushHud();
    if (this.beatMsg && now > this.beatUntil) {
      this.beatMsg = null;
      this.pushHud();
    }

    this.updateAmbient(dt, now);

    if (this.phase === 'intro') {
      const idx = Math.min(this.introI, 2);
      const introPos = [
        new THREE.Vector3(0, 8, 17),
        new THREE.Vector3(-4, 5.5, -2),
        new THREE.Vector3(0, 6, 11),
      ];
      const introLook = [
        new THREE.Vector3(0, 1.2, 2),
        this.masterPos.clone().setY(1.4),
        new THREE.Vector3(-3, 0.9, -3),
      ];
      this.camera.position.lerp(introPos[idx], 1 - Math.pow(0.02, dt));
      this.camera.lookAt(introLook[idx]);
    } else if (this.phase === 'polish') {
      // Pull in and orbit slightly: the statue is the subject of this act.
      const target = new THREE.Vector3(
        this.cameraLateral(this.hero.position.x),
        this.hero.position.y + 5.2,
        this.hero.position.z + 8.5,
      );
      this.camera.position.lerp(target, 1 - Math.pow(0.002, dt));
      this.camera.lookAt(0, this.masterPos.y + 1.3, -9);
    } else {
      const f = this.cameraFraming();
      const target = new THREE.Vector3(
        this.cameraLateral(this.hero.position.x) + f.lateral,
        this.hero.position.y + 6.2 * f.heightMul,
        this.hero.position.z + 10 + f.backAdd,
      );
      this.camera.position.lerp(target, 1 - Math.pow(0.0015, dt));
      this.camera.lookAt(
        this.cameraLateral(this.hero.position.x),
        this.hero.position.y + 1.3 + f.lookUp,
        this.hero.position.z - 1.0 - f.lookAhead,
      );
    }

    this.renderFrame();
  };
}

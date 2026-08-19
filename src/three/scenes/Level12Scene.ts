import * as THREE from 'three';
import {
  BaseLevelScene,
  type BaseHud,
  zoneDisc,
  spawnPad,
  placeWoodSign,
  loadPropModel,
  loadCharModel,
} from './BaseLevelScene';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { TrailPath } from '../TrailPath';
import { CAST_PROP_GLB, CAST_CHAR_GLB } from '../castModels';
import { AudioManager } from '@/audio/AudioManager';

/**
 * Level 12 «Ледяная тропа» — GDD Level 12.
 *
 * Rule of three, expressed in the route itself rather than in text:
 *   learn — a short, wide, forgiving straight;
 *   turn  — the first bend, where inertia starts to matter;
 *   run   — five narrowing checkpoints with crystals off the racing line.
 *
 * The trail is a curve, not a row of boxes: bends are what make sliding a
 * skill instead of holding one direction, and a straight corridor cannot
 * teach the mechanic the level is named after.
 */

export type L12Phase = 'intro' | 'learn' | 'turn' | 'run' | 'drop' | 'outro';

export interface L12Hud extends BaseHud {
  segmentsCrossed: number;
  segmentsTotal: number;
  crystals: number;
  slipped: boolean;
}

/**
 * Route down the valley: straight, then bends of increasing bite, then the
 * drop.
 *
 * Долина кончалась на z = −39: 55 м осевой линии при плановых 300 с — самый
 * короткий маршрут главы при самой высокой планке. Продлена до −64 четвёртым
 * актом «Спуск», где лёд быстрее, а колена короче и злее. Это та же механика
 * на большей громкости, а не новая: уровень называется «Ледяная тропа», и
 * последнее, что он должен показать, — тропу, на которой инерция наконец
 * решает всё.
 */
const WAYPOINTS: Array<[number, number]> = [
  [0, 8],
  [0, 2],
  [0, -5],
  [-4.5, -11],
  [-7.5, -17.5],
  [-4, -23.5],
  [2, -28],
  [7, -33],
  [8.5, -39],
  // ── Четвёртый акт: быстрый лёд ──
  [5.5, -44],
  [-1.5, -48],
  [-7, -52.5],
  [-4.5, -58],
  [2.5, -62],
  [4, -66],
];

/** Normalised checkpoint positions along the route. */
const CHECKPOINTS = [0.13, 0.25, 0.37, 0.49, 0.6, 0.71, 0.82, 0.93];

/** Crystals sit off the racing line, so the golden path costs a steer. */
const CRYSTALS: Array<[t: number, lateral: number]> = [
  [0.19, 0.55],
  [0.3, -0.6],
  [0.4, 0.65],
  [0.48, -0.55],
  [0.56, 0.6],
  [0.63, 0],
  [0.7, -0.62],
  [0.77, 0.58],
  [0.85, -0.6],
  [0.95, 0.5],
];

/** Где начинается спуск — по нормали вдоль тропы. */
const DROP_T = 0.6;

export class Level12Scene extends BaseLevelScene {
  private phase: L12Phase = 'intro';
  private onHud: ((h: L12Hud) => void) | null = null;
  private introI = 0;
  private nextAt = 0;
  private segmentsCrossed = 0;
  private readonly segmentsTotal = CHECKPOINTS.length;
  private crystals = 0;
  private readonly crystalsTotal = CRYSTALS.length;
  private velocity = new THREE.Vector3();
  private trail!: TrailPath;
  private crystalMeshes: THREE.Object3D[] = [];
  private checkpointArches: THREE.Group[] = [];
  private slipped = false;
  private slipMsgUntil = 0;
  private turnHintUntil = 0;
  private gatePos = new THREE.Vector3();
  private lastSlideSfxAt = 0;

  protected currentPhase() { return this.phase; }

  protected onMovementHintDismiss() {
    this.pushHud();
  }

  tryInteract() {}

  /** Inertia and trail width both tighten as the level progresses. */
  private get inertia() {
    if (this.phase === 'learn') return 0.78;
    if (this.phase === 'turn') return 0.82;
    // Спуск: лёд держит скорость дольше, поэтому поворот надо начинать раньше.
    return this.phase === 'drop' ? 0.9 : 0.85;
  }

  private static halfWidthAt(t: number) {
    // Wide while learning, tightening through the bends, tightest on the drop.
    if (t < 0.13) return 1.95;
    if (t < 0.25) return 1.75;
    if (t < DROP_T) return THREE.MathUtils.lerp(1.6, 1.25, (t - 0.25) / (DROP_T - 0.25));
    return THREE.MathUtils.lerp(1.25, 0.95, (t - DROP_T) / (1 - DROP_T));
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L12Hud) => void) {
    this.nick = nick || 'друг';
    this.lang = lang;
    this.onHud = onHud;
    const loader = createGameGltfLoader();

    this.camera.position.set(0, 8, 18);

    // Keep decoration and relief off the racing line.
    this.pathCorridorHalf = 3.0;
    this.pathCorridor = (z) => {
      const t = THREE.MathUtils.clamp((8 - z) / 74, 0, 1);
      // flatPointAt, not pointAt: this runs inside the terrain sampler.
      return this.trail ? this.trail.flatPointAt(t).x : 0;
    };

    this.trail = new TrailPath({
      waypoints: WAYPOINTS,
      halfWidth: Level12Scene.halfWidthAt,
      heightAt: () => 0,
    });
    for (const [t] of CRYSTALS) {
      const p = this.trail.pointAt(t);
      this.reserve(p.x, p.z, 2.6);
    }

    // A snow valley with an ice ribbon running through it reads far better
    // than a level-wide sheet of ice, and keeps the trail edges legible.
    await this.setupWinterEnvironment(loader, {
      ground: 'snow',
      decorCount: 26,
      decorCenterZ: -18,
      terrain: {
        relief: 1.15,
        rimHeight: 4.2,
        // Долина стала длиннее на 25 м, и подъём кромки надо отодвинуть вместе
        // с ней: при прежних 34 «стена холма» в 4.2 м вставала бы поперёк
        // финишных ворот. Кромка теперь начинается сразу за ними.
        playHalfExtent: 82,
        seed: 12,
        // No flat features: the corridor above already carves the winding
        // route, so the trail descends a real valley rather than crossing a
        // chain of flat discs.
        features: [
          { kind: 'mound', x: -20, z: -12, r: 11, height: 3.2 },
          { kind: 'mound', x: 21, z: -27, r: 12, height: 3.8 },
        ],
      },
    });

    // Terrain exists now — sit the ribbon and rails on it.
    this.trail.setHeightSampler(this.groundHeightAt);
    this.gatePos = this.trail.pointAt(1);

    // ── Trail surface ────────────────────────────────────────────
    const iceMat = new THREE.MeshStandardMaterial({
      color: 0xdff2fb,
      roughness: 0.06,
      metalness: 0.42,
      transparent: true,
      opacity: 0.92,
    });
    const trailMesh = this.trail.buildSurface(iceMat, { segments: 180, yOffset: 0.07 });
    this.scene.add(trailMesh);

    const railMat = new THREE.MeshStandardMaterial({
      color: 0x64c8f5,
      emissive: 0x2f9fe0,
      emissiveIntensity: 0.5,
      roughness: 0.35,
    });
    this.scene.add(
      this.trail.buildEdgeRail(railMat, -1, { segments: 180, height: 0.32 }),
      this.trail.buildEdgeRail(railMat, 1, { segments: 180, height: 0.32 }),
    );

    // ── Checkpoint arches ────────────────────────────────────────
    const archMat = new THREE.MeshStandardMaterial({
      color: 0xa8dcf5, emissive: 0x4fb8e8, emissiveIntensity: 0.3,
      transparent: true, opacity: 0.72,
    });
    for (const t of CHECKPOINTS) {
      const arch = new THREE.Group();
      const half = Level12Scene.halfWidthAt(t);
      for (const side of [-1, 1] as const) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 1.9, 8), archMat);
        post.position.set(side * half, 0.95, 0);
        arch.add(post);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 0.16, 0.16), archMat);
      beam.position.y = 1.9;
      arch.add(beam);
      const p = this.trail.pointAt(t);
      const tan = this.trail.tangentAt(t);
      arch.position.copy(p);
      arch.rotation.y = Math.atan2(tan.x, tan.z);
      arch.userData.passed = false;
      this.checkpointArches.push(arch);
      this.scene.add(arch);
    }

    // ── Crystals on the golden path ──────────────────────────────
    // Крупнее: с игровой камеры в девяти метрах предмет меньше двух третей
    // метра ребёнок не опознаёт как «то, что надо взять». Тот же класс, что
    // яблоки на L2, только тонуть здесь не в чем — снег без высокой травы.
    const crystalTpl = await loadPropModel(loader, CAST_PROP_GLB.ice_crystal, { maxSize: 0.75 });
    for (const [t, lateral] of CRYSTALS) {
      const half = Level12Scene.halfWidthAt(t);
      const pos = this.trail.offsetAt(t, lateral * half);
      let crystal: THREE.Object3D;
      if (crystalTpl) {
        crystal = crystalTpl.clone(true);
      } else {
        crystal = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.24),
          new THREE.MeshStandardMaterial({
            color: 0xffd700, emissive: 0xf1c40f, emissiveIntensity: 0.6,
            transparent: true, opacity: 0.92,
          }),
        );
        crystal.castShadow = true;
      }
      crystal.position.set(pos.x, pos.y + 0.62, pos.z);
      crystal.userData.collected = false;
      crystal.userData.baseY = pos.y + 0.62;
      this.crystalMeshes.push(crystal);
      this.scene.add(crystal);
    }

    // ── Ice gate, landmark at the finish ─────────────────────────
    const gateMat = new THREE.MeshStandardMaterial({
      color: 0x9fdcf7, emissive: 0x5bc0eb, emissiveIntensity: 0.45,
      transparent: true, opacity: 0.8,
    });
    const gate = new THREE.Group();
    for (const side of [-1, 1] as const) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 4.2, 8), gateMat);
      post.position.set(side * 1.8, 2.1, 0);
      post.castShadow = true;
      gate.add(post);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.42, 0.42), gateMat);
    lintel.position.y = 4.2;
    gate.add(lintel);
    for (let i = 0; i < 3; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.1, 6), gateMat);
      spike.position.set((i - 1) * 1.2, 4.9, 0);
      gate.add(spike);
    }
    const gateTan = this.trail.tangentAt(1);
    gate.position.copy(this.gatePos);
    gate.rotation.y = Math.atan2(gateTan.x, gateTan.z);
    this.scene.add(gate);
    // Only the two posts are solid — the gap between them is the finish
    // line itself, and a player has to be able to slide through it.
    for (const side of [-1, 1] as const) {
      const rotY = gate.rotation.y;
      this.colliders.push({
        kind: 'circle',
        x: this.gatePos.x + side * 1.8 * Math.cos(rotY),
        z: this.gatePos.z - side * 1.8 * Math.sin(rotY),
        r: 0.42,
      });
    }

    // Ice master waiting past the gate — gives the outro a destination.
    const master = await loadCharModel(loader, CAST_CHAR_GLB.ice_master, 1.5);
    if (master) {
      const spot = this.trail.offsetAt(1, 3.2);
      master.position.set(spot.x, 0, spot.z + 2.5);
      this.snapToGround(master);
      master.lookAt(this.gatePos.x, master.position.y, this.gatePos.z);
      this.scene.add(master);
      // A destination a player is meant to run at, on an icy trail, needs a
      // body — same gap as L13's ice_master: nothing here stopped a fast
      // approach from sliding straight through him.
      this.colliders.push({ kind: 'circle', x: master.position.x, z: master.position.z, r: 0.55 });
    }

    this.scene.add(zoneDisc(0, 6, 3.6, 0xe1f5fe, this.groundHeightAt(0, 6) + 0.06));
    this.scene.add(
      zoneDisc(this.gatePos.x, this.gatePos.z, 4.4, 0x4fc3f7, this.gatePos.y + 0.06),
    );
    const pad = spawnPad(0, 6);
    this.snapToGround(pad);
    this.scene.add(pad);
    this.scene.add(await placeWoodSign(loader, -2.8, 5, 0.35, 0xe1f5fe));

    await this.placeProps(loader, [
      { key: 'pine_tree', opts: { x: -11, z: -8, maxSize: 3.2 } },
      { key: 'pine_tree', opts: { x: 12, z: -20, maxSize: 3.6 } },
      { key: 'pine_tree', opts: { x: -14, z: -28, maxSize: 2.8 } },
      { key: 'rock_snow', opts: { x: -10.5, z: -19, maxSize: 1.8 } },
      { key: 'rock_snow', opts: { x: 11, z: -33, maxSize: 1.5 } },
      { key: 'snow_pile', opts: { x: 5, z: -14, maxSize: 1.4 } },
    ]);

    this.hero.position.set(0, this.groundHeightAt(0, 6), 6);
    // The wall. Planted last, so it can read the corridor and every room the
    // level reserved and hug the outside of both.
    await this.encloseLevel(loader);
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
    let speaker = 'Барсик';
    let line = '';
    let objective = '';
    const p = this.phase;
    const n = this.nick;

    if (p === 'intro') {
      const lines = [
        this.copy('Ледяная тропа! Скользко!', 'Мұзды жол! Тайғақ!'),
        this.copy(`Осторожно, ${n}. На льду Барсик скользит дальше.`, `Абайла, ${n}. Мұзда Барсик әрі қарай сырғанайды.`),
        this.copy('Сначала прямо — попробуй разогнаться.', 'Алдымен тіке — жылдамдап көр.'),
      ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = this.copy('🧊 Пройди ледяную тропу', '🧊 Мұзды жолдан өт');
    } else if (p === 'learn') {
      line = this.copy('Тропа широкая — привыкай к скольжению.', 'Жол кең — сырғанауға үйрен.');
      objective = this.copy('🧊 Доберись до первых ворот', '🧊 Бірінші қақпаға жет');
    } else if (p === 'turn') {
      line = performance.now() < this.turnHintUntil
        ? this.copy('Поворот! Начинай тормозить заранее.', 'Бұрылыс! Алдын ала баяула.')
        : this.copy(`Отлично, ${n}! Теперь поворот.`, `Жарайсың, ${n}! Енді бұрылыс.`);
      objective = this.copy(
        `🧊 ${this.segmentsCrossed}/${this.segmentsTotal} ворот`,
        `🧊 ${this.segmentsCrossed}/${this.segmentsTotal} қақпа`,
      );
    } else if (p === 'run') {
      if (this.slipped && performance.now() < this.slipMsgUntil) {
        line = this.copy('Ой! Снова на тропу — попробуй ещё.', 'Ой! Қайта жолға — тағы байқап көр.');
      } else {
        line = this.copy('Тропа сужается. Собирай кристаллы!', 'Жол тарылады. Кристалдарды жина!');
      }
      objective = this.copy(
        `🧊 ${this.segmentsCrossed}/${this.segmentsTotal}  💎 ${this.crystals}/${this.crystalsTotal}`,
        `🧊 ${this.segmentsCrossed}/${this.segmentsTotal}  💎 ${this.crystals}/${this.crystalsTotal}`,
      );
    } else if (p === 'drop') {
      if (this.slipped && performance.now() < this.slipMsgUntil) {
        line = this.copy('Ой! Здесь лёд быстрее. Тормози заранее.', 'Ой! Мұнда мұз жылдамырақ. Алдын ала баяула.');
      } else if (performance.now() < this.turnHintUntil) {
        line = this.copy(
          'Дальше лёд скользкий по-настоящему — поворачивай раньше!',
          'Әрі қарай мұз шын сырғанақ — ертерек бұрыл!',
        );
      } else {
        line = this.copy('Держись середины — тропа совсем узкая.', 'Ортасын ұста — жол мүлдем тар.');
      }
      objective = this.copy(
        `🧊 ${this.segmentsCrossed}/${this.segmentsTotal}  💎 ${this.crystals}/${this.crystalsTotal}`,
        `🧊 ${this.segmentsCrossed}/${this.segmentsTotal}  💎 ${this.crystals}/${this.crystalsTotal}`,
      );
    } else if (p === 'outro') {
      speaker = this.copy('Мастер льда', 'Мұз шебері');
      line = this.copy('Ты прошёл! Я жду на поляне — помоги со скульптурой!', 'Өттің! Мен алаңда күтемін — мүсінге көмектес!');
      objective = this.copy('🎉 Ледяные ворота пройдены!', '🎉 Мұзды қақпа өтілді!');
    }

    this.onHud?.({
      phase: p, speaker, line, objective,
      segmentsCrossed: this.segmentsCrossed,
      segmentsTotal: this.segmentsTotal,
      crystals: this.crystals,
      slipped: this.slipped,
      stars: this.stars,
      canInteract: false,
      showMoveHint: !this.hasTakenFirstStep && (p === 'intro' || p === 'learn'),
      showActionHint: false,
      outro: p === 'outro',
    });
  }

  /** Slipping off returns the player to the last arch, never to the start. */
  private softResetSegment() {
    const t = this.segmentsCrossed > 0 ? CHECKPOINTS[this.segmentsCrossed - 1] : 0;
    const p = this.trail.pointAt(t);
    this.hero.position.set(p.x, p.y, p.z);
    this.velocity.set(0, 0, 0);
    this.slipped = true;
    this.slipMsgUntil = performance.now() + 2200;
    this.spawnSparks(this.hero.position, 8, [0x42a5f5, 0xe1f5fe]);
    AudioManager.sfx('stumble');
    this.pushHud();
  }

  private nextCrystalPos(): THREE.Vector3 | null {
    for (const c of this.crystalMeshes) {
      if (!c.userData.collected) return c.position.clone();
    }
    if (this.segmentsCrossed < this.segmentsTotal) {
      return this.trail.pointAt(CHECKPOINTS[this.segmentsCrossed]);
    }
    return this.gatePos.clone();
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
        this.phase = 'learn';
      } else {
        this.nextAt = now + 2600;
      }
      this.pushHud();
    }

    const sliding = this.phase === 'learn' || this.phase === 'turn'
      || this.phase === 'run' || this.phase === 'drop';
    let projection = this.trail.project(this.hero.position);

    if (sliding) {
      // Ice owns acceleration/inertia instead of `updateMovement`, but input
      // must obey the same camera-space contract as every walking level.
      const d = this.cameraRelativeDirection(this.dir());
      const speed = this.baseSpeed * 0.8;
      const inertia = this.inertia;
      this.velocity.x += d.x * speed * dt * 2.4;
      this.velocity.z += d.y * speed * dt * 2.4;
      this.velocity.x *= inertia;
      this.velocity.z *= inertia;

      const maxV = speed * 1.15;
      this.velocity.x = THREE.MathUtils.clamp(this.velocity.x, -maxV, maxV);
      this.velocity.z = THREE.MathUtils.clamp(this.velocity.z, -maxV, maxV);

      this.hero.position.x += this.velocity.x * dt;
      this.hero.position.z += this.velocity.z * dt;

      projection = this.trail.project(this.hero.position);
      const groundY = this.groundHeightAt(this.hero.position.x, this.hero.position.z);
      this.hero.position.y += (groundY - this.hero.position.y) * Math.min(1, dt * 12);

      if (!this.hasTakenFirstStep && this.velocity.lengthSq() > 0.4) {
        this.hasTakenFirstStep = true;
        this.onMovementHintDismiss();
      }

      // Off the ribbon, or doubled back past the start.
      if (projection.lateral > projection.halfWidth + 0.35 || this.hero.position.z > 10) {
        this.softResetSegment();
      }

      const glideSpeed = Math.hypot(this.velocity.x, this.velocity.z);
      if (glideSpeed > 1.4 && now - this.lastSlideSfxAt > 620) {
        this.lastSlideSfxAt = now;
        AudioManager.sfx('whoosh');
      }

      // Checkpoints
      for (let i = this.segmentsCrossed; i < this.segmentsTotal; i++) {
        if (projection.t < CHECKPOINTS[i]) break;
        this.segmentsCrossed = i + 1;
        this.stars += 2;
        const arch = this.checkpointArches[i];
        arch.userData.passed = true;
        this.spawnSparks(arch.position, 12, [0x4fc3f7, 0xffd700]);
        AudioManager.sfx('success');

        if (this.segmentsCrossed === 1 && this.phase === 'learn') {
          this.phase = 'turn';
          this.turnHintUntil = now + 3200;
        } else if (this.segmentsCrossed === 2 && this.phase === 'turn') {
          this.phase = 'run';
        } else if (this.phase === 'run' && CHECKPOINTS[i] >= DROP_T) {
          // Спуск объявляется аркой, а не текстом посреди дороги: игрок
          // проезжает ворота и сразу чувствует, что лёд стал быстрее.
          this.phase = 'drop';
          this.turnHintUntil = now + 3600;
        } else if (this.segmentsCrossed >= this.segmentsTotal) {
          this.phase = 'outro';
          this.stars += 10;
          this.spawnSparks(this.gatePos, 26, [0xffd700, 0x00cec9]);
          AudioManager.sfx('levelComplete');
        }
        this.pushHud();
        break;
      }

      // Crystals
      for (const crystal of this.crystalMeshes) {
        if (crystal.userData.collected) continue;
        if (this.hero.position.distanceTo(crystal.position) < 1.15) {
          crystal.userData.collected = true;
          crystal.visible = false;
          this.crystals++;
          this.stars += 2;
          this.spawnSparks(crystal.position, 12, [0xffd700, 0xf1c40f]);
          AudioManager.sfx('bonus');
          this.pushHud();
        }
      }

      if (Math.abs(this.velocity.x) > 0.05 || Math.abs(this.velocity.z) > 0.05) {
        const angle = Math.atan2(this.velocity.x, this.velocity.z);
        this.hero.rotation.y += (angle - this.hero.rotation.y) * 0.12;
        if (!this.walking) {
          this.walking = true;
          this.idleAction?.fadeOut(0.1);
          this.walkAction?.reset().fadeIn(0.1).play();
        }
      } else if (this.walking) {
        this.walking = false;
        this.walkAction?.fadeOut(0.15);
        this.idleAction?.reset().fadeIn(0.15).play();
      }
    }

    for (const crystal of this.crystalMeshes) {
      if (crystal.userData.collected) continue;
      crystal.rotation.y += dt * 2.5;
      crystal.position.y = (crystal.userData.baseY as number) + Math.sin(now * 0.004 + crystal.position.z) * 0.12;
    }

    if (this.slipped && now > this.slipMsgUntil) this.slipped = false;

    this.updateGuideArrow(now, sliding ? this.nextCrystalPos() : null, ['intro', 'outro']);
    this.updateAmbient(dt, now);

    if (this.phase === 'intro') {
      // Intro dolly down the first bend, previewing the route.
      const idx = Math.min(this.introI, 2);
      const introPos = [
        new THREE.Vector3(0, 8, 18),
        new THREE.Vector3(2.5, 6.5, 13),
        new THREE.Vector3(0, 5.5, 12),
      ];
      const introLook = [
        new THREE.Vector3(0, 1, 2),
        new THREE.Vector3(-2, 1, -8),
        new THREE.Vector3(0, 0.8, -4),
      ];
      this.camera.position.lerp(introPos[idx], 1 - Math.pow(0.02, dt));
      this.camera.lookAt(introLook[idx]);
    } else {
      // Chase camera aligned to the trail, so bends read before they arrive
      // instead of swinging into view at the last moment.
      const tan = this.trail.tangentAt(Math.min(projection.t + 0.03, 1));
      const f = this.cameraFraming();
      const back = tan.clone().multiplyScalar(-(9.5 + f.backAdd));
      const target = new THREE.Vector3(
        this.hero.position.x + back.x + f.lateral,
        this.hero.position.y + 5.6 * f.heightMul,
        this.hero.position.z + back.z,
      );
      this.camera.position.lerp(target, 1 - Math.pow(0.0018, dt));
      const look = this.hero.position.clone().add(tan.multiplyScalar(4.5 + f.lookAhead));
      this.camera.lookAt(look.x, this.hero.position.y + 1.1 + f.lookUp, look.z);
    }

    this.renderFrame();
  };
}

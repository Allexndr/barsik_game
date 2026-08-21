import * as THREE from 'three';
import {
  BaseLevelScene, type BaseHud, zoneDisc, spawnPad, questMarker,
  loadCharModel, loadPropModel, placeWoodSign,
} from './BaseLevelScene';
import { AYA_LOOK } from '../characterLooks';
import { createPlushCharacter } from '../PlushCharacter';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { placeAmbientCritters, placeS1Prop } from '../s1Place';
import { CAST_PROP_GLB } from '../castModels';
import { AudioManager } from '@/audio/AudioManager';

/**
 * Level 14 «Поделись теплом» — GDD Level 14.
 *
 * Three acts around one resource:
 *   warm     — meet a shivering Aya, learn that warmth drains away from
 *              fire and comes back at it;
 *   search   — hunt the scarf across a wide field, with campfires as
 *              waypoints so the meter shapes the route instead of punishing;
 *   firewood — the scarf alone does not fix cold, so build her own fire.
 *
 * The old version put the scarf in the drift nearest spawn, so the whole
 * level resolved in about ten seconds and the warmth meter never mattered.
 */

export type L14Phase = 'intro' | 'warm' | 'search' | 'firewood' | 'outro';

export interface L14Hud extends BaseHud {
  warmth: number;
  hasScarf: boolean;
  sneezing: boolean;
  logsDelivered: number;
  logsTotal: number;
}

/** Campfires double as the route: each one is a safe island. */
const CAMPFIRES: Array<[x: number, z: number]> = [
  [7, -3],
  [-13, -15],
  [12, -25],
];

/** The scarf is deliberately in the farthest drift, not the nearest. */
const DRIFTS: Array<[x: number, z: number, hasScarf: boolean]> = [
  [-7, -3, false],
  [8, -9, false],
  [-15, -8, false],
  [5, -18, false],
  [-9, -22, false],
  [17, -16, false],
  [-19, -28, false],
  [14, -31, true],
];

/** Firewood for Aya's own fire, gathered in the last act. */
const LOGS: Array<[x: number, z: number]> = [
  [-11, -6],
  [10, -13],
  [-4, -27],
];

const AYA_POS = new THREE.Vector3(0, 0, -11);

export class Level14Scene extends BaseLevelScene {
  private phase: L14Phase = 'intro';
  private onHud: ((h: L14Hud) => void) | null = null;
  private introI = 0;
  private nextAt = 0;
  private hasScarf = false;
  private warmth = 100;
  private sneezing = false;
  private sneezeUntil = 0;
  private ayaMarker: THREE.Object3D | null = null;
  private ayaGroup: THREE.Object3D | null = null;
  private drifts: THREE.Object3D[] = [];
  private searched = 0;
  private campfires: Array<{ pos: THREE.Vector3; flame: THREE.Mesh }> = [];
  private logs: Array<{ mesh: THREE.Object3D; taken: boolean }> = [];
  private carryingLog: THREE.Object3D | null = null;
  private logsDelivered = 0;
  private readonly logsTotal = LOGS.length;
  private ayaFire: THREE.Group | null = null;
  private lastWarmthHud = 100;
  private beatMsg: { ru: string; kk: string } | null = null;
  private beatUntil = 0;

  protected currentPhase() { return this.phase; }

  protected onMovementHintDismiss() {
    this.pushHud();
  }

  private get isActive() {
    return this.phase === 'warm' || this.phase === 'search' || this.phase === 'firewood';
  }

  private setBeat(ru: string, kk: string) {
    this.beatMsg = { ru, kk };
    this.beatUntil = performance.now() + 5000;
  }

  /** Distance to the nearest lit fire, used for the warmth meter. */
  private nearestFireDistance() {
    let best = Infinity;
    for (const f of this.campfires) best = Math.min(best, this.hero.position.distanceTo(f.pos));
    if (this.ayaFire?.visible) best = Math.min(best, this.hero.position.distanceTo(AYA_POS));
    return best;
  }

  tryInteract() {
    if (!this.isActive) return;
    const t = this.interactTarget;
    if (!t) return;

    // ── Firewood act ───────────────────────────────────────────
    if (this.phase === 'firewood') {
      if (!this.carryingLog) {
        const log = this.logs.find((l) => l.mesh === t && !l.taken);
        if (!log) return;
        log.taken = true;
        this.carryingLog = log.mesh;
        this.stars += 2;
        AudioManager.sfx('collect');
        this.spawnSparks(log.mesh.position, 8, [0xd4a373, 0xffe0b2]);
        this.pushHud();
        return;
      }
      if (t !== this.ayaMarker) return;
      this.carryingLog.visible = false;
      this.carryingLog = null;
      this.logsDelivered++;
      this.stars += 4;
      AudioManager.sfx('success');
      this.growAyaFire();
      if (this.logsDelivered >= this.logsTotal) {
        this.phase = 'outro';
        this.stars += 10;
        this.spawnSparks(AYA_POS, 28, [0xff8a3d, 0xffd700]);
        AudioManager.sfx('levelComplete');
      }
      this.pushHud();
      return;
    }

    // ── Searching drifts ───────────────────────────────────────
    const drift = this.drifts.find((d) => d === t);
    if (drift && !this.hasScarf) {
      if (drift.userData.searched) return;
      drift.userData.searched = true;
      this.searched++;
      const marker = drift.userData.marker as THREE.Object3D | undefined;
      if (marker) marker.visible = false;

      if (drift.userData.hasScarf) {
        this.hasScarf = true;
        this.stars += 6;
        drift.visible = false;
        AudioManager.sfx('found');
        this.spawnSparks(drift.position, 16, [0xff6b6b, 0xffd700]);
        this.setBeat('Шарф! Скорее к Айе!', 'Орамал! Тезірек Айяға!');
      } else {
        this.stars += 1;
        AudioManager.sfx('interact');
        this.spawnSparks(drift.position, 8, [0xe1f5fe, 0xffffff]);
      }
      this.pushHud();
      return;
    }

    // ── Handing the scarf over ─────────────────────────────────
    if (this.hasScarf && t === this.ayaMarker && this.phase === 'search') {
      this.stars += 8;
      this.spawnSparks(AYA_POS, 20, [0xff6b6b, 0xffd700]);
      AudioManager.sfx('success');
      const scarf = this.ayaGroup?.userData.scarf as THREE.Mesh | undefined;
      if (scarf) scarf.visible = true;
      this.phase = 'firewood';
      this.setBeat(
        'Уже теплее! Но шарфа мало — принеси дрова, разожжём ей костёр.',
        'Жылырақ! Бірақ орамал аз — отын әкел, оған от жағамыз.',
      );
      for (const l of this.logs) l.mesh.visible = true;
      this.pushHud();
      return;
    }

    // ── First act: reach Aya, learn the meter ──────────────────
    if (this.phase === 'warm' && t === this.ayaMarker) {
      this.phase = 'search';
      this.stars += 3;
      this.setBeat(
        'Айя замёрзла. Её шарф унесло ветром — обыщи сугробы!',
        'Айя тоңып қалды. Орамалын жел ұшырып кеткен — қар үйінділерін тінт!',
      );
      for (const d of this.drifts) {
        const m = d.userData.marker as THREE.Object3D | undefined;
        if (m) m.visible = true;
      }
      this.pushHud();
    }
  }

  private growAyaFire() {
    if (!this.ayaFire) return;
    this.ayaFire.visible = true;
    this.ayaFire.scale.setScalar(0.5 + this.logsDelivered * 0.28);
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L14Hud) => void) {
    this.nick = nick || this.defaultNick(lang);
    this.lang = lang;
    this.onHud = onHud;
    const loader = createGameGltfLoader();

    this.camera.position.set(0, 8, 17);
    this.reserve(AYA_POS.x, AYA_POS.z, 5);
    for (const [x, z] of CAMPFIRES) this.reserve(x, z, 3.5);
    for (const [x, z] of DRIFTS) this.reserve(x, z, 2.6);
    for (const [x, z] of LOGS) this.reserve(x, z, 2.6);

    await this.setupWinterEnvironment(loader, {
      sky: ['#4a6a8a', '#8ab0c8', '#d0e8f0'],
      decorCount: 44,
      decorCenterZ: -16,
      terrain: {
        relief: 0.95,
        rimHeight: 3.8,
        playHalfExtent: 36,
        seed: 14,
        features: [
          { kind: 'flat', x: 0, z: -16, r: 26 },
          { kind: 'mound', x: -27, z: -20, r: 10, height: 2.6 },
          { kind: 'mound', x: 26, z: -9, r: 11, height: 3.0 },
        ],
      },
    });

    AYA_POS.y = this.groundHeightAt(AYA_POS.x, AYA_POS.z);
    this.scene.add(zoneDisc(0, 5, 3.6, 0xe1f5fe, this.groundHeightAt(0, 5) + 0.04));
    this.scene.add(zoneDisc(AYA_POS.x, AYA_POS.z, 4.2, 0xff6b6b, AYA_POS.y + 0.05));
    const pad = spawnPad(0, 5);
    this.snapToGround(pad);
    this.scene.add(pad);
    this.scene.add(await placeWoodSign(loader, -3, 3.5, 0.3, 0xe1f5fe));

    // ── Aya ──────────────────────────────────────────────────────
    const ayaGlb = await loadCharModel(loader, 'aya.glb', 1.3);
    this.ayaGroup = ayaGlb ?? createPlushCharacter(AYA_LOOK);
    this.ayaGroup.position.copy(AYA_POS);
    this.ayaGroup.rotation.y = Math.PI;
    // Крупнее: с игровой камеры в девяти метрах предмет меньше двух третей
    // метра ребёнок не опознаёт как «то, что надо взять». Тот же класс, что
    // яблоки на L2, только тонуть здесь не в чем — снег без высокой травы.
    const scarfGlb = await loadPropModel(loader, CAST_PROP_GLB.scarf, { maxSize: 0.82 });
    const scarf = scarfGlb ?? new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.08, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xff6b6b, emissive: 0xff6b6b, emissiveIntensity: 0.3 }),
    );
    if (scarfGlb) scarf.position.set(0, 1.05, 0.08);
    else { scarf.position.y = 1.05; scarf.rotation.x = Math.PI / 2; }
    scarf.visible = false;
    this.ayaGroup.add(scarf);
    this.ayaGroup.userData.scarf = scarf;
    this.snapToGround(this.ayaGroup);
    this.scene.add(this.ayaGroup);

    this.ayaMarker = questMarker(0xff6b6b, 0xff9f43);
    this.ayaMarker.position.copy(AYA_POS);
    this.scene.add(this.ayaMarker);
    this.colliders.push({ kind: 'circle', x: AYA_POS.x, z: AYA_POS.z, r: 1.0 });

    // Aya's own fire, built in the last act.
    this.ayaFire = new THREE.Group();
    const ayaFlame = new THREE.Mesh(
      new THREE.ConeGeometry(0.42, 0.9, 7),
      new THREE.MeshBasicMaterial({ color: 0xff8a3d }),
    );
    ayaFlame.position.y = 0.6;
    const ayaLight = new THREE.PointLight(0xff9f43, 1.6, 9, 2);
    ayaLight.position.y = 0.9;
    this.ayaFire.add(ayaFlame, ayaLight);
    this.ayaFire.position.set(AYA_POS.x + 1.8, AYA_POS.y, AYA_POS.z + 0.6);
    this.ayaFire.visible = false;
    this.scene.add(this.ayaFire);

    // ── Campfires as safe islands ────────────────────────────────
    for (const [x, z] of CAMPFIRES) {
      const y = this.groundHeightAt(x, z);
      const camp = await placeS1Prop(loader, 'campfire', { x, z, maxSize: 1.3 });
      if (camp) this.scene.add(camp);
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.34, 0.72, 6),
        new THREE.MeshBasicMaterial({ color: 0xff6f00 }),
      );
      flame.position.set(x, y + 0.55, z);
      const light = new THREE.PointLight(0xff9f43, 1.3, 8, 2);
      light.position.set(x, y + 0.9, z);
      this.scene.add(flame, light, zoneDisc(x, z, 2.8, 0xff9800, y + 0.05));
      this.campfires.push({ pos: new THREE.Vector3(x, y, z), flame });
    }

    // ── Drifts ───────────────────────────────────────────────────
    const snowPileTpl = await loadPropModel(loader, CAST_PROP_GLB.snow_pile, { maxSize: 1.5 });
    for (const [x, z, hasScarf] of DRIFTS) {
      const y = this.groundHeightAt(x, z);
      let drift: THREE.Object3D;
      if (snowPileTpl) {
        drift = snowPileTpl.clone(true);
        drift.position.set(x, 0, z);
        this.snapToGround(drift);
      } else {
        drift = new THREE.Mesh(
          new THREE.SphereGeometry(0.8, 10, 8),
          new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
        );
        drift.position.set(x, y + 0.45, z);
        drift.scale.y = 0.55;
        drift.castShadow = true;
      }
      drift.userData.hasScarf = hasScarf;
      drift.userData.searched = false;

      // A "?" over an unsearched drift; hidden until the search act begins.
      const q = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xffeaa7, emissive: 0xfdcb6e, emissiveIntensity: 0.7 }),
      );
      q.position.set(x, y + 1.35, z);
      q.visible = false;
      drift.userData.marker = q;
      this.drifts.push(drift);
      this.scene.add(drift, q);
    }

    // ── Firewood ─────────────────────────────────────────────────
    const logMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.95 });
    for (const [x, z] of LOGS) {
      const y = this.groundHeightAt(x, z);
      const log = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.9, 7), logMat);
        stick.rotation.z = Math.PI / 2;
        stick.rotation.y = i * 0.5;
        stick.position.set(0, 0.1 + i * 0.16, (i - 1) * 0.12);
        stick.castShadow = true;
        log.add(stick);
      }
      log.position.set(x, y, z);
      log.visible = false;
      this.logs.push({ mesh: log, taken: false });
      this.scene.add(log);
    }

    await this.placeProps(loader, [
      { key: 'pine_tree', opts: { x: -11, z: -5, maxSize: 3.0 } },
      { key: 'pine_tree', opts: { x: 15, z: -20, maxSize: 2.8 } },
      { key: 'pine_tree', opts: { x: -21, z: -24, maxSize: 3.2 } },
      { key: 'rock_snow', opts: { x: 10, z: -6, maxSize: 1.4 } },
      { key: 'rock_snow', opts: { x: -17, z: -18, maxSize: 1.3 } },
      { key: 'tent', opts: { x: 9.5, z: -1, maxSize: 1.8, rotY: -0.6 } },
      { key: 'lantern', opts: { x: 5, z: -2, maxSize: 0.65 } },
      { key: 'snow_pile', opts: { x: -6, z: -31, maxSize: 1.2 } },
      { key: 'tree_decorated', opts: { x: 20, z: -30, maxSize: 2.4 } },
    ]);
    await placeAmbientCritters(this.scene, loader, [
      { key: 'fox', x: 8, z: 1, rotY: -1.5, h: 0.8 },
      { key: 'rabbit', x: -8, z: -1, rotY: 0.4, h: 0.65 },
      { key: 'polar', x: -12, z: -12, rotY: 0.8, h: 0.9 },
      { key: 'penguin', x: 16, z: -27, rotY: -0.9, h: 0.75 },
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
    const warmthIcon = this.warmth > 60 ? '🔥' : this.warmth > 25 ? '🌡️' : '🥶';

    if (p === 'intro') {
      const lines = [
        this.copy('Айя дрожит от холода...', 'Айя суықтан дірілдейді...'),
        this.copy(`Подойди к ней, ${n}. Рядом с костром теплее.`, `Оған жақында, ${n}. От жанында жылырақ.`),
        this.copy('Следи за шкалой тепла — грейся у костров.', 'Жылу шкаласын қада — от жанында жылын.'),
      ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = this.copy('🧣 Подойди к Айе', '🧣 Айяға жақында');
    } else if (p === 'warm') {
      if (!line) {
        line = this.sneezing
          ? this.copy('Апчхи! Погрейся у костра.', 'Апчхи! От жанында жылын.')
          : this.copy('Айя совсем замёрзла. Подойди к ней.', 'Айя мүлде тоңып қалды. Оған жақында.');
      }
      objective = this.copy(`${warmthIcon} Тепло: ${Math.round(this.warmth)}%`, `${warmthIcon} Жылу: ${Math.round(this.warmth)}%`);
    } else if (p === 'search') {
      if (!line) {
        line = this.hasScarf
          ? this.copy('Шарф у тебя! Неси Айе.', 'Орамал сенде! Айяға апар.')
          : this.sneezing
            ? this.copy('Апчхи! Скорее к костру.', 'Апчхи! Тезірек отқа.')
            : this.copy(`Обыскано сугробов: ${this.searched}/${this.drifts.length}`, `Тінтілген үйінді: ${this.searched}/${this.drifts.length}`);
      }
      objective = this.hasScarf
        ? this.copy(`🧣 Отдай шарф Айе  ·  ${warmthIcon} ${Math.round(this.warmth)}%`, `🧣 Орамалды Айяға бер  ·  ${warmthIcon} ${Math.round(this.warmth)}%`)
        : this.copy(`🔍 ${this.searched}/${this.drifts.length}  ·  ${warmthIcon} ${Math.round(this.warmth)}%`, `🔍 ${this.searched}/${this.drifts.length}  ·  ${warmthIcon} ${Math.round(this.warmth)}%`);
    } else if (p === 'firewood') {
      if (!line) {
        line = this.carryingLog
          ? this.copy('Неси дрова Айе!', 'Отынды Айяға апар!')
          : this.copy(`Дрова: ${this.logsDelivered}/${this.logsTotal}. Найди ещё!`, `Отын: ${this.logsDelivered}/${this.logsTotal}. Тағы тап!`);
      }
      objective = this.copy(
        `🪵 ${this.logsDelivered}/${this.logsTotal}  ·  ${warmthIcon} ${Math.round(this.warmth)}%`,
        `🪵 ${this.logsDelivered}/${this.logsTotal}  ·  ${warmthIcon} ${Math.round(this.warmth)}%`,
      );
    } else if (p === 'outro') {
      speaker = this.copy('Айя', 'Айя');
      line = this.copy(
        'Теперь так тепло! Спасибо, что не бросил меня. Смотри — снеговик тает!',
        'Енді өте жылы! Тастамағаның үшін рахмет. Қара — аққала еріп жатыр!',
      );
      objective = this.copy('⛄ К снеговику!', '⛄ Аққалаға!');
    }

    this.onHud?.({
      phase: p, speaker, line, objective,
      warmth: this.warmth,
      hasScarf: this.hasScarf,
      sneezing: this.sneezing,
      logsDelivered: this.logsDelivered,
      logsTotal: this.logsTotal,
      stars: this.stars,
      canInteract: Boolean(this.interactTarget),
      showMoveHint: !this.hasTakenFirstStep && (p === 'intro' || p === 'warm'),
      showActionHint: Boolean(this.interactTarget),
      outro: p === 'outro',
    });
  }

  private nearestInteract(): THREE.Object3D | null {
    const hp = this.hero.position;
    if (this.phase === 'firewood') {
      if (this.carryingLog) return hp.distanceTo(AYA_POS) < 2.8 ? this.ayaMarker : null;
      for (const l of this.logs) {
        if (l.taken) continue;
        if (hp.distanceTo(l.mesh.position) < 2.2) return l.mesh;
      }
      return null;
    }
    if (this.phase === 'warm') {
      return hp.distanceTo(AYA_POS) < 2.8 ? this.ayaMarker : null;
    }
    if (this.phase !== 'search') return null;
    if (this.hasScarf) return hp.distanceTo(AYA_POS) < 2.8 ? this.ayaMarker : null;
    for (const d of this.drifts) {
      if (d.userData.searched || !d.visible) continue;
      if (hp.distanceTo(d.position) < 2.3) return d;
    }
    return null;
  }

  private objectiveWorldPos(): THREE.Vector3 | null {
    if (!this.isActive) return null;
    if (this.phase === 'warm') return AYA_POS.clone();
    if (this.phase === 'firewood') {
      if (this.carryingLog) return AYA_POS.clone();
      const hp = this.hero.position;
      let best: THREE.Vector3 | null = null;
      let bestD = Infinity;
      for (const l of this.logs) {
        if (l.taken) continue;
        const d = hp.distanceTo(l.mesh.position);
        if (d < bestD) { bestD = d; best = l.mesh.position.clone(); }
      }
      return best;
    }
    if (this.hasScarf) return AYA_POS.clone();
    const hp = this.hero.position;
    let best: THREE.Vector3 | null = null;
    let bestD = Infinity;
    for (const d of this.drifts) {
      if (d.userData.searched || !d.visible) continue;
      const dist = hp.distanceTo(d.position);
      if (dist < bestD) { bestD = dist; best = d.position.clone(); }
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
      if (this.introI >= 3) this.phase = 'warm';
      else this.nextAt = now + 2600;
      this.pushHud();
    }

    // Warmth is slowed, not stopped, while cold — never a fail state.
    const chilled = this.warmth < 25;
    this.updateMovement(
      dt,
      this.isActive,
      this.baseSpeed * (chilled ? 0.82 : 1),
      -32, 32, -38, 10,
    );

    if (this.isActive) {
      const fireDist = this.nearestFireDistance();
      if (fireDist < 3.2) {
        this.warmth = Math.min(100, this.warmth + dt * 26);
      } else {
        this.warmth = Math.max(0, this.warmth - dt * 2.6);
      }

      if (this.warmth <= 0 && !this.sneezing) {
        // Spec: warmth zero is a sneeze, not a death.
        this.sneezing = true;
        this.sneezeUntil = now + 1800;
        this.warmth = 28;
        AudioManager.sfx('stumble');
        this.spawnSparks(this.hero.position, 8, [0xe1f5fe, 0xb3e5fc]);
        this.pushHud();
      }
      if (this.sneezing && now > this.sneezeUntil) {
        this.sneezing = false;
        this.pushHud();
      }
      if (Math.abs(this.warmth - this.lastWarmthHud) > 4) {
        this.lastWarmthHud = this.warmth;
        this.pushHud();
      }
    }

    // Aya shivers until she has both scarf and fire.
    if (this.ayaGroup) {
      const settled = this.phase === 'outro';
      const shiver = settled ? 0 : this.hasScarf ? 0.008 : 0.02;
      this.ayaGroup.position.x = AYA_POS.x + Math.sin(now * 0.02) * shiver;
    }
    for (const f of this.campfires) {
      f.flame.scale.y = 1 + Math.sin(now * 0.008 + f.pos.x) * 0.16;
    }
    if (this.ayaFire?.visible) {
      this.ayaFire.rotation.y += dt * 0.4;
    }
    for (const d of this.drifts) {
      const m = d.userData.marker as THREE.Object3D | undefined;
      if (m?.visible) m.position.y = this.groundHeightAt(d.position.x, d.position.z) + 1.35
        + Math.sin(now * 0.004 + d.position.x) * 0.08;
    }
    if (this.carryingLog) {
      this.carryingLog.position.set(
        this.hero.position.x,
        this.hero.position.y + 1.45 + Math.sin(now * 0.005) * 0.04,
        this.hero.position.z,
      );
    }

    if (this.ayaMarker) {
      this.ayaMarker.visible = this.phase === 'warm'
        || (this.phase === 'search' && this.hasScarf)
        || (this.phase === 'firewood' && Boolean(this.carryingLog));
    }

    this.updateGuideArrow(now, this.objectiveWorldPos(), ['intro', 'outro']);

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
        new THREE.Vector3(-2.5, 4.5, -6),
        new THREE.Vector3(0, 6, 11),
      ];
      const introLook = [
        new THREE.Vector3(0, 1.2, 2),
        AYA_POS.clone().setY(1.3),
        new THREE.Vector3(3, 0.9, -3),
      ];
      this.camera.position.lerp(introPos[idx], 1 - Math.pow(0.02, dt));
      this.camera.lookAt(introLook[idx]);
    } else {
      const f = this.cameraFraming();
      const target = new THREE.Vector3(
        this.cameraLateral(this.hero.position.x) + f.lateral,
        this.hero.position.y + 6.2 * f.heightMul,
        this.hero.position.z + 10.5 + f.backAdd,
      );
      this.camera.position.lerp(target, 1 - Math.pow(0.0015, dt));
      this.camera.lookAt(
        this.cameraLateral(this.hero.position.x),
        this.hero.position.y + 1.25 + f.lookUp,
        this.hero.position.z - 2.5 - f.lookAhead,
      );
    }

    this.renderFrame();
  };
}

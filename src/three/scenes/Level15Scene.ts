import * as THREE from 'three';
import {
  BaseLevelScene, type BaseHud, zoneDisc, spawnPad, questMarker,
  loadPropModel, placeWoodSign,
} from './BaseLevelScene';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { placeMany, placeAmbientCritters, placeS1Prop } from '../s1Place';
import { AudioManager } from '@/audio/AudioManager';

/**
 * Level 15 «Спасти снеговика» — GDD Level 15.
 *
 * Structured as three acts so the soft timer has somewhere to build:
 *   first    — one drift close by, fully guided: learn carry and deliver;
 *   pressure — two more from across the field, sun out, timer biting;
 *   features — the snowman is stable, now give him his face back.
 *
 * The old version was one flat loop of three short round trips (~60s of
 * play against a 260s target) with the timer already at full pressure on
 * the very first pickup.
 */

export type L15Phase = 'intro' | 'first' | 'pressure' | 'features' | 'outro';

export interface L15Hud extends BaseHud {
  chunksDelivered: number;
  chunksTotal: number;
  featuresDelivered: number;
  featuresTotal: number;
  carrying: boolean;
  snowmanSize: number;
  timerSec: number;
}

/** Pieces of the snowman's face, and where they sit once returned. */
const FEATURES: Array<{
  key: 'carrot' | 'winter_hat' | 'scarf' | 'pinecone';
  id: string;
  x: number;
  z: number;
  size: number;
  slot: [number, number, number];
}> = [
  { key: 'carrot', id: 'nose', x: -17, z: -6, size: 0.42, slot: [0, 2.05, 0.5] },
  { key: 'winter_hat', id: 'hat', x: 16, z: -22, size: 0.5, slot: [0, 2.72, 0] },
  { key: 'scarf', id: 'scarf', x: -14, z: -27, size: 0.55, slot: [0, 1.62, 0.08] },
  { key: 'pinecone', id: 'buttons', x: 19, z: -9, size: 0.34, slot: [0, 1.2, 0.55] },
];

/** Drifts: the first sits close, the rest are a real walk away. */
const DRIFTS: Array<[x: number, z: number]> = [
  [-6, -4],
  [14, -14],
  [-15, -18],
  [10, -28],
  [-9, -31],
];

interface Carryable {
  root: THREE.Object3D;
  marker: THREE.Object3D | null;
  kind: 'chunk' | 'feature';
  id: string;
  slot?: [number, number, number];
  delivered: boolean;
}

export class Level15Scene extends BaseLevelScene {
  private phase: L15Phase = 'intro';
  private onHud: ((h: L15Hud) => void) | null = null;
  private introI = 0;
  private nextAt = 0;
  private chunksDelivered = 0;
  private readonly chunksTotal = 3;
  private featuresDelivered = 0;
  private readonly featuresTotal = FEATURES.length;
  private carrying: Carryable | null = null;
  private chunkTimer = 0;
  private timerActive = false;
  private snowmanPos = new THREE.Vector3(0, 0, -12);
  private snowman: THREE.Object3D | null = null;
  private snowmanMarker: THREE.Object3D | null = null;
  private items: Carryable[] = [];
  private meltLevel = 0;
  private sunbeam: THREE.Mesh | null = null;
  private beatMsgUntil = 0;
  private beatMsg: { ru: string; kk: string } | null = null;

  protected currentPhase() { return this.phase; }

  protected onMovementHintDismiss() {
    this.pushHud();
  }

  /** Timer eases in: forgiving on the first run, tighter once melting bites. */
  private get chunkTimeLimit() {
    return this.phase === 'first' ? 45 : 32;
  }

  private get isCarryPhase() {
    return this.phase === 'first' || this.phase === 'pressure' || this.phase === 'features';
  }

  tryInteract() {
    if (!this.isCarryPhase) return;
    const t = this.interactTarget;
    if (!t) return;

    if (!this.carrying) {
      const item = this.items.find((i) => i.root === t && i.root.visible && !i.delivered);
      if (!item) return;
      this.carrying = item;
      item.root.visible = false;
      if (item.marker) item.marker.visible = false;
      if (item.kind === 'chunk') {
        this.timerActive = true;
        this.chunkTimer = this.chunkTimeLimit;
      }
      this.stars += 2;
      this.spawnSparks(item.root.position, 8, [0xe1f5fe, 0xffffff]);
      AudioManager.sfx('collect');
      this.pushHud();
      return;
    }

    if (t !== this.snowmanMarker) return;
    const item = this.carrying;
    this.carrying = null;
    this.timerActive = false;
    item.delivered = true;

    if (item.kind === 'chunk') {
      this.chunksDelivered++;
      this.meltLevel = Math.max(0, this.meltLevel - 0.35);
      this.stars += 5;
      this.updateSnowmanScale();
      this.spawnSparks(this.snowmanPos, 14, [0xe1f5fe, 0xffd700]);
      AudioManager.sfx('success');

      if (this.chunksDelivered === 1 && this.phase === 'first') {
        this.phase = 'pressure';
        this.setBeat(
          'Солнце вышло! Снеговик тает быстрее — неси ещё два куска.',
          'Күн шықты! Аққала тезірек еріп жатыр — тағы екі кесек әкел.',
        );
        if (this.sunbeam) this.sunbeam.visible = true;
      } else if (this.chunksDelivered >= this.chunksTotal) {
        this.phase = 'features';
        this.meltLevel = 0;
        this.setBeat(
          'Он спасён! Но где его нос, шапка и шарф? Ветер разнёс их по полю.',
          'Ол аман! Бірақ мұрны, тымағы мен орамалы қайда? Жел оларды далаға шашып жіберді.',
        );
        if (this.sunbeam) this.sunbeam.visible = false;
        for (const i of this.items) {
          if (i.kind === 'feature') i.root.visible = true;
        }
      }
      this.pushHud();
      return;
    }

    // Feature: attach it to the snowman where it belongs.
    this.featuresDelivered++;
    this.stars += 4;
    if (this.snowman && item.slot) {
      const [sx, sy, sz] = item.slot;
      item.root.position.set(this.snowmanPos.x + sx, this.snowmanPos.y + sy, this.snowmanPos.z + sz);
      item.root.visible = true;
    }
    this.spawnSparks(this.snowmanPos, 16, [0xffd700, 0xff8a65]);
    AudioManager.sfx('bonus');

    if (this.featuresDelivered >= this.featuresTotal) {
      this.phase = 'outro';
      this.stars += 12;
      this.spawnSparks(this.snowmanPos, 28, [0xffd700, 0x00cec9]);
      AudioManager.sfx('levelComplete');
    }
    this.pushHud();
  }

  private setBeat(ru: string, kk: string) {
    this.beatMsg = { ru, kk };
    this.beatMsgUntil = performance.now() + 5000;
  }

  private updateSnowmanScale() {
    if (!this.snowman) return;
    const base = 0.72 + this.chunksDelivered * 0.14 - this.meltLevel * 0.18;
    this.snowman.scale.setScalar(Math.max(0.5, base));
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L15Hud) => void) {
    this.nick = nick || 'друг';
    this.lang = lang;
    this.onHud = onHud;
    const loader = createGameGltfLoader();

    this.camera.position.set(0, 8, 18);
    this.reserve(0, -12, 5);
    for (const [x, z] of DRIFTS) this.reserve(x, z, 3);
    for (const f of FEATURES) this.reserve(f.x, f.z, 3);

    await this.setupWinterEnvironment(loader, {
      sunColor: 0xfff3e0,
      sky: ['#5a7a9a', '#9ab0c8', '#d0e8f0'],
      decorCount: 46,
      decorCenterZ: -14,
      terrain: {
        relief: 0.9,
        rimHeight: 3.8,
        playHalfExtent: 36,
        seed: 15,
        features: [
          { kind: 'flat', x: 0, z: -14, r: 26 },
          { kind: 'mound', x: -26, z: -22, r: 11, height: 2.8 },
          { kind: 'mound', x: 27, z: -18, r: 10, height: 2.4 },
        ],
      },
    });

    this.scene.add(zoneDisc(0, 6, 4, 0xe1f5fe, this.groundHeightAt(0, 6) + 0.04));
    this.scene.add(zoneDisc(0, -12, 4.4, 0x4fc3f7, this.groundHeightAt(0, -12) + 0.05));
    const pad = spawnPad(0, 6);
    this.snapToGround(pad);
    this.scene.add(pad);
    this.scene.add(await placeWoodSign(loader, -3, 4, 0.3, 0xe1f5fe));

    // ── Snowman ──────────────────────────────────────────────────
    this.snowmanPos.y = this.groundHeightAt(0, -12);
    const snowGlb = await loadPropModel(loader, 'snowman.glb', { height: 3.0 });
    this.snowman = snowGlb ?? this.makeSnowman();
    this.snowman.position.copy(this.snowmanPos);
    this.snowman.scale.setScalar(0.72);
    this.scene.add(this.snowman);
    this.colliders.push({ kind: 'circle', x: 0, z: -12, r: 1.2 });

    this.snowmanMarker = questMarker(0x4fc3f7, 0x81d4fa);
    this.snowmanMarker.position.copy(this.snowmanPos);
    this.scene.add(this.snowmanMarker);

    // Shaft of sunlight that appears when the melt accelerates — the level
    // states its own pressure instead of only saying it in the HUD.
    this.sunbeam = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 1.4, 14, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffe0a3, transparent: true, opacity: 0.16,
        side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    this.sunbeam.position.set(0, this.snowmanPos.y + 7, -12);
    this.sunbeam.visible = false;
    this.scene.add(this.sunbeam);

    // ── Snow drifts ──────────────────────────────────────────────
    for (const [x, z] of DRIFTS) {
      const y = this.groundHeightAt(x, z);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 10, 8),
        new THREE.MeshStandardMaterial({
          color: 0xffffff, roughness: 0.86,
          emissive: 0xe1f5fe, emissiveIntensity: 0.18,
        }),
      );
      mesh.position.set(x, y + 0.3, z);
      mesh.scale.y = 0.55;
      mesh.castShadow = true;
      const marker = questMarker(0xe3f2fd, 0x90caf9);
      marker.position.set(x, y, z);
      marker.scale.setScalar(0.6);
      // Hidden until it is the nearest live objective — five lit beams at once
      // turn the field into a forest of lollipops and point nowhere.
      marker.visible = false;
      this.items.push({ root: mesh, marker, kind: 'chunk', id: `chunk_${x}_${z}`, delivered: false });
      this.scene.add(mesh, marker);
    }

    // ── Scattered features, revealed in the last act ─────────────
    for (const f of FEATURES) {
      const obj = await placeS1Prop(loader, f.key, { x: f.x, z: f.z, maxSize: f.size });
      if (!obj) continue;
      obj.visible = false;
      const marker = questMarker(0xffe0b2, 0xffb74d);
      marker.position.set(f.x, this.groundHeightAt(f.x, f.z), f.z);
      marker.scale.setScalar(0.6);
      marker.visible = false;
      this.items.push({ root: obj, marker, kind: 'feature', id: f.id, slot: f.slot, delivered: false });
      this.scene.add(obj, marker);
    }

    await placeMany(this.scene, loader, [
      { key: 'pine_tree', opts: { x: -11, z: -8, maxSize: 3.0 } },
      { key: 'pine_tree', opts: { x: 13, z: -24, maxSize: 2.6 } },
      { key: 'rock_snow', opts: { x: 9, z: -6, maxSize: 1.5 } },
      { key: 'rock_snow', opts: { x: -18, z: -13, maxSize: 1.3 } },
      { key: 'snow_pile', opts: { x: -7, z: -22, maxSize: 1.3 } },
      { key: 'snow_pile', opts: { x: 20, z: -30, maxSize: 1.1 } },
      { key: 'tree_decorated', opts: { x: -21, z: -3, maxSize: 2.4 } },
      { key: 'pine_tree', opts: { x: 22, z: -5, maxSize: 2.8 } },
      { key: 'pine_tree', opts: { x: -24, z: -30, maxSize: 3.2 } },
      { key: 'pine_tree', opts: { x: 6, z: -34, maxSize: 2.4 } },
      { key: 'rock_snow', opts: { x: -3, z: -25, maxSize: 1.2 } },
      { key: 'rock_snow', opts: { x: 17, z: -33, maxSize: 1.6 } },
      { key: 'snow_pile', opts: { x: 11, z: -19, maxSize: 1.4 } },
      { key: 'snow_pile', opts: { x: -19, z: -24, maxSize: 1.2 } },
      { key: 'snow_pile', opts: { x: 24, z: -12, maxSize: 1.5 } },
      { key: 'bench', opts: { x: -9, z: -9, maxSize: 1.3, rotY: 0.6 } },
      { key: 'snowflake', opts: { x: -12, z: -3, maxSize: 0.5, y: 1.4 } },
      { key: 'snowflake', opts: { x: 8, z: -16, maxSize: 0.45, y: 1.2 } },
    ]);
    await placeAmbientCritters(this.scene, loader, [
      { key: 'fox', x: 8, z: -2, rotY: -0.8, h: 0.8 },
      { key: 'owl', x: -12, z: -16, rotY: 1.0, h: 0.7 },
      { key: 'penguin', x: 15, z: -19, rotY: -1.5, h: 0.75 },
      { key: 'polar', x: -20, z: -9, rotY: 0.6, h: 0.95 },
      { key: 'rabbit', x: 5, z: -26, rotY: 2.1, h: 0.7 },
    ]);

    this.hero.position.set(0, this.groundHeightAt(0, 6), 6);
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

  private makeSnowman(): THREE.Group {
    const g = new THREE.Group();
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
    const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), snowMat);
    bottom.position.y = 0.6; bottom.castShadow = true;
    const mid = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), snowMat);
    mid.position.y = 1.4; mid.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), snowMat);
    head.position.y = 1.95; head.castShadow = true;
    g.add(bottom, mid, head);
    return g;
  }

  private pushHud() {
    const n = this.nick;
    let speaker = 'Барсик';
    let line = '';
    let objective = '';
    const p = this.phase;

    if (this.beatMsg && performance.now() < this.beatMsgUntil && p !== 'intro') {
      line = this.copy(this.beatMsg.ru, this.beatMsg.kk);
    }

    if (p === 'intro') {
      const lines = [
        this.copy('Снеговик тает!', 'Аққала еріп жатыр!'),
        this.copy(`Ему нужен снег, ${n}. Вон сугроб — совсем рядом.`, `Оған қар керек, ${n}. Әне қар үйіндісі — тым жақын.`),
        this.copy('Возьми кусок и неси к снеговику. Не бойся — время мягкое.', 'Кесекті ал да аққалаға апар. Қорықпа — уақыт жұмсақ.'),
      ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = this.copy('⛄ Принеси первый кусок снега', '⛄ Бірінші қар кесегін әкел');
    } else if (p === 'first') {
      if (!line) {
        line = this.carrying
          ? this.copy('Неси снег к снеговику!', 'Қарды аққалаға әкел!')
          : this.copy('Сугроб светится — возьми оттуда снег.', 'Қар үйіндісі жарқырайды — сол жерден қар ал.');
      }
      objective = this.copy(
        `⛄ ${this.chunksDelivered}/${this.chunksTotal}${this.carrying ? ` · ⏱ ${Math.ceil(this.chunkTimer)}с` : ''}`,
        `⛄ ${this.chunksDelivered}/${this.chunksTotal}${this.carrying ? ` · ⏱ ${Math.ceil(this.chunkTimer)}с` : ''}`,
      );
    } else if (p === 'pressure') {
      if (!line) {
        if (this.carrying && this.timerActive) {
          line = this.copy(`Быстрее! ${Math.ceil(this.chunkTimer)} сек`, `Жылдам! ${Math.ceil(this.chunkTimer)} сек`);
        } else {
          line = this.copy(`Принесено: ${this.chunksDelivered}/${this.chunksTotal}`, `Әкелінді: ${this.chunksDelivered}/${this.chunksTotal}`);
        }
      }
      objective = this.copy(
        `⛄ ${this.chunksDelivered}/${this.chunksTotal}${this.carrying ? ` · ⏱ ${Math.ceil(this.chunkTimer)}с` : ''}`,
        `⛄ ${this.chunksDelivered}/${this.chunksTotal}${this.carrying ? ` · ⏱ ${Math.ceil(this.chunkTimer)}с` : ''}`,
      );
    } else if (p === 'features') {
      if (!line) {
        line = this.carrying
          ? this.copy('Отлично! Неси это снеговику.', 'Жарайсың! Мұны аққалаға апар.')
          : this.copy(`Найди всё, что потерял снеговик: ${this.featuresDelivered}/${this.featuresTotal}`, `Аққала жоғалтқанның бәрін тап: ${this.featuresDelivered}/${this.featuresTotal}`);
      }
      objective = this.copy(
        `🧣 ${this.featuresDelivered}/${this.featuresTotal} — нос, шапка, шарф, пуговки`,
        `🧣 ${this.featuresDelivered}/${this.featuresTotal} — мұрын, тымақ, орамал, түйме`,
      );
    } else if (p === 'outro') {
      speaker = this.copy('Снеговик', 'Аққала');
      line = this.copy('Спасибо! Я снова большой и красивый! А вон там — зимний сундук!', 'Рахмет! Мен қайта үлкен әрі әдеміМІН! Ана жерде — қысқы сандық!');
      objective = this.copy('📦 К зимнему сундуку!', '📦 Қысқы сандыққа!');
    }

    this.onHud?.({
      phase: p, speaker, line, objective,
      chunksDelivered: this.chunksDelivered, chunksTotal: this.chunksTotal,
      featuresDelivered: this.featuresDelivered, featuresTotal: this.featuresTotal,
      carrying: Boolean(this.carrying),
      snowmanSize: 0.72 + this.chunksDelivered * 0.14 - this.meltLevel * 0.18,
      timerSec: Math.ceil(this.chunkTimer),
      stars: this.stars,
      canInteract: Boolean(this.interactTarget),
      showMoveHint: !this.hasTakenFirstStep && (p === 'intro' || p === 'first'),
      showActionHint: Boolean(this.interactTarget),
      outro: p === 'outro',
    });
  }

  /** Only the items the current act is about are pickable. */
  private activeItems() {
    const wantFeature = this.phase === 'features';
    return this.items.filter((i) => !i.delivered && (i.kind === 'feature') === wantFeature);
  }

  private nearestInteract(): THREE.Object3D | null {
    const hp = this.hero.position;
    if (this.carrying) {
      return hp.distanceTo(this.snowmanPos) < 2.8 ? this.snowmanMarker : null;
    }
    for (const item of this.activeItems()) {
      if (!item.root.visible) continue;
      if (hp.distanceTo(item.root.position) < 2.4) return item.root;
    }
    return null;
  }

  private objectiveWorldPos(): THREE.Vector3 | null {
    if (!this.isCarryPhase) return null;
    if (this.carrying) return this.snowmanPos.clone();
    const hp = this.hero.position;
    let best: THREE.Vector3 | null = null;
    let bestD = Infinity;
    for (const item of this.activeItems()) {
      if (!item.root.visible) continue;
      const d = hp.distanceTo(item.root.position);
      if (d < bestD) { bestD = d; best = item.root.position.clone(); }
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
      if (this.introI >= 3) this.phase = 'first';
      else this.nextAt = now + 2600;
      this.pushHud();
    }

    const canMove = this.isCarryPhase;
    this.updateMovement(dt, canMove, this.baseSpeed, -30, 30, -36, 10);

    if (this.phase === 'first' || this.phase === 'pressure') {
      // Melt only bites once the sun is out; the first run stays gentle.
      const meltRate = this.phase === 'pressure' ? 0.016 : 0.005;
      this.meltLevel = Math.min(0.8, this.meltLevel + dt * meltRate);
      this.updateSnowmanScale();

      if (this.timerActive && this.carrying) {
        const before = Math.ceil(this.chunkTimer);
        this.chunkTimer -= dt;
        if (Math.ceil(this.chunkTimer) !== before) {
          if (Math.ceil(this.chunkTimer) <= 5) AudioManager.sfx('tick');
          this.pushHud();
        }
        if (this.chunkTimer <= 0) {
          // No fail: the snow melts in your paws and the drift comes back.
          const dropped = this.carrying;
          this.carrying = null;
          this.timerActive = false;
          dropped.root.visible = true;
          if (dropped.marker) dropped.marker.visible = true;
          this.meltLevel = Math.min(0.8, this.meltLevel + 0.15);
          this.spawnSparks(this.hero.position, 10, [0x81d4fa, 0xe1f5fe]);
          AudioManager.sfx('stumble');
          this.setBeat('Снег растаял в лапках! Возьми ещё — ничего страшного.', 'Қар алақанда еріп кетті! Тағы ал — ештеңе етпейді.');
          this.pushHud();
        }
      }
    }

    // Carried item rides above the hero so the state is always visible.
    if (this.carrying) {
      this.carrying.root.visible = true;
      this.carrying.root.position.set(
        this.hero.position.x,
        this.hero.position.y + 1.5 + Math.sin(now * 0.005) * 0.05,
        this.hero.position.z,
      );
    }

    if (this.sunbeam?.visible) {
      const m = this.sunbeam.material as THREE.MeshBasicMaterial;
      m.opacity = 0.13 + Math.sin(now * 0.0016) * 0.05;
    }

    for (const item of this.items) {
      if (item.delivered || item.kind !== 'chunk' || !item.root.visible) continue;
      if (this.carrying?.root === item.root) continue;
      item.root.position.y = this.groundHeightAt(item.root.position.x, item.root.position.z)
        + 0.3 + Math.sin(now * 0.003 + item.root.position.x) * 0.04;
    }

    // Light only the beam the player is being sent to, and only while they
    // are not already carrying something.
    const objective = this.objectiveWorldPos();
    for (const item of this.items) {
      if (!item.marker) continue;
      item.marker.visible = !item.delivered
        && !this.carrying
        && Boolean(objective)
        && item.root.position.distanceTo(objective!) < 0.01;
    }
    if (this.snowmanMarker) this.snowmanMarker.visible = Boolean(this.carrying);

    this.updateGuideArrow(now, objective, ['intro', 'outro']);

    const prev = this.interactTarget;
    this.interactTarget = this.nearestInteract();
    if (prev !== this.interactTarget) this.pushHud();
    if (this.beatMsg && now > this.beatMsgUntil) {
      this.beatMsg = null;
      this.pushHud();
    }

    this.updateAmbient(dt, now);

    if (this.phase === 'intro') {
      const idx = Math.min(this.introI, 2);
      const introPos = [new THREE.Vector3(0, 8, 18), new THREE.Vector3(-3, 6.5, 8), new THREE.Vector3(0, 5.5, 12)];
      const introLook = [
        new THREE.Vector3(0, 1, 0),
        this.snowmanPos.clone().setY(1.2),
        new THREE.Vector3(0, 0.8, -6),
      ];
      this.camera.position.lerp(introPos[idx], 1 - Math.pow(0.02, dt));
      this.camera.lookAt(introLook[idx]);
    } else {
      const f = this.cameraFraming();
      const target = new THREE.Vector3(
        this.hero.position.x * 0.35 + f.lateral,
        this.hero.position.y + 6.2 * f.heightMul,
        this.hero.position.z + 10.5 + f.backAdd,
      );
      this.camera.position.lerp(target, 1 - Math.pow(0.0015, dt));
      this.camera.lookAt(
        this.hero.position.x * 0.25,
        this.hero.position.y + 1.2 + f.lookUp,
        this.hero.position.z - 3 - f.lookAhead,
      );
    }

    this.renderFrame();
  };
}

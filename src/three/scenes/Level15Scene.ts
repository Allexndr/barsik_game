import * as THREE from 'three';
import {
  BaseLevelScene, type BaseHud, zoneDisc, spawnPad, questMarker, pathArrow,
  loadPropModel, placeWoodSign,
} from './BaseLevelScene';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { placeMany, placeAmbientCritters } from '../s1Place';

/**
 * Level 15 «Спасти снеговика» — GDD Level 15:
 * Soft 30s timer per snow chunk. Snowman grows as you deliver.
 */

export type L15Phase = 'intro' | 'rescue' | 'outro';
export interface L15Hud extends BaseHud {
  chunksDelivered: number;
  chunksTotal: number;
  carrying: boolean;
  snowmanSize: number;
  timerSec: number;
}

export class Level15Scene extends BaseLevelScene {
  private phase: L15Phase = 'intro';
  private onHud: ((h: L15Hud) => void) | null = null;
  private introI = 0;
  private nextAt = 0;
  private chunksDelivered = 0;
  private readonly chunksTotal = 3;
  private carrying = false;
  private chunkTimer = 0;
  private readonly chunkTimeLimit = 30;
  private timerActive = false;
  private snowmanPos = new THREE.Vector3(0, 0, -10);
  private snowman: THREE.Object3D | null = null;
  private snowmanMarker: THREE.Object3D | null = null;
  private chunkSpots: { mesh: THREE.Mesh; delivered: boolean }[] = [];
  private carriedSpot: THREE.Mesh | null = null;
  private meltLevel = 0;

  protected currentPhase() { return this.phase; }

  protected onMovementHintDismiss() {
    this.pushHud();
  }

  tryInteract() {
    if (this.phase !== 'rescue') return;
    const t = this.interactTarget;
    if (!t) return;

    const spot = this.chunkSpots.find(s => s.mesh === t && s.mesh.visible && !s.delivered);
    if (spot && !this.carrying) {
      this.carrying = true;
      this.carriedSpot = spot.mesh;
      spot.mesh.visible = false;
      this.timerActive = true;
      this.chunkTimer = this.chunkTimeLimit;
      this.stars += 2;
      this.spawnSparks(spot.mesh.position, 8, [0xe1f5fe, 0xffffff]);
      this.pushHud();
      return;
    }

    if (this.carrying && t === this.snowmanMarker) {
      this.carrying = false;
      this.timerActive = false;
      if (this.carriedSpot) {
        const entry = this.chunkSpots.find(s => s.mesh === this.carriedSpot);
        if (entry) entry.delivered = true;
        this.carriedSpot = null;
      }
      this.chunksDelivered++;
      this.meltLevel = Math.max(0, this.meltLevel - 0.35);
      this.stars += 5;
      this.spawnSparks(this.snowmanPos, 12, [0xe1f5fe, 0xffd700]);
      this.updateSnowmanScale();
      if (this.chunksDelivered >= this.chunksTotal) {
        this.phase = 'outro';
        this.stars += 10;
        this.spawnSparks(this.snowmanPos, 24, [0xffd700, 0x00cec9]);
      } else {
        this.respawnCarriedChunk();
      }
      this.pushHud();
    }
  }

  private respawnCarriedChunk() {
    if (this.carriedSpot) {
      this.carriedSpot.visible = true;
      this.carriedSpot = null;
    }
  }

  private updateSnowmanScale() {
    if (!this.snowman) return;
    const base = 0.65 + this.chunksDelivered * 0.18 - this.meltLevel * 0.15;
    this.snowman.scale.setScalar(Math.max(0.5, base));
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L15Hud) => void) {
    this.nick = nick || 'друг';
    this.lang = lang;
    this.onHud = onHud;
    const loader = createGameGltfLoader();

    this.camera.position.set(0, 7, 16);
    await this.setupWinterEnvironment(loader, {
      sunColor: 0xfff8e1,
      sunIntensity: 1.05,
      sky: ['#5a7a9a', '#9ab0c8', '#d0e8f0'],
    });

    this.scene.add(zoneDisc(0, 4, 6, 0xe1f5fe, 0.03));
    this.scene.add(zoneDisc(0, -10, 4, 0x4fc3f7, 0.04));
    this.scene.add(spawnPad(0, 4));
    this.scene.add(await placeWoodSign(loader, -2.5, 2, 0.3, 0xe1f5fe));

    const snowGlb = await loadPropModel(loader, 'snowman.glb', { height: 1.6 });
    this.snowman = snowGlb ?? this.makeSnowman();
    this.snowman.position.copy(this.snowmanPos);
    this.snowman.scale.setScalar(0.55);
    this.scene.add(this.snowman);
    this.colliders.push({ kind: 'circle', x: 0, z: -10, r: 1.2 });

    this.snowmanMarker = questMarker(0x4fc3f7, 0x81d4fa);
    this.snowmanMarker.position.copy(this.snowmanPos);
    this.scene.add(this.snowmanMarker);

    await placeMany(this.scene, loader, [
      { key: 'carrot', opts: { x: 1.2, z: -9.2, maxSize: 0.4 } },
      { key: 'pinecone', opts: { x: -2.5, z: -8, maxSize: 0.32 } },
      { key: 'pine_tree', opts: { x: -7, z: -6, maxSize: 2.5 } },
      { key: 'rock_snow', opts: { x: 7, z: -8, maxSize: 1.3 } },
      { key: 'snowflake', opts: { x: 3, z: -12, maxSize: 0.45, y: 1.2 } },
      { key: 'snow_pile', opts: { x: -5, z: -4, maxSize: 1.2 } },
      { key: 'snow_pile', opts: { x: 5.5, z: -11, maxSize: 1.0 } },
      { key: 'winter_hat', opts: { x: -1.2, z: -9.5, maxSize: 0.35, y: 0.15 } },
    ]);
    await placeAmbientCritters(this.scene, loader, [
      { key: 'fox', x: 6, z: -2, rotY: -0.8, h: 0.8 },
      { key: 'owl', x: -8, z: -10, rotY: 1.0, h: 0.7 },
      { key: 'penguin', x: 8, z: -13, rotY: -1.5, h: 0.75 },
      { key: 'polar', x: -8, z: -3, rotY: 0.6, h: 0.95 },
    ]);

    const positions: [number, number][] = [[-7, -2], [7, -5], [-6, -12], [6, -14]];
    for (const [x, z] of positions) {
      const spot = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, emissive: 0xe1f5fe, emissiveIntensity: 0.15 }),
      );
      spot.position.set(x, 0.32, z);
      spot.scale.y = 0.5;
      if (this.chunkSpots.length >= this.chunksTotal) spot.visible = false;
      this.chunkSpots.push({ mesh: spot, delivered: false });
      this.scene.add(spot);
      const a = pathArrow(x * 0.2, z + 1, Math.atan2(-10 - z, -x));
      this.pathArrows.push(a);
      this.scene.add(a);
    }

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

  private makeSnowman(): THREE.Group {
    const g = new THREE.Group();
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
    const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), snowMat);
    bottom.position.y = 0.6; bottom.castShadow = true;
    const mid = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), snowMat);
    mid.position.y = 1.4; mid.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), snowMat);
    head.position.y = 1.95; head.castShadow = true;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 6), new THREE.MeshStandardMaterial({ color: 0xff6f00 }));
    nose.position.set(0, 1.95, 0.3); nose.rotation.x = Math.PI / 2;
    g.add(bottom, mid, head, nose);
    g.userData.mid = mid;
    g.userData.head = head;
    return g;
  }


  private pushHud() {
    const n = this.nick;
    let speaker = 'Барсик';
    let line = '';
    let objective = '';
    const p = this.phase;

    if (p === 'intro') {
      const lines = [
        this.copy('Снеговик тает!', 'Аққала еріп жатыр!'),
        this.copy(`Принеси 3 куска снега, ${n}!`, `3 қар кесегін әкел, ${n}!`),
        this.copy('У каждого куска — 30 секунд. Не успел — попробуй снова!', 'Әр кесекке — 30 секунд. Үлгермесең — қайта көр!'),
      ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = this.copy('⛄ Принеси 3 куска снега', '⛄ 3 қар кесегін әкел');
    } else if (p === 'rescue') {
      if (this.carrying && this.timerActive) {
        line = this.copy(`Быстрее! ${Math.ceil(this.chunkTimer)} сек`, `Жылдам! ${Math.ceil(this.chunkTimer)} сек`);
      } else if (this.carrying) {
        line = this.copy('Неси снег к снеговику!', 'Қарды аққалаға әкел!');
      } else {
        line = this.copy(`Принесено: ${this.chunksDelivered}/${this.chunksTotal}`, `Әкелінді: ${this.chunksDelivered}/${this.chunksTotal}`);
      }
      objective = this.copy(
        `⛄ ${this.chunksDelivered}/${this.chunksTotal}${this.carrying ? ` · ⏱ ${Math.ceil(this.chunkTimer)}с` : ''}`,
        `⛄ ${this.chunksDelivered}/${this.chunksTotal}${this.carrying ? ` · ⏱ ${Math.ceil(this.chunkTimer)}с` : ''}`,
      );
    } else if (p === 'outro') {
      speaker = this.copy('Снеговик', 'Аққала');
      line = this.copy('Спасибо! Я снова большой! А вон там — зимний сундук!', 'Рахмет! Мен қайта үлкенмін! Ана жерде — қысқы сандық!');
      objective = this.copy('📦 К зимнему сундуку!', '📦 Қысқы сандыққа!');
    }

    this.onHud?.({
      phase: p, speaker, line, objective,
      chunksDelivered: this.chunksDelivered, chunksTotal: this.chunksTotal,
      carrying: this.carrying,
      snowmanSize: 0.65 + this.chunksDelivered * 0.18 - this.meltLevel * 0.15,
      timerSec: Math.ceil(this.chunkTimer),
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
      if (hp.distanceTo(this.snowmanPos) < 2.5) return this.snowmanMarker;
    } else {
      for (const spot of this.chunkSpots) {
        if (!spot.mesh.visible || spot.delivered) continue;
        if (hp.distanceTo(spot.mesh.position) < 2.2) return spot.mesh;
      }
    }
    return null;
  }

  private objectiveWorldPos(): THREE.Vector3 | null {
    if (this.phase !== 'rescue') return null;
    if (this.carrying) return this.snowmanPos.clone();
    const hp = this.hero.position;
    let best: THREE.Vector3 | null = null;
    let bestD = Infinity;
    for (const spot of this.chunkSpots) {
      if (!spot.mesh.visible || spot.delivered) continue;
      const d = hp.distanceTo(spot.mesh.position);
      if (d < bestD) { bestD = d; best = spot.mesh.position.clone(); }
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
      if (this.introI >= 3) { this.phase = 'rescue'; this.pushHud(); }
      else { this.nextAt = now + 2600; this.pushHud(); }
    }

    const canMove = !['intro', 'outro'].includes(this.phase);
    this.updateMovement(dt, canMove, this.baseSpeed, -12, 12, -18, 8);

    if (this.phase === 'rescue') {
      // Continuous gentle melt
      this.meltLevel = Math.min(0.8, this.meltLevel + dt * 0.012);
      this.updateSnowmanScale();

      if (this.timerActive && this.carrying) {
        this.chunkTimer -= dt;
        if (Math.floor(this.chunkTimer) !== Math.floor(this.chunkTimer + dt)) this.pushHud();
        if (this.chunkTimer <= 0) {
          this.carrying = false;
          this.timerActive = false;
          this.meltLevel = Math.min(0.8, this.meltLevel + 0.2);
          this.spawnSparks(this.snowmanPos, 8, [0x81d4fa, 0xe1f5fe]);
          this.respawnCarriedChunk();
          this.pushHud();
        }
      }
    }

    this.updateGuideArrow(now, this.objectiveWorldPos(), ['intro', 'outro']);

    const prev = this.interactTarget;
    this.interactTarget = this.nearestInteract();
    if (prev !== this.interactTarget) this.pushHud();

    this.updateAmbient(dt, now);

    if (this.phase === 'intro') {
      const idx = Math.min(this.introI, 2);
      const introPos = [new THREE.Vector3(0, 7, 16), new THREE.Vector3(0, 6, 14), new THREE.Vector3(0, 5, 12)];
      const introLook = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, -3), new THREE.Vector3(0, 0.5, -8)];
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

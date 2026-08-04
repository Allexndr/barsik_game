import * as THREE from 'three';
import {
  BaseLevelScene,
  type BaseHud,
  zoneDisc,
  spawnPad,
  placeWoodSign,
  pathArrow,
  loadPropModel,
} from './BaseLevelScene';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { placeMany } from '../s1Place';
import { CAST_PROP_GLB } from '../castModels';
import { AudioManager } from '@/audio/AudioManager';

/**
 * Level 12 «Ледяная тропа» — GDD Level 12:
 * Ice sliding mechanic. Inertia 0.85, narrow path, 5 segments.
 * Ice crystals on golden path. Slip off → soft segment reset.
 */

export type L12Phase = 'intro' | 'slide' | 'outro';

export interface L12Hud extends BaseHud {
  segmentsCrossed: number;
  segmentsTotal: number;
  crystals: number;
  slipped: boolean;
}


export class Level12Scene extends BaseLevelScene {
  private phase: L12Phase = 'intro';
  private onHud: ((h: L12Hud) => void) | null = null;
  private introI = 0;
  private nextAt = 0;
  private segmentsCrossed = 0;
  private readonly segmentsTotal = 5;
  private crystals = 0;
  private readonly crystalsTotal = 6;
  private velocity = new THREE.Vector3();
  private readonly inertia = 0.85;
  private segmentStarts: number[] = [];
  private crystalMeshes: THREE.Object3D[] = [];
  private slipped = false;
  private slipMsgUntil = 0;
  private gatePos = new THREE.Vector3(0, 0, -28);

  protected currentPhase() { return this.phase; }

  protected onMovementHintDismiss() {
    this.pushHud();
  }

  tryInteract() {}

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L12Hud) => void) {
    this.nick = nick || 'друг';
    this.lang = lang;
    this.onHud = onHud;
    const loader = createGameGltfLoader();

    this.camera.position.set(0, 7, 16);
    await this.setupWinterEnvironment(loader, { ground: 'ice' });

    const pathMat = new THREE.MeshStandardMaterial({
      color: 0xe1f5fe, roughness: 0.08, metalness: 0.35, transparent: true, opacity: 0.85,
    });
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0x42a5f5, emissive: 0x42a5f5, emissiveIntensity: 0.35 });

    for (let i = 0; i < this.segmentsTotal; i++) {
      const z = -2 - i * 5;
      const path = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 4.8), pathMat);
      path.position.set(0, 0.05, z);
      this.scene.add(path);

      for (const sx of [-1.2, 1.2]) {
        const edge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 4.8), edgeMat);
        edge.position.set(sx, 0.18, z);
        this.scene.add(edge);
      }
      this.segmentStarts.push(z + 2);
    }

    // Golden path: crystals + arrows along optimal route
    const crystalPositions: [number, number][] = [
      [0, -4], [-0.6, -9], [0.5, -14], [-0.4, -19], [0.3, -24], [0, -27],
    ];
    const crystalTpl = await loadPropModel(loader, CAST_PROP_GLB.ice_crystal, { maxSize: 0.45 });
    for (let i = 0; i < crystalPositions.length; i++) {
      const [x, z] = crystalPositions[i];
      let crystal: THREE.Object3D;
      if (crystalTpl) {
        crystal = crystalTpl.clone(true);
        crystal.position.set(x, 0.55, z);
      } else {
        crystal = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.22),
          new THREE.MeshStandardMaterial({
            color: 0xffd700, emissive: 0xf1c40f, emissiveIntensity: 0.55,
            transparent: true, opacity: 0.9,
          }),
        );
        crystal.position.set(x, 0.55, z);
        crystal.castShadow = true;
      }
      crystal.userData.collected = false;
      this.crystalMeshes.push(crystal);
      this.scene.add(crystal);

      if (i < crystalPositions.length - 1) {
        const a = pathArrow(x, z - 1.2, 0);
        this.pathArrows.push(a);
        this.scene.add(a);
      }
    }

    const gateMat = new THREE.MeshStandardMaterial({
      color: 0x81d4fa, emissive: 0x81d4fa, emissiveIntensity: 0.35, transparent: true, opacity: 0.75,
    });
    const gateL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.5, 0.3), gateMat);
    gateL.position.set(-1.4, 1.75, -28);
    const gateR = gateL.clone();
    gateR.position.x = 1.4;
    const gateTop = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.3, 0.3), gateMat);
    gateTop.position.set(0, 3.5, -28);
    this.scene.add(gateL, gateR, gateTop);

    this.scene.add(zoneDisc(0, 4, 4, 0xe1f5fe, 0.03));
    this.scene.add(zoneDisc(0, -28, 5, 0x4fc3f7, 0.04));
    this.scene.add(spawnPad(0, 4));
    this.scene.add(await placeWoodSign(loader, -2.5, 2, 0.3, 0xe1f5fe));

    await placeMany(this.scene, loader, [
      { key: 'pine_tree', opts: { x: -5.5, z: -8, maxSize: 2.4 } },
      { key: 'pine_tree', opts: { x: 5.8, z: -18, maxSize: 2.6 } },
      { key: 'rock_snow', opts: { x: -4.5, z: -22, maxSize: 1.3 } },
      { key: 'snowflake', opts: { x: 3.2, z: -12, maxSize: 0.45, y: 1.4 } },
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
    let speaker = 'Барсик';
    let line = '';
    let objective = '';
    const p = this.phase;
    const n = this.nick;

    if (p === 'intro') {
      const lines = [
        this.copy('Ледяная тропа! Скользко!', 'Мұзды жол! Тайғақ!'),
        this.copy(`Иди осторожно, ${n}. Барсик скользит дальше!`, `Абайлап жүр, ${n}. Барсик әрі қарай сырғанайды!`),
        this.copy('Золотые кристаллы — лучший путь. Не выскользни!', 'Алтын кристалдар — ең жақсы жол. Сырғанама!'),
      ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = this.copy('🧊 Пройди 5 сегментов, собери кристаллы', '🧊 5 сегментті өт, кристалдарды жина');
    } else if (p === 'slide') {
      if (this.slipped && performance.now() < this.slipMsgUntil) {
        line = this.copy('Ой! Снова на тропу — попробуй ещё.', 'Ой! Қайта жолға — тағы байқап көр.');
      } else {
        line = this.copy(`Сегменты: ${this.segmentsCrossed}/${this.segmentsTotal}`, `Сегменттер: ${this.segmentsCrossed}/${this.segmentsTotal}`);
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
      showMoveHint: !this.hasTakenFirstStep && p === 'intro',
      showActionHint: false,
      outro: p === 'outro',
    });
  }

  private softResetSegment() {
    const segIdx = Math.max(0, this.segmentsCrossed);
    const z = segIdx > 0 ? this.segmentStarts[segIdx - 1] : 4;
    this.hero.position.set(0, 0, z);
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
      return new THREE.Vector3(0, 0, this.segmentStarts[this.segmentsCrossed] - 2);
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
        this.phase = 'slide';
        this.pushHud();
      } else {
        this.nextAt = now + 2600;
        this.pushHud();
      }
    }

    if (this.phase === 'slide') {
      const d = this.dir();
      const speed = this.baseSpeed * 0.75;
      this.velocity.x += d.x * speed * dt * 2.2;
      this.velocity.z += d.y * speed * dt * 2.2;
      this.velocity.x *= this.inertia;
      this.velocity.z *= this.inertia;

      const maxV = speed * 1.1;
      this.velocity.x = THREE.MathUtils.clamp(this.velocity.x, -maxV, maxV);
      this.velocity.z = THREE.MathUtils.clamp(this.velocity.z, -maxV, maxV);

      this.hero.position.x += this.velocity.x * dt;
      this.hero.position.z += this.velocity.z * dt;

      const offPath = Math.abs(this.hero.position.x) > 1.35
        || this.hero.position.z > 5
        || this.hero.position.z < -30;
      if (offPath) {
        this.softResetSegment();
      }

      for (let i = this.segmentsCrossed; i < this.segmentsTotal; i++) {
        if (this.hero.position.z < this.segmentStarts[i] - 2.5) {
          this.segmentsCrossed = i + 1;
          this.stars += 2;
          this.spawnSparks(new THREE.Vector3(0, 0.5, this.segmentStarts[i]), 10, [0x4fc3f7, 0xffd700]);
          this.pushHud();
          if (this.segmentsCrossed >= this.segmentsTotal) {
            this.phase = 'outro';
            this.stars += 10;
            this.spawnSparks(this.gatePos, 24, [0xffd700, 0x00cec9]);
            this.pushHud();
          }
          break;
        }
      }

      for (const crystal of this.crystalMeshes) {
        if (crystal.userData.collected) continue;
        if (this.hero.position.distanceTo(crystal.position) < 1.1) {
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
      if (!crystal.userData.collected) {
        crystal.rotation.y += dt * 2.5;
        crystal.position.y = 0.55 + Math.sin(now * 0.004 + crystal.position.z) * 0.12;
      }
    }

    if (this.slipped && now > this.slipMsgUntil) this.slipped = false;

    this.updateGuideArrow(now, this.phase === 'slide' ? this.nextCrystalPos() : null, ['intro', 'outro']);
    this.updateAmbient(dt, now);

    if (this.phase === 'intro') {
      const idx = Math.min(this.introI, 2);
      const introPos = [new THREE.Vector3(0, 7, 16), new THREE.Vector3(0, 6, 14), new THREE.Vector3(0, 5, 11)];
      const introLook = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, -4), new THREE.Vector3(0, 0.5, -10)];
      this.camera.position.lerp(introPos[idx], 1 - Math.pow(0.02, dt));
      this.camera.lookAt(introLook[idx]);
    } else {
      const target = new THREE.Vector3(this.hero.position.x * 0.25, 5.5, this.hero.position.z + 9);
      this.camera.position.lerp(target, 1 - Math.pow(0.0015, dt));
      this.camera.lookAt(this.hero.position.x * 0.15, 1.1, this.hero.position.z - 2);
    }

    this.renderFrame();
  };
}

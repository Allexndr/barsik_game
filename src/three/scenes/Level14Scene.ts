import * as THREE from 'three';
import {
  BaseLevelScene, type BaseHud, zoneDisc, spawnPad, questMarker, pathArrow,
  loadCharModel, loadPropModel, placeWoodSign,
} from './BaseLevelScene';
import { AYA_LOOK } from '../characterLooks';
import { createPlushCharacter } from '../PlushCharacter';
import { groundY } from '../modelUtils';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { placeMany, placeAmbientCritters, placeS1Prop } from '../s1Place';
import { CAST_PROP_GLB } from '../castModels';
import { AudioManager } from '@/audio/AudioManager';

/**
 * Level 14 «Поделись теплом» — GDD Level 14:
 * Find scarf in snowdrifts, deliver to Aya. Warmth meter + campfire.
 */

export type L14Phase = 'intro' | 'search' | 'deliver' | 'outro';
export interface L14Hud extends BaseHud { warmth: number; hasScarf: boolean; sneezing: boolean; }

export class Level14Scene extends BaseLevelScene {
  private phase: L14Phase = 'intro';
  private onHud: ((h: L14Hud) => void) | null = null;
  private introI = 0;
  private nextAt = 0;
  private hasScarf = false;
  private warmth = 100;
  private sneezing = false;
  private sneezeUntil = 0;
  private ayaPos = new THREE.Vector3(0, 0, -10);
  private ayaMarker: THREE.Object3D | null = null;
  private ayaGroup: THREE.Object3D | null = null;
  private drifts: THREE.Object3D[] = [];
  private campfirePos = new THREE.Vector3(6, 0, -4);
  private campfireFlame: THREE.Mesh | null = null;
  private lastWarmthHud = 100;

  protected currentPhase() { return this.phase; }

  protected onMovementHintDismiss() {
    this.pushHud();
  }

  tryInteract() {
    if (this.phase !== 'search' && this.phase !== 'deliver') return;
    const t = this.interactTarget;
    if (!t) return;

    const drift = this.drifts.find(d => d === t);
    if (drift && !this.hasScarf) {
      const hasIt = drift.userData.hasScarf as boolean;
      this.spawnSparks(drift.position, 8, hasIt ? [0xff6b6b, 0xffd700] : [0xe1f5fe, 0xffffff]);
      if (hasIt) {
        this.hasScarf = true;
        AudioManager.sfx('found');
        this.stars += 5;
        this.phase = 'deliver';
        drift.visible = false;
      }
      this.pushHud();
      return;
    }

    if (this.hasScarf && t === this.ayaMarker) {
      this.phase = 'outro';
      this.stars += 17;
      this.spawnSparks(this.ayaPos, 24, [0xff6b6b, 0xffd700]);
      if (this.ayaGroup) {
        const scarf = this.ayaGroup.userData.scarf as THREE.Mesh;
        if (scarf) scarf.visible = true;
      }
      this.pushHud();
    }
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L14Hud) => void) {
    this.nick = nick || 'друг';
    this.lang = lang;
    this.onHud = onHud;
    const loader = createGameGltfLoader();

    this.camera.position.set(0, 7, 16);
    await this.setupWinterEnvironment(loader);
    this.scene.add(zoneDisc(0, 4, 6, 0xe1f5fe, 0.03));
    this.scene.add(zoneDisc(0, -10, 4, 0xff6b6b, 0.04));
    this.scene.add(spawnPad(0, 4));
    this.scene.add(await placeWoodSign(loader, -2.5, 2, 0.3, 0xe1f5fe));

    // Aya — Meshy aya.glb when present; else plush + scarf slot
    const ayaGlb = await loadCharModel(loader, 'aya.glb', 1.28);
    this.ayaGroup = ayaGlb ?? createPlushCharacter(AYA_LOOK);
    this.ayaGroup.position.copy(this.ayaPos);
    this.ayaGroup.rotation.y = Math.PI;
    // Scarf visual on Aya — Meshy plush scarf (fallback: winter hat kit / torus)
    const scarfGlb = await loadPropModel(loader, CAST_PROP_GLB.scarf, { maxSize: 0.55 });
    const scarf = scarfGlb ?? new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.08, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xff6b6b, emissive: 0xff6b6b, emissiveIntensity: 0.3 }),
    );
    if (scarfGlb) {
      scarf.position.set(0, 1.05, 0.08);
    } else {
      scarf.position.y = 1.05;
      scarf.rotation.x = Math.PI / 2;
    }
    scarf.visible = false;
    this.ayaGroup.add(scarf);
    this.ayaGroup.userData.scarf = scarf;
    groundY(this.ayaGroup);
    this.scene.add(this.ayaGroup);

    this.ayaMarker = questMarker(0xff6b6b, 0xff9f43);
    this.ayaMarker.position.copy(this.ayaPos);
    this.scene.add(this.ayaMarker);
    this.colliders.push({ kind: 'circle', x: 0, z: -10, r: 1.0 });

    const driftPositions: [number, number, boolean][] = [
      [-6, -2, true], [6, -4, false], [-5, -8, false], [7, -10, false], [-8, -12, false],
      [4, -14, false], [-3, -16, false], [9, -7, false],
    ];
    const snowPileTpl = await loadPropModel(loader, CAST_PROP_GLB.snow_pile, { maxSize: 1.4 });
    for (const [x, z, hasScarf] of driftPositions) {
      let drift: THREE.Object3D;
      if (snowPileTpl) {
        drift = snowPileTpl.clone(true);
        drift.position.set(x, 0, z);
        groundY(drift);
      } else {
        drift = new THREE.Mesh(
          new THREE.SphereGeometry(0.75, 10, 8),
          new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
        );
        drift.position.set(x, 0.45, z);
        drift.scale.y = 0.55;
        drift.castShadow = true;
      }
      drift.userData.hasScarf = hasScarf;
      this.drifts.push(drift);
      this.scene.add(drift);
      const q = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 6, 6),
        new THREE.MeshStandardMaterial({ color: 0xffeaa7, emissive: 0xfdcb6e, emissiveIntensity: 0.6 }),
      );
      q.position.set(x, 1.2, z);
      this.scene.add(q);
    }

    // Campfire — Kenney survival kit
    const camp = await placeS1Prop(loader, 'campfire', {
      x: this.campfirePos.x, z: this.campfirePos.z, maxSize: 1.3,
    });
    if (camp) {
      this.scene.add(camp);
    } else {
      const fireBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.55, 0.22, 8),
        new THREE.MeshStandardMaterial({ color: 0x4e342e }),
      );
      fireBase.position.copy(this.campfirePos);
      fireBase.position.y = 0.11;
      this.scene.add(fireBase);
    }
    this.campfireFlame = new THREE.Mesh(
      new THREE.ConeGeometry(0.35, 0.7, 6),
      new THREE.MeshBasicMaterial({ color: 0xff6f00 }),
    );
    this.campfireFlame.position.copy(this.campfirePos);
    this.campfireFlame.position.y = 0.55;
    const warmGlow = zoneDisc(6, -4, 2.5, 0xff9800, 0.06);
    this.scene.add(this.campfireFlame, warmGlow);
    this.scene.add(pathArrow(3, 0, Math.atan2(-4, 6)));

    await placeMany(this.scene, loader, [
      { key: 'pine_tree', opts: { x: -8, z: -6, maxSize: 2.4 } },
      { key: 'rock_snow', opts: { x: 8, z: -8, maxSize: 1.3 } },
      { key: 'berry', opts: { x: -3, z: -12, maxSize: 0.35 } },
      { key: 'lantern', opts: { x: 4.5, z: -3, maxSize: 0.65 } },
      { key: 'tent', opts: { x: 8.5, z: -2, maxSize: 1.8, rotY: -0.6 } },
    ]);
    await placeAmbientCritters(this.scene, loader, [
      { key: 'fox', x: 7, z: 0, rotY: -1.5, h: 0.8 },
      { key: 'rabbit', x: -7, z: -1, rotY: 0.4, h: 0.65 },
      { key: 'polar', x: -9, z: -10, rotY: 0.8, h: 0.9 },
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
        this.copy('Айе холодно! Ей нужен шарф!', 'Айя тоңып жатыр! Оған шарф керек!'),
        this.copy(`Поищи в сугробах, ${n}!`, `Қар үйінділерінен ізде, ${n}!`),
        this.copy('Согрейся у костра — тепло не кончается навсегда!', 'Оттың жанында жылын — жылу мәңгі бітпейді!'),
      ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = this.copy('🧣 Найди шарф → отдай Айе', '🧣 Шарф тап → Айяға бер');
    } else if (p === 'search') {
      if (this.sneezing) {
        line = this.copy('А-апчхи! Согрейся у костра!', 'А-апчхи! Оттың жанында жылын!');
      } else {
        line = this.isMobile
          ? this.copy('Ищи шарф в сугробах — нажимай лапку!', 'Қар үйіндісінен шарф ізде — табанды бас!')
          : this.copy('Ищи шарф в сугробах (E)!', 'Қар үйіндісінен шарф ізде (E)!');
      }
      objective = this.copy(`🔥 Тепло: ${Math.round(this.warmth)}%`, `🔥 Жылы: ${Math.round(this.warmth)}%`);
    } else if (p === 'deliver') {
      line = this.copy('Шарф найден! Отнеси Айе!', 'Шарф табылды! Айяға әкел!');
      objective = this.isMobile
        ? this.copy('Отдай шарф Айе — нажми лапку', 'Шарфты Айяға беру үшін табанды бас')
        : this.copy('Отдай шарф Айе (E)', 'Шарфты Айяға бер (E)');
    } else if (p === 'outro') {
      speaker = this.copy('Айя', 'Айя');
      line = this.copy('Спасибо! Так тепло! Смотри — снеговик тает!', 'Рахмет! Қандай жылы! Қара — аққала еріп жатыр!');
      objective = this.copy('⛄ К снеговику!', '⛄ Аққалаға!');
    }

    this.onHud?.({
      phase: p, speaker, line, objective,
      warmth: Math.round(this.warmth), hasScarf: this.hasScarf, sneezing: this.sneezing,
      stars: this.stars,
      canInteract: Boolean(this.interactTarget),
      showMoveHint: !this.hasTakenFirstStep && p === 'intro',
      showActionHint: Boolean(this.interactTarget),
      outro: p === 'outro',
    });
    this.lastWarmthHud = Math.round(this.warmth);
  }

  private nearestInteract(): THREE.Object3D | null {
    const hp = this.hero.position;
    if (this.hasScarf) {
      if (hp.distanceTo(this.ayaPos) < 2.5) return this.ayaMarker;
    } else {
      for (const drift of this.drifts) {
        if (!drift.visible) continue;
        if (hp.distanceTo(drift.position) < 2.2) return drift;
      }
    }
    return null;
  }

  private objectiveWorldPos(): THREE.Vector3 | null {
    if (this.phase === 'search') {
      const hp = this.hero.position;
      if (this.warmth < 35) return this.campfirePos.clone();
      let best: THREE.Vector3 | null = null;
      let bestD = Infinity;
      for (const drift of this.drifts) {
        if (!drift.visible) continue;
        const d = hp.distanceTo(drift.position);
        if (d < bestD) { bestD = d; best = drift.position.clone(); }
      }
      return best;
    }
    if (this.phase === 'deliver') return this.ayaPos.clone();
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
      if (this.introI >= 3) { this.phase = 'search'; this.pushHud(); }
      else { this.nextAt = now + 2600; this.pushHud(); }
    }

    const canMove = !['intro', 'outro'].includes(this.phase);
    this.updateMovement(dt, canMove, this.baseSpeed, -12, 12, -16, 8);

    if (this.phase === 'search' || this.phase === 'deliver') {
      const nearFire = this.hero.position.distanceTo(this.campfirePos) < 2.8;
      if (nearFire) {
        this.warmth = Math.min(100, this.warmth + dt * 22);
        if (Math.random() < dt * 2) {
          this.spawnSparks(this.campfirePos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.8, (Math.random() - 0.5) * 0.4)), 2, [0xff9800, 0xffd700]);
        }
      } else {
        this.warmth = Math.max(0, this.warmth - dt * 4.2);
      }
      if (this.warmth <= 0 && !this.sneezing) {
        this.sneezing = true;
        AudioManager.sfx('whoosh');
        this.sneezeUntil = now + 1800;
        this.spawnSparks(this.hero.position, 6, [0x81d4fa, 0xffffff]);
        this.pushHud();
      }
      if (this.sneezing && now > this.sneezeUntil) {
        this.sneezing = false;
        this.warmth = 15;
        this.pushHud();
      }
      const rounded = Math.round(this.warmth);
      if (Math.abs(rounded - this.lastWarmthHud) >= 5) this.pushHud();
    }

    if (this.campfireFlame) {
      this.campfireFlame.scale.y = 0.9 + Math.sin(now * 0.008) * 0.15;
      (this.campfireFlame.material as THREE.MeshBasicMaterial).color.setHex(
        Math.sin(now * 0.01) > 0 ? 0xff6f00 : 0xff9800,
      );
    }

    if (this.ayaGroup && this.phase !== 'outro') {
      this.ayaGroup.position.y = Math.sin(now * 0.004) * 0.04;
    }

    this.updateGuideArrow(now, this.objectiveWorldPos(), ['intro', 'outro']);

    const prev = this.interactTarget;
    this.interactTarget = this.nearestInteract();
    if (prev !== this.interactTarget) this.pushHud();

    this.updateAmbient(dt, now);

    if (this.phase === 'intro') {
      const idx = Math.min(this.introI, 2);
      const introPos = [new THREE.Vector3(0, 7, 16), new THREE.Vector3(0, 6, 14), new THREE.Vector3(0, 5, 12)];
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

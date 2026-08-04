import * as THREE from 'three';
import {
  BaseLevelScene,
  type BaseHud,
  zoneDisc,
  spawnPad,
  pathArrow,
  loadCharModel,
  loadPropModel,
  placeWoodSign,
} from './BaseLevelScene';
import { groundY } from '../modelUtils';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { placeMany, placeAmbientCritters } from '../s1Place';
import { AudioManager } from '@/audio/AudioManager';

/**
 * Level 11 «Первые снежинки» — GDD Level 11:
 * Catch falling snowflakes. Meditative, calm. 5 needed, 10 bonus.
 */

export type L11Phase = 'intro' | 'catch' | 'finish' | 'outro';

export interface L11Hud extends BaseHud {
  caught: number;
  target: number;
  bonus: number;
}


function makeSnowman(): THREE.Group {
  const g = new THREE.Group();
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  const parts: THREE.Mesh[] = [];
  for (const [r, y] of [[0.55, 0.55], [0.4, 1.25], [0.28, 1.75]] as const) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), snowMat);
    s.position.y = y;
    s.castShadow = true;
    s.visible = false;
    parts.push(s);
    g.add(s);
  }
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.05, 0.18, 6),
    new THREE.MeshStandardMaterial({ color: 0xff6f00 }),
  );
  nose.position.set(0, 1.75, 0.26);
  nose.rotation.x = Math.PI / 2;
  nose.visible = false;
  g.add(nose);
  g.userData.parts = parts;
  g.userData.nose = nose;
  return g;
}

interface Snowflake {
  mesh: THREE.Mesh;
  vy: number;
  grounded: boolean;
  groundTime: number;
  caught: boolean;
}

export class Level11Scene extends BaseLevelScene {
  private phase: L11Phase = 'intro';
  private onHud: ((h: L11Hud) => void) | null = null;
  private introI = 0;
  private nextAt = 0;
  private snowflakes: Snowflake[] = [];
  private caught = 0;
  private readonly target = 5;
  private readonly bonus = 10;
  private nextSpawn = 0;
  private snowman: THREE.Object3D | null = null;
  private snowmanPos = new THREE.Vector3(0, 0, -10);
  private snowmanIsGlb = false;

  protected currentPhase() { return this.phase; }

  protected onMovementHintDismiss() {
    this.pushHud();
  }

  tryInteract() {
    if (this.phase !== 'finish') return;
    if (this.hero.position.distanceTo(this.snowmanPos) < 2.5) {
      this.phase = 'outro';
      this.stars += 8;
      this.spawnSparks(this.snowmanPos, 24, [0xffd700, 0x00cec9]);
      this.pushHud();
    }
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L11Hud) => void) {
    this.nick = nick || 'друг';
    this.lang = lang;
    this.onHud = onHud;
    const loader = createGameGltfLoader();

    this.camera.position.set(0, 7, 16);
    await this.setupWinterEnvironment(loader, { clouds: 6 });

    this.scene.add(zoneDisc(0, 4, 10, 0xe1f5fe, 0.03));
    this.scene.add(zoneDisc(0, -10, 4, 0x81d4fa, 0.04));
    this.scene.add(spawnPad(0, 4));
    this.scene.add(await placeWoodSign(loader, -2.5, 2, 0.3, 0xe1f5fe));
    this.scene.add(await placeWoodSign(loader, 0, -12, 0, 0x4fc3f7));

    // Path arrows toward ice trail (foreshadow L12)
    for (const [x, z, rot] of [[0, -2, 0], [0, -5, 0], [0, -8, 0]] as const) {
      const a = pathArrow(x, z, rot);
      this.pathArrows.push(a);
      this.scene.add(a);
    }

    const snowGlb = await loadPropModel(loader, 'snowman.glb', { height: 1.8 });
    if (snowGlb) {
      this.snowman = snowGlb;
      this.snowmanIsGlb = true;
      this.snowman.scale.setScalar(0.25);
      this.snowman.visible = false;
    } else {
      this.snowman = makeSnowman();
    }
    this.snowman.position.copy(this.snowmanPos);
    this.scene.add(this.snowman);

    // Winter unique props — pine + snow rock
    const pine = await loadPropModel(loader, 's1_pine_tree.glb', { maxSize: 2.8 });
    if (pine) {
      pine.position.set(5.5, 0, -6);
      groundY(pine);
      this.scene.add(pine);
      this.colliders.push({ kind: 'circle', x: 5.5, z: -6, r: 1.2 });
    }
    const rock = await loadPropModel(loader, 's1_rock_snow.glb', { maxSize: 1.6 });
    if (rock) {
      rock.position.set(-5.2, 0, -4);
      groundY(rock);
      this.scene.add(rock);
      this.colliders.push({ kind: 'circle', x: -5.2, z: -4, r: 1.0 });
    }
    const fox = await loadCharModel(loader, 's1_fox.glb', 0.85);
    if (fox) {
      fox.position.set(4.2, 0, 1.5);
      fox.rotation.y = -Math.PI * 0.4;
      groundY(fox);
      this.scene.add(fox);
    }

    await placeMany(this.scene, loader, [
      { key: 'carrot', opts: { x: -1.5, z: -9.5, maxSize: 0.4 } },
      { key: 'snowflake', opts: { x: 2.5, z: -3, maxSize: 0.5, y: 1.2 } },
      { key: 'ice_crystal', opts: { x: -3.5, z: -11, maxSize: 0.55, y: 0.3 } },
      { key: 'rock_snow', opts: { x: 6.5, z: 2, maxSize: 1.2, rotY: 0.7 } },
      { key: 'snow_pile', opts: { x: -7, z: -2, maxSize: 1.3 } },
      { key: 'snow_pile', opts: { x: 7.5, z: -8, maxSize: 1.1 } },
      { key: 'tree_decorated', opts: { x: -8, z: -10, maxSize: 2.4 } },
      { key: 'winter_hat', opts: { x: 1.2, z: -9.2, maxSize: 0.4 } },
    ]);
    await placeAmbientCritters(this.scene, loader, [
      { key: 'rabbit', x: -6.5, z: 1, rotY: 0.9, h: 0.7 },
      { key: 'penguin', x: 6, z: -11, rotY: -0.8, h: 0.75 },
      { key: 'polar', x: -5, z: -14, rotY: 0.5, h: 0.95 },
    ]);

    // Aya cheering from the side
    const ayaGlb = await loadCharModel(loader, 'aya.glb', 1.2);
    if (ayaGlb) {
      ayaGlb.position.set(-4.5, 0, -8);
      ayaGlb.rotation.y = Math.PI * 0.35;
      groundY(ayaGlb);
      this.scene.add(ayaGlb);
    }

    this.scene.add(zoneDisc(0, -10, 2.5, 0x4fc3f7, 0.05));

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

  private updateSnowmanProgress() {
    if (!this.snowman) return;
    if (this.snowmanIsGlb) {
      const t = Math.min(this.caught / this.target, 1);
      this.snowman.visible = this.caught > 0;
      this.snowman.scale.setScalar(0.3 + t * 0.85);
      return;
    }
    const parts = this.snowman.userData.parts as THREE.Mesh[];
    const nose = this.snowman.userData.nose as THREE.Mesh;
    const step = Math.min(this.caught, this.target);
    for (let i = 0; i < parts.length; i++) {
      parts[i].visible = i < step;
    }
    nose.visible = step >= this.target;
  }

  private pushHud() {
    const n = this.nick;
    let speaker = 'Барсик';
    let line = '';
    let objective = '';
    const p = this.phase;

    if (p === 'intro') {
      const lines = [
        this.copy('Снег! Первый снег!', 'Қар! Алғашқы қар!'),
        this.copy(`Айя радуется, ${n}! Лови снежинки — не спеши.`, `Айя қуанады, ${n}! Қар ұста — асықпа.`),
        this.copy('Подойди к снежинке пока она на земле.', 'Қар жерге түскенше жақында.'),
      ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = this.copy('❄️ Поймай 5 снежинок (10 — бонус)', '❄️ 5 қар ұста (10 — бонус)');
    } else if (p === 'catch') {
      if (this.caught >= this.target) {
        line = this.copy(
          `Снеговик готов! Бонус: ещё ${this.bonus - this.caught} снежинок.`,
          `Аққала дайын! Бонус: тағы ${this.bonus - this.caught} қар ұлпасы.`,
        );
      } else {
        line = this.copy(`Тихо лови... ${this.caught}/${this.target}`, `Тыныш ұста... ${this.caught}/${this.target}`);
      }
      objective = this.copy(`❄️ ${this.caught}/${this.target} (бонус: ${this.bonus})`, `❄️ ${this.caught}/${this.target} (бонус: ${this.bonus})`);
    } else if (p === 'finish') {
      speaker = this.copy('Снеговик', 'Аққала');
      line = this.copy('Спасибо за снежинки! Идите по ледяной тропинке!', 'Қар үшін рахмет! Мұзды жолмен жүр!');
      objective = this.isMobile
        ? this.copy('Подойди к снеговику и нажми лапку', 'Аққалаға жақындап, табанды бас')
        : this.copy('Подойди к снеговику и нажми E', 'Аққалаға жақындап, E пернесін бас');
    } else if (p === 'outro') {
      speaker = this.copy('Айя', 'Айя');
      line = this.copy('Как красиво! Впереди — ледяная тропа!', 'Қандай әдемі! Алда — мұзды жол!');
      objective = this.copy('🧊 К ледяной тропе!', '🧊 Мұзды жолға!');
    }

    this.onHud?.({
      phase: p,
      speaker,
      line,
      objective,
      caught: this.caught,
      target: this.target,
      bonus: this.bonus,
      stars: this.stars,
      canInteract: p === 'finish' && this.hero.position.distanceTo(this.snowmanPos) < 2.5,
      showMoveHint: !this.hasTakenFirstStep && (p === 'intro' || p === 'finish'),
      showActionHint: p === 'finish',
      outro: p === 'outro',
    });
  }

  private spawnSnowflake() {
    const x = (Math.random() - 0.5) * 18;
    const z = -2 - Math.random() * 14;
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.18 + Math.random() * 0.08),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xe1f5fe,
        emissiveIntensity: 0.35 + Math.random() * 0.2,
        transparent: true,
        opacity: 0.92,
      }),
    );
    mesh.position.set(x, 9 + Math.random() * 2, z);
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.snowflakes.push({
      mesh,
      vy: 0.85 + Math.random() * 0.35,
      grounded: false,
      groundTime: 0,
      caught: false,
    });
  }

  private nearestSnowflake(): THREE.Vector3 | null {
    let best: THREE.Vector3 | null = null;
    let bestD = Infinity;
    for (const sf of this.snowflakes) {
      if (sf.caught || !sf.grounded) continue;
      const d = this.hero.position.distanceTo(sf.mesh.position);
      if (d < bestD) { bestD = d; best = sf.mesh.position.clone(); }
    }
    return best;
  }

  private catchSnowflake(sf: Snowflake) {
    sf.caught = true;
    this.caught++;
    this.stars += this.caught <= this.bonus ? 2 : 0;
    AudioManager.sfx(this.caught <= this.target ? 'sparkle' : 'bonus');
    this.spawnSparks(sf.mesh.position, 10, [0xe1f5fe, 0xffffff]);
    this.scene.remove(sf.mesh);
    this.updateSnowmanProgress();

    if (this.caught === this.target) {
      this.spawnSparks(this.snowmanPos, 16, [0x4fc3f7, 0xffd700]);
    }
    if (this.caught >= this.bonus) {
      this.phase = 'finish';
      this.stars += 6;
      this.spawnSparks(new THREE.Vector3(0, 2, -6), 20, [0xffd700, 0x00cec9]);
    } else if (this.caught >= this.target && this.phase === 'catch') {
      // Allow bonus catches; player walks to snowman when ready
    }
    this.pushHud();
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
        this.phase = 'catch';
        this.nextSpawn = now + 800;
        this.pushHud();
      } else {
        this.nextAt = now + 2800;
        this.pushHud();
      }
    }

    // Meditative spawn pacing
    if ((this.phase === 'catch' || (this.phase === 'finish' && this.caught < this.bonus)) && now > this.nextSpawn && this.snowflakes.filter(s => !s.caught).length < 6) {
      this.spawnSnowflake();
      this.nextSpawn = now + 1400 + Math.random() * 1600;
    }

    for (const sf of this.snowflakes) {
      if (sf.caught) continue;
      if (!sf.grounded) {
        sf.mesh.position.y -= sf.vy * dt;
        sf.mesh.rotation.x += dt * 1.8;
        sf.mesh.rotation.y += dt * 1.2;
        if (sf.mesh.position.y <= 0.3) {
          sf.grounded = true;
          sf.groundTime = now;
          sf.mesh.position.y = 0.3;
        }
      } else if (this.phase === 'catch' || this.phase === 'finish') {
        const d = this.hero.position.distanceTo(sf.mesh.position);
        if (d < 1.6) {
          this.catchSnowflake(sf);
          continue;
        }
        if (now - sf.groundTime > 6000) {
          sf.caught = true;
          this.scene.remove(sf.mesh);
        }
      }
    }

    // Walk to snowman after minimum catches
    if (this.phase === 'catch' && this.caught >= this.target) {
      const d = this.hero.position.distanceTo(this.snowmanPos);
      if (d < 2.2) {
        this.phase = 'finish';
        this.pushHud();
      }
    }

    const canMove = !['intro', 'outro'].includes(this.phase);
    this.updateMovement(dt, canMove, this.baseSpeed * 0.92, -12, 12, -16, 8);

    const obj = this.phase === 'catch' ? this.nearestSnowflake()
      : this.phase === 'finish' ? this.snowmanPos.clone()
      : null;
    this.updateGuideArrow(now, obj, ['intro', 'outro']);

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

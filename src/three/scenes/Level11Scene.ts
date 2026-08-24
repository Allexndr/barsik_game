import * as THREE from 'three';
import {
  BaseLevelScene, type BaseHud, zoneDisc, spawnPad,
  loadCharModel, loadPropModel, placeWoodSign,
} from './BaseLevelScene';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { placeAmbientCritters } from '../s1Place';
import { AudioManager } from '@/audio/AudioManager';

/**
 * Level 11 «Первые снежинки» — GDD Level 11.
 *
 * One mechanic, escalated three times:
 *   first  — two slow flakes that sit a long while on the snow;
 *   build  — five more at normal pace, the snowman growing with each;
 *   golden — golden flakes that only count if caught in mid-air, which is
 *            where the jump finally becomes a skill rather than a toy.
 *
 * The old version had no timing at all despite the level being named for
 * it: flakes were collected by walking near them where they lay, and the
 * whole thing resolved in about ninety seconds.
 */

export type L11Phase = 'intro' | 'first' | 'build' | 'golden' | 'finish' | 'outro';

export interface L11Hud extends BaseHud {
  caught: number;
  target: number;
  golden: number;
  goldenTarget: number;
}

interface Snowflake {
  mesh: THREE.Mesh;
  vy: number;
  grounded: boolean;
  groundedAt: number;
  caught: boolean;
  gold: boolean;
}

/** Reach above the hero's feet — a jump has to actually get you there. */
const CATCH_REACH = 2.3;

export class Level11Scene extends BaseLevelScene {
  private phase: L11Phase = 'intro';
  private onHud: ((h: L11Hud) => void) | null = null;
  private introI = 0;
  private nextAt = 0;
  private snowflakes: Snowflake[] = [];
  private caught = 0;
  private readonly firstTarget = 2;
  private readonly target = 7;
  private golden = 0;
  private readonly goldenTarget = 5;
  private nextSpawn = 0;
  private snowman: THREE.Object3D | null = null;
  private snowmanParts: THREE.Object3D[] = [];
  private snowmanStage = 0;
  private snowmanPos = new THREE.Vector3(0, 0, -12);
  private snowmanIsGlb = false;
  private aya: THREE.Object3D | null = null;
  private beatMsg: { ru: string; kk: string } | null = null;
  private beatUntil = 0;

  protected currentPhase() { return this.phase; }

  protected onMovementHintDismiss() { this.pushHud(); }

  private get isCatching() {
    return this.phase === 'first' || this.phase === 'build' || this.phase === 'golden';
  }

  private setBeat(ru: string, kk: string) {
    this.beatMsg = { ru, kk };
    this.beatUntil = performance.now() + 5000;
  }

  tryInteract() {
    if (this.phase !== 'finish') return;
    if (this.hero.position.distanceTo(this.snowmanPos) < 3) {
      this.phase = 'outro';
      this.stars += 8;
      this.spawnSparks(this.snowmanPos, 26, [0xffd700, 0x00cec9]);
      AudioManager.sfx('levelComplete');
      this.pushHud();
    }
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L11Hud) => void) {
    this.nick = nick || this.defaultNick(lang);
    this.lang = lang;
    this.onHud = onHud;
    const loader = createGameGltfLoader();

    this.camera.position.set(0, 8, 17);
    this.reserve(0, -12, 5);

    await this.setupWinterEnvironment(loader, {
      clouds: 7,
      decorCount: 38,
      decorCenterZ: -12,
      terrain: {
        relief: 0.9,
        rimHeight: 3.6,
        playHalfExtent: 32,
        seed: 11,
        features: [
          { kind: 'flat', x: 0, z: -10, r: 24 },
          { kind: 'mound', x: -24, z: -18, r: 10, height: 2.4 },
          { kind: 'mound', x: 25, z: -8, r: 10, height: 2.8 },
        ],
      },
    });

    this.snowmanPos.y = this.groundHeightAt(0, -12);
    this.scene.add(zoneDisc(0, 5, 3.6, 0xe1f5fe, this.groundHeightAt(0, 5) + 0.04));
    this.scene.add(zoneDisc(0, -12, 4, 0x81d4fa, this.snowmanPos.y + 0.05));
    const pad = spawnPad(0, 5);
    this.snapToGround(pad);
    this.scene.add(pad);
    this.scene.add(await placeWoodSign(loader, -3, 3.5, 0.3, 0xe1f5fe));

    const snowGlb = await loadPropModel(loader, 'snowman.glb', { height: 2.6 });
    this.snowman = snowGlb ?? this.makeSnowman();
    this.snowmanIsGlb = Boolean(snowGlb);
    this.snowman.position.copy(this.snowmanPos);
    this.snowman.visible = false;
    this.scene.add(this.snowman);
    this.colliders.push({ kind: 'circle', x: 0, z: -12, r: 1.1 });

    const ayaGlb = await loadCharModel(loader, 'aya.glb', 1.28);
    if (ayaGlb) {
      ayaGlb.position.set(-4.5, 0, -9);
      this.snapToGround(ayaGlb);
      ayaGlb.lookAt(0, ayaGlb.position.y, -12);
      this.aya = ayaGlb;
      this.scene.add(ayaGlb);
      // Only the snowman had a collider — the standing character next to
      // it didn't.
      this.colliders.push({ kind: 'circle', x: ayaGlb.position.x, z: ayaGlb.position.z, r: 0.55 });
    }

    await this.placeProps(loader, [
      { key: 'pine_tree', opts: { x: -10, z: -5, maxSize: 3.0 } },
      { key: 'pine_tree', opts: { x: 13, z: -16, maxSize: 2.8 } },
      { key: 'pine_tree', opts: { x: -18, z: -21, maxSize: 3.2 } },
      { key: 'rock_snow', opts: { x: 9, z: -3, maxSize: 1.4 } },
      { key: 'rock_snow', opts: { x: -14, z: -13, maxSize: 1.3 } },
      { key: 'snow_pile', opts: { x: 6, z: -20, maxSize: 1.3 } },
      { key: 'snow_pile', opts: { x: -7, z: -24, maxSize: 1.2 } },
      { key: 'tree_decorated', opts: { x: 18, z: -24, maxSize: 2.4 } },
      { key: 'carrot', opts: { x: -1.6, z: -11, maxSize: 0.4 } },
    ]);
    await placeAmbientCritters(this.scene, loader, [
      { key: 'rabbit', x: -6.5, z: 1, rotY: 0.9, h: 0.7 },
      { key: 'penguin', x: 7, z: -14, rotY: -0.8, h: 0.75 },
      { key: 'polar', x: -12, z: -6, rotY: 0.5, h: 0.95 },
      { key: 'fox', x: 15, z: -5, rotY: -1.4, h: 0.8 },
    ]);

    this.hero.position.set(0, this.groundHeightAt(0, 5), 5);
    // One room, not one road. A corridor here would put a wall through the
    // middle of the only space the level has.
    // Taken from the movement bounds the level already declares: x ±24, z −30..8.
    this.playArena = { x: 0, z: -11, r: 31 };
    await this.encloseArena(loader);

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
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82 });
    for (const [r, y] of [[0.7, 0.7], [0.5, 1.6], [0.34, 2.24]] as const) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12), snowMat);
      s.position.y = y;
      s.castShadow = true;
      s.visible = false;
      g.add(s);
      this.snowmanParts.push(s);
    }
    return g;
  }

  /**
   * Snowman grows in three readable steps, not a continuous scale creep a
   * five-year-old can't track (plan §6, D/L11 "grows in readable stages"):
   * base ball → +torso → +head, one new part per third of the build act.
   * A GLB snowman has no separable parts, so it pops through the same three
   * steps as fixed scale jumps instead.
   */
  private updateSnowman() {
    if (!this.snowman) return;
    const built = Math.max(0, this.caught - this.firstTarget);
    const span = this.target - this.firstTarget;
    if (built <= 0) {
      this.snowman.visible = false;
      this.snowmanStage = 0;
      return;
    }
    this.snowman.visible = true;
    const stage = Math.min(3, Math.ceil((built / span) * 3));
    if (this.snowmanIsGlb) {
      this.snowman.scale.setScalar([0.45, 0.7, 1.0][stage - 1]);
    } else {
      this.snowmanParts.forEach((part, i) => { part.visible = i < stage; });
    }
    if (stage > this.snowmanStage) {
      this.spawnSparks(
        this.snowmanPos.clone().add(new THREE.Vector3(0, 0.8 + stage * 0.6, 0)),
        14, [0xffffff, 0xe1f5fe],
      );
      AudioManager.sfx('sparkle');
    }
    this.snowmanStage = stage;
  }

  private spawnSnowflake(gold: boolean) {
    // Golden flakes spawn nearer the hero: they must be caught mid-air, so
    // the player needs a fair chance to get under one before it lands.
    const cx = gold ? this.hero.position.x : 0;
    const cz = gold ? this.hero.position.z : -8;
    const spread = gold ? 7 : 20;
    const x = THREE.MathUtils.clamp(cx + (Math.random() - 0.5) * spread, -20, 20);
    const z = THREE.MathUtils.clamp(cz + (Math.random() - 0.5) * spread, -26, 6);

    const mesh = new THREE.Mesh(
      // Снежинку надо успеть поймать в воздухе — значит, её надо сначала
      // увидеть. Радиус 0.2 на фоне снега это точка.
      new THREE.OctahedronGeometry(gold ? 0.38 : 0.3),
      new THREE.MeshStandardMaterial({
        color: gold ? 0xffe27a : 0xffffff,
        emissive: gold ? 0xf1c40f : 0xe1f5fe,
        emissiveIntensity: gold ? 0.8 : 0.4,
        transparent: true,
        opacity: 0.95,
      }),
    );
    mesh.position.set(x, this.groundHeightAt(x, z) + 8.5 + Math.random() * 1.5, z);
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.snowflakes.push({
      mesh,
      // Slow and forgiving in the first act, brisk once it is a golden catch.
      vy: (this.phase === 'first' ? 0.55 : gold ? 1.5 : 0.95) + Math.random() * 0.25,
      grounded: false,
      groundedAt: 0,
      caught: false,
      gold,
    });
  }

  private catchFlake(sf: Snowflake, inAir: boolean) {
    sf.caught = true;
    this.scene.remove(sf.mesh);

    if (sf.gold) {
      this.golden++;
      this.stars += 3;
      AudioManager.sfx('bonus');
      this.spawnSparks(sf.mesh.position, 16, [0xffd700, 0xfff3c4]);
      if (this.golden >= this.goldenTarget) {
        this.phase = 'finish';
        this.stars += 10;
        this.setBeat('Все золотые пойманы! Иди к снеговику.', 'Барлық алтын ұсталды! Аққалаға бар.');
      }
      this.pushHud();
      return;
    }

    this.caught++;
    this.stars += 2;
    AudioManager.sfx(inAir ? 'bonus' : 'sparkle');
    this.spawnSparks(sf.mesh.position, 10, [0xe1f5fe, 0xffffff]);
    this.updateSnowman();

    if (this.caught === this.firstTarget && this.phase === 'first') {
      this.phase = 'build';
      this.setBeat(
        'Из снежинок растёт снеговик! Поймай ещё пять.',
        'Қар ұлпасынан аққала өседі! Тағы бесеуін ұста.',
      );
    } else if (this.caught >= this.target && this.phase === 'build') {
      this.phase = 'golden';
      this.setBeat(
        'Смотри — золотые снежинки! Их надо ловить в воздухе: подпрыгни!',
        'Қара — алтын ұлпалар! Оларды ауада ұстау керек: секір!',
      );
    }
    this.pushHud();
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
        this.copy('Снег! Первый снег!', 'Қар! Алғашқы қар!'),
        this.copy(`Айя радуется, ${n}! Лови снежинки — не спеши.`, `Айя қуанады, ${n}! Қар ұста — асықпа.`),
        this.copy('Подойди к снежинке, пока она лежит на снегу.', 'Ұлпа қарда жатқанда жақында.'),
      ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = this.copy('❄️ Поймай первые снежинки', '❄️ Алғашқы ұлпаларды ұста');
    } else if (p === 'first') {
      if (!line) line = this.copy('Они падают медленно — успеешь.', 'Олар баяу түседі — үлгересің.');
      objective = this.copy(`❄️ ${this.caught}/${this.firstTarget}`, `❄️ ${this.caught}/${this.firstTarget}`);
    } else if (p === 'build') {
      if (!line) line = this.copy(`Снеговик растёт: ${this.caught}/${this.target}`, `Аққала өседі: ${this.caught}/${this.target}`);
      objective = this.copy(`⛄ ${this.caught}/${this.target} снежинок`, `⛄ ${this.caught}/${this.target} ұлпа`);
    } else if (p === 'golden') {
      if (!line) {
        line = this.isMobile
          ? this.copy('Золотые ловятся только в воздухе — прыгай под ними!', 'Алтындар тек ауада ұсталады — астынан секір!')
          : this.copy('Золотые ловятся только в воздухе — прыжок на Space!', 'Алтындар тек ауада ұсталады — Space-пен секір!');
      }
      objective = this.copy(
        `✨ Золотых: ${this.golden}/${this.goldenTarget}`,
        `✨ Алтын: ${this.golden}/${this.goldenTarget}`,
      );
    } else if (p === 'finish') {
      speaker = this.copy('Снеговик', 'Аққала');
      line = this.copy('Спасибо за снежинки! Подойди ко мне.', 'Қар үшін рахмет! Маған жақында.');
      objective = this.isMobile
        ? this.copy('Подойди к снеговику и нажми лапку', 'Аққалаға жақындап, табанды бас')
        : this.copy('Подойди к снеговику и нажми E', 'Аққалаға жақындап, E пернесін бас');
    } else if (p === 'outro') {
      speaker = this.copy('Айя', 'Айя');
      line = this.copy('Как красиво! Впереди — ледяная тропа!', 'Қандай әдемі! Алда — мұзды жол!');
      objective = this.copy('🧊 К ледяной тропе!', '🧊 Мұзды жолға!');
    }

    this.onHud?.({
      phase: p, speaker, line, objective,
      caught: this.caught,
      target: this.target,
      golden: this.golden,
      goldenTarget: this.goldenTarget,
      stars: this.stars,
      canInteract: p === 'finish' && this.hero.position.distanceTo(this.snowmanPos) < 3,
      showMoveHint: !this.hasTakenFirstStep && (p === 'intro' || p === 'first'),
      showActionHint: p === 'finish',
      outro: p === 'outro',
    });
  }

  private nearestFlakePos(): THREE.Vector3 | null {
    let best: THREE.Vector3 | null = null;
    let bestD = Infinity;
    const wantGold = this.phase === 'golden';
    for (const sf of this.snowflakes) {
      if (sf.caught || sf.gold !== wantGold) continue;
      const d = this.hero.position.distanceTo(sf.mesh.position);
      if (d < bestD) { bestD = d; best = sf.mesh.position.clone(); }
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
        this.phase = 'first';
        this.nextSpawn = now + 600;
      } else {
        this.nextAt = now + 2800;
      }
      this.pushHud();
    }

    // ── Spawning ─────────────────────────────────────────────────
    if (this.isCatching && now > this.nextSpawn) {
      const live = this.snowflakes.filter((s) => !s.caught).length;
      const cap = this.phase === 'first' ? 3 : this.phase === 'golden' ? 4 : 6;
      if (live < cap) {
        this.spawnSnowflake(this.phase === 'golden');
        this.nextSpawn = now + (this.phase === 'golden' ? 900 : 1300) + Math.random() * 1200;
      } else {
        this.nextSpawn = now + 400;
      }
    }

    // ── Flakes ───────────────────────────────────────────────────
    for (const sf of this.snowflakes) {
      if (sf.caught) continue;
      const ground = this.groundHeightAt(sf.mesh.position.x, sf.mesh.position.z) + 0.3;

      if (!sf.grounded) {
        sf.mesh.position.y -= sf.vy * dt;
        sf.mesh.rotation.x += dt * 1.8;
        sf.mesh.rotation.y += dt * 1.2;
        sf.mesh.position.x += Math.sin(now * 0.001 + sf.mesh.position.z) * dt * 0.35;

        // Mid-air catch: the hero's head has to reach it. This is the whole
        // point of the golden act, and a free bonus during the earlier ones.
        const flat = Math.hypot(
          sf.mesh.position.x - this.hero.position.x,
          sf.mesh.position.z - this.hero.position.z,
        );
        const reachTop = this.hero.position.y + CATCH_REACH;
        if (flat < 1.5 && sf.mesh.position.y <= reachTop && sf.mesh.position.y > this.hero.position.y) {
          this.catchFlake(sf, true);
          continue;
        }

        if (sf.mesh.position.y <= ground) {
          sf.grounded = true;
          sf.groundedAt = now;
          sf.mesh.position.y = ground;
          // A golden flake that lands is spent — that is the timing pressure.
          if (sf.gold) {
            sf.caught = true;
            this.scene.remove(sf.mesh);
            AudioManager.sfx('stumble');
          }
        }
        continue;
      }

      if (!this.isCatching) continue;
      if (this.hero.position.distanceTo(sf.mesh.position) < 1.6) {
        this.catchFlake(sf, false);
        continue;
      }
      // Dissolve if left too long, so the field never silts up.
      const life = this.phase === 'first' ? 9000 : 6000;
      if (now - sf.groundedAt > life) {
        sf.caught = true;
        this.scene.remove(sf.mesh);
      }
    }

    this.updateMovement(dt, this.phase !== 'intro' && this.phase !== 'outro',
      this.baseSpeed * 0.95, -24, 24, -30, 8);

    if (this.aya) {
      this.aya.position.y = this.groundHeightAt(this.aya.position.x, this.aya.position.z)
        + Math.abs(Math.sin(now * 0.004)) * 0.06;
    }
    if (this.beatMsg && now > this.beatUntil) {
      this.beatMsg = null;
      this.pushHud();
    }

    const obj = this.isCatching ? this.nearestFlakePos()
      : this.phase === 'finish' ? this.snowmanPos.clone()
      : null;
    this.updateGuideArrow(now, obj, ['intro', 'outro']);
    this.updateAmbient(dt, now);

    if (this.phase === 'intro') {
      const idx = Math.min(this.introI, 2);
      const introPos = [
        new THREE.Vector3(0, 8, 17),
        new THREE.Vector3(-5, 5, -4),
        new THREE.Vector3(0, 6, 11),
      ];
      const introLook = [
        new THREE.Vector3(0, 1.2, 2),
        new THREE.Vector3(-4.5, 1.2, -9),
        new THREE.Vector3(0, 1.5, -6),
      ];
      this.camera.position.lerp(introPos[idx], 1 - Math.pow(0.02, dt));
      this.camera.lookAt(introLook[idx]);
    } else {
      const f = this.cameraFraming();
      // Golden act pulls back and up a little: you need to see flakes above
      // you to line a jump up at all.
      const lift = this.phase === 'golden' ? 1.1 : 0;
      const target = new THREE.Vector3(
        this.cameraLateral(this.hero.position.x) + f.lateral,
        this.hero.position.y + (6 + lift) * f.heightMul,
        this.hero.position.z + 10 + f.backAdd,
      );
      this.camera.position.lerp(target, 1 - Math.pow(0.0015, dt));
      this.camera.lookAt(
        this.cameraLateral(this.hero.position.x),
        this.hero.position.y + 1.2 + lift + f.lookUp,
        this.hero.position.z - 3 - f.lookAhead,
      );
    }

    this.renderFrame();
  };
}

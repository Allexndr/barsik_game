import * as THREE from 'three';
import {
  BaseLevelScene, type BaseHud, zoneDisc, spawnPad, questMarker, pathArrow,
  loadCharModel, loadPropModel, placeWoodSign,
} from './BaseLevelScene';
import { groundY } from '../modelUtils';
import { CAST_CHAR_GLB, CAST_PROP_GLB, KEY_ICE } from '../castModels';
import { resolveKey } from '../inventory';
import { createPlushSquirrel, createPlushHedgehog } from '../PlushAnimals';
import { createPlushCharacter } from '../PlushCharacter';
import { AYA_LOOK, ZHULDYZ_LOOK } from '../characterLooks';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { placeAmbientCritters } from '../s1Place';
import { AudioManager } from '@/audio/AudioManager';
import { useGameStore } from '@/store/useGameStore';

/**
 * Level 16 «Зимний QR-сундук» — GDD Level 16:
 * Ice key opens snowflake lock. Group photo finale. Season 1 complete → Chapter 3 teaser.
 */

/** The cave sits at the far end of the climb, not four metres from spawn. */
const CHEST_Z = -34;

export type L16Phase = 'intro' | 'gather' | 'lock' | 'approach' | 'unlock' | 'open' | 'outro';
export interface L16Hud extends BaseHud {
  chestOpen: boolean;
  prepDone: number;
  prepTotal: number;
}

/**
 * Кого Барсик встречает по дороге к пещере.
 *
 * Индексы — в списке `friendIds` общего снимка. Эти пятеро ждут вдоль подъёма
 * и уходят к пещере, когда с ними поздороваются; остальные четверо уже там.
 * Финальный снимок «все, кого Барсик встретил за сезон» раньше просто
 * включался в конце — девять фигур появлялись из воздуха. Теперь их приводит
 * игрок, и к последнему кадру они идут за ним процессией.
 */
const WAITING_FRIENDS: ReadonlyArray<{
  index: number;
  x: number;
  z: number;
  ru: string;
  kk: string;
}> = [
  { index: 0, x: -9, z: -4, ru: 'Садовник! Я дошёл до самых гор, как обещал.', kk: 'Бағбан! Мен уәде еткендей, тауларға дейін жеттім.' },
  { index: 2, x: 10, z: -11, ru: 'Ёжик, ты добрался сюда по снегу? Вот молодец!', kk: 'Кірпі, сен мұнда қар үстімен жеттің бе? Жарайсың!' },
  { index: 3, x: -12, z: -19, ru: 'Твой жёлудь открыл сундук в лесу. Спасибо тебе!', kk: 'Сенің жаңғағың орманда сандықты ашты. Саған рахмет!' },
  { index: 4, x: 11, z: -25, ru: 'Путало, ты пришёл! Снимешь нас всех вместе?', kk: 'Путало, сен келдің! Бәрімізді бірге түсіресің бе?' },
  { index: 5, x: -7, z: -30, ru: 'Ягодка, и ты здесь! Пойдём, пещера уже близко.', kk: 'Жидек, сен де мұндасың! Жүр, үңгір жақын қалды.' },
];

/** Сколько лучей у снежинки-замка. */
const LOCK_RAYS = 3;

function makeFriendSilhouette(color: number, x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.85, 8), mat);
  body.position.y = 0.42;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), mat);
  head.position.y = 0.95;
  g.add(body, head);
  g.position.set(x, 0, z);
  return g;
}

export class Level16Scene extends BaseLevelScene {
  private phase: L16Phase = 'intro';
  private onHud: ((h: L16Hud) => void) | null = null;
  private introI = 0;
  private nextAt = 0;
  private chest: THREE.Group | null = null;
  private chestOpen = false;
  private lidOpenTime = 0;
  private friends: THREE.Object3D[] = [];
  private confettiBurst = 0;
  private iceKey: THREE.Object3D | null = null;
  private hasIceKey = false;
  private prepMarkers: THREE.Object3D[] = [];
  private prepDone = 0;
  private readonly prepTotal = WAITING_FRIENDS.length;
  private crystals: THREE.Object3D[] = [];
  /** Кристаллы, которые надо вставить в снежинку-замок. */
  private lockCrystals: THREE.Object3D[] = [];
  private lockSet = 0;
  private lockRays: THREE.Mesh[] = [];
  /** Летящие в замок кристаллы: from → to за 900 мс. */
  private flying: Array<{ obj: THREE.Object3D; from: THREE.Vector3; to: THREE.Vector3; start: number; ray: number }> = [];
  private beatRu = '';
  private beatKk = '';
  private beatUntil = 0;

  protected currentPhase() { return this.phase; }

  protected onMovementHintDismiss() {
    this.pushHud();
  }

  private say(ru: string, kk: string, ms = 4200) {
    this.beatRu = ru;
    this.beatKk = kk;
    this.beatUntil = performance.now() + ms;
  }

  tryInteract() {
    if (this.phase === 'gather') {
      const t = this.interactTarget;
      if (!t?.userData.isWaitingFriend || t.userData.greeted) return;
      t.userData.greeted = true;
      this.prepDone += 1;
      this.stars += 3;
      this.spawnSparks(t.position, 12, [0xffd700, 0x4fc3f7]);
      AudioManager.sfx('found');
      this.say(t.userData.greetRu as string, t.userData.greetKk as string);
      // Друг уходит к пещере сам — к финальному кадру он уже стоит на месте.
      t.userData.walking = true;
      if (this.prepDone >= this.prepTotal) {
        this.phase = 'lock';
        this.spawnSparks(this.chest?.position ?? this.hero.position, 16, [0xffd700, 0xffffff]);
        this.say(
          'Все в сборе! Снежинка-замок пустая — верни в неё три кристалла.',
          'Бәрі жиналды! Қар құлыбы бос — оған үш кристалды қайтар.',
        );
      }
      this.pushHud();
      return;
    }

    if (this.phase === 'lock') {
      const t = this.interactTarget;
      if (!t?.userData.isLockCrystal || t.userData.set) return;
      t.userData.set = true;
      this.lockSet += 1;
      this.stars += 4;
      AudioManager.sfx('sparkle');
      const rayIndex = this.lockSet - 1;
      const ray = this.lockRays[rayIndex];
      this.flying.push({
        obj: t,
        from: t.position.clone(),
        to: ray ? ray.getWorldPosition(new THREE.Vector3()) : (this.chest?.position.clone() ?? t.position.clone()),
        start: performance.now(),
        ray: rayIndex,
      });
      if (this.lockSet >= LOCK_RAYS) {
        this.phase = 'approach';
        this.say(
          'Снежинка светится! Теперь ключ подойдёт.',
          'Ұлпа жарқырап тұр! Енді кілт келеді.',
        );
      }
      this.pushHud();
      return;
    }

    if (this.phase !== 'approach') return;
    if (!this.interactTarget || !this.chest) return;
    if (!this.hasIceKey) {
      this.pushHud();
      return;
    }
    this.phase = 'unlock';
    this.stars += 10;
    this.spawnSparks(this.chest.position, 20, [0x4fc3f7, 0xffd700]);
    AudioManager.sfx('success');
    if (this.iceKey) this.iceKey.visible = false;
    this.nextAt = performance.now() + 1800;
    this.pushHud();
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L16Hud) => void) {
    this.nick = nick || this.defaultNick(lang);
    this.lang = lang;
    this.onHud = onHud;

    // Same shape as L9's acorn: derived from the save rather than a loose
    // localStorage flag, because the flag is outside `barsik_progress` and a
    // save that lost it left the season finale unfinishable.
    this.hasIceKey = resolveKey(KEY_ICE).has;
    if (!this.hasIceKey && import.meta.env.DEV) {
      // Spare for a QA jump into `?mission=16` with no save. Never in a build,
      // and never when the save says L13 is behind you — that case now takes
      // the real path, so the real path is the one being played locally.
      console.warn('[L16] no ice key and level 13 is not complete — granting for QA only');
      this.hasIceKey = true;
    }

    const loader = createGameGltfLoader();

    this.camera.position.set(0, 6, 14);
    await this.setupWinterEnvironment(loader, {
      sky: ['#3a5a7a', '#6a8aaa', '#b0d0e8'],
      backdrop: 'finale',
      // The default play extent of 30 puts the rim lift — a 3.4 m wall of
      // hillside — across everything past z = -16. With the finale moved to
      // the end of a forty-metre climb, the chest and all seven friends would
      // have been standing on that slope.
      terrain: { playHalfExtent: 52, rimFalloff: 16 },
      decorCenterZ: -22,
    });

    this.scene.add(zoneDisc(0, 4, 6, 0x4fc3f7, 0.04));
    this.scene.add(zoneDisc(0, CHEST_Z, 6.5, 0xffd700, 0.05));
    this.scene.add(spawnPad(0, 4));
    this.scene.add(await placeWoodSign(loader, -2.5, 2, 0.3, 0x4fc3f7));

    this.chest = this.makeChest();
    this.chest.position.set(0, 0, CHEST_Z);
    const meshyChest = await loadPropModel(loader, 'treasure_chest.glb', { maxSize: 1.6 });
    if (meshyChest) {
      for (const child of [...this.chest.children]) {
        if (child === this.chest.userData.glow) continue;
        if (child === this.chest.userData.lid) continue;
        if (child === this.chest.userData.lock) continue;
        this.chest.remove(child);
      }
      meshyChest.rotation.y = Math.PI;
      groundY(meshyChest);
      this.chest.add(meshyChest);
    }
    this.scene.add(this.chest);
    this.colliders.push({ kind: 'circle', x: 0, z: CHEST_Z, r: 1.2 });

    // Здесь стояли три золотых круга «поставь подарок». Круг — это не место и
    // не человек: последним делом сезона было трижды нажать лапку на пустой
    // траве. Теперь вдоль подъёма ждут пятеро друзей (`WAITING_FRIENDS`), и
    // финальный снимок собирает игрок, а не движок.
    //
    // Кольца-подсветки остаются: они отмечают, где ждёт друг.
    for (const spot of WAITING_FRIENDS) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.6, 0.95, 24),
        new THREE.MeshBasicMaterial({
          color: 0xffe066,
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(spot.x, this.groundHeightAt(spot.x, spot.z) + 0.05, spot.z);
      this.scene.add(ring);
      this.prepMarkers.push(ring);
    }

    const marker = questMarker(0x4fc3f7, 0x81d4fa);
    marker.position.set(0, 0, CHEST_Z);
    this.snapToGround(marker);
    marker.position.y += 2.6;
    this.scene.add(marker);
    this.prepMarkers.push(marker);

    // Floating ice key (from L13 master) — ice_key prop → golden tinted → procedural
    const iceKeyGlb = await loadPropModel(loader, CAST_PROP_GLB.ice_key_prop, { maxSize: 0.55 });
    const goldenKeyGlb = iceKeyGlb
      ? null
      : await loadPropModel(loader, CAST_PROP_GLB.golden_key, { maxSize: 0.5 });
    const meshyKey = iceKeyGlb ?? goldenKeyGlb;
    if (meshyKey) {
      if (!iceKeyGlb) {
        meshyKey.traverse((o) => {
          const m = (o as THREE.Mesh).material;
          if (m && (m as THREE.MeshStandardMaterial).color) {
            const mat = (m as THREE.MeshStandardMaterial).clone();
            mat.color.setHex(0x81d4fa);
            mat.emissive?.setHex(0x4fc3f7);
            mat.emissiveIntensity = 0.45;
            (o as THREE.Mesh).material = mat;
          }
        });
      }
      this.iceKey = meshyKey as THREE.Group;
      this.iceKey.position.set(-1.2, 2.2, 2);
    } else {
      this.iceKey = new THREE.Group();
      const keyMat = new THREE.MeshStandardMaterial({ color: 0x4fc3f7, emissive: 0x81d4fa, emissiveIntensity: 0.7 });
      const keyBody = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), keyMat);
      const keyShaft = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.25, 0.05), keyMat);
      keyShaft.position.y = -0.2;
      this.iceKey.add(keyBody, keyShaft);
      this.iceKey.position.set(-1.2, 2.2, 2);
    }
    this.iceKey.visible = this.hasIceKey;
    this.scene.add(this.iceKey);

    // Крупнее: с игровой камеры в девяти метрах предмет меньше двух третей
    // метра ребёнок не опознаёт как «то, что надо взять». Тот же класс, что
    // яблоки на L2, только тонуть здесь не в чем — снег без высокой травы.
    const crystalTpl = await loadPropModel(loader, CAST_PROP_GLB.ice_crystal, { maxSize: 0.75 });
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const r = 5.4;
      let crystal: THREE.Object3D;
      if (crystalTpl) {
        crystal = crystalTpl.clone(true);
        crystal.position.set(Math.cos(angle) * r, 0.5, CHEST_Z + Math.sin(angle) * r);
      } else {
        crystal = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.28),
          new THREE.MeshStandardMaterial({ color: 0x4fc3f7, emissive: 0x4fc3f7, emissiveIntensity: 0.45, transparent: true, opacity: 0.85 }),
        );
        crystal.position.set(Math.cos(angle) * r, 0.5, CHEST_Z + Math.sin(angle) * r);
        crystal.castShadow = true;
      }
      crystal.userData.spin = i;
      this.crystals.push(crystal);
      this.scene.add(crystal);
    }

    await this.placeProps(loader, [
      { key: 'snowflake', opts: { x: 0, z: -4, maxSize: 0.7, y: 2.8 } },
      { key: 'pine_tree', opts: { x: -6, z: -8, maxSize: 2.6 } },
      { key: 'pine_tree', opts: { x: 6.5, z: -7, maxSize: 2.4 } },
      { key: 'snowman', opts: { x: -5, z: -1, maxSize: 1.4, rotY: 0.6 } },
      { key: 'present', opts: { x: 2.2, z: -5.5, maxSize: 0.55 } },
      { key: 'present_b', opts: { x: -2.4, z: -5.8, maxSize: 0.5 } },
      { key: 'tree_decorated', opts: { x: 5, z: -10, maxSize: 2.5 } },
      { key: 'star', opts: { x: 0, z: -4, maxSize: 0.4, y: 3.4 } },
    ]);
    await placeAmbientCritters(this.scene, loader, [
      { key: 'fox', x: 5.5, z: 1, rotY: -1.8, h: 0.8 },
      { key: 'rabbit', x: -4.5, z: 2, rotY: 0.5, h: 0.65 },
      { key: 'owl', x: 7, z: -5, rotY: -2.2, h: 0.7 },
      { key: 'penguin', x: -7, z: -4, rotY: 0.9, h: 0.75 },
    ]);

    // Group photo — unlocked cast first; locked friends as soft silhouettes
    const unlocked = new Set(useGameStore.getState().friends.map((f) => f.id));
    // Always show gardener + aya as story anchors; rest respect unlocks
    unlocked.add('gardener');
    unlocked.add('aya');
    // Full nine-friend roster (season1Friends.ts). yagodka_rare (L9) and
    // snowman (L15) were missing here — the finale photo of "everyone Barsik
    // met" was missing two of the nine people it claimed to be of.
    const friendIds = ['gardener', 'aya', 'hedgehog', 'squirrel', 'putalo', 'yagodka_rare', 'ice_master', 'snowman', 'ice_friend_rare'] as const;
    // A wide arc around the chest rather than a 7x6 huddle in front of the
    // spawn. Everyone Barsik met across the season is standing at the end of
    // the walk, which is the shot the finale is for.
    const friendPositions: [number, number][] = [
      [-7.4, CHEST_Z + 3.4], [7.4, CHEST_Z + 3.4],
      [-8.6, CHEST_Z - 1.2], [8.6, CHEST_Z - 1.2],
      [-10.2, CHEST_Z - 3.2], [10.2, CHEST_Z - 3.2],
      [-5.2, CHEST_Z - 5.4], [5.2, CHEST_Z - 5.4],
      [0, CHEST_Z - 7.2],
    ];
    const friendColors = [0xa29bfe, 0xfdcb6e, 0x55efc4, 0xff7675, 0x74b9ff, 0xffeaa7, 0xe17055, 0xdfe6e9, 0x81ecec];
    for (let i = 0; i < friendPositions.length; i++) {
      const [x, z] = friendPositions[i];
      const id = friendIds[i];
      // Снеговик — единственный из девяти, чья модель лежит среди предметов,
      // а не среди персонажей: он и есть предмет из L15. Пока каталог был
      // объявлен как `Record<string, string>`, `CAST_CHAR_GLB['snowman']`
      // молча отдавал undefined, и в финальном снимке сезона снеговик выходил
      // безымянным цветным силуэтом.
      const isSnowman = id === 'snowman';
      const file = isSnowman ? CAST_PROP_GLB.snowman : CAST_CHAR_GLB[id];
      const isUnlocked = unlocked.has(id) || id === 'ice_friend_rare';
      let f: THREE.Object3D | null = null;
      if (isUnlocked && file) {
        f = isSnowman
          ? await loadPropModel(loader, file, { height: 1.15 })
          : await loadCharModel(loader, file, id === 'hedgehog' || id === 'squirrel' ? 0.9 : 1.15);
      }
      if (!f) {
        if (isUnlocked && id === 'aya') f = createPlushCharacter(AYA_LOOK);
        else if (isUnlocked && id === 'gardener') f = createPlushCharacter(ZHULDYZ_LOOK);
        else if (isUnlocked && id === 'hedgehog') f = createPlushHedgehog();
        else if (isUnlocked && id === 'squirrel') f = createPlushSquirrel();
        else f = makeFriendSilhouette(friendColors[i], x, z);
      }
      f.position.set(x, 0, z);
      f.rotation.y = Math.atan2(-x, CHEST_Z - z);
      groundY(f);
      f.visible = false;
      f.userData.unlockedFriend = isUnlocked;
      f.userData.photoX = x;
      f.userData.photoZ = z;

      // Пятеро ждут по дороге. Они видны с начала уровня — это и есть цели
      // первого акта, а не невидимки, которые появятся в конце.
      const waiting = WAITING_FRIENDS.find((w) => w.index === i);
      if (waiting) {
        f.position.set(waiting.x, f.position.y, waiting.z);
        // Height above came from groundY(f) at the gathering spot near the
        // chest, which is flat (base 0). The waiting spot is partway up the
        // snow slope — reusing that y buried two of five friends into the
        // mound.
        groundY(f, this.groundHeightAt(waiting.x, waiting.z));
        f.rotation.y = Math.atan2(-waiting.x, 4 - waiting.z);
        f.visible = true;
        f.userData.isWaitingFriend = true;
        f.userData.greeted = false;
        f.userData.walking = false;
        f.userData.greetRu = waiting.ru;
        f.userData.greetKk = waiting.kk;
      }

      this.friends.push(f);
      this.scene.add(f);
    }

    // ── Снежинка-замок ──
    // Три луча над сундуком, каждый гаснет, пока в него не вернут кристалл.
    // Кристаллы уже кольцом стоят вокруг сундука с прошлой итерации и были
    // чистой декорацией.
    for (let i = 0; i < LOCK_RAYS; i++) {
      const a = (i / LOCK_RAYS) * Math.PI * 2;
      const ray = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.12, 1.1),
        new THREE.MeshStandardMaterial({
          color: 0x9fd8ff,
          emissive: 0x2b7fb8,
          emissiveIntensity: 0.15,
          transparent: true,
          opacity: 0.55,
        }),
      );
      ray.position.set(Math.sin(a) * 0.75, 2.35, CHEST_Z + Math.cos(a) * 0.75);
      ray.rotation.y = a;
      this.scene.add(ray);
      this.lockRays.push(ray);
    }
    // Три кристалла из восьми — те, что вернутся в замок.
    for (const i of [0, 3, 6]) {
      const c = this.crystals[i];
      if (!c) continue;
      c.userData.isLockCrystal = true;
      c.userData.set = false;
      this.lockCrystals.push(c);
    }

    for (let z = 0; z > CHEST_Z + 6; z -= 3.5) {
      const arrow = pathArrow(0, z, 0);
      // The climb to the chest is a snow slope, not flat ground — pathArrow's
      // fixed y=0 buried the trail markers up to 1.6 units into the mound.
      this.snapToGround(arrow);
      this.scene.add(arrow);
    }

    this.hero.position.set(0, this.groundHeightAt(0, 4), 4);
    // One room, not one road. A corridor here would put a wall through the
    // middle of the only space the level has.
    // Taken from the movement bounds the level already declares: x ±22, z −45..8 — the chest sits at z −34, so a fourteen-metre arena
    // would have walled the player away from the thing the level is about.
    this.playArena = { x: 0, z: -18.5, r: 35 };
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

  private makeChest(): THREE.Group {
    const g = new THREE.Group();
    const iceMat = new THREE.MeshStandardMaterial({
      color: 0xb3e5fc, roughness: 0.15, metalness: 0.45, transparent: true, opacity: 0.88,
    });
    // No environment map in this game, so a mostly-metal surface has nothing
    // to reflect and reads as flat black instead of gold — same class of bug
    // as the CC0 kit assets. Emissive carries the gold glow instead.
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd700, roughness: 0.25, metalness: 0.12, emissive: 0xffd700, emissiveIntensity: 0.35,
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.85, 1.05), iceMat);
    body.position.y = 0.42; body.castShadow = true;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.32, 1.05), iceMat);
    lid.position.y = 0.98; lid.castShadow = true;

    const lock = new THREE.Mesh(new THREE.OctahedronGeometry(0.18), goldMat);
    lock.position.set(0, 0.82, 0.54);

    const glow = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.6, 28),
      new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.02;

    g.add(body, lid, lock, glow);
    g.userData.lid = lid;
    g.userData.glow = glow;
    g.userData.lock = lock;
    return g;
  }


  private pushHud() {
    const n = this.nick;
    let speaker = 'Барсик';
    let line = '';
    let objective = '';
    const p = this.phase;

    if (p === 'intro') {
      const lines = !this.hasIceKey
        ? [
            this.copy('Зимний сундук! Финал зимы!', 'Қысқы сандық! Қыс финалы!'),
            this.copy(`Нужен ледяной ключ от мастера (уровень 13), ${n}.`, `Мұз шеберінің кілті керек (13-деңгей), ${n}.`),
            this.copy('Сначала собери скульптуру у мастера льда!', 'Алдымен мұз шеберінің мүсінін жина!'),
          ]
        : [
            this.copy('Зимний сундук! Финал зимы!', 'Қысқы сандық! Қыс финалы!'),
            this.copy(`Смотри, ${n} — вдоль подъёма нас ждут друзья!`, `Қара, ${n} — өрлеу бойында бізді достар күтіп тұр!`),
            this.copy('Позови каждого — и все дойдём до пещеры вместе.', 'Әрқайсысын шақыр — сонда бәріміз үңгірге бірге жетеміз.'),
          ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = !this.hasIceKey
        ? this.copy('Нужен ледяной ключ (ур. 13)', 'Мұз кілті керек (13-деңгей)')
        : this.copy('👥 Позови друзей', '👥 Достарды шақыр');
    } else if (p === 'gather') {
      line = this.copy(
        'Друзья ждут вдоль подъёма — позови каждого, и все дойдут до пещеры вместе.',
        'Достар өрлеу бойында күтіп тұр — әрқайсысын шақыр, сонда бәрі үңгірге бірге жетеді.',
      );
      objective = this.copy(
        `👥 Друзья: ${this.prepDone}/${this.prepTotal}`,
        `👥 Достар: ${this.prepDone}/${this.prepTotal}`,
      );
    } else if (p === 'lock') {
      line = this.copy(
        'Снежинка-замок пустая. Верни в неё три кристалла из круга.',
        'Қар құлыбы бос. Шеңберден үш кристалды оған қайтар.',
      );
      objective = this.copy(
        `❄️ Кристаллы в замок: ${this.lockSet}/${LOCK_RAYS}`,
        `❄️ Құлыпқа кристалл: ${this.lockSet}/${LOCK_RAYS}`,
      );
    } else if (p === 'approach') {
      line = this.hasIceKey
        ? this.copy('Поляна готова! Ключ подходит — открой сундук!', 'Алаң дайын! Кілт сәйкес — сандықты аш!')
        : this.copy('Без ледяного ключа сундук не откроется.', 'Мұз кілтсіз сандық ашылмайды.');
      objective = this.hasIceKey
        ? (this.isMobile
          ? this.copy('Нажми кнопку лапки', 'Табан түймесін бас')
          : this.copy('Нажми E', 'E пернесін бас'))
        : this.copy('Найди ключ на уровне 13', 'Кілтті 13-деңгейден тап');
    } else if (p === 'unlock') {
      speaker = this.copy('Мастер льда', 'Мұз шебері');
      line = this.copy('Снежинка-замок крутится... Открывается!', 'Қар құлыбы айналады... Ашылуда!');
      objective = this.copy('🔓 Сундук открывается...', '🔓 Сандық ашылуда...');
    } else if (p === 'open') {
      line = this.copy('Звёзды! Ледяной друг! Карта к Горному озеру!', 'Жұлдыздар! Мұз досы! Тау көліне карта!');
      objective = this.copy('🎉 Сезон 1 завершён!', '🎉 1-маусым аяқталды!');
    } else if (p === 'outro') {
      speaker = this.copy('Барсик', 'Барсик');
      line = this.copy(
        `${n}, мы прошли зиму! Впереди — Горное озеро. Сезон 2 скоро!`,
        `${n}, қысты өттік! Алда — Тау көлі. 2-маусым жақында!`,
      );
      objective = this.copy('🗺️ Глава 3: Горное озеро', '🗺️ 3-тарау: Тау көлі');
    }

    // Реплика последнего события держится, пока её читают: подсказка фазы
    // поверх только что произошедшего спорит с тем, что видно на экране.
    if (performance.now() < this.beatUntil && p !== 'intro' && p !== 'outro') {
      line = this.copy(this.beatRu, this.beatKk);
    }

    this.onHud?.({
      phase: p, speaker, line, objective,
      chestOpen: this.chestOpen,
      prepDone: this.prepDone,
      prepTotal: this.prepTotal,
      stars: this.stars,
      canInteract: Boolean(this.interactTarget),
      showMoveHint: !this.hasTakenFirstStep && (p === 'intro' || p === 'gather'),
      showActionHint: Boolean(this.interactTarget),
      outro: p === 'outro',
    });
  }

  private nearestInteract(): THREE.Object3D | null {
    const hp = this.hero.position;
    if (this.phase === 'gather') {
      let best: THREE.Object3D | null = null;
      let bestD = 2.6;
      for (const f of this.friends) {
        if (!f.userData.isWaitingFriend || f.userData.greeted) continue;
        // По плоскости: друг стоит на своей высоте рельефа, герой на своей.
        const d = Math.hypot(hp.x - f.position.x, hp.z - f.position.z);
        if (d < bestD) { bestD = d; best = f; }
      }
      return best;
    }
    if (this.phase === 'lock') {
      let best: THREE.Object3D | null = null;
      let bestD = 2.4;
      for (const c of this.lockCrystals) {
        if (c.userData.set) continue;
        const d = Math.hypot(hp.x - c.position.x, hp.z - c.position.z);
        if (d < bestD) { bestD = d; best = c; }
      }
      return best;
    }
    if (!this.chest || this.chestOpen) return null;
    if (this.hero.position.distanceTo(this.chest.position) < 2.5 && this.phase === 'approach') return this.chest;
    return null;
  }

  private objectiveWorldPos(): THREE.Vector3 | null {
    if (this.phase === 'gather') {
      const next = this.friends.find((f) => f.userData.isWaitingFriend && !f.userData.greeted);
      return next?.position.clone() ?? null;
    }
    if (this.phase === 'lock') {
      const next = this.lockCrystals.find((c) => !c.userData.set);
      return next?.position.clone() ?? null;
    }
    if (this.chest && (this.phase === 'intro' || this.phase === 'approach')) {
      return this.chest.position.clone();
    }
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
      if (this.introI >= 3) { this.phase = this.hasIceKey ? 'gather' : 'approach'; this.pushHud(); }
      else { this.nextAt = now + 2600; this.pushHud(); }
    }

    if (this.phase === 'unlock' && now > this.nextAt) {
      this.phase = 'open';
      this.chestOpen = true;
      this.lidOpenTime = now;
      this.stars += 20;
      this.confettiBurst = now;
      this.spawnSparks(this.chest!.position, 40, [0x4fc3f7, 0xffd700]);
      AudioManager.sfx('levelComplete');
      for (const f of this.friends) {
        f.visible = true;
        if (!f.userData.unlockedFriend) {
          f.traverse((o) => {
            const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
            if (m && 'opacity' in m) {
              const mat = m.clone();
              mat.transparent = true;
              mat.opacity = 0.45;
              (o as THREE.Mesh).material = mat;
            }
          });
        }
      }
      if (this.chest) {
        const lid = this.chest.userData.lid as THREE.Mesh;
        lid.userData.opening = true;
        (this.chest.userData.lock as THREE.Mesh).visible = false;
      }
      this.nextAt = now + 3500;
      this.pushHud();
    }

    if (this.phase === 'open' && now > this.nextAt) {
      this.phase = 'outro';
      this.spawnSparks(new THREE.Vector3(0, 2, -5), 30, [0xffd700, 0x00cec9]);
      this.pushHud();
    }

    // Periodic confetti during open/outro
    if ((this.phase === 'open' || this.phase === 'outro') && now - this.confettiBurst > 800) {
      this.confettiBurst = now;
      this.spawnSparks(
        new THREE.Vector3((Math.random() - 0.5) * 4, 1.5, -4 + (Math.random() - 0.5) * 3),
        12,
        [0x4fc3f7, 0xffd700],
      );
    }

    const canMove = !['intro', 'outro', 'open'].includes(this.phase);
    this.updateMovement(dt, canMove, this.baseSpeed, -22, 22, CHEST_Z - 11, 8);

    if (this.chest) {
      const glow = this.chest.userData.glow as THREE.Mesh;
      (glow.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(now * 0.004) * 0.2;
      const lock = this.chest.userData.lock as THREE.Mesh;
      if (lock.visible) {
        lock.rotation.y += dt * 2.5;
        lock.rotation.x = Math.sin(now * 0.003) * 0.2;
      }
      const lid = this.chest.userData.lid as THREE.Mesh;
      if (lid.userData.opening) {
        const elapsed = now - this.lidOpenTime;
        if (elapsed < 900) {
          lid.rotation.x = -Math.PI * 0.65 * (elapsed / 900);
          lid.position.y = 0.98 + Math.sin((elapsed / 900) * Math.PI) * 0.35;
        } else {
          lid.rotation.x = -Math.PI * 0.65;
          lid.position.y = 1.15;
        }
      }
    }

    if (this.iceKey?.visible) {
      this.iceKey.position.y = 2.2 + Math.sin(now * 0.003) * 0.12;
      this.iceKey.rotation.y += dt * 1.8;
    }

    // Позванный друг идёт к своему месту на общем снимке. К последнему кадру
    // все девять уже стоят — потому что пятерых привёл игрок.
    for (const f of this.friends) {
      if (f.userData.walking) {
        const tx = f.userData.photoX as number;
        const tz = f.userData.photoZ as number;
        const dx = tx - f.position.x;
        const dz = tz - f.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.25) {
          f.userData.walking = false;
          f.position.x = tx;
          f.position.z = tz;
          f.rotation.y = Math.atan2(-tx, CHEST_Z - tz);
        } else {
          const step = Math.min(d, 2.6 * dt);
          f.position.x += (dx / d) * step;
          f.position.z += (dz / d) * step;
          f.rotation.y = Math.atan2(dx, dz);
        }
      }
      if (f.visible) f.position.y = Math.sin(now * 0.003 + f.position.x) * 0.05;
    }

    // Кристалл летит в свой луч снежинки-замка.
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const fl = this.flying[i];
      const t = Math.min(1, (now - fl.start) / 900);
      fl.obj.position.lerpVectors(fl.from, fl.to, t);
      fl.obj.position.y += Math.sin(t * Math.PI) * 1.6;
      fl.obj.rotation.y += dt * 6;
      if (t >= 1) {
        fl.obj.visible = false;
        const ray = this.lockRays[fl.ray];
        if (ray) {
          const mat = ray.material as THREE.MeshStandardMaterial;
          mat.emissiveIntensity = 1.1;
          mat.opacity = 1;
        }
        this.spawnSparks(fl.to, 14, [0x9fd8ff, 0xffffff]);
        this.flying.splice(i, 1);
      }
    }

    for (const ray of this.lockRays) {
      const mat = ray.material as THREE.MeshStandardMaterial;
      if (mat.emissiveIntensity > 0.9) {
        ray.rotation.z = Math.sin(now * 0.004 + ray.position.x) * 0.08;
      }
    }

    if (this.beatUntil && now > this.beatUntil) {
      this.beatUntil = 0;
      this.pushHud();
    }

    // Ring of crystals around the chest — `userData.spin` was set at build
    // time and never read, so all eight sat dead still.
    for (const c of this.crystals) {
      c.rotation.y += dt * (0.6 + (c.userData.spin as number) * 0.05);
      c.position.y = 0.5 + Math.sin(now * 0.0025 + (c.userData.spin as number)) * 0.12;
    }

    this.updateGuideArrow(now, this.objectiveWorldPos(), ['intro', 'outro', 'unlock', 'open']);

    const prev = this.interactTarget;
    this.interactTarget = this.nearestInteract();
    if (prev !== this.interactTarget) this.pushHud();

    this.updateAmbient(dt, now);

    if (this.phase === 'intro' && !this.hasTakenFirstStep) {
      const idx = Math.min(this.introI, 2);
      // The last intro shot looks all the way down the valley to the cave, so
      // the goal of the season's final level is visible before the first step.
      // Locked to the cinematic path until then — same fix as L2/L8: without
      // the guard, a child who moves immediately walks off-frame for the
      // rest of intro's fixed multi-second timer, not just one bad frame.
      const introPos = [new THREE.Vector3(0, 6, 14), new THREE.Vector3(0, 6.5, 13), new THREE.Vector3(0, 8, 12)];
      const introLook = [
        new THREE.Vector3(0, 1, 2),
        new THREE.Vector3(0, 1.4, -6),
        new THREE.Vector3(0, 2.2, -18),
      ];
      this.camera.position.lerp(introPos[idx], 1 - Math.pow(0.02, dt));
      this.camera.lookAt(introLook[idx]);
    } else if (this.phase === 'open' || this.phase === 'outro') {
      // Framed on the chest and the arc of friends behind it. This was pinned
      // to z = 2 looking at z = -5, which is where the chest used to be — with
      // the finale moved to the end of the climb it would have shot thirty
      // metres of empty snow for the most important frame of the season.
      const target = new THREE.Vector3(0, 5.8, CHEST_Z + 11);
      this.camera.position.lerp(target, 1 - Math.pow(0.002, dt));
      this.camera.lookAt(0, 1.3, CHEST_Z - 2.5);
    } else {
      // Same framing as the rest of the season: a tall or short frame needs a
      // flatter, further-back camera, or the desktop pitch spends the lower
      // third of the screen on ground directly in front of the hero.
      const f = this.cameraFraming();
      const target = new THREE.Vector3(
        this.cameraLateral(this.hero.position.x) + f.lateral,
        5.5 * f.heightMul,
        this.hero.position.z + 9 + f.backAdd,
      );
      this.camera.position.lerp(target, 1 - Math.pow(0.0015, dt));
      this.camera.lookAt(
        this.cameraLateral(this.hero.position.x),
        1.15 + f.lookUp,
        this.hero.position.z - 0.5 - f.lookAhead,
      );
    }

    this.renderFrame();
  };
}

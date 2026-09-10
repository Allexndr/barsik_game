import * as THREE from 'three';
import {
  BaseLevelScene,
  type BaseHud,
  spawnPad,
  questMarker,
  butterfly,
  bush,
  tulip,
  pathArrow,
  placeWoodSign,
  loadCharModel,
  loadPropModel,
} from './BaseLevelScene';
import { AudioManager } from '@/audio/AudioManager';
import { groundY } from '../modelUtils';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { placeAmbientCritters, placeS1Char } from '../s1Place';
import { CAST_PROP_GLB, KEY_ACORN } from '../castModels';
import { resolveKey } from '../inventory';

/**
 * Уровень 10 «QR-сундук» — уровень 9 главы 1 по GDD:
 * механика загадки и награды. Жёлудь-ключ (с уровня 5) открывает сундук.
 * Внутри: звёзды, редкая подруга «Ягодка» и карта главы 2.
 */

// ── Планировка ──────────────────────────────────────────────────
// Сундук — награда за весь Фруктовый лес, а стоял он в восьми метрах от точки
// появления, и все три печати помещались в коробку 24×20 — 480 м², самый
// маленький уровень сезона при медиане около 2500. Всё было видно с самого
// начала, поэтому кульминация первого мира заканчивалась меньше чем за минуту.
const SPAWN_Z = 8;
/** Поляна с сундуком — в дальнем конце сорокаметрового пути. */
const CHEST_Z = -34;

/** Знак на печати, на святилище её стража и на замке сундука. */
type Sigil = 'sun' | 'leaf' | 'drop';

/**
 * У каждой печати свой страж, и каждый страж живёт в своём месте.
 *
 * Стражи и раньше были смоделированы и стояли у святилищ, ничего не делая, пока
 * игрок снимал печать с постамента прямо перед ними. Теперь они что-то просят
 * взамен — отсюда и берётся большая часть длительности уровня, и это не стоило
 * ни одной новой модели.
 */
const SHRINES: Array<{
  x: number;
  z: number;
  guard: 'owl' | 'fox' | 'deer';
  rotY: number;
  sigil: Sigil;
  name: { ru: string; kk: string };
}> = [
  { x: -17, z: -6, guard: 'fox', rotY: 1.1, sigil: 'sun', name: { ru: 'Лиса', kk: 'Түлкі' } },
  { x: 18, z: -19, guard: 'owl', rotY: -0.9, sigil: 'leaf', name: { ru: 'Сова', kk: 'Үкі' } },
  { x: -9, z: -45, guard: 'deer', rotY: 0.3, sigil: 'drop', name: { ru: 'Оленёнок', kk: 'Бұғы' } },
];

/** Что страж просит, прежде чем расстаться со своей печатью. */
const BERRIES_PER_GUARD = 3;

/**
 * Двенадцать ягод при нужных девяти.
 *
 * Запас намеренный. Ровно с девятью одна ягода, оказавшаяся внутри камня или за
 * границей проходимой зоны, делает уровень непроходимым — тот же тупик, что
 * только что был с жёлудем-ключом. Три лишние ещё и означают, что ребёнок,
 * прошедший мимо куста, за это не наказан.
 */
const BERRY_SPOTS: Array<{ x: number; z: number }> = [
  { x: 7, z: -2 }, { x: -21, z: -3 }, { x: -12, z: -13 },
  { x: 21, z: -8 }, { x: -22, z: -18 }, { x: 13, z: -27 },
  { x: 22, z: -29 }, { x: -17, z: -31 }, { x: 5, z: -41 },
  { x: -20, z: -42 }, { x: 16, z: -40 }, { x: -3, z: -22 },
];

/**
 * Замок: три столба перед сундуком, нажимать в том порядке, который показан на
 * его лицевой панели, а не слева направо.
 *
 * Это задача на сопоставление, а не на память: нужный порядок всё время горит на
 * сундуке. Пятилетние входят в аудиторию игры, и просить их удержать
 * последовательность в голове значит закрыть им уровень; просить повторить то,
 * что видно, — ровно та задача, которая им по силам.
 */
const PILLARS: Array<{ x: number; z: number; sigil: Sigil }> = [
  { x: -2.6, z: CHEST_Z + 3.4, sigil: 'drop' },
  { x: 0, z: CHEST_Z + 4.0, sigil: 'sun' },
  { x: 2.6, z: CHEST_Z + 3.4, sigil: 'leaf' },
];

/** Порядок, который требует замок, — тот же, в каком святилища встречаются по пути. */
const LOCK_ORDER: Sigil[] = ['sun', 'leaf', 'drop'];

const SIGIL_COLOR: Record<Sigil, number> = { sun: 0xffc93c, leaf: 0x6ab04c, drop: 0x4aa3df };

/**
 * Знак сделан объёмной фигуркой, а не текстурой: три силуэта, которые ребёнок
 * различает с одного взгляда и через всю поляну.
 */
function makeSigil(kind: Sigil, size = 1): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({
    color: SIGIL_COLOR[kind],
    emissive: SIGIL_COLOR[kind],
    emissiveIntensity: 0.45,
    roughness: 0.4,
    metalness: 0.2,
  });
  let geo: THREE.BufferGeometry;
  if (kind === 'sun') geo = new THREE.SphereGeometry(0.22 * size, 14, 10);
  else if (kind === 'drop') geo = new THREE.ConeGeometry(0.2 * size, 0.46 * size, 12);
  else geo = new THREE.TetrahedronGeometry(0.28 * size);
  const mesh = new THREE.Mesh(geo, mat);
  if (kind === 'drop') mesh.rotation.x = Math.PI; // остриём вниз, как капля
  return mesh;
}

/** Осевая линия пути от кромки леса к поляне с сундуком. */
function routeX(z: number) {
  return Math.sin((z - SPAWN_Z) * 0.07) * 3.6;
}

/**
 * В `quest` сбор и обмен идут одновременно, и это намеренно. Разделить их —
 * значит получить «собери девять ягод, потом сделай три круга обратно», то есть
 * дважды пройти ту же землю. Обмен по дороге, когда страж просто оказался рядом,
 * — то же расстояние, но с выбором внутри.
 */
export type L10Phase = 'intro' | 'quest' | 'lock' | 'unlock' | 'open' | 'outro';

export interface L10Hud extends BaseHud {
  hasAcornKey: boolean;
  chestOpen: boolean;
  sealsDone: number;
  sealsTotal: number;
  berries: number;
  lockDone: number;
}

function makeChest(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8, metalness: 0.1 });
  // Карты окружения в игре нет, поэтому почти металлической поверхности нечего
  // отражать и она читается плоско-чёрной вместо золота. Золото даёт свечение
  // emissive — та же правка, что у замка сундука на L16.
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.3, metalness: 0.12, emissive: 0xffd700, emissiveIntensity: 0.3 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 1.0), woodMat);
  body.position.y = 0.4;
  body.castShadow = true;

  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 1.0), woodMat);
  lid.position.y = 0.95;
  lid.castShadow = true;
  lid.userData.isLid = true;

  // Золотая окантовка.
  const trim1 = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.05, 1.02), goldMat);
  trim1.position.y = 0.2;
  const trim2 = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.05, 1.02), goldMat);
  trim2.position.y = 0.7;

  // Замок в форме жёлудя.
  const lockCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    goldMat,
  );
  lockCap.position.set(0, 0.85, 0.52);
  const lockBody = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.6, emissive: 0xf39c12, emissiveIntensity: 0.3 }));
  lockBody.position.set(0, 0.75, 0.52);

  // Светящееся кольцо.
  const glow = new THREE.Mesh(
    new THREE.RingGeometry(1.0, 1.5, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.02;

  g.add(body, lid, trim1, trim2, lockCap, lockBody, glow);
  g.position.set(x, 0, z);
  g.userData.lid = lid;
  g.userData.glow = glow;
  g.userData.lockCap = lockCap;
  g.userData.lockBody = lockBody;
  return g;
}

function makeAcornKeyFloat(x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const capMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 1 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.8, emissive: 0xf39c12, emissiveIntensity: 0.4 });

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
  cap.position.y = 0.1;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), bodyMat);
  body.position.y = -0.02;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 4), capMat);
  stem.position.y = 0.2;

  g.add(cap, body, stem);
  g.position.set(x, y, z);
  return g;
}

export class Level9Scene extends BaseLevelScene {
  private phase: L10Phase = 'intro';
  private onHud: ((h: L10Hud) => void) | null = null;
  private introI = 0;
  private nextAt = 0;
  private chest: THREE.Group | null = null;
  private acornKey: THREE.Object3D | null = null;
  private chestOpen = false;
  private lidOpenTime = 0;
  private hasAcornKey = false;
  private butterflies: THREE.Group[] = [];
  private yagodka: THREE.Object3D | null = null;
  private seals: THREE.Object3D[] = [];
  private sealsDone = 0;
  private readonly sealsTotal = 3;
  /** Высота покоя парящего ключа, чтобы покачивание шло по рельефу. */
  private keyBaseY = 2.5;
  private berries: THREE.Object3D[] = [];
  /** Собрано и ещё не обменяно. Стражи берут только полными тройками. */
  private berryCount = 0;
  private guardians: THREE.Object3D[] = [];
  private pillars: THREE.Group[] = [];
  /** Сколько из LOCK_ORDER уже нажато. Неверный столб сбрасывает счёт. */
  private lockDone = 0;
  private lockWrongAt = 0;
  /** После первой ошибки стрелка начинает показывать ответ. */
  private lockFailures = 0;
  private lockFace: THREE.Group | null = null;
  private chestMarker: THREE.Object3D | null = null;

  protected currentPhase() { return this.phase; }

  protected onMovementHintDismiss() {
    this.pushHud();
  }

  tryInteract() {
    const now = performance.now();
    const t = this.interactTarget;

    if (this.phase === 'quest') {
      if (!t || t.userData.done) return;

      if (t.userData.isBerry) {
        t.userData.done = true;
        t.visible = false;
        this.berryCount += 1;
        this.stars += 1;
        this.spawnSparks(t.position, 8, [0xe84393, 0xff7675]);
        AudioManager.sfx('interact');
        this.praiseUntil = now + 500;
        this.pushHud();
        return;
      }

      if (t.userData.isSeal) {
        // Страж меняет только полную горсть. Сказать это и ничего не взять —
        // правильный ответ на две ягоды; иначе он их заберёт и оставит ребёнка
        // с долгом, которого тот не видит.
        if (this.berryCount < BERRIES_PER_GUARD) {
          AudioManager.sfx('click');
          this.pushHud();
          return;
        }
        this.berryCount -= BERRIES_PER_GUARD;
        t.userData.done = true;
        t.visible = false;
        const beacon = t.userData.beacon as THREE.Object3D | undefined;
        if (beacon) beacon.visible = false;
        this.sealsDone += 1;
        this.stars += 3;
        // Отданная печать теперь ждёт на своём столбе у сундука.
        const sigil = t.userData.sigil as Sigil;
        const pillar = this.pillars.find((p) => p.userData.sigil === sigil);
        if (pillar) pillar.userData.armed = true;
        this.spawnSparks(t.position, 14, [0xffd700, 0x00cec9]);
        AudioManager.sfx('found');
        this.praiseUntil = now + 900;
        if (this.sealsDone >= this.sealsTotal) {
          this.phase = 'lock';
          this.spawnSparks(this.chest?.position ?? this.hero.position, 18, [0xffd700, 0xff9f43]);
        }
        this.pushHud();
      }
      return;
    }

    if (this.phase === 'lock') {
      if (!t?.userData.isPillar || t.userData.set) return;
      const sigil = t.userData.sigil as Sigil;
      if (sigil === LOCK_ORDER[this.lockDone]) {
        t.userData.set = true;
        this.lockDone += 1;
        this.stars += 2;
        this.spawnSparks(t.position, 12, [SIGIL_COLOR[sigil], 0xffffff]);
        AudioManager.sfx('success');
        if (this.lockDone >= LOCK_ORDER.length) {
          if (!this.hasAcornKey) {
            // Всё, что уровень просил, сделано, а сундук всё равно не
            // открывается. С нормальным сейвом сюда не попасть — L9 идёт после
            // L5, — но если это всё же случится, игрок должен стоять перед
            // видимо собранным замком, а не застревать раньше.
            this.pushHud();
            return;
          }
          this.phase = 'unlock';
          this.stars += 10;
          this.spawnSparks(this.chest?.position ?? this.hero.position, 16, [0xffd700, 0x00cec9]);
          this.nextAt = now + 1500;
        }
      } else {
        // Не тот столб: всё выходит обратно, ничего не отнимается. Отнимать
        // звёзды здесь значило бы наказывать пятилетних, под которых задача и
        // сделана, и отучать восьмилетних пробовать.
        this.lockDone = 0;
        this.lockFailures += 1;
        this.lockWrongAt = now;
        for (const p of this.pillars) p.userData.set = false;
        AudioManager.sfx('click');
      }
      this.pushHud();
    }
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L10Hud) => void) {
    this.nick = nick || this.defaultNick(lang);
    this.lang = lang;
    this.onHud = onHud;

    // Берётся из сейва, а не из отдельного флага. См. src/three/inventory.ts:
    // флаг лежит вне `barsik_progress`, поэтому его не переносят и не
    // восстанавливают, и сейв, потерявший его, превращал сундук в тупик.
    this.hasAcornKey = resolveKey(KEY_ACORN).has;
    if (!this.hasAcornKey && import.meta.env.DEV) {
      // QA заходит через `?mission=9` вообще без прогресса, и без этого
      // сундука локально не достать. Условие намеренно узкое: при настоящем
      // сейве решает строка выше, значит, играется та ветка, которая уйдёт в
      // сборку.
      console.warn('[L9] no acorn key and level 5 is not complete — granting for QA only');
      this.hasAcornKey = true;
    }

    const loader = createGameGltfLoader();

    this.camera.position.set(9, 8, 17);
    // Арена, а не коридор.
    //
    // Уровень разбрасывает двенадцать ягодных кустов от x −22 до +22 и просит
    // найти девять: собственный комментарий называет это «источником ходьбы на
    // уровне». Коридор шириной 4.4 м посередине такого не вмещает, а
    // `clampToPlayArea` пропускает коридор плюс зарезервированные комнаты и
    // больше ничего — кусты ставили там, где хотел дизайн, и тут же отгораживали.
    // Резервировать их поодиночке тоже мало: комнаты без маршрута между ними —
    // острова, до которых не дойти.
    //
    // Честная форма уровня про поиск в лесу — открытое пространство.
    this.playArena = { x: 0, z: -18, r: 33 };
    await this.setupForestEnvironment(loader, {
      flatRadius: 11,
      flatCenterZ: CHEST_Z,
      terrain: {
        playHalfExtent: 58,
        rimFalloff: 16,
        rimHeight: 3.4,
        seed: 9,
        features: [
          { kind: 'flat', x: 0, z: CHEST_Z, r: 11 },
          { kind: 'flat', x: 0, z: SPAWN_Z - 3, r: 8 },
        ],
      },
    });

    // Резервируем геймплей до того, как поверх него что-то разбросано.
    this.reserve(0, CHEST_Z, 9);
    this.reserve(0, SPAWN_Z, 5);
    for (const sh of SHRINES) this.reserve(sh.x, sh.z, 4);
    // Ягоды тоже: это геймплей, а не декор.
    //
    // Резерв и делает точку проходимой: `clampToPlayArea` пропускает коридор
    // плюс зарезервированные комнаты и больше ничего. Без него кусты стояли там,
    // где их хотел уровень, и были отгорожены от игрока: полный перебор всех
    // точек, где можно стоять, нашёл в пределах радиуса подбора 1.9 м только три
    // куста из двенадцати — при девяти, которые в сумме просят три стража.
    // Запасные ягоды, ради которых список и делали («двенадцать при нужных
    // девяти»), такую нехватку не покрывали: уровень нельзя было пройти вообще,
    // а стрелка указывала на (7, −2) — один из тех, до которых никто не мог дойти.
    for (const spot of BERRY_SPOTS) this.reserve(spot.x, spot.z, 3);

    const pad = spawnPad(0, SPAWN_Z);
    pad.position.y = this.groundHeightAt(0, SPAWN_Z) + 0.01;
    this.scene.add(pad);
    this.scene.add(await placeWoodSign(loader, -2.8, SPAWN_Z - 1.6, 0.3, 0xffd700));
    await this.layTrail(
      loader,
      Array.from({ length: 24 }, (_, i) => {
        const z = SPAWN_Z - (i / 23) * (SPAWN_Z - CHEST_Z + 2);
        return { x: routeX(z), z };
      }),
      { size: 1.3 },
    );

    // Сундук: treasure_chest из Meshy Discover → набор Kenney → процедурный.
    // Анимация крышки остаётся процедурной: сундуки в GLB — единый меш, поэтому
    // для открытия держим отдельную тонкую золотую крышку поверх.
    this.chest = makeChest(0, CHEST_Z);
    const kit = this.assetKit(loader);
    const meshyChest = await loadPropModel(loader, 'treasure_chest.glb', { maxSize: 1.6 });
    const kitChest = meshyChest
      ? null
      : await kit.spawn('platformer', 'chest', {
          maxSize: 1.6,
          position: [0, 0, CHEST_Z],
          rotationY: Math.PI,
        });
    const chestVisual = meshyChest ?? kitChest;
    if (chestVisual) {
      for (const child of [...this.chest.children]) {
        if (child === this.chest.userData.glow) continue;
        if (child === this.chest.userData.lid) continue;
        if (child === this.chest.userData.lockCap) continue;
        if (child === this.chest.userData.lockBody) continue;
        this.chest.remove(child);
      }
      if (meshyChest) {
        meshyChest.rotation.y = Math.PI;
        groundY(meshyChest);
      }
      this.chest.add(chestVisual);
    }
    this.scene.add(this.chest);
    this.snapToGround(this.chest);
    this.colliders.push({ kind: 'circle', x: 0, z: CHEST_Z, r: 1.2 });

    // Три золотые печати, каждая в своём святилище со своим стражем, разнесены
    // по карте: их поиск и есть уровень, а не круг вокруг точки появления.
    for (const shrine of SHRINES) {
      const { x, z } = shrine;
      const seal = new THREE.Group();
      const disk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.28, 0.08, 16),
        // Та же правка из-за отсутствия карты окружения, что и у замка выше:
        // металлу нечего отражать, и он рендерится чёрным, поэтому золото здесь
        // держится на emissive.
        new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.12, roughness: 0.3, emissive: 0xffb300, emissiveIntensity: 0.45 }),
      );
      disk.position.y = 0.4;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.4, 0.65, 20),
        new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      // Постамент: печать читается как святыня, а не как монета, обронённая в
      // траву, и видна поверх подлеска с такого расстояния, чтобы к ней можно
      // было пойти.
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.58, 0.34, 12),
        new THREE.MeshStandardMaterial({ color: 0x9e9384, roughness: 0.95 }),
      );
      base.position.y = 0.17;
      base.castShadow = true;
      // На печати стоит знак её стража, поэтому столб, на который она потом
      // встанет, игрок уже видел, — это не новое правило.
      const mark = makeSigil(shrine.sigil, 0.8);
      mark.position.y = 0.62;
      seal.add(base, disk, ring, mark);
      seal.position.set(x, this.groundHeightAt(x, z), z);
      seal.userData.isSeal = true;
      seal.userData.done = false;
      seal.userData.sigil = shrine.sigil;
      seal.userData.name = shrine.name;
      seal.userData.mark = mark;
      this.seals.push(seal);
      this.scene.add(seal);
      this.colliders.push({ kind: 'circle', x, z, r: 0.6 });
      // Луч над каждым святилищем. Три таких столба света над кронами
      // превращают «броди, пока не найдёшь» в «иди вон туда».
      const beacon = questMarker(0xffd700, 0xff9f43);
      beacon.position.set(x, this.groundHeightAt(x, z), z);
      seal.userData.beacon = beacon;
      this.scene.add(beacon);
    }
    for (const sh of SHRINES) {
      // Ставятся по одному, а не через `placeAmbientCritters`, который ничего не
      // возвращает: стражи больше не декор, и уровню нужно уметь разворачивать
      // их к тому, с кем они говорят.
      const guard = await placeS1Char(loader, sh.guard, {
        x: sh.x + 1.6, z: sh.z + 1.1, rotY: sh.rotY, height: 0.95,
      });
      if (guard) {
        this.guardians.push(guard);
        this.scene.add(guard);
        // Коллайдеры получили и сундук, и печати, и столбы, а три стража, к
        // которым игрок реально подходит меняться, — нет.
        this.colliders.push({ kind: 'circle', x: sh.x + 1.6, z: sh.z + 1.1, r: 0.45 });
      }
    }

    // Двенадцать ягод в кустах по всей игровой зоне — отсюда и берётся ходьба
    // на этом уровне.
    for (const spot of BERRY_SPOTS) {
      const g = new THREE.Group();
      // bush(x, z, scale) — третий аргумент масштаб, а не y. Ноль давал
      // двенадцать кустов нулевого размера, поэтому в первом варианте ягода
      // висела над голой травой.
      const shrub = bush(0, 0, 1.1);
      // bush() теперь сажает себя на землю сам, но этот куст — потомок группы,
      // уже поднятой на высоту земли под ягодой: если оставить, сверху
      // прибавится ещё высота рельефа в мировой точке (0, 0).
      shrub.position.set(0, 0, 0);
      g.add(shrub);
      // Кольцо на земле под кустом. `bush()` — тот же помощник, которым
      // окружение раскидывает кусты сотнями, поэтому без кольца куст с ягодой
      // выглядит ровно как девяносто кустов без неё, и единственным способом
      // найти ягоду становится стрелка — а это уже не поиск.
      // Кольцо шире листвы: при 0.5–0.78 оно рисовалось под кустом и не было
      // видно ни с одного угла, откуда игрок может смотреть.
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.02, 1.34, 22),
        new THREE.MeshBasicMaterial({ color: 0xe84393, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      g.add(ring);
      const fruit =
        (await loadPropModel(loader, CAST_PROP_GLB.berry, { maxSize: 0.46 })) ??
        new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 12, 10),
          new THREE.MeshStandardMaterial({ color: 0xe84393, roughness: 0.45, emissive: 0x8e2f5f, emissiveIntensity: 0.3 }),
        );
      // `loadPropModel` записывает собственное смещение посадки в position.y,
      // поэтому здесь можно задавать только x и z: прямая запись в y как раз и
      // закопала яблоки на L2.
      fruit.position.x = 0;
      fruit.position.z = 0;
      // Выше листвы. `bush()` строит сферы радиусом до 0.7 с центром на 0.385,
      // поэтому всё, что ниже примерно 1.1, оказывается внутри куста.
      fruit.position.y += 1.25;
      g.add(fruit);
      g.position.set(spot.x, this.groundHeightAt(spot.x, spot.z), spot.z);
      g.userData.isBerry = true;
      g.userData.done = false;
      g.userData.fruit = fruit;
      g.userData.ring = ring;
      this.berries.push(g);
      this.scene.add(g);
    }

    // Замок: три столба перед сундуком.
    for (const p of PILLARS) {
      const g = new THREE.Group();
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.26, 0.34, 1.15, 10),
        new THREE.MeshStandardMaterial({ color: 0x8d8378, roughness: 0.95 }),
      );
      shaft.position.y = 0.57;
      shaft.castShadow = true;
      const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.26, 0.12, 12),
        new THREE.MeshStandardMaterial({ color: 0x6d6459, roughness: 0.9 }),
      );
      cup.position.y = 1.2;
      const mark = makeSigil(p.sigil);
      // Чуть выше кромки чаши. На 1.52 под знаком был заметный зазор, и он
      // читался как отвалившийся меш, а не как знак, лежащий на постаменте.
      mark.position.y = 1.38;
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.36, 0.52, 20),
        new THREE.MeshBasicMaterial({ color: SIGIL_COLOR[p.sigil], transparent: true, opacity: 0.0, side: THREE.DoubleSide }),
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.04;
      g.add(shaft, cup, mark, halo);
      g.position.set(p.x, this.groundHeightAt(p.x, p.z), p.z);
      g.userData.isPillar = true;
      g.userData.sigil = p.sigil;
      /** Столб активен, когда его печать выменяна: только тогда его можно нажать. */
      g.userData.armed = false;
      g.userData.set = false;
      g.userData.mark = mark;
      g.userData.halo = halo;
      this.pillars.push(g);
      this.scene.add(g);
      this.colliders.push({ kind: 'circle', x: p.x, z: p.z, r: 0.45 });
    }

    // Лицевая панель замка: порядок нажатий горит на сундуке всю задачу.
    // Задача — считать его с сундука, а не запомнить.
    const lockFace = new THREE.Group();
    // Сначала подложка, чтобы ряд читался одним знаком, а не тремя украшениями,
    // случайно висящими рядом с сундуком.
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.72, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x4a3b2a, roughness: 0.9 }),
    );
    board.position.z = -0.2;
    lockFace.add(board);
    LOCK_ORDER.forEach((sigil, i) => {
      // Знаки — потомки 1, 3, 5: цикл по LOCK_ORDER в `loop()` адресует их как
      // `1 + i * 2`, поэтому между ними ничего вставлять нельзя.
      const s = makeSigil(sigil, 0.9);
      s.position.set((i - 1) * 0.56, 0, 0.08);
      lockFace.add(s);
      const plate = new THREE.Mesh(
        new THREE.CircleGeometry(0.26, 16),
        new THREE.MeshBasicMaterial({ color: 0x1d1710, transparent: true, opacity: 0.7 }),
      );
      plate.position.set((i - 1) * 0.56, 0, -0.1);
      lockFace.add(plate);
    });
    // Над сундуком, а не поперёк него: на 1.6 ряд лежал на крышке, и на подходе
    // они читались одним захламлённым предметом.
    lockFace.position.set(0, this.groundHeightAt(0, CHEST_Z) + 2.15, CHEST_Z + 0.55);
    this.scene.add(lockFace);
    this.lockFace = lockFace;

    // Маркер квеста над сундуком. Прячется, как только читать надо замок: луч
    // вертикален на x = 0 и проходит ровно через середину подложки, превращая
    // единственный знак, на котором держится задача, в мусор именно тогда, когда
    // он становится важен.
    const marker = questMarker(0xffd700, 0xff9f43);
    marker.position.set(0, this.groundHeightAt(0, CHEST_Z), CHEST_Z);
    this.scene.add(marker);
    this.chestMarker = marker;

    // Жёлудь-ключ: сгенерированный жёлудь → golden_key → Kenney → процедурный.
    const meshyKey =
      (await loadPropModel(loader, CAST_PROP_GLB.acorn_key, { maxSize: 0.55 })) ??
      (await loadPropModel(loader, 'golden_key.glb', { maxSize: 0.55 }));
    if (meshyKey) {
      meshyKey.position.set(0, this.groundHeightAt(0, CHEST_Z) + 2.5, CHEST_Z);
      this.acornKey = meshyKey;
    } else {
      const kitKey = await kit.spawn('platformer', 'key', {
        maxSize: 0.55,
        position: [0, this.groundHeightAt(0, CHEST_Z) + 2.5, CHEST_Z],
        ground: false,
      });
      this.acornKey = kitKey ?? makeAcornKeyFloat(0, this.groundHeightAt(0, CHEST_Z) + 2.5, CHEST_Z);
    }
    this.keyBaseY = this.groundHeightAt(0, CHEST_Z) + 2.5;
    this.scene.add(this.acornKey);

    // Стрелки вдоль тропы.
    for (let i = 0; i < 4; i++) {
      const a = pathArrow(0, 3 - i * 1.5, 0);
      this.pathArrows.push(a);
      this.scene.add(a);
    }

    // Декор.
    for (let i = 0; i < 10; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = 2 - (i / 10) * 10;
      this.scene.add(bush(side * (5 + Math.random() * 3), z));
    }
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = 2 - (i / 8) * 10;
      this.scene.add(tulip(side * 4, z, [0xe74c3c, 0xf1c40f, 0xfd79a8, 0xa29bfe][i % 4]));
    }

    // Бабочки.
    for (let i = 0; i < 4; i++) {
      const bf = butterfly((Math.random() - 0.5) * 12, -3 - Math.random() * 6, [0xff7675, 0x74b9ff, 0xfdcb6e][i % 3]);
      this.butterflies.push(bf);
      this.scene.add(bf);
    }

    await this.loadTrees(loader, 28, 20, -18, 4.6);
    await this.loadProps(loader, 12, 6, 34, -18);

    await this.placeProps(loader, [
      { key: 'map_scroll', opts: { x: -3.2, z: SPAWN_Z - 4, maxSize: 0.6, y: 0.15 } },
      { key: 'lantern', opts: { x: 3.5, z: SPAWN_Z - 3.5, height: 1.4 } },
      { key: 'pinecone', opts: { x: 2.2, z: SPAWN_Z - 2, maxSize: 0.3 } },
      { key: 'stump', opts: { x: -5.5, z: -14, maxSize: 1.1 } },
      { key: 'mushroom', opts: { x: 6.2, z: -9, maxSize: 0.5 } },
      // На (-7.5, -26) стояла декоративная ягода. Раз ягоды — это то, что просит
      // уровень, ягода, которую нельзя подобрать, становится ловушкой: тот же
      // дефект, что и двенадцать декоративных снимков на L7.
      { key: 'flowers', opts: { x: 5.5, z: -30, maxSize: 0.7 } },
      { key: 'lantern_wood', opts: { x: -4.6, z: CHEST_Z + 5, height: 1.4 } },
      { key: 'lantern_wood', opts: { x: 4.6, z: CHEST_Z + 5, height: 1.4 } },
    ]);
    await placeAmbientCritters(this.scene, loader, [
      { key: 'squirrel', x: 5, z: -6, rotY: -1.0, h: 0.9 },
      { key: 'rabbit', x: -6, z: -20, rotY: 0.7, h: 0.5 },
      { key: 'bird', x: 7, z: -28, rotY: -0.4, h: 0.55 },
    ]);

    const start = this.devStart() ?? { x: 0, z: SPAWN_Z };
    this.hero.position.set(start.x, this.groundHeightAt(start.x, start.z), start.z);
    // Стена. Ставится последней, чтобы прочитать и коридор, и все комнаты,
    // которые зарезервировал уровень, и обойти их снаружи.
    // Здесь арена, а не тропа: `encloseLevel` выводит стену из коридора, а его у
    // этого уровня больше нет.
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

  private pushHud() {
    const n = this.nick;
    let speaker = 'Барсик';
    let line = '';
    let objective = '';
    const p = this.phase;

    if (p === 'intro') {
      const lines = !this.hasAcornKey
        ? [
            this.copy('Сундук в конце леса!', 'Орман соңындағы сандық!'),
            this.copy(`Нужен жёлудь-ключ от белочки (уровень 5), ${n}.`, `Тиіннің жаңғақ-кілті керек (5-деңгей), ${n}.`),
            this.copy('Вернись к белочке или открой уровень 5!', 'Тиінге орал немесе 5-деңгейді аш!'),
          ]
        : [
            this.copy('Сундук охраняют три лесных стража!', 'Сандықты үш орман күзетшісі қорғайды!'),
            this.copy(`Они отдадут печати за ягоды, ${n}. Три ягоды за печать.`, `Олар мөрді жидекке айырбастайды, ${n}. Мөрге үш жидек.`),
            this.copy('Ягоды растут в кустах по всему лесу — ищи!', 'Жидек орман бұталарында өседі — ізде!'),
          ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = !this.hasAcornKey
        ? this.copy('Нужен жёлудь-ключ (ур. 5)', 'Жаңғақ-кілт керек (5-деңгей)')
        : this.copy('🫐 Собери ягоды для стражей', '🫐 Күзетшілерге жидек жина');
    } else if (p === 'quest') {
      const target = this.interactTarget;
      if (target?.userData.isSeal) {
        const guard = target.userData.name as { ru: string; kk: string };
        speaker = this.copy(guard.ru, guard.kk);
        line = this.berryCount >= BERRIES_PER_GUARD
          ? this.copy('Три ягоды — и печать твоя!', 'Үш жидек — мөр сенікі!')
          : this.copy(
              `Принеси три ягоды. У тебя ${this.berryCount}.`,
              `Үш жидек әкел. Сенде ${this.berryCount}.`,
            );
      } else if (this.berryCount >= BERRIES_PER_GUARD) {
        line = this.copy('Ягод хватает! Иди к стражу за печатью.', 'Жидек жетеді! Мөр үшін күзетшіге бар.');
      } else {
        line = this.copy('Ягоды прячутся в кустах по всему лесу.', 'Жидектер орман бұталарында тығылған.');
      }
      objective = this.copy(
        `🫐 ${this.berryCount}/${BERRIES_PER_GUARD}   🥇 ${this.sealsDone}/${this.sealsTotal}`,
        `🫐 ${this.berryCount}/${BERRIES_PER_GUARD}   🥇 ${this.sealsDone}/${this.sealsTotal}`,
      );
    } else if (p === 'lock') {
      const want = LOCK_ORDER[this.lockDone];
      const shrine = SHRINES.find((s) => s.sigil === want);
      const wrongRecently = performance.now() - this.lockWrongAt < 2200;
      line = wrongRecently
        ? this.copy('Не тот столб! Смотри на замок и начни сначала.', 'Бағана дұрыс емес! Құлыпқа қара да қайта баста.')
        : this.copy(
            'Замок показывает порядок. Нажимай столбы так же!',
            'Құлып кезекті көрсетеді. Бағаналарды солай бас!',
          );
      objective =
        this.lockFailures > 0 && shrine
          ? this.copy(
              `🔒 ${this.lockDone}/3 — сейчас знак ${this.copy(shrine.name.ru, shrine.name.kk)}`,
              `🔒 ${this.lockDone}/3 — қазір ${this.copy(shrine.name.ru, shrine.name.kk)} белгісі`,
            )
          : this.copy(`🔒 Печати: ${this.lockDone}/3`, `🔒 Мөрлер: ${this.lockDone}/3`);
    } else if (p === 'unlock') {
      speaker = this.copy('Белочка', 'Тиін');
      line = this.copy('Мой жёлудь открыл сундук! Ура!', 'Менің жаңғағым сандықты ашты! Ура!');
      objective = this.copy('🔓 Сундук открывается...', '🔓 Сандық ашылуда...');
    } else if (p === 'open') {
      line = this.copy('Звёзды! Редкий друг «Ягодка»! И карта к горам!', 'Жұлдыздар! Сирек дос «Жидек»! Тауға карта!');
      objective = this.copy('🎉 Сундук открыт!', '🎉 Сандық ашылды!');
    } else if (p === 'outro') {
      speaker = this.copy('Айя', 'Айя');
      line = this.copy('Снег! Я никогда не видела снег! Пора прощаться с лесом и идти к горам!', 'Қар! Мен қар көрмегем! Орманмен қоштасып, тауға бару уақыты!');
      objective = this.copy('🗺️ Карта к Ледяной долине!', '🗺️ Мұзды аңғарға карта!');
    }

    this.onHud?.({
      phase: p,
      speaker,
      line,
      objective,
      hasAcornKey: this.hasAcornKey,
      chestOpen: this.chestOpen,
      sealsDone: this.sealsDone,
      sealsTotal: this.sealsTotal,
      berries: this.berryCount,
      lockDone: this.lockDone,
      stars: this.stars,
      canInteract: Boolean(this.interactTarget),
      // Не 'intro': canMove исключает эту фазу.
      showMoveHint: !this.hasTakenFirstStep && p === 'quest',
      showActionHint: Boolean(this.interactTarget),
      outro: p === 'outro',
    });
  }

  /**
   * Расстояния здесь меряются по плоскости земли, а не в 3D.
   *
   * Трёхмерный `distanceTo` засчитывает игроку перепад высот между тем, где он
   * стоит, и тем, где стоит цель, а на рельефе это реальная величина: на L3
   * маркер, поднятый на два метра, сделал последнюю остановку недостижимой.
   * Обе здешние цели случайно оказались в пределах 12 см от высоты земли под
   * героем, так что это не починка живого бага — это тот же способ замера, что
   * теперь во всём сезоне, чтобы после переноса реквизита никто не перепроверял
   * заново.
   */
  private nearestInteract(): THREE.Object3D | null {
    const hp = this.hero.position;
    const flat = (o: THREE.Object3D) => Math.hypot(hp.x - o.position.x, hp.z - o.position.z);

    if (this.phase === 'quest') {
      let best: THREE.Object3D | null = null;
      let bestD = 2.4;
      for (const s of this.seals) {
        if (s.userData.done) continue;
        const d = flat(s);
        if (d < bestD) { bestD = d; best = s; }
      }
      // Ягоду подбирают с более близкой дистанции, чем окликают святилище,
      // поэтому стоя между кустом и стражем игрок получает стража.
      for (const b of this.berries) {
        if (b.userData.done) continue;
        const d = flat(b);
        if (d < Math.min(bestD, 1.9)) { bestD = d; best = b; }
      }
      return best;
    }

    if (this.phase === 'lock') {
      let best: THREE.Object3D | null = null;
      let bestD = 2.0;
      for (const p of this.pillars) {
        if (!p.userData.armed || p.userData.set) continue;
        const d = flat(p);
        if (d < bestD) { bestD = d; best = p; }
      }
      return best;
    }

    return null;
  }

  private objectiveWorldPos(): THREE.Vector3 | null {
    if (this.phase === 'quest') {
      // Хватает ягод в лапах — идти надо к стражу. Не хватает — к ближайшему
      // кусту: так стрелка полезна всю фазу, а не указывает на святилище, с
      // которым пока нечего менять.
      if (this.berryCount >= BERRIES_PER_GUARD) {
        const seal = this.nearestOf(this.seals);
        if (seal) return seal.position.clone();
      }
      const berry = this.nearestOf(this.berries);
      if (berry) return berry.position.clone();
      return this.nearestOf(this.seals)?.position.clone() ?? null;
    }
    if (this.phase === 'lock') {
      // Молчит до первой ошибки: получить ответ, не попробовав, — не задача, а
      // не получить его никогда — стена.
      if (this.lockFailures > 0) {
        const want = LOCK_ORDER[this.lockDone];
        const p = this.pillars.find((q) => q.userData.sigil === want && !q.userData.set);
        if (p) return p.position.clone();
      }
      return this.chest?.position.clone() ?? null;
    }
    if (this.chest && this.phase === 'intro') return this.chest.position.clone();
    return null;
  }

  private nearestOf(list: THREE.Object3D[]): THREE.Object3D | null {
    const hp = this.hero.position;
    let best: THREE.Object3D | null = null;
    let bestD = Infinity;
    for (const o of list) {
      if (o.userData.done) continue;
      const d = Math.hypot(hp.x - o.position.x, hp.z - o.position.z);
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }

  protected loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.renderPausedFrame()) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();

    // Ход интро.
    if (this.phase === 'intro' && (now > this.nextAt || this.introRushed(this.introI))) {
      this.introI += 1;
      if (this.introI >= 3) {
        // В квест в любом случае. Без ключа уровень и так сломан — см.
        // `resolveKey`, из-за которого с настоящим сейвом это практически
        // недостижимо, — а оставить игрока на площадке появления без единого
        // дела было бы худшим способом сломаться.
        this.phase = 'quest';
        this.nextAt = now + 500;
        this.pushHud();
      } else {
        this.nextAt = now + 2400;
        this.pushHud();
      }
    }

    // Переход «замок открыт» → «сундук открывается».
    if (this.phase === 'unlock' && now > this.nextAt) {
      this.phase = 'open';
      this.chestOpen = true;
      this.lidOpenTime = now;
      this.stars += 20;
      this.spawnSparks(this.chest!.position, 50, [0xffd700, 0xff6b6b]);
      this.spawnSparks(this.chest!.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 30, [0x00cec9, 0xa29bfe]);
      AudioManager.sfx('success');

      // Rare friend «Ягодка» pops from the chest when Meshy model is present
      if (!this.yagodka) {
        void loadCharModel(createGameGltfLoader(), 'yagodka.glb', 1.1).then((friend) => {
          if (!friend || !this.chest || this.disposed) return;
          friend.position.copy(this.chest.position);
          friend.position.y = 0;
          friend.position.z += 1.2;
          groundY(friend);
          this.yagodka = friend;
          this.scene.add(friend);
          this.spawnSparks(friend.position, 20, [0xfd79a8, 0xffd700]);
        });
      }

      // Анимация открывающейся крышки.
      if (this.chest) {
        const lid = this.chest.userData.lid as THREE.Mesh;
        lid.userData.opening = true;
        // Прячем жёлудь-ключ: он использован.
        if (this.acornKey) this.acornKey.visible = false;
        // Прячем замок.
        const lockCap = this.chest.userData.lockCap as THREE.Mesh;
        const lockBody = this.chest.userData.lockBody as THREE.Mesh;
        lockCap.visible = false;
        lockBody.visible = false;
      }

      this.nextAt = now + 3000;
      this.pushHud();
    }

    // Переход «открыт» → финал.
    if (this.phase === 'open' && now > this.nextAt) {
      this.phase = 'outro';
      this.pushHud();
    }

    const canMove = !['intro', 'outro'].includes(this.phase);
    this.updateMovement(dt, canMove, this.baseSpeed, -26, 26, CHEST_Z - 16, SPAWN_Z + 2);

    // Пульсация свечения сундука.
    if (this.chest) {
      const glow = this.chest.userData.glow as THREE.Mesh;
      (glow.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(now * 0.003) * 0.15;

      // Анимация открытия крышки.
      const lid = this.chest.userData.lid as THREE.Mesh;
      if (lid.userData.opening) {
        const elapsed = now - this.lidOpenTime;
        if (elapsed < 800) {
          lid.rotation.x = -Math.PI * 0.6 * (elapsed / 800);
          lid.position.y = 0.95 + Math.sin((elapsed / 800) * Math.PI) * 0.3;
        } else {
          lid.rotation.x = -Math.PI * 0.6;
          lid.position.y = 1.1;
        }
      }
    }

    // Покачивание жёлудя-ключа.
    if (this.acornKey && this.acornKey.visible) {
      this.acornKey.position.y = this.keyBaseY + Math.sin(now * 0.003) * 0.15;
      this.acornKey.rotation.y += dt * 1.5;
    }

    // Ягоды медленно поворачиваются, чтобы куст с ягодой цеплял взгляд издалека:
    // неподвижная ягода в неподвижном кусте в траве не видна.
    for (const b of this.berries) {
      if (b.userData.done) continue;
      const fruit = b.userData.fruit as THREE.Object3D;
      fruit.rotation.y += dt * 1.1;
      fruit.position.y = (fruit.userData.restY ??= fruit.position.y) + Math.sin(now * 0.002 + b.position.x) * 0.05;
      const ring = b.userData.ring as THREE.Mesh;
      (ring.material as THREE.MeshBasicMaterial).opacity =
        (b === this.interactTarget ? 0.62 : 0.34) + Math.sin(now * 0.003 + b.position.z) * 0.1;
    }

    // Знаки печатей крутятся на постаментах — тем же языком, что и ягоды.
    for (const s of this.seals) {
      if (s.userData.done) continue;
      (s.userData.mark as THREE.Object3D).rotation.y += dt * 0.9;
    }

    // Столбы: тёмные, пока их печать не заработана, светятся, пока их можно
    // нажать, и несут печать, когда она встала. Состояние задачи читается по
    // одним столбам, без HUD.
    for (const p of this.pillars) {
      const mark = p.userData.mark as THREE.Mesh;
      const halo = p.userData.halo as THREE.Mesh;
      const armed = p.userData.armed as boolean;
      const set = p.userData.set as boolean;
      const mat = mark.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = set ? 0.95 : armed ? 0.45 + Math.sin(now * 0.004) * 0.2 : 0.05;
      mark.rotation.y += dt * (set ? 1.6 : armed ? 0.8 : 0);
      mark.position.y = 1.38 + (set ? 0.14 : 0) + (armed ? Math.sin(now * 0.003) * 0.05 : 0);
      (halo.material as THREE.MeshBasicMaterial).opacity = set ? 0.5 : armed ? 0.28 : 0;
    }

    // Панель замка: следующий знак «дышит», а неверное нажатие встряхивает весь
    // ряд — поправка приходит на замок, где и находится ответ, а не на тот столб,
    // который нажали не вовремя.
    if (this.lockFace) {
      const shake = now - this.lockWrongAt < 600 ? Math.sin(now * 0.06) * 0.06 : 0;
      this.lockFace.position.x = shake;
      this.lockFace.visible = this.phase === 'lock' || this.phase === 'quest';
      if (this.chestMarker) this.chestMarker.visible = this.phase === 'intro' || this.phase === 'quest';
      // children[0] — подложка, знаки идут под номерами 1, 3, 5.
      for (let i = 0; i < LOCK_ORDER.length; i++) {
        const child = this.lockFace.children[1 + i * 2] as THREE.Mesh;
        const mat = child.material as THREE.MeshStandardMaterial;
        const isNext = this.phase === 'lock' && i === this.lockDone;
        mat.emissiveIntensity = i < this.lockDone ? 0.95 : isNext ? 0.55 + Math.sin(now * 0.005) * 0.3 : 0.18;
        child.scale.setScalar(isNext ? 1.2 : 1);
        child.rotation.y += dt * (isNext ? 1.2 : 0.25);
      }
    }

    // Стражи смотрят на того, кто подошёл достаточно близко для обмена.
    this.guardians.forEach((g, i) => {
      const shrine = SHRINES[i];
      if (!shrine) return;
      const d = Math.hypot(this.hero.position.x - g.position.x, this.hero.position.z - g.position.z);
      const want = d < 6
        ? Math.atan2(this.hero.position.x - g.position.x, this.hero.position.z - g.position.z)
        : shrine.rotY;
      g.rotation.y += (want - g.rotation.y) * Math.min(1, dt * 3);
    });

    // Бабочки.
    for (const b of this.butterflies) {
      const ph = (b.userData.phase as number) + now * 0.001;
      b.position.x = (b.userData.ox as number) + Math.sin(ph) * 1.5;
      b.position.z = (b.userData.oz as number) + Math.cos(ph * 0.8) * 1.5;
      b.position.y = this.groundHeightAt(b.position.x, b.position.z) + 1.2 + Math.sin(ph * 1.5) * 0.4;
      b.rotation.y = ph;
    }

    // Стрелка-указатель.
    const obj = this.objectiveWorldPos();
    this.updateGuideArrow(now, obj, ['intro', 'outro', 'unlock', 'open']);

    // Поиск объекта для взаимодействия.
    const prev = this.interactTarget;
    this.interactTarget = this.nearestInteract();
    if (prev !== this.interactTarget) this.pushHud();

    this.updateAmbient(dt, now);

    // Камера.
    // Кинематографично только до первого шага — та же правка, что на L2, L8 и
    // L16. Без этой проверки камера остаётся на фиксированном пути весь таймер
    // интро, даже когда герой уже пошёл.
    if (this.phase === 'intro' && !this.hasTakenFirstStep) {
      const idx = Math.min(this.introI, 2);
      // Открываемся на глубину леса, потом опускаемся за спину герою. Старый
      // показ смотрел с z = 0 до −4 — это был весь уровень, пока он был глубиной
      // в двадцать метров, а теперь это первые две секунды.
      const introPos = [
        new THREE.Vector3(9, 8, 17),
        new THREE.Vector3(3.5, 4.4, 13),
        new THREE.Vector3(0, 5.4, SPAWN_Z + 7),
      ];
      const introLook = [
        new THREE.Vector3(0, 1.6, CHEST_Z + 8),
        new THREE.Vector3(routeX(-6), 1.2, -6),
        new THREE.Vector3(0, 1.1, SPAWN_Z - 3),
      ];
      const ease = idx === 0 ? 0.35 : idx === 1 ? 0.1 : 0.02;
      this.camera.position.lerp(introPos[idx], 1 - Math.pow(ease, dt));
      this.camera.lookAt(introLook[idx]);
    } else if (this.phase === 'unlock' || this.phase === 'open' || this.phase === 'outro') {
      // Первый кадр держим на сундуке, а не на спине героя.
      this.updateCamera(
        // Сбоку: герой открывает сундук стоя прямо перед ним, и фронтальный
        // кадр закрывает его спиной всю награду.
        new THREE.Vector3(3.4, this.groundHeightAt(0, CHEST_Z) + 3.6, CHEST_Z + 6.2),
        new THREE.Vector3(0, this.groundHeightAt(0, CHEST_Z) + 1.2, CHEST_Z - 0.4),
        0.02,
        dt,
      );
    } else {
      // Портрету и телефону в ландшафте нужна камера положе и дальше:
      // десктопный наклон отправляет нижнюю треть высокого кадра в землю прямо
      // перед героем. cameraFraming() уже существовал, и его использовали семь
      // уровней; этот — нет.
      const f = this.cameraFraming();
      const target = new THREE.Vector3(
        this.cameraLateral(this.hero.position.x) + f.lateral,
        5.5 * f.heightMul,
        this.hero.position.z + 9 + f.backAdd,
      );
      this.camera.position.lerp(target, 1 - Math.pow(0.0015, dt));
      this.camera.lookAt(
        this.cameraLateral(this.hero.position.x),
        1.2 + f.lookUp,
        this.hero.position.z - 2 - f.lookAhead,
      );
    }

    this.renderFrame();
  };
}

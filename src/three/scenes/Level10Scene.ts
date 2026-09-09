import * as THREE from 'three';
import {
  BaseLevelScene,
  type BaseHud,
  mountain,
  zoneDisc,
  spawnPad,
  questMarker,
  butterfly,
  bush,
  tulip,
  hill,
    loadCharModel,
  loadPropModel,
  placeWoodSign,
} from './BaseLevelScene';
import { groundY } from '../modelUtils';
import { createPlushSquirrel, createPlushHedgehog } from '../PlushAnimals';
import { createPlushCharacter } from '../PlushCharacter';
import { ZHULDYZ_LOOK } from '../characterLooks';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { makeOldOak } from './Level3Scene';
import { makePutalo } from './Level7Scene';
import { placeAmbientCritters } from '../s1Place';

/**
 * Level 11 «Прощание с лесом» — GDD Level 10:
 * Explore + farewell. Visit 4 familiar places, say goodbye to NPCs.
 * Circular route with bonus stars.
 */

export type L11Phase = 'intro' | 'gifts' | 'farewell' | 'leaving' | 'outro';

export interface L11Hud extends BaseHud {
  farewellDone: number;
  farewellTotal: number;
  giftsDone: number;
  giftsTotal: number;
  carryingGift: boolean;
}

interface FarewellSpot {
  pos: THREE.Vector3;
  npcName: string;
  npcNameKk: string;
  /**
   * Что здесь было.
   *
   * Уровень назван прощанием, а прощаться было не с чем: каждое место — это
   * NPC на траве и одна реплика. Ландмарки своих уровней тут уже стояли
   * декорацией (дом садовника, старый дуб, нора белочки), но никто про них не
   * вспоминал вслух. Воспоминание — первое, что происходит на месте: сначала
   * узнаёшь место, потом даришь, потом прощаешься.
   */
  memoryRu: string;
  memoryKk: string;
  remembered: boolean;
  /** Огонёк над ландмарком: гаснет, когда воспоминание рассказано. */
  spark: THREE.Object3D | null;
  farewellRu: string;
  farewellKk: string;
  done: boolean;
  gifted: boolean;
  marker: THREE.Group;
}

function makeSnowman(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), snowMat);
  bottom.position.y = 0.6;
  bottom.castShadow = true;
  const mid = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), snowMat);
  mid.position.y = 1.4;
  mid.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), snowMat);
  head.position.y = 1.95;
  head.castShadow = true;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 6), new THREE.MeshStandardMaterial({ color: 0xff6f00 }));
  nose.position.set(0, 1.95, 0.3);
  nose.rotation.x = Math.PI / 2;
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), new THREE.MeshStandardMaterial({ color: 0x333 }));
  eyeL.position.set(0.1, 2.02, 0.27);
  const eyeR = eyeL.clone();
  eyeR.position.x = -0.1;
  g.add(bottom, mid, head, nose, eyeL, eyeR);
  g.position.set(x, 0, z);
  return g;
}

export class Level10Scene extends BaseLevelScene {
  private phase: L11Phase = 'intro';
  private onHud: ((h: L11Hud) => void) | null = null;
  private introI = 0;
  private nextAt = 0;
  private spots: FarewellSpot[] = [];
  private farewellDone = 0;
  /** Пятое место — Путало: друг из L7, которого в прощании не было. */
  private readonly farewellTotal = 5;
  private activeFarewell: FarewellSpot | null = null;
  private farewellUntil = 0;
  private butterflies: THREE.Group[] = [];
  private trailMeshes: THREE.Mesh[] = [];
  private giftPile: THREE.Object3D | null = null;
  private giftsDone = 0;
  private readonly giftsTotal = 5;
  private carryingGift = false;
  private carryingMesh: THREE.Object3D | null = null;
  /** Ягоды в несомой корзинке — по одной на друга; тают на глазах. */
  private carriedBerries: THREE.Mesh[] = [];
  /** Ягоды в корзине на земле — гаснут, когда корзинку забрали. */
  private pileBerries: THREE.Mesh[] = [];
  /**
   * Корзину берут один раз, а не по ягоде на каждого друга.
   *
   * Раньше цикл был «корзина → друг → корзина → друг»: пять возвратов к куче
   * на (0, −4) к местам, разбросанным до 28 м от неё, — **216 м** ходьбы на
   * уровне, который по замыслу тихое прощание, а не марафон. Теперь Барсик
   * несёт корзину с собой и достаёт ягоду у каждого места: тот же жест,
   * та же реплика, один обход вместо пяти.
   */
  private basketTaken = false;
  /**
   * Карта у выхода из леса.
   *
   * Она уже лежала на z = −35 с комментарием «карта, которая отправляет всех в
   * горы, лежит у выхода» — и была чистой декорацией: уровень заканчивался на
   * четвёртом прощании, посреди леса. Теперь прощание — не конец, а разрешение
   * уйти: за картой надо дойти до опушки и оглянуться.
   */
  private exitMap: THREE.Object3D | null = null;
  private exitMarker: THREE.Group | null = null;

  protected currentPhase() { return this.phase; }

  protected onMovementHintDismiss() {
    this.pushHud();
  }

  tryInteract() {
    if (this.phase === 'gifts') {
      if (this.interactTarget === this.giftPile && !this.basketTaken) {
        this.basketTaken = true;
        this.carryingGift = true;
        // Корзинка в лапах — и по числу ягод в ней видно, скольким друзьям
        // ещё не подарили. Счётчик в HUD говорит то же самое словами, но
        // ребёнку, который не читает, считает только эта горстка.
        this.carryingMesh = this.makeCarriedBasket();
        this.hero.add(this.carryingMesh);
        for (const b of this.pileBerries) b.visible = false;
        this.spawnSparks(this.giftPile!.position, 8, [0xe84393, 0xffd700]);
        this.phase = 'farewell';
        this.pushHud();
        return;
      }
    }

    if (this.phase === 'leaving') {
      if (this.interactTarget === this.exitMap) this.leaveForest();
      return;
    }

    if (this.phase !== 'farewell') return;
    const t = this.interactTarget;
    if (!t) return;
    const spot = this.spots.find(s => s.marker === t && !s.done);
    if (!spot) return;

    // Сначала узнать место. Три нажатия на одном месте — это не три подхода,
    // а разговор: вспомнил, подарил, попрощался.
    if (!spot.remembered) {
      spot.remembered = true;
      this.stars += 1;
      this.activeFarewell = spot;
      this.farewellUntil = performance.now() + 3600;
      if (spot.spark) {
        this.spawnSparks(spot.spark.position, 14, [0xffe9a8, 0xffd700]);
        spot.spark.visible = false;
      }
      this.pushHud();
      return;
    }

    if (!spot.gifted) {
      if (!this.carryingGift) {
        this.phase = 'gifts';
        this.pushHud();
        return;
      }
      spot.gifted = true;
      this.giftsDone += 1;
      // Корзинка остаётся в лапах, пока из неё не уйдёт последняя ягода.
      this.carryingGift = this.giftsDone < this.giftsTotal;
      const given = this.carriedBerries.pop();
      if (given) {
        given.removeFromParent();
        given.geometry.dispose();
        (given.material as THREE.Material).dispose();
      }
      if (!this.carryingGift && this.carryingMesh) {
        this.hero.remove(this.carryingMesh);
        this.carryingMesh.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          m.geometry.dispose();
          (m.material as THREE.Material).dispose();
        });
        this.carryingMesh = null;
        this.carriedBerries.length = 0;
      }
      this.stars += 2;
      this.spawnSparks(spot.pos, 10, [0xe84393, 0xf1c40f]);
      this.activeFarewell = spot;
      this.farewellUntil = performance.now() + 1600;
      // Подарок отдан, но на этом же месте ещё осталось попрощаться.
      this.pushHud();
      return;
    }

    spot.done = true;
    this.farewellDone++;
    this.activeFarewell = spot;
    this.farewellUntil = performance.now() + 2200;
    this.stars += 3;
    this.spawnSparks(spot.pos, 12, [0xf1c40f, 0xa29bfe]);
    spot.marker.visible = false;
    if (this.farewellDone >= this.farewellTotal) {
      // Прощание — не конец уровня, а разрешение уйти.
      this.phase = 'leaving';
      this.stars += 3;
      this.spawnSparks(new THREE.Vector3(0, 2, 0), 20, [0xffd700, 0x00cec9]);
      if (this.exitMarker) this.exitMarker.visible = true;
    }
    this.pushHud();
  }

  /** Корзинка, которую Барсик несёт: та же, что стояла на земле, но поменьше. */
  private makeCarriedBasket(): THREE.Object3D {
    const group = new THREE.Group();
    // Светлее куртки и заметно крупнее первого варианта: на игровом отдалении
    // корзинка 0.3 м тёмного дерева сливалась с грудью, и «несу подарки»
    // читалось только по счётчику в HUD.
    const basket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.42, 0.3, 12),
      new THREE.MeshStandardMaterial({ color: 0xe0a563, roughness: 0.85 }),
    );
    group.add(basket);
    for (let i = 0; i < this.giftsTotal; i++) {
      const berry = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0xe84393, emissive: 0xad1457, emissiveIntensity: 0.6 }),
      );
      const a = (i / this.giftsTotal) * Math.PI * 2;
      berry.position.set(Math.cos(a) * 0.2, 0.2, Math.sin(a) * 0.2);
      group.add(berry);
      this.carriedBerries.push(berry);
    }
    // Сбоку у бедра, а не на груди: модель героя без скелета (0 анимаций,
    // 0 skins), руки к корзинке не привязать, и на груди она входила в плечо.
    group.position.set(0.52, 1.0, 0.18);
    return group;
  }

  /**
   * Опушка: карта в лапах, лес за спиной.
   *
   * Все пять маркеров загораются в последний раз — не как цели, а как «мы
   * здесь». Это единственный кадр, в котором видно весь пройденный лес сразу.
   */
  private leaveForest() {
    this.phase = 'outro';
    this.stars += 5;
    if (this.exitMarker) this.exitMarker.visible = false;
    if (this.exitMap) {
      this.spawnSparks(this.exitMap.position, 22, [0xffd700, 0x8fd8f5]);
      this.exitMap.visible = false;
    }
    for (const spot of this.spots) {
      spot.marker.visible = true;
      this.spawnSparks(spot.pos, 8, [0xf1c40f, 0xa29bfe]);
    }
    this.pushHud();
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L11Hud) => void) {
    this.nick = nick || this.defaultNick(lang);
    this.lang = lang;
    this.onHud = onHud;
    const loader = createGameGltfLoader();

    this.camera.position.set(0, 8, 18);
    await this.setupForestEnvironment(loader, { fogColor: 0x90a4ae, sky: ['#8fb8d8', '#bcd6e6', '#eef4f2'], flatRadius: 20, flatCenterZ: -14 });
    this.setupSky();
    this.setupClouds(5, 26, 50);

    this.scene.add(hill(-22, -15, 10, 1.2));
    this.scene.add(hill(24, -25, 12, 1.4));

    for (const [x, z, h, w] of [
      [-40, -60, 20, 14],
      [38, -55, 22, 15],
    ] as const) {
      this.scene.add(mountain(x, z, h, w));
    }

    this.scene.add(zoneDisc(0, 6, 5, 0x81c784, this.groundHeightAt(0, 6) + 0.025));
    const spawnPadObj = spawnPad(0, 6);
    this.snapToGround(spawnPadObj);
    this.scene.add(spawnPadObj);
    this.scene.add(await placeWoodSign(loader, -2.5, 4, 0.3, 0x81c784));

    // Корзинка с ягодами в центре: её берут один раз на весь обход.
    this.giftPile = new THREE.Group();
    const basket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.65, 0.45, 12),
      new THREE.MeshStandardMaterial({ color: 0xc47a3a, roughness: 0.9 }),
    );
    basket.position.y = 0.22;
    this.giftPile.add(basket);
    // Ягод в корзине столько, сколько друзей: пятая появилась вместе с Путало.
    for (let i = 0; i < this.giftsTotal; i++) {
      const berry = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xe84393, emissive: 0xad1457, emissiveIntensity: 0.35 }),
      );
      const a = (i / this.giftsTotal) * Math.PI * 2;
      berry.position.set(Math.cos(a) * 0.25, 0.5, Math.sin(a) * 0.25);
      this.giftPile.add(berry);
      this.pileBerries.push(berry);
    }
    this.giftPile.position.set(0, this.groundHeightAt(0, -4), -4);
    this.giftPile.userData.isGiftPile = true;
    this.scene.add(this.giftPile);
    this.scene.add(zoneDisc(0, -4, 2.5, 0xe84393, this.groundHeightAt(0, -4) + 0.03));

    // Места прощания разнесены по лесу, а не собраны в кучу.
    //
    // Раньше все четыре стояли в коробке 12×10 с корзиной посередине: их было
    // видно прямо со старта, и «обход» кончался за двадцать секунд. По спеке
    // это круг по местам, где игрок уже был, — а такой бит работает, только
    // если мир и правда пройти ещё раз. Поэтому каждое место теперь там, где
    // был его уровень: садовник у дома, пенёк на своей поляне с загадками,
    // ёжик под старым дубом, белочка у норки по дороге в горы.
    const spotConfigs: [
      number, number, string, string, string, string, string, string, string | null,
    ][] = [
      [-16, 4, 'Садовник', 'Бағбан',
        'Здесь я собирал яблоки в три корзины — по числу светлых полосок.',
        'Мұнда мен алмаларды үш себетке жинағанмын — ашық жолақтардың санына қарай.',
        'Береги наш сад, Барсик. Мы будем ждать!', 'Бағбаны сақта, Барсик. Күтеміз!', 'zhuldyz.glb'],
      [15, -9, 'Пенёк', 'Түпкі',
        'А тут пенёк загадывал загадки. Я угадал все до одной!',
        'Ал мұнда томар жұмбақ айтқан. Мен бәрін тапқанмын!',
        'Приходи — загадки не кончаются!', 'Кел — жұмбақтар бітпейді!', null],
      // Путало — единственный друг сезона, которого в прощании не было.
      [19, -19, 'Путало', 'Путало',
        'Здесь я шёл тихо-тихо, чтобы не спугнуть тебя. И ты показал мне закат.',
        'Мұнда мен сені үркітпейін деп жайлап басқанмын. Сен маған батқан күнді көрсеттің.',
        'Я сниму горы и пришлю тебе снимок!', 'Мен тауларды түсіріп, саған суретін жіберемін!', null],
      [-13, -21, 'Ёжик', 'Кірпі',
        'Под этим дубом я нашёл тебя по следам лап.',
        'Осы еменнің түбінен мен сені із бойынша тапқанмын.',
        'Спасибо, что нашёл меня тогда!', 'Сол кезде мені тапқаның үшін рахмет!', 'hedgehog.glb'],
      [12, -30, 'Белочка', 'Тиін',
        'Отсюда я нёс твою корзину до самой норки. Тяжёлая была!',
        'Осы жерден мен сенің себетіңді інге дейін көтеріп барғанмын. Ауыр екен!',
        'Жёлудь сработал! Увидимся в горах!', 'Жаңғақ жарамды! Тауда кездесеміз!', 'squirrel.glb'],
    ];

    for (let i = 0; i < spotConfigs.length; i++) {
      const [x, z, nameRu, nameKk, memoryRu, memoryKk, farewellRu, farewellKk, glbFile] = spotConfigs[i];
      const marker = questMarker(0xf1c40f, 0xff9f43);
      marker.position.set(x, this.groundHeightAt(x, z), z);
      this.scene.add(marker);

      // Огонёк воспоминания: тёплая искра над местом, гаснет, когда вспомнили.
      const spark = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.85, toneMapped: false }),
      );
      spark.position.set(x, this.groundHeightAt(x, z) + 2.1, z);
      this.scene.add(spark);

      this.spots.push({
        pos: new THREE.Vector3(x, this.groundHeightAt(x, z), z),
        npcName: nameRu,
        npcNameKk: nameKk,
        memoryRu,
        memoryKk,
        remembered: false,
        spark,
        farewellRu,
        farewellKk,
        done: false,
        gifted: false,
        marker,
      });
      this.colliders.push({ kind: 'circle', x, z, r: 1.0 });

      let npc: THREE.Object3D | null = null;
      if (glbFile) {
        npc = await loadCharModel(loader, glbFile, glbFile.includes('hedgehog') || glbFile.includes('squirrel') ? 0.95 : 1.25);
      }
      if (!npc) {
        // Порядок мест сменился: Путало встал третьим, поэтому индексы
        // запасных моделей больше не совпадают с прежними.
        if (i === 0) npc = createPlushCharacter({ ...ZHULDYZ_LOOK, height: 1.2 });
        else if (i === 2) npc = makePutalo(0, 0);
        else if (i === 3) npc = createPlushHedgehog();
        else if (i === 4) npc = createPlushSquirrel();
        else {
          // Stump stand-in for Пенёк
          const stump = new THREE.Group();
          const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.45, 0.55, 0.55, 10),
            new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 1 }),
          );
          trunk.position.y = 0.28;
          stump.add(trunk);
          npc = stump;
        }
      }
      npc.position.set(x + 0.9, 0, z);
      npc.rotation.y = Math.atan2(-x, -z);
      groundY(npc, this.groundHeightAt(x + 0.9, z));
      this.scene.add(npc);
    }

    // Светящаяся тропа между местами — замкнутый круг обхода.
    for (let i = 0; i < this.spots.length; i++) {
      const a = this.spots[i].pos;
      const b = this.spots[(i + 1) % this.spots.length].pos;
      const steps = 4;
      for (let s = 1; s <= steps; s++) {
        const t = s / (steps + 1);
        const trail = new THREE.Mesh(
          new THREE.CircleGeometry(0.35, 12),
          new THREE.MeshBasicMaterial({ color: 0x81c784, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
        );
        trail.rotation.x = -Math.PI / 2;
        const tx = a.x + (b.x - a.x) * t;
        const tz = a.z + (b.z - a.z) * t;
        trail.position.set(tx, this.groundHeightAt(tx, tz) + 0.04, tz);
        this.trailMeshes.push(trail);
        this.scene.add(trail);
      }
    }

    // Снеговик у выхода — намёк на зимнюю главу.
    const snowGlb = await loadPropModel(loader, 'snowman.glb', { height: 1.5 });
    if (snowGlb) {
      snowGlb.position.set(0, 0, -14);
      groundY(snowGlb);
      this.scene.add(snowGlb);
    } else {
      this.scene.add(makeSnowman(0, -14));
    }

    // Декор.
    for (let i = 0; i < 12; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = 4 - (i / 12) * 16;
      this.scene.add(bush(side * (7 + Math.random() * 3), z));
    }
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = 4 - (i / 8) * 16;
      this.scene.add(tulip(side * 5, z, [0xe74c3c, 0xf1c40f, 0xfd79a8, 0xa29bfe][i % 4]));
    }

    for (let i = 0; i < 4; i++) {
      const bf = butterfly((Math.random() - 0.5) * 14, -4 - Math.random() * 8, [0xff7675, 0x74b9ff, 0xfdcb6e][i % 3]);
      this.butterflies.push(bf);
      this.scene.add(bf);
    }

    // Тот самый дуб из L3, а не похожий: место должно быть узнаваемым.
    const oak = makeOldOak(-15.5, -23);
    oak.scale.setScalar(0.72);
    this.snapToGround(oak);
    this.scene.add(oak);
    this.colliders.push({ kind: 'circle', x: -15.5, z: -23, r: 1.2 });

    for (const [x, z] of [[-16, 4], [15, -9], [19, -19], [-13, -21], [12, -30], [0, -35]] as const) {
      this.reserve(x, z, 4.5);
    }
    await this.loadTrees(loader, 26, 26, -16, 4.0);
    await this.loadProps(loader, 9, 6, 30, -18);

    // У каждого места прощания свой ориентир, иначе это просто NPC на пустой
    // траве, а не то место, где что-то было.
    const exitProps = await this.placeProps(loader, [
      // Садовник — дом и садовая ограда (L0).
      { key: 'cabin', opts: { x: -19, z: 7, maxSize: 3.4, rotY: 0.5 } },
      { key: 'fence', opts: { x: -13, z: 5, maxSize: 1.6, rotY: 0.2 } },
      { key: 'basket_red', opts: { x: -14.5, z: 3, maxSize: 0.7 } },
      // Пенёк — поляна с загадками (L6).
      { key: 'stump', opts: { x: 15, z: -9, maxSize: 1.4 } },
      { key: 'mushroom', opts: { x: 16.4, z: -7.8, maxSize: 0.45 } },
      { key: 'mushroom', opts: { x: 13.6, z: -10.4, maxSize: 0.4 } },
      // Ёжик — старый дуб, под которым его нашли (L3).
      { key: 'berry', opts: { x: -11.5, z: -20, maxSize: 0.35 } },
      // Белочка — норка по дороге из леса (L5).
      { key: 'treehouse', opts: { x: 14.5, z: -32, maxSize: 3.0, rotY: -0.4 } },
      { key: 'acorn_key', opts: { x: 10.5, z: -29, maxSize: 0.5 } },
      // Карта, которая отправляет всех в горы, лежит у выхода.
      { key: 'map_scroll', opts: { x: 0, z: -35, maxSize: 0.6, y: 0.12 } },
      { key: 'wood_sign', opts: { x: 2.5, z: -34, maxSize: 1.3, rotY: 0.3 } },
    ]);

    // Карту берут в лапы, а не просто проходят мимо. Ищем по месту, а не по
    // индексу в списке: список правят чаще, чем координаты выхода.
    this.exitMap =
      exitProps.reduce<THREE.Object3D | null>((best, obj) => {
        const d = Math.hypot(obj.position.x, obj.position.z + 35);
        const bd = best ? Math.hypot(best.position.x, best.position.z + 35) : Infinity;
        return d < bd ? obj : best;
      }, null) ?? null;
    this.exitMarker = questMarker(0x8fd8f5, 0x0984e3);
    this.exitMarker.position.set(0, this.groundHeightAt(0, -35), -35);
    this.exitMarker.visible = false;
    this.scene.add(this.exitMarker);
    await placeAmbientCritters(this.scene, loader, [
      { key: 'fox', x: 6.5, z: -6, rotY: -1.2, h: 0.85 },
      { key: 'rabbit', x: -7, z: -8, rotY: 0.5, h: 0.7 },
      { key: 'owl', x: 8, z: 0, rotY: -2.0, h: 0.7 },
    ]);

    this.hero.position.set(0, this.groundHeightAt(0, 6), 6);
    // Уровень — серпантин, а не поле: биты идут вниз попеременно слева и
    // справа. Если проложить это настоящим маршрутом и обнести стенами, он
    // перестаёт читаться как поляна с разбросанными предметами.
    this.derivePathFromRooms({ x: 0, z: 6 });
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

    if (p === 'intro') {
      const lines = [
        this.copy('Пора прощаться с лесом...', 'Орманмен қоштасу уақыты...'),
        this.copy(`Возьми корзинку с ягодами, ${n} — она одна на всех.`, `Жидегі бар себетті ал, ${n} — ол бәріне ортақ.`),
        this.copy('Каждому другу — ягода, потом тёплое прощание!', 'Әр досқа — жидек, сосын жылы қоштасу!'),
      ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = this.copy('🎁 Возьми корзинку с ягодами', '🎁 Жидегі бар себетті ал');
    } else if (p === 'gifts') {
      line = this.carryingGift
        ? this.copy('Отнеси ягоду другу со звёздочкой!', 'Жидекті жұлдызды досқа апар!')
        : this.copy('Возьми корзинку — ягод хватит на всех.', 'Себетті ал — жидек бәріне жетеді.');
      objective = this.copy(
        `🎁 Подарки: ${this.giftsDone}/${this.giftsTotal}${this.carryingGift ? ' · корзинка в лапах' : ''}`,
        `🎁 Сыйлық: ${this.giftsDone}/${this.giftsTotal}${this.carryingGift ? ' · себет қолында' : ''}`,
      );
    } else if (p === 'farewell') {
      if (this.activeFarewell && performance.now() < this.farewellUntil) {
        const a = this.activeFarewell;
        if (a.remembered && !a.gifted) {
          // Вспоминает сам Барсик — это его память, а не реплика друга.
          speaker = 'Барсик';
          line = this.copy(a.memoryRu, a.memoryKk);
        } else {
          speaker = this.lang === 'kk' ? a.npcNameKk : a.npcName;
          line = a.gifted && !a.done
            ? this.copy('Спасибо за ягоду! Обними на прощание!', 'Жидек үшін рахмет! Қоштасуға құшақта!')
            : this.copy(a.farewellRu, a.farewellKk);
        }
      } else {
        this.activeFarewell = null;
        const next = this.spots.find(s => !s.done);
        const name = next ? (this.lang === 'kk' ? next.npcNameKk : next.npcName) : '';
        line = next && !next.remembered
          ? this.copy(`Подойди и вспомни, что здесь было: ${name}`, `Жақында да, мұнда не болғанын есіңе түсір: ${name}`)
          : this.carryingGift
            ? this.copy(`Отдай подарок: ${name}`, `Сыйлықты бер: ${name}`)
            : name
              ? this.copy(`Попрощайся с: ${name}`, `Қоштас: ${name}`)
              : this.copy('Все друзья попрощались!', 'Барлық достар қоштасты!');
      }
      objective = this.copy(`👋 Прощание: ${this.farewellDone}/${this.farewellTotal}`, `👋 Қоштасу: ${this.farewellDone}/${this.farewellTotal}`);
    } else if (p === 'leaving') {
      line = this.copy(
        'Все попрощались. На опушке лежит карта в горы — забери её и оглянись на лес.',
        'Бәрі қоштасты. Орман шетінде тауларға апаратын карта жатыр — оны ал да, орманға бұрылып қара.',
      );
      objective = this.copy('🗺️ Забери карту у опушки', '🗺️ Орман шетінен картаны ал');
    } else if (p === 'outro') {
      speaker = this.copy('Садовник', 'Бағбан');
      line = this.copy(
        'До свидания, Барсик! За горами — снег и новые приключения!',
        'Сау бол, Барсик! Таулардың артында — қар және жаңа оқиғалар!',
      );
      objective = this.copy('❄️ Дорога к Ледяной долине', '❄️ Мұзды аңғарға жол');
    }

    this.onHud?.({
      phase: p,
      speaker,
      line,
      objective,
      farewellDone: this.farewellDone,
      farewellTotal: this.farewellTotal,
      giftsDone: this.giftsDone,
      giftsTotal: this.giftsTotal,
      carryingGift: this.carryingGift,
      stars: this.stars,
      canInteract: Boolean(this.interactTarget),
      // Не 'intro': эта фаза исключена из canMove.
      showMoveHint: !this.hasTakenFirstStep && p === 'gifts',
      showActionHint: Boolean(this.interactTarget),
      outro: p === 'outro',
    });
  }

  private nearestInteract(): THREE.Object3D | null {
    const hp = this.hero.position;
    let best: THREE.Object3D | null = null;
    let bestD = 2.5;

    if ((this.phase === 'gifts' || this.phase === 'farewell') && !this.basketTaken && this.giftPile) {
      const d = hp.distanceTo(this.giftPile.position);
      if (d < bestD) { bestD = d; best = this.giftPile; }
    }

    for (const spot of this.spots) {
      if (spot.done) continue;
      const d = hp.distanceTo(spot.pos);
      if (d >= bestD) continue;
      if (this.phase !== 'farewell') continue;
      // Воспоминание берётся до подарка и не требует ягоды в лапах: иначе
      // ребёнок, пришедший к месту с пустыми руками, не может даже узнать его.
      if (!spot.remembered) {
        bestD = d; best = spot.marker;
      } else if (spot.gifted) {
        // Прощальное объятие — независимо от того, что в лапах. Пока корзину
        // отдавали по ягоде, «пустые лапы» и «пора прощаться» совпадали; с
        // корзиной, которая остаётся до последнего друга, это условие делало
        // прощание недоступным, и уровень вставал на 0/5.
        bestD = d; best = spot.marker;
      } else if (this.carryingGift) {
        bestD = d; best = spot.marker;
      }
    }

    if (this.phase === 'leaving' && this.exitMap) {
      const d = Math.hypot(hp.x - this.exitMap.position.x, hp.z - this.exitMap.position.z);
      if (d < bestD) best = this.exitMap;
    }

    return best;
  }

  private objectiveWorldPos(): THREE.Vector3 | null {
    if (this.phase === 'gifts' && !this.basketTaken && this.giftPile) {
      return this.giftPile.position.clone();
    }
    if (this.phase === 'gifts' || this.phase === 'farewell') {
      const hp = this.hero.position;
      let best: THREE.Vector3 | null = null;
      let bestD = Infinity;
      for (const spot of this.spots) {
        if (spot.done) continue;
        // Непрочитанное воспоминание — сама по себе цель: к такому месту
        // стрелка ведёт даже с пустыми лапами.
        if (!spot.remembered) {
          const dm = hp.distanceTo(spot.pos);
          if (dm < bestD) { bestD = dm; best = spot.pos.clone(); }
          continue;
        }
        const d = hp.distanceTo(spot.pos);
        if (d < bestD) { bestD = d; best = spot.pos.clone(); }
      }
      // Empty-handed with gifts still to give: the pile is the answer.
      //
      // Every branch above skips a spot that needs a gift the player is not
      // carrying, so once the last one was handed over the arrow went out
      // entirely — in the middle of a level still asking for «Прощание: 2/5».
      // A blank arrow is the one thing this level cannot afford: its five
      // stops are scattered over thirty metres and the pile is behind you.
      if (!best && !this.basketTaken && this.giftPile) {
        return this.giftPile.position.clone();
      }
      return best;
    }
    if (this.phase === 'leaving' && this.exitMap) return this.exitMap.position.clone();
    return null;
  }

  protected loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.renderPausedFrame()) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();

    if (this.phase === 'intro' && (now > this.nextAt || this.introRushed(this.introI))) {
      this.introI += 1;
      if (this.introI >= 3) {
        this.phase = 'gifts';
        this.nextAt = now + 500;
        this.pushHud();
      } else {
        this.nextAt = now + 2400;
        this.pushHud();
      }
    }

    const canMove = !['intro', 'outro'].includes(this.phase);
    this.updateMovement(dt, canMove, this.baseSpeed, -26, 26, -38, 10);

    for (const b of this.butterflies) {
      const ph = (b.userData.phase as number) + now * 0.001;
      b.position.x = (b.userData.ox as number) + Math.sin(ph) * 1.5;
      b.position.z = (b.userData.oz as number) + Math.cos(ph * 0.8) * 1.5;
      b.position.y = this.groundHeightAt(b.position.x, b.position.z) + 1.2 + Math.sin(ph * 1.5) * 0.4;
      b.rotation.y = ph;
    }

    for (const t of this.trailMeshes) {
      (t.material as THREE.MeshBasicMaterial).opacity = 0.2 + Math.sin(now * 0.003 + t.position.x) * 0.15;
    }

    for (const spot of this.spots) {
      if (!spot.done) {
        spot.marker.position.y = this.groundHeightAt(spot.pos.x, spot.pos.z)
          + Math.sin(now * 0.004 + spot.pos.x) * 0.08;
      }
      if (spot.spark?.visible) {
        spot.spark.position.y =
          this.groundHeightAt(spot.pos.x, spot.pos.z) + 2.1 + Math.sin(now * 0.0035 + spot.pos.z) * 0.22;
        const mat = (spot.spark as THREE.Mesh).material as THREE.MeshBasicMaterial;
        mat.opacity = 0.6 + Math.sin(now * 0.006 + spot.pos.x) * 0.25;
      }
    }

    if (this.exitMarker?.visible) {
      const bang = this.exitMarker.userData.bang as THREE.Object3D | undefined;
      if (bang) {
        bang.position.y = 4.2 + Math.sin(now * 0.006) * 0.15;
        bang.rotation.y += dt * 2;
      }
    }

    if (this.activeFarewell && now > this.farewellUntil) {
      this.activeFarewell = null;
      this.pushHud();
    }

    const obj = this.objectiveWorldPos();
    this.updateGuideArrow(now, obj, ['intro', 'outro']);

    const prev = this.interactTarget;
    this.interactTarget = this.nearestInteract();
    if (prev !== this.interactTarget) this.pushHud();

    this.updateAmbient(dt, now);

    // Кинематографично только до первого шага — та же правка, что на L2, L8
    // и L16. Без этой проверки камера остаётся на фиксированном пути весь
    // таймер интро, даже когда герой уже пошёл.
    if (this.phase === 'intro' && !this.hasTakenFirstStep) {
      const idx = Math.min(this.introI, 2);
      const introPos = [new THREE.Vector3(0, 8, 18), new THREE.Vector3(0, 7, 15), new THREE.Vector3(0, 6, 12)];
      const introLook = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, -3), new THREE.Vector3(0, 0.5, -6)];
      this.camera.position.lerp(introPos[idx], 1 - Math.pow(0.02, dt));
      this.camera.lookAt(introLook[idx]);
    } else {
      // Кадрирование как во всём сезоне: узкому или низкому экрану нужна
      // камера положе и дальше, иначе десктопный наклон тратит нижнюю треть
      // экрана на землю прямо перед героем.
      const f = this.cameraFraming();
      const target = new THREE.Vector3(
        this.cameraLateral(this.hero.position.x) + f.lateral,
        6 * f.heightMul,
        this.hero.position.z + 10 + f.backAdd,
      );
      this.camera.position.lerp(target, 1 - Math.pow(0.0015, dt));
      this.camera.lookAt(
        this.cameraLateral(this.hero.position.x),
        1.2 + f.lookUp,
        this.hero.position.z - 3 - f.lookAhead,
      );
    }

    this.renderFrame();
  };
}

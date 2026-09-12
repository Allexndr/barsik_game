import * as THREE from 'three';

/**
 * Нутро юрты — вторая локация, а не комната.
 *
 * В задании сказано прямо: пройдя в дверь, игрок должен оказаться совсем в
 * другом месте, и ни из одного из них не должно быть видно другое. Это
 * исключает постройку интерьера там, где стоит юрта: полая оболочка на той же
 * земле протекает в обе стороны — через проём, поверх стены и сквозь туман.
 *
 * Поэтому интерьер построен далеко в мировых координатах, за пределами самого
 * рельефа, а вход — это затемнение и телепорт. Ни портальной геометрии, ни
 * второй сцены: одна сцена, два места, и связывает их только переход, сквозь
 * который не видно.
 *
 * Внутри намеренно просторнее, чем снаружи. Пятилетний читает это как волшебство,
 * а не как ошибку, — ради этого туда и стоит заходить.
 */
export const YURT_INSIDE = { x: 0, z: 200 };

/** Радиус пола. С запасом: весь смысл комнаты в том, что внутри гораздо просторнее. */
export const INSIDE_R = 13;

/**
 * Высота крыши на заданном расстоянии от оси комнаты.
 *
 * Это нужно камере. Жерди идут от верха стены к шаныраку, поэтому камера
 * следования, стоящая просто «чуть выше героя», у стены оказывается внутри
 * крыши, — а жердь в ладони от объектива это коричневая стена во весь экран,
 * ровно так первая сборка этой комнаты и выглядела.
 */
export function roofHeightAt(distanceFromAxis: number): number {
  const wallR = INSIDE_R + 0.5;
  const ringR = wallR * 0.22;
  const wallH = 4.4;
  const apex = 8.6;
  if (distanceFromAxis <= ringR) return apex;
  if (distanceFromAxis >= wallR) return wallH;
  const t = (wallR - distanceFromAxis) / (wallR - ringR);
  return wallH + (apex - wallH) * t;
}

export interface YurtInterior {
  root: THREE.Group;
  /** Три струны слева направо. У каждой есть `note`, `colour` и `lit`. */
  strings: THREE.Group[];
  /** Инструмент, которому принадлежат струны: во время песни он наклоняется и светится. */
  dombra: THREE.Group;
  hearthLight: THREE.PointLight;
  /** Пылинки в столбе света из шанырака. */
  motes: THREE.Points;
}

const FELT = 0xefe7d7;
const FELT_DARK = 0xd9cdb6;
const WOOD = 0x8a6a44;
const WOOD_DARK = 0x6a4f33;
const RED = 0xc4462f;

/** Три цвета струн, подобранные так, чтобы различаться и при дальтонизме. */
export const STRING_COLOURS = [0xf0b429, 0x2aa8d8, 0xe0524a];

function mat(color: number, roughness = 0.9) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
}

/**
 * Кереге — решётчатая стена.
 *
 * Собрана двумя перекрещенными наборами наклонных планок, а не текстурой:
 * ромбический узор — то единственное, что превращает круглую войлочную комнату в
 * юрту, а не в палатку.
 */
function buildLattice(group: THREE.Group, radius: number, height: number) {
  const slat = new THREE.BoxGeometry(0.09, height * 1.24, 0.09);
  const slatMat = mat(WOOD, 0.85);
  const N = 34;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    for (const lean of [0.32, -0.32]) {
      const m = new THREE.Mesh(slat, slatMat);
      m.position.set(Math.sin(a) * radius, height / 2, Math.cos(a) * radius);
      m.rotation.y = a;
      m.rotation.z = lean;
      group.add(m);
    }
  }
}

/**
 * Стропила — жерди крыши и шанырак, в котором они сходятся.
 *
 * Шанырак — это и дымовое отверстие, и родовой символ, поэтому основной дневной
 * свет в комнате идёт именно оттуда. Остальное смягчает тёплая заливка.
 */
function buildRoof(group: THREE.Group, radius: number, wallH: number, apex: number) {
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.09, 1, 6);
  const poleMat = mat(WOOD_DARK, 0.9);
  const ringR = radius * 0.22;
  const N = 30;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const from = new THREE.Vector3(Math.sin(a) * radius, wallH, Math.cos(a) * radius);
    const to = new THREE.Vector3(Math.sin(a) * ringR, apex, Math.cos(a) * ringR);
    const mid = from.clone().lerp(to, 0.5);
    const len = from.distanceTo(to);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.scale.y = len;
    pole.position.copy(mid);
    pole.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      to.clone().sub(from).normalize(),
    );
    group.add(pole);
  }

  // Войлочный конус на жердях, открытый на макушке.
  const cone = new THREE.Mesh(
    new THREE.CylinderGeometry(ringR + 0.15, radius + 0.2, apex - wallH, 40, 1, true),
    new THREE.MeshStandardMaterial({ color: FELT_DARK, roughness: 1, side: THREE.BackSide }),
  );
  cone.position.y = (wallH + apex) / 2;
  group.add(cone);

  // Шанырак: само кольцо со спицами.
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(ringR, 0.11, 8, 32),
    mat(WOOD, 0.8),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = apex;
  group.add(ring);
  const spoke = new THREE.CylinderGeometry(0.045, 0.045, ringR * 2, 6);
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Mesh(spoke, mat(WOOD, 0.8));
    s.rotation.z = Math.PI / 2;
    s.rotation.y = (i / 6) * Math.PI;
    s.position.y = apex;
    group.add(s);
  }

  // Свет через шанырак дают отверстие в крыше, тёплая лампа и лёгкие частицы.
  // Объёмный прозрачный конус здесь не нужен: на близкой камере он перекрывает
  // ковры и площадки большой молочной полосой.
}

/** Текемет — войлочные ковры, плоскими полосами узора по полу. */
function buildCarpets(group: THREE.Group, radius: number) {
  const ringMat = (c: number) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: 1, metalness: 0 });
  const bands: Array<[number, number, number]> = [
    [radius * 0.36, radius * 0.52, 0xb8412c],
    [radius * 0.56, radius * 0.66, 0xe2c765],
    [radius * 0.7, radius * 0.84, 0x2f6f7a],
  ];
  for (const [inner, outer, colour] of bands) {
    const band = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 48), ringMat(colour));
    band.rotation.x = -Math.PI / 2;
    band.position.y = 0.02;
    group.add(band);
  }
  // Ornament: a ring of horn-shaped motifs, the standard Kazakh «қошқар мүйіз».
  const horn = new THREE.TorusGeometry(0.32, 0.06, 6, 14, Math.PI * 1.2);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const m = new THREE.Mesh(horn, ringMat(0xf3e6c8));
    m.position.set(Math.sin(a) * radius * 0.61, 0.035, Math.cos(a) * radius * 0.61);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -a;
    group.add(m);
  }
}

/** Сундуки вдоль стены; подушки добавляются позже курпешками из Meshy. */
function buildFurnishings(group: THREE.Group, radius: number) {
  const chestGeo = new THREE.BoxGeometry(1.6, 0.95, 0.9);
  const lidGeo = new THREE.BoxGeometry(1.68, 0.16, 0.98);
  for (const a of [Math.PI * 0.78, Math.PI * 1.22]) {
    const chest = new THREE.Mesh(chestGeo, mat(0x7a4a2c, 0.85));
    chest.position.set(Math.sin(a) * (radius - 1.4), 0.48, Math.cos(a) * (radius - 1.4));
    chest.rotation.y = a;
    group.add(chest);
    const lid = new THREE.Mesh(lidGeo, mat(RED, 0.8));
    lid.position.copy(chest.position).setY(1.02);
    lid.rotation.y = a;
    group.add(lid);
  }
}

/**
 * Мягкая тёплая заливка. Раньше здесь стоял очаг и перекрывал дорогу к домбре;
 * дневного света из шанырака плюс этой лампы достаточно.
 */
function buildWarmLight(parent: THREE.Group): THREE.PointLight {
  const light = new THREE.PointLight(0xffd2a8, 1.55, 28, 2);
  light.position.set(0, 3.2, 0);
  parent.add(light);
  return light;
}

/** Процедурная полоса курпешек — работает, пока не загрузятся GLB из Meshy. */
function makeFallbackKurpeshki(colour: number): THREE.Group {
  const g = new THREE.Group();
  const matFelt = mat(colour, 0.95);
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.22, 0.85), matFelt);
  body.position.y = 0.11;
  body.castShadow = true;
  body.receiveShadow = true;
  const pipe = new THREE.Mesh(
    new THREE.BoxGeometry(2.45, 0.06, 0.9),
    mat(0xe2c765, 0.9),
  );
  pipe.position.y = 0.24;
  g.add(body, pipe);
  return g;
}

function makeFallbackPillow(colour: number): THREE.Group {
  const g = new THREE.Group();
  const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.28, 0.7), mat(colour, 0.95));
  p.position.y = 0.14;
  p.castShadow = true;
  g.add(p);
  return g;
}

export type YurtCushionTemplates = {
  kurpeshki: THREE.Object3D[];
  pillows: THREE.Object3D[];
};

/**
 * Раскладывает курпешки и подушки вдоль внутренней стены, оставляя свободной дугу
 * у двери. Шаблоны берутся из Meshy, если они есть, иначе — мягкие процедурные
 * блоки.
 */
export function dressYurtCushions(root: THREE.Group, templates?: YurtCushionTemplates | null) {
  // Убрать предыдущий проход отделки: замена процедурного на Meshy.
  const doomed: THREE.Object3D[] = [];
  for (const c of root.children) {
    if (c.userData.isYurtCushion) doomed.push(c);
  }
  for (const c of doomed) root.remove(c);

  const radius = INSIDE_R - 1.55;
  const kurpeshki = templates?.kurpeshki?.length
    ? templates.kurpeshki
    : [makeFallbackKurpeshki(0xb8412c), makeFallbackKurpeshki(0x2f6f7a)];
  const pillows = templates?.pillows?.length
    ? templates.pillows
    : [makeFallbackPillow(0xc4462f), makeFallbackPillow(0x2aa8d8)];

  // Дверь смотрит в +z: герой входит с YURT_INSIDE.z + 7. Этот сектор пропускаем.
  const doorCenter = 0;
  const N = 14;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const dAng = Math.abs(Math.atan2(Math.sin(a - doorCenter), Math.cos(a - doorCenter)));
    if (dAng < 0.55) continue;

    const tpl = kurpeshki[i % kurpeshki.length];
    const matStrip = tpl.clone(true);
    matStrip.userData.isYurtCushion = true;
    matStrip.rotation.y = a + Math.PI / 2;
    matStrip.position.set(Math.sin(a) * radius, 0, Math.cos(a) * radius);
    root.add(matStrip);

    if (i % 2 === 0) {
      const pillow = pillows[Math.floor(i / 2) % pillows.length].clone(true);
      pillow.userData.isYurtCushion = true;
      pillow.position.set(
        Math.sin(a) * (radius + 0.15),
        0.22,
        Math.cos(a) * (radius + 0.15),
      );
      pillow.rotation.y = a + Math.PI / 2;
      pillow.rotation.z = Math.sin(a) * 0.08;
      pillow.rotation.x = -Math.cos(a) * 0.12;
      root.add(pillow);
    }
  }
}

/**
 * Домбра на подставке, с тремя крупно вынесенными струнами.
 *
 * У настоящей домбры две струны. У этой три, и это намеренная неправда:
 * мини-игра — перекличка, а три — наименьшее число, при котором мелодия
 * становится мелодией, а не чередованием. Инструмент к тому же увеличен: он и
 * есть то, ради чего комната существует, и ребёнок должен видеть через всю
 * комнату, какая струна шевельнулась.
 *
 * `bodyGlb` — необязательная мягкая оболочка из Meshy; накладки струн остаются
 * процедурными, чтобы кюй по-прежнему загорался жёлтым, голубым и коралловым.
 */
export function buildDombra(strings: THREE.Group[], bodyGlb?: THREE.Object3D | null): THREE.Group {
  const g = new THREE.Group();

  if (bodyGlb) {
    const body = bodyGlb.clone(true);
    // Совпадает с прежней увеличенной моделью, чтобы струны и площадки её обрамляли.
    const box0 = new THREE.Box3().setFromObject(body);
    const size0 = box0.getSize(new THREE.Vector3());
    const targetH = 4.2;
    body.scale.multiplyScalar(targetH / Math.max(size0.y, 0.001));
    const box1 = new THREE.Box3().setFromObject(body);
    body.position.y -= box1.min.y;
    body.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    g.add(body);
  } else {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.95, 18, 14), mat(0xa9773f, 0.7));
    body.scale.set(0.78, 1.05, 0.5);
    body.position.y = 1.15;
    g.add(body);

    const soundhole = new THREE.Mesh(
      new THREE.CircleGeometry(0.2, 16),
      new THREE.MeshBasicMaterial({ color: 0x2a1c10 }),
    );
    soundhole.position.set(0, 1.35, 0.48);
    g.add(soundhole);

    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.0, 0.2), mat(0x8a6438, 0.7));
    neck.position.y = 3.3;
    g.add(neck);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.7, 0.24), mat(WOOD_DARK, 0.7));
    head.position.y = 5.0;
    g.add(head);
  }

  // Интерактивные струны: тонкие сердечники со свечением, чтобы читаться струнами
  // на корпусе из Meshy, а не тремя отдельными пастельными игрушками.
  const stringGeo = new THREE.CylinderGeometry(0.028, 0.028, 3.6, 6);
  for (let i = 0; i < 3; i++) {
    const holder = new THREE.Group();
    const colour = STRING_COLOURS[i];
    const core = new THREE.Mesh(stringGeo, new THREE.MeshStandardMaterial({
      color: colour, roughness: 0.45, emissive: colour, emissiveIntensity: 0.15,
    }));
    core.position.y = 2.9;
    holder.add(core);

    const glow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 3.6, 8),
      new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0, depthWrite: false }),
    );
    glow.position.y = 2.9;
    holder.add(glow);

    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.45, 6), mat(colour, 0.6));
    peg.rotation.z = Math.PI / 2;
    peg.position.set(0, 4.55 + i * 0.2, 0.18);
    holder.add(peg);

    holder.position.set((i - 1) * 0.22, 0, 0.22);
    holder.userData.index = i;
    holder.userData.colour = colour;
    holder.userData.core = core;
    holder.userData.glow = glow;
    holder.userData.lit = 0;
    strings.push(holder);
    g.add(holder);
  }

  const rest = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.09, 8, 20), mat(WOOD, 0.85));
  rest.rotation.x = Math.PI / 2;
  rest.position.y = 0.09;
  g.add(rest);

  return g;
}

/**
 * Три площадки, на которых игрок отвечает.
 *
 * Они намеренно отделены от инструмента. Нажать саму струну означало бы стоять
 * внутри домбры, а три интерактивных объекта в тридцати сантиметрах друг от друга
 * — не та цель, в которую ребёнок попадёт с телефона. Разложенные дугой с шагом в
 * два с половиной метра, они однозначны при едва отклонённом стике.
 */
export function buildAnswerPads(): THREE.Group[] {
  const pads: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    const colour = STRING_COLOURS[i];
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.05, 0.16, 20),
      new THREE.MeshStandardMaterial({ color: colour, roughness: 0.75, emissive: colour, emissiveIntensity: 0.12 }),
    );
    disc.position.y = 0.08;
    g.add(disc);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(1.02, 0.07, 8, 26),
      new THREE.MeshStandardMaterial({ color: 0xfff3d6, roughness: 0.6 }),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.17;
    g.add(rim);

    const halo = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.15, 0.05, 22),
      new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0, depthWrite: false }),
    );
    halo.position.y = 0.2;
    g.add(halo);

    // Столб света стоит на площадке, пока звучит её нота.
    //
    // Одного посветления самой площадки для сигнала мало: на телефоне, в тёплой
    // комнате при свете огня, диск, ставший чуть светлее, пятилетний из трёх не
    // выделит. Луч — выделит.
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.72, 1.0, 4.2, 18, 1, true),
      new THREE.MeshBasicMaterial({
        color: colour, transparent: true, opacity: 0,
        side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    beam.position.y = 2.1;
    g.add(beam);

    g.userData.index = i;
    g.userData.colour = colour;
    g.userData.disc = disc;
    g.userData.halo = halo;
    g.userData.beam = beam;
    g.userData.isStringPad = true;
    pads.push(g);
  }
  return pads;
}

/** Пыль, кружащая в столбе света. Единственное, что здесь говорит «воздух». */
function buildMotes(radius: number, apex: number): THREE.Points {
  const N = 90;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius * 0.34;
    pos[i * 3] = Math.sin(a) * r;
    pos[i * 3 + 1] = 0.4 + Math.random() * (apex - 0.8);
    pos[i * 3 + 2] = Math.cos(a) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: 0xfff1cf, size: 0.09, transparent: true, opacity: 0.5,
      depthWrite: false, sizeAttenuation: true,
    }),
  );
}

/**
 * Строит весь интерьер в точке `YURT_INSIDE`.
 *
 * Всё подвешено к одной группе: локацию можно перенести, скрыть или удалить одним
 * действием, и ничто отсюда не попадёт в обход, идущий по уличной сцене.
 */
export function buildYurtInterior(opts?: { dombraBody?: THREE.Object3D | null }): YurtInterior {
  const root = new THREE.Group();
  root.position.set(YURT_INSIDE.x, 0, YURT_INSIDE.z);

  // Для юрты высоко, но эта двадцать семь метров в поперечнике. Заодно это даёт
  // запас камере: жерди начинаются от верха стены, и камера следования на их
  // уровне получает поперёк объектива бревно.
  const wallH = 4.4;
  const apex = 8.6;

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(INSIDE_R + 0.6, 56),
    mat(0xb99a72, 1),
  );
  floor.rotation.x = -Math.PI / 2;
  root.add(floor);

  // Войлочная стена, вид изнутри.
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(INSIDE_R + 0.5, INSIDE_R + 0.5, wallH, 48, 1, true),
    new THREE.MeshStandardMaterial({ color: FELT, roughness: 1, side: THREE.BackSide }),
  );
  wall.position.y = wallH / 2;
  root.add(wall);

  buildLattice(root, INSIDE_R + 0.34, wallH);
  buildRoof(root, INSIDE_R + 0.5, wallH, apex);
  buildCarpets(root, INSIDE_R);
  buildFurnishings(root, INSIDE_R);
  // Сначала процедурные заглушки; после загрузки Level0 подменяет их курпешками из Meshy.
  dressYurtCushions(root);
  const hearthLight = buildWarmLight(root);

  const strings: THREE.Group[] = [];
  const dombra = buildDombra(strings, opts?.dombraBody ?? null);
  // Достаточно близко к площадкам, чтобы камера, строящая кадр по ним, захватывала
  // и инструмент: весь смысл круга в том, чтобы видеть, какая струна шевельнулась.
  //
  // Отклонена назад на подставке, а не поставлена прямо. В вертикальном положении
  // гриф и все три струны уходили за панель диалога, которая на телефоне постоянно
  // занимает верхнюю треть экрана: единственное, на что игрок обязан смотреть,
  // оказывалось единственным, чего он не видел. Наклонённые струны лежат в средней
  // полосе, где над ними ничего нет.
  dombra.position.set(0, 0.5, -6.4);
  dombra.rotation.set(-1.24, 0.06, 0);
  dombra.scale.setScalar(0.78);
  root.add(dombra);

  const motes = buildMotes(INSIDE_R, apex);
  root.add(motes);

  return { root, strings, dombra, hearthLight, motes };
}

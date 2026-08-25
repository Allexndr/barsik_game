import * as THREE from 'three';
import type { AvatarSocket } from './BarsikAvatar';

/**
 * Everything a child can put on Barsik.
 *
 * Built in code rather than loaded as GLBs, for three reasons that all matter
 * more than fidelity here: try-on has to be instant (a shop where each item
 * costs a download is a shop nobody browses), forty small models would add
 * megabytes to a build already at 34 MB, and a procedural item can be
 * recoloured into a whole family from one builder.
 *
 * Every item declares the socket it belongs to, so the rig decides where it
 * sits and it stays attached while the body moves.
 */

export type WardrobeCategory = 'head' | 'face' | 'neck' | 'back' | 'hands' | 'feet' | 'tail' | 'color';

export interface WardrobeItem {
  id: string;
  name: { ru: string; kk: string };
  category: WardrobeCategory;
  socket: AvatarSocket | null;
  /** Stars. Free items are the starter set every child owns. */
  cost: number;
  rarity: 'common' | 'rare' | 'epic';
  /** Builds the mesh. Absent for recolour items, which change the look instead. */
  build?: () => THREE.Object3D;
  /** Recolour items patch the avatar's palette. */
  look?: { fur?: number; hoodie?: number; trousers?: number; spots?: number };
}

const mat = (color: number, rough = 0.8, metal = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });

function grp(...objs: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  for (const o of objs) {
    o.castShadow = true;
    g.add(o);
  }
  return g;
}

// ── Builders, each parameterised so one shape makes a family ──

function cap(color: number, peak = 0xffffff): THREE.Group {
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(color));
  crown.scale.set(1, 0.75, 1);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.02, 14, 1, false, -0.9, 1.8), mat(peak));
  brim.position.set(0, 0.01, 0.14);
  brim.scale.set(1, 1, 1.5);
  return grp(crown, brim);
}

/** Brand canon tubeteika — `photos/` trio cool Barsik. */
function tubeteika(base: number, gold: number): THREE.Group {
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
    mat(base, 0.75),
  );
  dome.position.y = 0.02;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.018, 8, 20), mat(gold, 0.35, 0.55));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.02;
  const g = grp(dome, rim);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), mat(gold, 0.3, 0.7));
    jewel.position.set(Math.cos(a) * 0.12, 0.1, Math.sin(a) * 0.12);
    g.add(jewel);
  }
  return g;
}

function beanie(color: number, pom = 0xffffff): THREE.Group {
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(color, 0.95));
  body.scale.set(1, 0.85, 1);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 18), mat(color, 0.95));
  band.rotation.x = Math.PI / 2;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), mat(pom, 1));
  ball.position.y = 0.2;
  return grp(body, band, ball);
}

function tallHat(color: number, bandColor: number): THREE.Group {
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.02, 16), mat(color));
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.26, 16), mat(color));
  top.position.y = 0.14;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.163, 0.163, 0.05, 16), mat(bandColor));
  band.position.y = 0.04;
  return grp(brim, top, band);
}

function crown(color: number, gem: number): THREE.Group {
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.07, 14), mat(color, 0.3, 0.8));
  const g = grp(band);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.11, 6), mat(color, 0.3, 0.8));
    spike.position.set(Math.cos(a) * 0.15, 0.08, Math.sin(a) * 0.15);
    g.add(spike);
    const stone = new THREE.Mesh(new THREE.OctahedronGeometry(0.028), mat(gem, 0.15, 0.2));
    stone.position.set(Math.cos(a) * 0.16, 0.02, Math.sin(a) * 0.16);
    g.add(stone);
  }
  return g;
}

function earflapHat(color: number, fur: number): THREE.Group {
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(color, 0.95));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.055, 8, 18), mat(fur, 1));
  rim.rotation.x = Math.PI / 2;
  const g = grp(dome, rim);
  for (const side of [-1, 1]) {
    const flap = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), mat(fur, 1));
    flap.scale.set(0.8, 1.2, 0.7);
    flap.position.set(side * 0.19, -0.08, 0);
    g.add(flap);
  }
  return g;
}

function flowerCrown(a: number, b: number): THREE.Group {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.018, 6, 18), mat(0x5aa04a, 1));
  ring.rotation.x = Math.PI / 2;
  const g = grp(ring);
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * Math.PI * 2;
    const color = i % 2 ? a : b;
    for (let p = 0; p < 5; p++) {
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 5), mat(color, 0.85));
      const pa = (p / 5) * Math.PI * 2;
      petal.position.set(
        Math.cos(ang) * 0.18 + Math.cos(pa) * 0.028,
        0.02 + Math.sin(pa) * 0.028,
        Math.sin(ang) * 0.18,
      );
      g.add(petal);
    }
  }
  return g;
}

function glasses(frame: number, lens: number, opacity = 0.55): THREE.Group {
  const g = new THREE.Group();
  const lensMat = new THREE.MeshStandardMaterial({
    color: lens, roughness: 0.15, transparent: true, opacity,
  });
  for (const side of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.014, 6, 16), mat(frame, 0.4, 0.3));
    rim.position.set(side * 0.1, 0, 0);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.068, 16), lensMat);
    disc.position.set(side * 0.1, 0, 0.004);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.012, 0.012), mat(frame, 0.4, 0.3));
    arm.position.set(side * 0.19, 0.01, -0.06);
    arm.rotation.y = side * 0.6;
    g.add(rim, disc, arm);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.012), mat(frame, 0.4, 0.3));
  g.add(bridge);
  return g;
}

function scarf(color: number, stripe?: number): THREE.Group {
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.045, 8, 18), mat(color, 0.95));
  loop.rotation.x = Math.PI / 2;
  loop.scale.set(1, 0.85, 1);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.26, 0.045), mat(color, 0.95));
  tail.position.set(0.1, -0.16, 0.06);
  tail.rotation.z = 0.2;
  const g = grp(loop, tail);
  if (stripe !== undefined) {
    for (let i = 0; i < 2; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.035, 0.05), mat(stripe, 0.95));
      s.position.set(0.1, -0.1 - i * 0.09, 0.06);
      s.rotation.z = 0.2;
      g.add(s);
    }
  }
  return g;
}

function bowTie(color: number): THREE.Group {
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 4), mat(color, 0.7));
    wing.rotation.z = side * Math.PI / 2;
    wing.position.set(side * 0.06, 0, 0.02);
    g.add(wing);
  }
  const knot = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.05, 0.04), mat(color, 0.7));
  knot.position.z = 0.02;
  g.add(knot);
  return grp(...g.children.slice());
}

function medal(ribbon: number, disc: number): THREE.Group {
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.16, 0.02), mat(ribbon, 0.9));
  band.position.set(0, -0.06, 0.14);
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.018, 16), mat(disc, 0.25, 0.85));
  coin.rotation.x = Math.PI / 2;
  coin.position.set(0, -0.16, 0.15);
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.028), mat(0xfff3b0, 0.3, 0.5));
  star.position.set(0, -0.16, 0.17);
  return grp(band, coin, star);
}

function backpack(color: number, flap: number): THREE.Group {
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.14), mat(color, 0.9));
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.11, 0.15), mat(flap, 0.9));
  lid.position.y = 0.11;
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.02), mat(0xd9b382, 0.6, 0.3));
  buckle.position.set(0, 0.04, -0.08);
  return grp(body, lid, buckle);
}

function wings(color: number): THREE.Group {
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI), mat(color, 0.6));
    w.scale.set(0.35, 1.05, 1);
    w.position.set(side * 0.1, 0.06, -0.02);
    w.rotation.z = side * -0.35;
    w.rotation.y = side * 0.5;
    g.add(w);
  }
  return grp(...g.children.slice());
}

function balloon(color: number): THREE.Group {
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), mat(color, 0.35));
  b.scale.set(1, 1.2, 1);
  b.position.y = 0.42;
  const knot = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.05, 6), mat(color, 0.35));
  knot.position.y = 0.25;
  knot.rotation.x = Math.PI;
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.26, 4), mat(0xf0f0f0, 1));
  string.position.y = 0.12;
  return grp(b, knot, string);
}

function lollipop(a: number, b: number): THREE.Group {
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 6), mat(0xfaf3e0, 0.9));
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.03, 18), mat(a, 0.35));
  head.position.y = 0.12;
  head.rotation.x = Math.PI / 2;
  const swirl = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.016, 6, 14), mat(b, 0.35));
  swirl.position.y = 0.12;
  return grp(stick, head, swirl);
}

function iceCream(cone: number, scoopA: number, scoopB: number): THREE.Group {
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 10), mat(cone, 0.9));
  c.rotation.x = Math.PI;
  const s1 = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), mat(scoopA, 0.7));
  s1.position.y = 0.1;
  const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mat(scoopB, 0.7));
  s2.position.y = 0.18;
  return grp(c, s1, s2);
}

function ball(a: number, b: number): THREE.Group {
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 12), mat(a, 0.6));
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 8, 18), mat(b, 0.6));
  stripe.rotation.y = Math.PI / 2;
  return grp(s, stripe);
}

function flagProp(color: number): THREE.Group {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6), mat(0xb08a5a, 0.9));
  pole.position.y = 0.16;
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.14), new THREE.MeshStandardMaterial({
    color, roughness: 0.85, side: THREE.DoubleSide,
  }));
  cloth.position.set(0.11, 0.3, 0);
  return grp(pole, cloth);
}

function mittens(color: number): THREE.Group {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), mat(color, 0.95));
  m.scale.set(1, 1.15, 1);
  const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), mat(color, 0.95));
  thumb.position.set(0.07, -0.02, 0.03);
  return grp(m, thumb);
}

function boots(color: number, sole: number): THREE.Group {
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.13, 0.2), mat(color, 0.85));
  b.position.z = 0.02;
  const s = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.04, 0.22), mat(sole, 0.9));
  s.position.set(0, -0.07, 0.02);
  return grp(b, s);
}

function skates(color: number): THREE.Group {
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.14, 0.19), mat(color, 0.7));
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.26), mat(0xdfe6ec, 0.2, 0.9));
  blade.position.y = -0.09;
  return grp(b, blade);
}

function tailBow(color: number): THREE.Group {
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.016, 6, 12), mat(color, 0.8));
    loop.position.x = side * 0.045;
    loop.rotation.y = Math.PI / 2;
    g.add(loop);
  }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), mat(color, 0.8));
  g.add(knot);
  return grp(...g.children.slice());
}

function headphones(cup: number, band: number): THREE.Group {
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.022, 8, 18, Math.PI), mat(band, 0.5));
  arc.rotation.y = Math.PI / 2;
  const g = grp(arc);
  for (const side of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 14), mat(cup, 0.5));
    c.rotation.z = Math.PI / 2;
    c.position.set(side * 0.2, 0, 0);
    g.add(c);
  }
  return g;
}

function partyHat(a: number, b: number): THREE.Group {
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 14), mat(a, 0.7));
  cone.position.y = 0.13;
  const g = grp(cone);
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1 - i * 0.03, 0.012, 6, 14), mat(b, 0.7));
    ring.position.y = 0.05 + i * 0.08;
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
  }
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), mat(b, 1));
  pom.position.y = 0.29;
  g.add(pom);
  return g;
}

/**
 * The catalogue. Forty items across eight slots, priced so the first few are
 * reachable after a level or two and the epics are a season-long goal.
 */
export const WARDROBE: WardrobeItem[] = [
  // ── Head ────────────────────────────────────────────────
  { id: 'cap_green', name: { ru: 'Зелёная кепка', kk: 'Жасыл кепка' }, category: 'head', socket: 'head', cost: 0, rarity: 'common', build: () => cap(0x3dcc6e, 0x2fae5b) },
  { id: 'cap_red', name: { ru: 'Красная кепка', kk: 'Қызыл кепка' }, category: 'head', socket: 'head', cost: 12, rarity: 'common', build: () => cap(0xe74c3c, 0xc0392b) },
  /** Brand canon (`photos/` trio): blue tubeteika with gold trim — free starter. */
  { id: 'tubeteika_blue', name: { ru: 'Тюбетейка', kk: 'Төбетей' }, category: 'head', socket: 'head', cost: 0, rarity: 'common', build: () => tubeteika(0x1a3a6e, 0xf0d24a) },
  { id: 'cap_blue', name: { ru: 'Синяя кепка', kk: 'Көк кепка' }, category: 'head', socket: 'head', cost: 12, rarity: 'common', build: () => cap(0x4a90d9, 0x2e6fb0) },
  { id: 'beanie_yellow', name: { ru: 'Жёлтая шапочка', kk: 'Сары бөрік' }, category: 'head', socket: 'head', cost: 18, rarity: 'common', build: () => beanie(0xf1c40f, 0xfff3b0) },
  { id: 'beanie_pink', name: { ru: 'Розовая шапочка', kk: 'Қызғылт бөрік' }, category: 'head', socket: 'head', cost: 18, rarity: 'common', build: () => beanie(0xfd79a8, 0xffe0ee) },
  { id: 'ushanka', name: { ru: 'Ушанка', kk: 'Құлақшын' }, category: 'head', socket: 'head', cost: 35, rarity: 'rare', build: () => earflapHat(0x6d4c41, 0xd7ccc8) },
  { id: 'tophat', name: { ru: 'Цилиндр', kk: 'Цилиндр' }, category: 'head', socket: 'head', cost: 45, rarity: 'rare', build: () => tallHat(0x2d3436, 0xe74c3c) },
  { id: 'party_hat', name: { ru: 'Праздничный колпак', kk: 'Мерекелік қалпақ' }, category: 'head', socket: 'head', cost: 22, rarity: 'common', build: () => partyHat(0xa29bfe, 0xffeaa7) },
  { id: 'flower_crown', name: { ru: 'Венок из цветов', kk: 'Гүл тәжі' }, category: 'head', socket: 'head', cost: 40, rarity: 'rare', build: () => flowerCrown(0xfd79a8, 0xffeaa7) },
  { id: 'headphones', name: { ru: 'Наушники', kk: 'Құлаққап' }, category: 'head', socket: 'head', cost: 38, rarity: 'rare', build: () => headphones(0xe74c3c, 0x2d3436) },
  { id: 'crown_gold', name: { ru: 'Золотая корона', kk: 'Алтын тәж' }, category: 'head', socket: 'head', cost: 120, rarity: 'epic', build: () => crown(0xf1c40f, 0x74b9ff) },

  // ── Face ────────────────────────────────────────────────
  { id: 'glasses_yellow', name: { ru: 'Жёлтые очки', kk: 'Сары көзілдірік' }, category: 'face', socket: 'face', cost: 0, rarity: 'common', build: () => glasses(0xf1c40f, 0xfff8d0, 0.4) },
  { id: 'glasses_round', name: { ru: 'Круглые очки', kk: 'Дөңгелек көзілдірік' }, category: 'face', socket: 'face', cost: 20, rarity: 'common', build: () => glasses(0xb0834a, 0xeaf6ff, 0.3) },
  { id: 'sunglasses', name: { ru: 'Тёмные очки', kk: 'Қара көзілдірік' }, category: 'face', socket: 'face', cost: 30, rarity: 'rare', build: () => glasses(0x2d3436, 0x1e272e, 0.85) },
  { id: 'glasses_star', name: { ru: 'Звёздные очки', kk: 'Жұлдызды көзілдірік' }, category: 'face', socket: 'face', cost: 55, rarity: 'epic', build: () => glasses(0xfd79a8, 0xffd6f0, 0.5) },

  // ── Neck ────────────────────────────────────────────────
  { id: 'scarf_red', name: { ru: 'Красный шарф', kk: 'Қызыл орамал' }, category: 'neck', socket: 'neck', cost: 15, rarity: 'common', build: () => scarf(0xe74c3c) },
  { id: 'scarf_blue', name: { ru: 'Синий шарф', kk: 'Көк орамал' }, category: 'neck', socket: 'neck', cost: 15, rarity: 'common', build: () => scarf(0x4a90d9, 0xffffff) },
  { id: 'scarf_stripe', name: { ru: 'Полосатый шарф', kk: 'Жолақты орамал' }, category: 'neck', socket: 'neck', cost: 28, rarity: 'common', build: () => scarf(0x2ecc71, 0xf1c40f) },
  { id: 'bowtie', name: { ru: 'Бабочка', kk: 'Көбелек галстук' }, category: 'neck', socket: 'neck', cost: 25, rarity: 'common', build: () => bowTie(0xe84393) },
  { id: 'medal_gold', name: { ru: 'Золотая медаль', kk: 'Алтын медаль' }, category: 'neck', socket: 'neck', cost: 90, rarity: 'epic', build: () => medal(0x4a90d9, 0xf1c40f) },

  // ── Back ────────────────────────────────────────────────
  { id: 'backpack_green', name: { ru: 'Зелёный рюкзак', kk: 'Жасыл рюкзак' }, category: 'back', socket: 'back', cost: 30, rarity: 'common', build: () => backpack(0x2ecc71, 0x27ae60) },
  { id: 'backpack_orange', name: { ru: 'Оранжевый рюкзак', kk: 'Қызғылт сары рюкзак' }, category: 'back', socket: 'back', cost: 30, rarity: 'common', build: () => backpack(0xe67e22, 0xd35400) },
  { id: 'wings_white', name: { ru: 'Белые крылья', kk: 'Ақ қанаттар' }, category: 'back', socket: 'back', cost: 110, rarity: 'epic', build: () => wings(0xfdfdfd) },
  { id: 'wings_rainbow', name: { ru: 'Радужные крылья', kk: 'Кемпірқосақ қанаттар' }, category: 'back', socket: 'back', cost: 150, rarity: 'epic', build: () => wings(0xa29bfe) },
  { id: 'balloon_red', name: { ru: 'Красный шарик', kk: 'Қызыл шар' }, category: 'back', socket: 'back', cost: 24, rarity: 'common', build: () => balloon(0xe74c3c) },
  { id: 'balloon_blue', name: { ru: 'Синий шарик', kk: 'Көк шар' }, category: 'back', socket: 'back', cost: 24, rarity: 'common', build: () => balloon(0x74b9ff) },

  // ── Hands ───────────────────────────────────────────────
  { id: 'lollipop', name: { ru: 'Леденец', kk: 'Кәмпит' }, category: 'hands', socket: 'handR', cost: 10, rarity: 'common', build: () => lollipop(0xe84393, 0xffffff) },
  { id: 'lollipop_lime', name: { ru: 'Лаймовый леденец', kk: 'Лайм кәмпит' }, category: 'hands', socket: 'handR', cost: 10, rarity: 'common', build: () => lollipop(0x9ee493, 0xffffff) },
  { id: 'icecream', name: { ru: 'Мороженое', kk: 'Балмұздақ' }, category: 'hands', socket: 'handR', cost: 20, rarity: 'common', build: () => iceCream(0xd2a24c, 0xfff0f5, 0xffb7c5) },
  { id: 'ball', name: { ru: 'Мячик', kk: 'Доп' }, category: 'hands', socket: 'handR', cost: 16, rarity: 'common', build: () => ball(0xe74c3c, 0xffffff) },
  { id: 'flag_kz', name: { ru: 'Флажок', kk: 'Жалауша' }, category: 'hands', socket: 'handR', cost: 26, rarity: 'common', build: () => flagProp(0x00afca) },
  { id: 'mittens_red', name: { ru: 'Варежки', kk: 'Биялай' }, category: 'hands', socket: 'handL', cost: 18, rarity: 'common', build: () => mittens(0xe74c3c) },
  { id: 'mittens_blue', name: { ru: 'Синие варежки', kk: 'Көк биялай' }, category: 'hands', socket: 'handL', cost: 18, rarity: 'common', build: () => mittens(0x4a90d9) },

  // ── Feet ────────────────────────────────────────────────
  { id: 'boots_brown', name: { ru: 'Ботинки', kk: 'Бәтеңке' }, category: 'feet', socket: 'footL', cost: 28, rarity: 'common', build: () => boots(0x8a5a2b, 0x4e342e) },
  { id: 'sneakers_white', name: { ru: 'Кроссовки', kk: 'Кроссовка' }, category: 'feet', socket: 'footL', cost: 34, rarity: 'common', build: () => boots(0xf5f5f5, 0xe74c3c) },
  { id: 'skates', name: { ru: 'Коньки', kk: 'Коньки' }, category: 'feet', socket: 'footL', cost: 70, rarity: 'rare', build: () => skates(0x4a90d9) },

  // ── Tail ────────────────────────────────────────────────
  { id: 'tail_bow_pink', name: { ru: 'Бантик на хвост', kk: 'Құйрыққа бантик' }, category: 'tail', socket: 'tail', cost: 14, rarity: 'common', build: () => tailBow(0xfd79a8) },
  { id: 'tail_bow_gold', name: { ru: 'Золотой бантик', kk: 'Алтын бантик' }, category: 'tail', socket: 'tail', cost: 48, rarity: 'rare', build: () => tailBow(0xf1c40f) },

  // ── Colours ─────────────────────────────────────────────
  // Recolours rather than meshes: the same rig, a different Barsik.
  { id: 'hoodie_purple', name: { ru: 'Фиолетовая толстовка', kk: 'Күлгін толстовка' }, category: 'color', socket: null, cost: 22, rarity: 'common', look: { hoodie: 0xa29bfe } },
  { id: 'hoodie_orange', name: { ru: 'Оранжевая толстовка', kk: 'Қызғылт сары толстовка' }, category: 'color', socket: null, cost: 22, rarity: 'common', look: { hoodie: 0xe67e22 } },
  { id: 'hoodie_pink', name: { ru: 'Розовая толстовка', kk: 'Қызғылт толстовка' }, category: 'color', socket: null, cost: 22, rarity: 'common', look: { hoodie: 0xfd79a8 } },
  { id: 'fur_snow', name: { ru: 'Снежная шубка', kk: 'Қарлы жүн' }, category: 'color', socket: null, cost: 60, rarity: 'rare', look: { fur: 0xffffff, spots: 0xbcd3e6 } },
  { id: 'fur_sand', name: { ru: 'Песочная шубка', kk: 'Құмды жүн' }, category: 'color', socket: null, cost: 60, rarity: 'rare', look: { fur: 0xf0d9b5, spots: 0xb08a5a } },
  { id: 'fur_night', name: { ru: 'Ночная шубка', kk: 'Түнгі жүн' }, category: 'color', socket: null, cost: 140, rarity: 'epic', look: { fur: 0x6c7a9c, spots: 0x2d3550 } },
];

export const WARDROBE_BY_ID = new Map(WARDROBE.map((i) => [i.id, i]));

export const CATEGORY_LABEL: Record<WardrobeCategory, { ru: string; kk: string }> = {
  head: { ru: 'Голова', kk: 'Бас' },
  face: { ru: 'Очки', kk: 'Көзілдірік' },
  neck: { ru: 'Шея', kk: 'Мойын' },
  back: { ru: 'Спина', kk: 'Арқа' },
  hands: { ru: 'В лапах', kk: 'Табанда' },
  feet: { ru: 'Обувь', kk: 'Аяқкиім' },
  tail: { ru: 'Хвост', kk: 'Құйрық' },
  color: { ru: 'Цвета', kk: 'Түстер' },
};

/** Items that take both feet, so the pair is applied together. */
export const PAIRED_FEET = new Set(['boots_brown', 'sneakers_white', 'skates']);
export const PAIRED_HANDS = new Set(['mittens_red', 'mittens_blue']);

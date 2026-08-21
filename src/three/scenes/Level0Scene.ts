import * as THREE from 'three';
import {
  BaseLevelScene,
  type BaseHud,
  spawnPad,
  butterfly,
  bush,
  tulip,
  loadPropModel,
  loadCharModel,
  mountain,
} from './BaseLevelScene';
import { AudioManager } from '@/audio/AudioManager';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { placeAmbientCritters } from '../s1Place';
import { createRiverWater, type RiverWater } from '../RiverWater';
import { CAST_PROP_GLB } from '../castModels';
import {
  buildYurtInterior,
  buildAnswerPads,
  YURT_INSIDE,
  INSIDE_R,
  roofHeightAt,
  type YurtInterior,
} from './level0/yurtInterior';

/**
 * Level 0 «Тропа домбры» — the first three minutes of the game.
 *
 * This replaces «Первое утро» outright. Nothing of that level survives: not
 * waking up in bed, not the apple that falls and rolls away, not chasing it,
 * not picking fruit off branches, not the bird, and not the gardener's
 * fetch-three-apples errand. Those were one verb — walk up to a thing and
 * press — dressed four different ways, and the first level of a game is the
 * one place that cannot afford to be a tutorial with a story stapled on.
 *
 * ── What this level is about ─────────────────────────────────────────────
 *
 * Barsik is a snow leopard cub. Snow leopards live up in the mountains, and
 * the whole season ends by going back there — so the interesting fact about
 * him on his first morning is that **he does not belong here yet**. He is a
 * mountain animal standing in a fruit forest at the bottom of the world.
 *
 * A night wind has been through the forest. Somewhere ahead a dombra is
 * playing, and the melody keeps breaking off. Following it is the level.
 * Each time the music stops, the wind has done something that Barsik can put
 * right, and each thing he puts right teaches exactly one control:
 *
 *   1. `follow`   — the dombra is the only thing telling you where to go, and
 *                   it gets louder as you close. Teaches: move, and that this
 *                   world answers being looked at and listened to.
 *   2. `lanterns` — the wind blew the path lanterns over. Stand three back up
 *                   and the path lights itself. Teaches: interact. It is
 *                   deliberately not collecting — nothing goes in a bag, the
 *                   world just gets better.
 *   3. `crossing` — the stream came up in the night. Stepping stones.
 *                   Teaches: jump, with a real consequence and no failure —
 *                   a miss is a splash, a shake, and a climb back out.
 *   4. `mend`     — the yurt's felt has torn loose and is flapping. Peg it
 *                   down. Teaches: that the point of this game is doing
 *                   something for someone else.
 *
 * Then the dombra plays whole for the first time, the gardener looks up at
 * the mountains and names them, and the season has a destination.
 *
 * No fail state anywhere, per canon: a mistake is a thing you learn from.
 *
 * ── Why it is built on BaseLevelScene ────────────────────────────────────
 *
 * The old Mission 0 was 2 405 lines carrying private copies of `bush`,
 * `tulip`, `spawnPad`, `pathArrow`, `groundY` and even its own `loadGlb` —
 * which is why every sweeping repair this season had to be applied to it
 * twice, and why it kept being the level that still had the bug. It shares
 * the base class now, like the other sixteen.
 */

// ── Layout ────────────────────────────────────────────────────────────────
// A single walk from the forest edge to the yurt, bending twice so the
// destination is never visible from the start — the dombra has to be worth
// following. Roughly 150 m of path with the beats spaced along it.
const SPAWN_Z = 20;
const YURT = { x: 2, z: -46 };
/**
 * How far back toward the mountains the player may walk. The story has
 * Barsik coming down from the peaks, so the corridor does not just fade out
 * behind the spawn point — it runs into the range he climbed down from.
 * Twelve metres past spawn is enough room to turn around and look up at it.
 */
const BACK_WALL_Z = SPAWN_Z + 12;
/** The path's centre line. Two gentle bends, no switchbacks a child can lose. */
function routeX(z: number) {
  return Math.sin((z - SPAWN_Z) * 0.045) * 5.2;
}

/**
 * The three fallen lanterns, each a little further off the path than the
 * last so that the second and third are found by looking rather than by
 * walking in a straight line.
 */
const LANTERNS: Array<{ x: number; z: number; rotZ: number }> = [
  { x: routeX(8) + 2.2, z: 8, rotZ: 1.35 },
  { x: routeX(-2) - 3.4, z: -2, rotZ: -1.5 },
  { x: routeX(-13) + 4.1, z: -13, rotZ: 1.2 },
];

/**
 * Everything about the crossing is placed relative to `routeX(z)`.
 *
 * An earlier version centred the bed, the water and the reserve on x = 0 while
 * the path at that z is at −4.9, so the river ran alongside the road instead
 * of across it and the walk had no crossing in it at all.
 */

/**
 * The crossing, as an actual platforming section.
 *
 * The first version was four stones over seven metres — three hops and it was
 * behind you. The brief is a real bit of difficulty you spend half a minute
 * on, so the stream is a long bend rather than a strip: twelve stones over
 * thirty metres of water, with the gaps growing, a couple of stones that sink
 * under you if you dawdle, and a checkpoint on the near bank.
 *
 * `sink` marks a stone that starts dropping the moment it takes weight. It is
 * the only pressure in the level and it is gentle: you get about a second and
 * a half, and it floats back up once you are off it, so a child who freezes
 * loses nothing but the hop.
 */
const CROSSING_FROM = -14;
// Ends well short of the yurt. At -44 the far shore came out a metre from the
// door, so there was no bank to land on — you crossed a river straight into a
// wall of felt. The beach between is where the level lets you breathe.
const CROSSING_TO = -40;

/** Pad radius. Wide on purpose: a five-year-old aims for the stone, not for a point. */
const STONE_R = 1.35;

/**
 * Laid out by marching an S-curve at a fixed *chord* — every hop is 3.30 m
 * centre to centre, so no stone is harder than any other.
 *
 * The first version was hand-typed, and two of its gaps (4.36 m and 4.32 m)
 * were beyond the hero's reach entirely: a 5.4 m/s jump under 12.2 m/s²
 * gravity is 0.885 s of air, which at walking speed carries 2.83 m. Nobody
 * could have crossed it. Spacing is generated and checked now — see
 * `assertCrossingIsJumpable`.
 *
 * With a 1.35 m pad at each end, the real ask is 3.10 − 1.35 = 1.75 m against
 * 2.83 m of reach: 62% of margin, and 0.40 m of open water still shows
 * between pads, so it reads as a jump rather than a walkway.
 */
const STONES: Array<{ x: number; z: number; sink?: boolean }> = [
  // Pulled in to the shore so the first hop is the easiest one, not the
  // hardest: at z −16 the step off the bank was 2.44 m of the 2.83 m reach.
  { x: 1.25, z: -15.2 },
  { x: 2.24, z: -18.1 },
  { x: 0.18, z: -20.5 },
  { x: -2.57, z: -22.1, sink: true },
  { x: -0.15, z: -23.9 },
  { x: 2.33, z: -25.5 },
  { x: -0.24, z: -27.5, sink: true },
  { x: -1.16, z: -30.6 },
  { x: 1.21, z: -32.2 },
  { x: -0.33, z: -35.2, sink: true },
  { x: -0.06, z: -38.1 },
  // The exit stone, placed against the shore the terrain actually built
  // rather than against CROSSING_TO. Without it the last hop was 3.60 m.
  { x: 1.5, z: -40.4 },
];

/** Loose felt panels round the yurt. Three, spread so mending is a lap. */
const PEGS: Array<{ x: number; z: number }> = [
  { x: YURT.x - 3.1, z: YURT.z + 1.6 },
  { x: YURT.x + 3.0, z: YURT.z + 1.9 },
  { x: YURT.x + 0.4, z: YURT.z - 3.2 },
];

export type L0Phase =
  | 'intro'
  | 'follow'
  | 'lanterns'
  | 'crossing'
  | 'mend'
  /** Walk to the door. The last beat outdoors. */
  | 'enter'
  /** The second location: inside the yurt, playing the kui back. */
  | 'inside'
  | 'song'
  | 'outro';

export interface L0Hud extends BaseHud {
  lanternsUp: number;
  lanternsTotal: number;
  pegsDone: number;
  pegsTotal: number;
  /** 0…1, how close the dombra sounds. Drives the HUD's listening meter. */
  nearness: number;
  wet: boolean;
  /** 0…1 blackout, driven by the scene so the two locations never cross-fade. */
  fade: number;
  /** Which round of the kui, and how many there are. */
  kuiRound: number;
  kuiTotal: number;
  /** True while the dombra is playing the phrase — the player should listen, not press. */
  kuiListening: boolean;
  /** How much of the current phrase has been echoed back correctly. */
  kuiEchoed: number;
  kuiLength: number;
}

/**
 * A dombra: pear body, long neck, two strings.
 *
 * Built rather than loaded because there is no dombra in the asset library
 * and it is the one object in the level that has to be recognisable to a
 * child in Kazakhstan. Two strings, not six — that is what makes it a dombra
 * and not a generic guitar.
 */
function makeDombra(): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0xb07a42, roughness: 0.75 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x6f4a26, roughness: 0.8 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), wood);
  body.scale.set(1, 1.18, 0.62);
  body.position.y = 0.22;

  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.92, 0.06), wood);
  neck.position.y = 0.86;

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.07), darkWood);
  head.position.y = 1.36;

  const rose = new THREE.Mesh(new THREE.CircleGeometry(0.062, 14), darkWood);
  rose.position.set(0, 0.28, 0.135);

  g.add(body, neck, head, rose);
  for (const dx of [-0.018, 0.018]) {
    const string = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0045, 0.0045, 1.24, 3),
      new THREE.MeshStandardMaterial({ color: 0xf3e7cf, roughness: 0.5 }),
    );
    string.position.set(dx, 0.78, 0.075);
    g.add(string);
  }
  return g;
}

/**
 * Cheap deterministic value noise — enough to break a flat felt colour into
 * something hand-dyed, not a real Perlin field and not worth one.
 */
function feltHash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Bakes mottled vertex colour onto felt geometry — the same "paint the
 * geometry, don't texture it" idiom the flowers use, aimed at a different
 * problem: the yurt read as a flat-shaded cylinder because it *was* one
 * colour, not because it was low-poly.
 */
function paintFelt(geo: THREE.BufferGeometry, base: THREE.Color, vary: THREE.Color, freq: number) {
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = feltHash(x * freq, z * freq) * 0.65 + feltHash(y * freq * 1.6, x * freq * 0.8) * 0.35;
    c.copy(base).lerp(vary, t);
    colours[i * 3] = c.r;
    colours[i * 3 + 1] = c.g;
    colours[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return geo;
}

/**
 * A yurt, in the game's plush idiom: a felt drum with a domed roof, a red
 * door frame and a shanyrak — the wheel at the crown, which is the shape on
 * the flag and the one detail that must not be got wrong.
 *
 * The first version was a cylinder, a cone and a black box for the door —
 * correct silhouette, nothing a child would call a home. This pass does not
 * change that silhouette; it adds the things that make felt read as felt
 * (mottled colour, not flat), a structure read at the door (posts, not a
 * frame floating on the wall), and the one cue that was actively wrong: the
 * doorway was a hole, and a lived-in yurt is warm inside before you reach it.
 */
function makeYurt(): THREE.Group {
  const g = new THREE.Group();
  const trim = new THREE.MeshStandardMaterial({ color: 0xc4462f, roughness: 0.8 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x9c6b3c, roughness: 0.85 });
  const feltMat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.92, color: 0xffffff,
  });
  const CREAM = new THREE.Color(0xf1ece0);
  const TAN = new THREE.Color(0xd9c9a3);

  const wallGeo = paintFelt(new THREE.CylinderGeometry(2.9, 3.0, 1.9, 22, 3), CREAM, TAN, 0.55);
  const wall = new THREE.Mesh(wallGeo, feltMat);
  wall.position.y = 0.95;
  wall.castShadow = true;

  const roofGeo = paintFelt(new THREE.ConeGeometry(3.05, 1.7, 22, 3), CREAM, TAN, 0.5);
  const roof = new THREE.Mesh(roofGeo, feltMat);
  roof.position.y = 2.72;
  roof.castShadow = true;

  // A reinforced base course — every real yurt has one, and it is what was
  // missing from the ground contact: without it the wall looked pinned to
  // the grass rather than standing on it.
  const baseBand = new THREE.Mesh(
    new THREE.CylinderGeometry(3.03, 3.1, 0.34, 22),
    new THREE.MeshStandardMaterial({ color: 0x8a6a3e, roughness: 0.95 }),
  );
  baseBand.position.y = 0.17;
  baseBand.castShadow = true;

  // Panel seams. Felt yurts are built from tied sections, not poured as one
  // shell — a handful of vertical rope-lines is what tells a child that,
  // without needing a tutorial popup to say so.
  const seamMat = new THREE.MeshStandardMaterial({ color: 0xb98f52, roughness: 0.9 });
  const seamCount = 9;
  for (let i = 0; i < seamCount; i++) {
    const a = (i / seamCount) * Math.PI * 2 + 0.18;
    if (Math.abs(Math.sin(a)) < 0.32 && Math.cos(a) > 0) continue; // leave the door face clear
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.045, 1.86, 0.05), seamMat);
    seam.position.set(Math.sin(a) * 2.95, 0.95, Math.cos(a) * 2.95);
    seam.rotation.y = a;
    g.add(seam);
  }

  // A mended patch, off to one side. Quiet continuity with the level's own
  // beat — the gardener fixes torn felt for a living, so his own home
  // should show one repair, not just be the place repairs happen.
  const patch = new THREE.Mesh(
    new THREE.PlaneGeometry(0.52, 0.4, 2, 2),
    new THREE.MeshStandardMaterial({ color: 0xe9dfc8, roughness: 0.95, side: THREE.DoubleSide }),
  );
  const patchA = 2.35;
  patch.position.set(Math.sin(patchA) * 2.93, 1.12, Math.cos(patchA) * 2.93);
  patch.rotation.y = patchA + Math.PI;
  patch.rotation.z = 0.06;

  const shanyrak = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.09, 8, 16), wood);
  shanyrak.rotation.x = Math.PI / 2;
  shanyrak.position.y = 3.52;
  for (let i = 0; i < 4; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.86, 5), wood);
    spoke.rotation.set(Math.PI / 2, 0, (i / 4) * Math.PI);
    spoke.position.y = 3.52;
    g.add(spoke);
  }

  // A soft, static smoke wisp over the shanyrak — three stretched, fading
  // blobs rather than a particle system, because a lived-in home has a fire
  // in it and a silhouette-only hearth does not say so from outside.
  const smokeMat = new THREE.MeshBasicMaterial({
    color: 0xf3f0ea, transparent: true, opacity: 0.32, depthWrite: false,
  });
  for (let i = 0; i < 3; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.22 + i * 0.1, 8, 6), smokeMat);
    puff.position.set(i * 0.05, 3.85 + i * 0.42, i * -0.03);
    puff.scale.set(1, 1.3, 1);
    g.add(puff);
  }

  // A band of ornament at the eaves. Kept to a simple repeating diamond —
  // the brief asks for Kazakh pattern used delicately, not a museum piece.
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.13), trim);
    d.scale.set(1, 1.5, 0.35);
    d.position.set(Math.sin(a) * 2.98, 1.78, Math.cos(a) * 2.98);
    d.rotation.y = a;
    g.add(d);
  }

  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.65, 0.16), trim);
  doorFrame.position.set(0, 0.82, 2.94);

  // Wood corner posts, so the frame reads as built rather than painted onto
  // the wall. Real ones carry the door's weight; these just need to look
  // like they could.
  const postGeo = new THREE.CylinderGeometry(0.075, 0.09, 1.72, 6);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(postGeo, wood);
    post.position.set(side * 0.64, 0.86, 2.98);
    g.add(post);
  }

  // The one thing that was actively wrong, not just plain: a black hole
  // read as broken, not as an unlit room. Warm and emissive, the same
  // "lit from within" trick the lanterns use once struck.
  const doorway = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 1.35, 0.1),
    new THREE.MeshStandardMaterial({
      color: 0xffcf8a, emissive: 0xffb347, emissiveIntensity: 0.8, roughness: 0.6,
    }),
  );
  doorway.position.set(0, 0.72, 3.02);

  g.add(wall, roof, baseBand, patch, shanyrak, doorFrame, doorway);
  return g;
}

/**
 * A fallen boulder at the foot of the mountains behind spawn — the close-up
 * read that says "rock", where `mountain()` is deliberately a distant-ridge
 * silhouette. Built from two offset lumps rather than one dodecahedron so
 * three or four in a cluster do not read as the same die at different sizes.
 */
function boulder(x: number, z: number, scale: number, groundY: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x7d8c95, roughness: 0.97, flatShading: true });
  const a = new THREE.Mesh(new THREE.DodecahedronGeometry(scale), mat);
  a.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  a.position.y = scale * 0.62;
  const b = new THREE.Mesh(new THREE.DodecahedronGeometry(scale * 0.62), mat);
  b.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  b.position.set(scale * 0.55, scale * 0.4, scale * 0.2);
  g.add(a, b);
  g.castShadow = true;
  g.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
  g.position.set(x, groundY, z);
  return g;
}

/**
 * A wooden tent peg: tapered shaft driven in at a slight angle, a rounded
 * head standing proud of the felt. The single 6-sided cone this replaced
 * read as a flat sliver at gameplay camera distance — barely a peg at all,
 * just a dark triangle on the panel.
 */
function makePeg(): THREE.Group {
  const g = new THREE.Group();
  // Втрое толще и вдвое выше прежнего. С игровой камеры в девяти метрах
  // колышек радиусом 4.5 см — это волосок: ребёнок не видит предмет, которым
  // ему предлагают что-то сделать.
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.055, 0.95, 8),
    new THREE.MeshStandardMaterial({ color: 0x9c6a38, roughness: 0.85 }),
  );
  shaft.position.y = 0.47;
  shaft.castShadow = true;
  // Насечки на древке — по ним видно, что это струганое дерево, а не палка.
  const notchMat = new THREE.MeshStandardMaterial({ color: 0x7a4f26, roughness: 0.9 });
  for (const y of [0.3, 0.55]) {
    const notch = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.016, 5, 12), notchMat);
    notch.rotation.x = Math.PI / 2;
    notch.position.y = y;
    g.add(notch);
  }
  const head = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.17, 0.16, 8),
    new THREE.MeshStandardMaterial({ color: 0x6b431f, roughness: 0.75 }),
  );
  head.position.y = 1.0;
  head.castShadow = true;
  g.add(shaft, head);
  g.rotation.z = 0.14;
  return g;
}

/**
 * One loose felt panel with its peg. Flapping while loose, still once pegged
 * — the animation is the whole read: a child sees which ones still need
 * doing without being told a number.
 */
function makeFeltPanel(): THREE.Group {
  const g = new THREE.Group();
  const felt = new THREE.MeshStandardMaterial({
    color: 0xe9e2d2, roughness: 0.95, side: THREE.DoubleSide,
  });

  // Войлок, а не карточка.
  //
  // Здесь стояла `PlaneGeometry` без поворота — то есть плоский прямоугольник
  // СТОЙМЯ на траве, ровно как игральная карта. Толщины нет, тени по кромке
  // нет, лежать он не лежит: узнать в нём кусок войлока невозможно.
  //
  // Теперь это отвернувшийся край кошмы: коробка с толщиной, наклонённая от
  // земли, и завёрнутый уголок сверху. Силуэт сразу читается как «тряпка
  // отошла и хлопает», а хлопанье в `loop` наконец имеет что колыхать.
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.07, 1.35), felt);
  panel.position.set(0, 0.42, -0.28);
  panel.rotation.x = -0.62;
  panel.castShadow = true;
  panel.receiveShadow = true;

  const curl = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.5), felt);
  curl.position.set(0, 0.92, -0.72);
  curl.rotation.x = 0.55;
  curl.castShadow = true;

  // Прижимной ремешок: по нему видно, куда именно бить колышком.
  const strap = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.05, 1.0),
    new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.9 }),
  );
  strap.position.set(0, 0.3, -0.1);
  strap.rotation.x = -0.62;

  // Колышек лежит рядом с самого начала.
  //
  // Он был `visible = false` до починки: ребёнку предлагалось «приколоть»
  // предмет, которого он ни разу не видел. Теперь колышек лежит на траве
  // рядом с заплатой, а после починки встаёт в неё стоймя.
  const peg = makePeg();
  peg.position.set(0.62, 0.13, 0.42);
  peg.rotation.set(0, 0.5, Math.PI / 2 - 0.1);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.8, 1.16, 24),
    new THREE.MeshBasicMaterial({ color: 0xf0d24a, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;

  g.add(panel, curl, strap, peg, ring);
  g.userData.panel = panel;
  g.userData.curl = curl;
  g.userData.peg = peg;
  g.userData.ring = ring;
  return g;
}

export class Level0Scene extends BaseLevelScene {
  private phase: L0Phase = 'intro';
  private onHud: ((h: L0Hud) => void) | null = null;
  private introI = 0;
  private nextAt = 0;

  private lanterns: THREE.Object3D[] = [];
  private lanternsUp = 0;
  private readonly lanternsTotal = 3;

  private stones: THREE.Object3D[] = [];
  /** Surface height of the river, derived from the banks the terrain built. */
  private waterY = 0;
  private river: RiverWater | null = null;

  // ── The second location ──────────────────────────────────────
  private interior: YurtInterior | null = null;
  private pads: THREE.Group[] = [];
  /** True once the hero has been moved into the yurt. Switches ground, bounds and camera. */
  private insideYurt = false;
  /** 0 clear, 1 black. The transition is a blackout, never a cross-fade. */
  private fade = 0;
  private fadeTo = 0;
  /** Set while the blackout is deep enough to move the hero without it being seen. */
  private pendingTeleport: (() => void) | null = null;

  /**
   * The kui, as call and response.
   *
   * Three rounds of two, three and four notes. The dombra plays the phrase,
   * the strings light in order, and the player answers on the three pads. A
   * wrong pad is not a failure — the phrase is simply played again from the
   * start, which is what a teacher does.
   */
  private kuiRounds = [2, 3, 4];
  private kuiRound = 0;
  private kuiPhrase: number[] = [];
  private kuiEchoed = 0;
  /** Index into the phrase while the dombra is playing it; -1 when listening is over. */
  private kuiPlayI = -1;
  private kuiNextNoteAt = 0;
  private kuiListening = true;
  private wetUntil = 0;
  private crossed = false;

  private panels: THREE.Group[] = [];
  private pegsDone = 0;
  private readonly pegsTotal = 3;

  private yurt: THREE.Group | null = null;
  private gardener: THREE.Object3D | null = null;
  private dombra: THREE.Group | null = null;
  /** Ground ring at the door, lit only once there is somewhere to walk in. */
  private doorMarker: THREE.Mesh | null = null;
  private butterflies: THREE.Group[] = [];

  /** 0…1 by distance to the yurt. The dombra is the level's compass. */
  private nearness = 0;
  private lastChime = 0;

  /**
   * Вода этого уровня — только река на переправе.
   *
   * Базовая проверка сравнивает высоту земли с уровнем воды по всему миру, а
   * уровень стоит на скульптурном рельефе, где ложбины уходят ниже реки. Замер:
   * 26.5% площади разброса числилось «под водой», из них 4.4% — вне меша реки,
   * полосой по западному краю. «Под водой» значит «без травы, цветов и зверья»,
   * то есть эта полоса лысела без всякой причины. Игрок туда не заходит — она
   * за оградой, — но тот же промах в первом уровне выедал шестую часть луга,
   * по которому ребёнок ходит. Ограничиваем проверку прямоугольником реки.
   */
  protected isUnderwater(x: number, z: number) {
    if (Math.abs(x - routeX(z)) > 20) return false;
    if (z > CROSSING_FROM + 6 || z < CROSSING_TO - 6) return false;
    return super.isUnderwater(x, z);
  }

  protected currentPhase() { return this.phase; }

  protected onMovementHintDismiss() {
    // First step taken: that is the whole of beat one's teaching, so the
    // level moves on the moment it happens rather than after a timer.
    if (this.phase === 'follow') this.pushHud();
  }

  /**
   * Inside, the room is the boundary — a circle, not a corridor with rooms
   * along it. Overridden rather than reserved so the outdoor play area is
   * untouched and cannot leak a path two hundred metres north.
   */
  protected clampToPlayArea(x: number, z: number): { x: number; z: number } {
    // Outdoors, the corridor itself has no far end — `pathCorridor` only ever
    // bounds x. Capping z here, rather than teaching the base clamp about a
    // wall it would need for exactly one level, holds the player at the
    // mountains behind spawn without touching the camera: the camera only
    // ever follows the hero's position, so it stays free to look past the
    // line even though the hero cannot cross it.
    if (!this.insideYurt) return super.clampToPlayArea(x, Math.min(z, BACK_WALL_Z));
    const dx = x - YURT_INSIDE.x;
    const dz = z - YURT_INSIDE.z;
    const d = Math.hypot(dx, dz);
    const r = INSIDE_R - 1.1;
    if (d <= r) return { x, z };
    return { x: YURT_INSIDE.x + (dx / d) * r, z: YURT_INSIDE.z + (dz / d) * r };
  }

  /**
   * Hold the camera inside the felt and under the roof.
   *
   * Both bounds are needed and the second one is the one that bites. Pulling
   * the camera inside the wall is obvious; what is not is that the roof poles
   * slope down to meet that wall, so the closer to the wall the camera is
   * pushed, the lower it has to be. Getting only the first right put a roof
   * pole directly across the lens and filled the screen with brown.
   */
  /**
   * Show one location and hide the other.
   *
   * Distance alone was not enough. Frustum culling does drop the interior for
   * free while you are outdoors — measured at two draw calls of difference
   * across a hundred and sixty-nine meshes — but it does nothing in the other
   * direction, because the treeline that encloses every level is instanced
   * with `frustumCulled = false`. Standing inside a yurt two hundred metres
   * away, the whole forest was still being submitted every frame.
   *
   * The sky is kept in both places: the room has a smoke hole in the roof and
   * you can see up through it.
   */
  private showOnly(inside: boolean) {
    const keep = new Set<THREE.Object3D>([this.hero]);
    if (this.interior) keep.add(this.interior.root);
    for (const p of this.pads) keep.add(p);
    for (const child of this.scene.children) {
      if ((child as THREE.Light).isLight || (child as THREE.Camera).isCamera) continue;
      if (child.name === 'skyDome') continue;
      if (keep.has(child)) {
        child.visible = inside;
        continue;
      }
      child.visible = !inside;
    }
    this.hero.visible = true;
  }

  private keepCameraInsideYurt() {
    const p = this.camera.position;
    const dx = p.x - YURT_INSIDE.x;
    const dz = p.z - YURT_INSIDE.z;
    let d = Math.hypot(dx, dz);
    // The physical felt wall is at R + .5, but putting a 54° phone lens only
    // .9 units below its low eave still lets the *top of the frame* look past
    // the roof on a hard orbit. Keep a meaningful roof-volume buffer rather
    // than merely preventing the camera origin itself from crossing a wall.
    // This is deliberately a little closer to the child when they stand near
    // the perimeter; a tight but fully interior shot is always better than a
    // view of the hidden outdoor world.
    const maxR = INSIDE_R - 3.5;
    if (d > maxR) {
      const k = maxR / d;
      p.x = YURT_INSIDE.x + dx * k;
      p.z = YURT_INSIDE.z + dz * k;
      d = maxR;
    }
    const ceiling = roofHeightAt(d) - 1.25;
    if (p.y > ceiling) p.y = Math.max(2.0, ceiling);
  }

  /**
   * `withCameraOrbit()` rotates around the hero only for the render, then
   * restores the stored follow-camera position. Clamping before render is
   * therefore the only point that can catch a hard look-around which swings
   * the lens through the yurt wall or low roof. The outdoor world keeps its
   * unconstrained orbit; this is a room boundary, not a global camera rule.
   */
  protected beforeRenderCamera() {
    if (this.insideYurt) this.keepCameraInsideYurt();
  }

  /** Enter the second location from the blackout, or directly for dev QA. */
  private enterYurt(noteDelay = 1500, celebrate = true) {
    this.insideYurt = true;
    this.showOnly(true);
    this.phase = 'inside';
    this.hero.position.set(YURT_INSIDE.x, 0, YURT_INSIDE.z + 7.0);
    this.hero.rotation.y = Math.PI;
    this.yaw = Math.PI;
    this.airborne = false;
    this.jumpVelocity = 0;
    this.camera.position.set(YURT_INSIDE.x, 4.2, YURT_INSIDE.z + 12.4);
    // Snap the aim rather than easing it two hundred metres.
    this.resetCameraAim();
    this.kuiRound = 0;
    this.startKuiRound(performance.now() + noteDelay);
    if (celebrate) AudioManager.sfx('sparkle');
  }

  /**
   * A direct room start makes the camera boundary checkable without replaying
   * three minutes of outdoor beats. It is dead in production builds.
   *
   * `?mission=0&l0=inside`
   */
  private devStartInsideYurt() {
    return import.meta.env.DEV
      && typeof location !== 'undefined'
      && new URLSearchParams(location.search).get('l0') === 'inside';
  }

  tryInteract() {
    const now = performance.now();
    const t = this.interactTarget;
    if (!t) return;

    if (this.phase === 'lanterns' && t.userData.isLantern && !t.userData.done) {
      t.userData.done = true;
      this.lanternsUp += 1;
      this.stars += 2;
      AudioManager.sfx('sparkle');
      this.spawnSparks(t.position, 14, [0xf0d24a, 0xffeaa7]);
      this.praiseUntil = now + 900;
      if (this.lanternsUp >= this.lanternsTotal) {
        this.phase = 'crossing';
        this.stars += 3;
        AudioManager.sfx('found');
      }
      this.pushHud();
      return;
    }

    if (this.phase === 'mend' && t.userData.isPanel && !t.userData.done) {
      t.userData.done = true;
      // Колышек виден с самого начала и теперь просто встаёт в ремешок —
      // анимация в `loop`. Раньше он до этого момента не существовал на
      // экране: ребёнку предлагали приколоть предмет, которого он не видел.
      (t.userData.ring as THREE.Mesh).visible = false;
      this.pegsDone += 1;
      this.stars += 3;
      AudioManager.sfx('interact');
      this.spawnSparks(t.position, 12, [0xe9e2d2, 0xc4462f]);
      this.praiseUntil = now + 900;
      if (this.pegsDone >= this.pegsTotal) {
        // The felt is mended, so the gardener opens the door. The level's
        // second half is somewhere else.
        this.phase = 'enter';
        this.stars += 5;
        AudioManager.sfx('found');
        this.spawnSparks(this.gardener?.position ?? this.hero.position, 26, [0xf0d24a, 0x5fbf7a]);
      }
      this.pushHud();
      return;
    }

    // ── Inside: answering the kui ────────────────────────────────
    if (this.phase === 'inside' && t.userData.isStringPad) {
      if (this.kuiListening) return; // still being played to; pressing does nothing
      this.pressPad(t.userData.index as number, now);
    }
  }

  /**
   * One answer on one pad.
   *
   * Right notes accumulate. A wrong note costs nothing at all — no stars, no
   * lives, no restart of the round — the phrase is simply played again, which
   * is what happens when a child gets it wrong in front of someone teaching
   * them. The only thing a mistake costs is the few seconds of hearing it.
   */
  private pressPad(index: number, now: number) {
    const want = this.kuiPhrase[this.kuiEchoed];
    this.flashString(index, 1);

    if (index === want) {
      this.kuiEchoed += 1;
      AudioManager.sfx('collect');
      if (this.kuiEchoed >= this.kuiPhrase.length) {
        this.stars += 4;
        this.kuiRound += 1;
        this.praiseUntil = now + 1400;
        AudioManager.sfx('sparkle');
        this.spawnSparks(
          new THREE.Vector3(YURT_INSIDE.x, 1.6, YURT_INSIDE.z - 3.0),
          22,
          [0xf0d24a, 0x5fbf7a],
        );
        if (this.kuiRound >= this.kuiRounds.length) {
          // The melody is whole. The song happens here, in the room it was
          // learned in, rather than back out on the grass.
          this.phase = 'song';
          this.stars += 6;
          this.nextAt = now + 5200;
          AudioManager.sfx('levelComplete');
        } else {
          this.startKuiRound(now + 900);
        }
      }
    } else {
      // Wrong note: a soft "not that one", then the phrase again.
      AudioManager.sfx('stumble');
      this.startKuiRound(now + 700);
    }
    this.pushHud();
  }

  /** Deal a fresh phrase for the current round and start playing it. */
  private startKuiRound(atMs: number) {
    const len = this.kuiRounds[Math.min(this.kuiRound, this.kuiRounds.length - 1)];
    // Re-dealt on every attempt rather than kept, so a child who missed the
    // fourth note is not made to sit through the same phrase until they get
    // it — and so nobody can beat it by memorising one answer.
    this.kuiPhrase = Array.from({ length: len }, () => Math.floor(Math.random() * 3));
    this.kuiEchoed = 0;
    this.kuiPlayI = 0;
    this.kuiListening = true;
    this.kuiNextNoteAt = atMs;
  }

  /** Light a string and its pad for a moment. `strength` 1 is a full pluck. */
  private flashString(index: number, strength: number) {
    const s = this.interior?.strings[index];
    if (s) s.userData.lit = strength;
    const pad = this.pads[index];
    if (pad) pad.userData.lit = strength;
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L0Hud) => void) {
    this.nick = nick || this.defaultNick(lang);
    this.lang = lang;
    this.onHud = onHud;
    const loader = createGameGltfLoader();

    this.camera.position.set(6, 7, SPAWN_Z + 11);
    this.pathCorridor = routeX;
    this.pathCorridorHalf = 3.2;

    await this.setupForestEnvironment(loader, {
      flatRadius: 9,
      flatCenterZ: YURT.z,
      terrain: {
        playHalfExtent: 54,
        rimFalloff: 15,
        rimHeight: 3.2,
        seed: 0,
        features: [
          { kind: 'flat', x: 0, z: SPAWN_Z - 3, r: 8 },
          { kind: 'flat', x: YURT.x, z: YURT.z, r: 9 },
          // The river bed, bank to bank.
          //
          // Two earlier attempts got this wrong. `flat` levels but does not
          // dig, so the water sat below the ground and the stones stood on
          // grass. Then basins dug — but basins are applied *before* the path
          // corridor is carved, and that carve scales the height by 0.08 on
          // the centre line, filling a 3 m basin back in to half a metre. The
          // result was a shallow ribbon of water with dry land either side,
          // which is the "why is there ground here" you can see in the shot.
          //
          // A trench is applied after the corridor and spans the full width
          // the player can reach, so during the crossing there is nowhere to
          // stand but the stones.
          {
            kind: 'trench' as const,
            x: routeX((CROSSING_FROM + CROSSING_TO) / 2),
            z: (CROSSING_FROM + CROSSING_TO) / 2,
            halfW: 15,
            halfD: Math.abs(CROSSING_TO - CROSSING_FROM) / 2,
            depth: 2.6,
          },
        ],
      },
    });

    // ── The mountains behind spawn ──────────────────────────────────
    // `setupForestEnvironment`'s own backdrop ridge sits entirely past the
    // yurt (z ≈ -62 to -78) — nothing marks the way Barsik came down from.
    // This closes the loop behind him: a boulder field at the foot of a
    // ridge, not an invisible wall. `clampToPlayArea` is what actually stops
    // the player at BACK_WALL_Z; this is why they stop there.
    for (const [ox, oz, h, w] of [
      [-40, 50, 22, 17],
      [-2, 58, 26, 20],
      [42, 48, 21, 16],
    ] as const) {
      this.scene.add(mountain(ox, oz, h, w));
    }
    const boulderSpots: Array<[number, number, number]> = [
      [-9, 35, 1.5], [-3, 38, 1.1], [4, 34, 1.7], [9.5, 37.5, 1.2], [-14, 39, 1.3],
    ];
    for (const [bx, bz, scale] of boulderSpots) {
      this.scene.add(boulder(bx, bz, scale, this.groundHeightAt(bx, bz)));
    }

    this.reserve(0, SPAWN_Z, 5);
    this.reserve(YURT.x, YURT.z, 8);
    // The whole river, not a ribbon down the middle of it. `reserve` is what
    // keeps decoration out, and at r = 6.5 it covered a fraction of a bed
    // that is thirty metres across — so grass, bushes and trees came up
    // through the water either side of the stones.
    for (let i = 0; i <= 10; i++) {
      const z = CROSSING_FROM - (i / 10) * (CROSSING_FROM - CROSSING_TO);
      this.reserve(routeX(z), z, 13);
    }
    for (const l of LANTERNS) this.reserve(l.x, l.z, 2.5);
    for (const p of PEGS) this.reserve(p.x, p.z, 2);

    // ── The water line ───────────────────────────────────────────
    // Derived from the terrain that actually got built, not from a constant.
    // The first attempt hard-coded bed + 0.62 and the stream came out *above*
    // the near bank — a river flooding the meadow. Sampling both banks and
    // sitting partway between them cannot do that, whatever the terrain
    // generator decides to produce.
    //
    // Computed here rather than with the water mesh, because everything
    // placed below needs to know where the water is: the trail used to march
    // straight into the river and lay stepping stones along the bottom of it.
    const midZ = (CROSSING_FROM + CROSSING_TO) / 2;
    const bedY = this.groundHeightAt(routeX(midZ), midZ);
    const bankY = Math.min(
      this.groundHeightAt(routeX(CROSSING_FROM + 4), CROSSING_FROM + 4),
      this.groundHeightAt(routeX(CROSSING_TO - 4), CROSSING_TO - 4),
    );
    const waterY = bedY + Math.max(0.25, (bankY - bedY) * 0.55);
    this.waterY = waterY;
    // Set before the scatter runs, so nothing is planted on the river bed.
    this.waterLineY = waterY;

    const pad = spawnPad(0, SPAWN_Z);
    this.scene.add(pad);

    // The trail stops at each bank. It used to be laid at even spacing from
    // the spawn to the yurt regardless of what was in the way, so a line of
    // path stones ran along the river bed underwater — which also quietly
    // told the player the route went straight through.
    await this.layTrail(
      loader,
      Array.from({ length: 26 }, (_, i) => {
        const z = SPAWN_Z - (i / 25) * (SPAWN_Z - YURT.z - 5);
        return { x: routeX(z), z };
      }).filter((p) => !this.isUnderwater(p.x, p.z)),
      { size: 1.25 },
    );

    // Wide enough to run past the treeline. Where the ground rises above the
    // water line the terrain simply hides the plane, so the shore draws
    // itself and there is no strip of grass sitting inside the river.
    //
    // The stones are passed in so the water knows something is standing in
    // it: twelve cylinders in a mirror-flat sheet look painted on.
    this.river = createRiverWater({
      width: 38,
      length: Math.abs(CROSSING_TO - CROSSING_FROM) + 12,
      centre: { x: routeX(midZ), z: midZ },
      y: waterY,
      bedAt: (x, z) => this.groundHeightAt(x, z),
      obstacles: STONES.map((s) => ({ x: routeX(s.z) + s.x, z: s.z, r: STONE_R })),
    });
    this.scene.add(this.river.mesh);

    // Top surface, a little proud of the water so it reads as dry.
    const topY = waterY + 0.3;
    // Reaches the bed rather than floating at a constant height: the bed is
    // sculpted, so a fixed 2 m cylinder hangs in the water at the deep end.
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9aa3a8, roughness: 0.95 });
    for (const s of STONES) {
      const x = routeX(s.z) + s.x;
      const bed = this.groundHeightAt(x, s.z);
      const h = Math.max(1.2, topY - bed + 0.6);
      const stone = new THREE.Mesh(
        new THREE.CylinderGeometry(STONE_R, STONE_R + 0.16, h, 12),
        stoneMat,
      );
      stone.position.set(x, topY - h / 2, s.z);
      stone.castShadow = true;
      stone.userData.restY = stone.position.y;
      stone.userData.sink = !!s.sink;
      stone.userData.sunk = 0;
      this.stones.push(stone);
      this.scene.add(stone);
      // The bit that was missing entirely. Without this the stones are
      // scenery: height comes from `groundHeightAt`, which knows only the
      // terrain, so the hero's feet tracked the river bed and sank straight
      // through every one of them.
      // The reach is a touch wider than the pad — a child aiming at the edge
      // gets the stone, not the water.
      this.addPlatform(stone, STONE_R + 0.25, h / 2);
    }
    this.assertCrossingIsJumpable(waterY);

    // ── Lanterns, lying where the wind put them ───────────────────
    for (const spec of LANTERNS) {
      const holder = new THREE.Group();
      const glb =
        (await loadPropModel(loader, CAST_PROP_GLB.lantern, { height: 1.05, aspectMax: 4 })) ??
        (await loadPropModel(loader, CAST_PROP_GLB.lantern_wood, { height: 1.05, aspectMax: 4 }));
      const body = glb ?? this.makeSimpleLantern();
      body.position.y = 0;
      holder.add(body);

      // The flame is what changes when it is set upright, so it is separate
      // and starts dark.
      const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 10, 8),
        new THREE.MeshStandardMaterial({
          color: 0xf0d24a, emissive: 0xf0d24a, emissiveIntensity: 0, roughness: 0.4,
        }),
      );
      flame.position.y = 0.62;
      holder.add(flame);

      const glow = new THREE.Mesh(
        new THREE.RingGeometry(0.5, 0.78, 18),
        new THREE.MeshBasicMaterial({ color: 0xf0d24a, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.03;
      holder.add(glow);

      holder.position.set(spec.x, this.groundHeightAt(spec.x, spec.z), spec.z);
      holder.rotation.z = spec.rotZ;   // knocked over
      holder.userData.isLantern = true;
      holder.userData.done = false;
      holder.userData.restZ = spec.rotZ;
      holder.userData.flame = flame;
      holder.userData.glow = glow;
      this.lanterns.push(holder);
      this.scene.add(holder);
    }

    // ── The yurt, its felt, and the player of the dombra ──────────
    this.yurt = makeYurt();
    this.yurt.position.set(YURT.x, this.groundHeightAt(YURT.x, YURT.z), YURT.z);
    this.scene.add(this.yurt);
    this.colliders.push({ kind: 'circle', x: YURT.x, z: YURT.z, r: 3.2 });

    for (const p of PEGS) {
      const panel = makeFeltPanel();
      panel.position.set(p.x, this.groundHeightAt(p.x, p.z), p.z);
      panel.lookAt(YURT.x, panel.position.y, YURT.z);
      panel.userData.isPanel = true;
      panel.userData.done = false;
      panel.userData.sway = Math.random() * Math.PI * 2;
      this.panels.push(panel);
      this.scene.add(panel);
    }

    // ── The porch ────────────────────────────────────────────────
    // Gardener and dombra used to sit at YURT.z + 4.6 — a metre short of
    // where the crossing lets the player off, which read as "left by the
    // water" rather than "waiting at the door". Both are staged against the
    // wall instead, either side of the doorway the teleport already uses
    // (YURT.z + 3.6), on a mat that declares the spot as a place rather
    // than a patch of grass something happened to be dropped on.
    const doorFront = YURT.z + 3.6;
    const porchZ = YURT.z + 3.1;
    const gx = YURT.x - 1.6;
    const dx = YURT.x - 0.9;

    const mat = new THREE.Mesh(
      new THREE.CircleGeometry(1.75, 22),
      new THREE.MeshStandardMaterial({ color: 0xac3c28, roughness: 0.92 }),
    );
    mat.rotation.x = -Math.PI / 2;
    mat.position.set(YURT.x - 1.1, this.groundHeightAt(YURT.x - 1.1, porchZ) + 0.02, porchZ);
    this.scene.add(mat);

    this.gardener =
      (await loadCharModel(loader, 'zhuldyz.glb', 1.5)) ??
      (await loadCharModel(loader, 'aya.glb', 1.5));
    if (this.gardener) {
      this.gardener.position.set(gx, this.groundHeightAt(gx, porchZ), porchZ);
      // Angled toward the door instead of square-on to the player — tending
      // it, not posted there waiting for someone to walk up.
      this.gardener.rotation.y = Math.PI * 0.82;
      this.scene.add(this.gardener);
    }

    // Leaned against the felt at a single backward tilt, the way you rest an
    // instrument when your hands are busy pinning down a wall — not the old
    // three-axis knock-over that read as dropped mid-lawn.
    this.dombra = makeDombra();
    this.dombra.position.set(dx, this.groundHeightAt(dx, porchZ + 0.3), porchZ + 0.3);
    this.dombra.rotation.set(0.22, 0.55, -0.08);
    this.scene.add(this.dombra);
    // Solid. Without this the hero walks straight through the instrument and
    // stands inside the gardener, which reads as the world being made of
    // scenery rather than of things.
    this.colliders.push({ kind: 'circle', x: (gx + dx) / 2, z: porchZ + 0.15, r: 1.15 });

    // ── The door marker ─────────────────────────────────────────────
    // A ring on the threshold, the same visual language the lanterns and
    // felt pegs already use for "something happens here" — lit only once
    // the gardener has actually opened the door (phase 'enter'), so it
    // never invites the player to a door that would not open yet.
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1.15, 24),
      new THREE.MeshBasicMaterial({
        color: 0xf0d24a, transparent: true, opacity: 0, side: THREE.DoubleSide,
      }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(YURT.x, this.groundHeightAt(YURT.x, doorFront) + 0.04, doorFront);
    this.scene.add(marker);
    this.doorMarker = marker;

    // ── Dressing ─────────────────────────────────────────────────
    // Everything that grows out of soil is filtered against the water line.
    // These loops walked the route at even spacing from the spawn to the
    // yurt, which marches straight through the middle of the river — so
    // bushes and tulips were coming up out of the water either side of the
    // stepping stones.
    for (let i = 0; i < 24; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = SPAWN_Z - (i / 24) * (SPAWN_Z - YURT.z);
      const x = routeX(z) + side * (5.5 + Math.random() * 4);
      if (this.isUnderwater(x, z)) continue;
      this.scene.add(bush(x, z));
    }
    for (let i = 0; i < 16; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = SPAWN_Z - (i / 16) * (SPAWN_Z - YURT.z);
      const x = routeX(z) + side * 3.6;
      if (this.isUnderwater(x, z)) continue;
      this.scene.add(tulip(x, z, [0xef6b3a, 0xf0d24a, 0xfd79a8][i % 3]));
    }
    for (let i = 0; i < 8; i++) {
      const bf = butterfly(
        routeX(SPAWN_Z - i * 8) + (Math.random() - 0.5) * 8,
        SPAWN_Z - i * 8,
        [0xf0d24a, 0x2aa8d8, 0xef6b3a][i % 3],
      );
      this.butterflies.push(bf);
      this.scene.add(bf);
    }
    await placeAmbientCritters(this.scene, loader, [
      { key: 'squirrel', x: routeX(4) + 6, z: 4, rotY: -1.1, h: 0.85 },
      // On the far beach, not at z −30, which is now the middle of the river.
      { key: 'bird', x: routeX(-43) - 4.5, z: -43, rotY: 0.6, h: 0.5 },
    ]);

    // The wall. Planted last, so it can read the corridor and every room the
    // level reserved and hug the outside of both.
    await this.encloseWithForest(loader, { zFrom: YURT.z - 8, zTo: SPAWN_Z + 4 });

    // ── The second location ──────────────────────────────────────
    // Built two hundred metres out, well past the terrain's own extent and
    // past the fog, so there is no angle from which one location can see the
    // other. It costs nothing to leave it in the scene: it is a single group,
    // never in the camera frustum until the hero is standing in it.
    const interior = buildYurtInterior();
    this.interior = interior;
    interior.root.visible = false;
    this.scene.add(interior.root);
    // The pads sit in an arc in front of the instrument.
    this.pads = buildAnswerPads();
    for (const pad of this.pads) {
      const i = pad.userData.index as number;
      pad.position.set(YURT_INSIDE.x + (i - 1) * 2.7, 0, YURT_INSIDE.z - 2.2);
      pad.visible = false;
      this.scene.add(pad);
    }

    // Inside, the floor is flat and at zero. Wrapping the sampler rather than
    // giving the interior its own terrain keeps every height-aware system —
    // movement, the jump, prop grounding — working in both places unchanged.
    const outdoorHeight = this.groundHeightAt;
    this.groundHeightAt = (x, z) => (this.insideYurt ? 0 : outdoorHeight(x, z));

    const start = this.devStart() ?? { x: 0, z: SPAWN_Z };
    this.hero.position.set(start.x, this.groundHeightAt(start.x, start.z), start.z);
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
      this.nextAt = performance.now() + 900;
      if (this.devStartInsideYurt()) this.enterYurt(0, false);
      this.pushHud();
      this.loop();
    });
  }

  /**
   * Refuse to ship a crossing the hero cannot make.
   *
   * The first crossing had two gaps of 4.36 m and 4.32 m against 2.83 m of
   * reach — not hard, impossible, and it took a player to find it because
   * nothing in the build was measuring. A hop that no longer fits should
   * break the build's console the moment the level loads, not a child's
   * afternoon.
   *
   * Reach is derived from the same constants the jump uses, so tuning the
   * jump re-checks the level for free.
   */
  private assertCrossingIsJumpable(waterY: number) {
    if (!import.meta.env.DEV) return;
    // A scene that React has already thrown away keeps running its `init` to
    // the end, and `dispose` has by then replaced the terrain sampler with a
    // flat zero. Everything then reads as under water, both banks come back
    // unreachable, and the console fills with a failure that is not real —
    // which is worse than no check at all, because it is what a real failure
    // would be hiding behind.
    if (this.disposed) return;
    const airtime = (2 * this.jumpSpeed) / this.gravity;
    const reach = this.baseSpeed * airtime;

    // The banks are found by asking the terrain where it comes out of the
    // water, never by trusting CROSSING_FROM/TO. Those are inputs to the
    // trench, and the trench feathers over three metres, so the real shore is
    // a metre or so beyond them — measuring against the constant is how the
    // exit hop came out "fine" at 2.4 m when it was really 3.0 m and
    // impossible. And a shore is a line, not a point: the nearest dry ground
    // may be off to one side, which is a perfectly good place to land.
    // `dir` is given, not inferred from CROSSING_FROM/TO: the exit stone sits
    // *past* CROSSING_TO, so inferring the direction sent the scan back up
    // the river and reported the shore as unreachable at infinity.
    const nearestDryFrom = (x: number, z: number, dir: 1 | -1) => {
      let best = Infinity;
      for (let dz = 0; dz <= 10; dz += 0.2) {
        for (let ox = -10; ox <= 10; ox += 0.4) {
          const px = routeX(z + dir * dz) + ox;
          const pz = z + dir * dz;
          if (this.groundHeightAt(px, pz) <= waterY + 0.02) continue;
          if (this.clampToPlayArea(px, pz).x !== px) continue; // must be somewhere you may stand
          best = Math.min(best, Math.hypot(px - x, pz - z));
        }
      }
      return best;
    };

    const pads = STONES.map((s) => ({ x: routeX(s.z) + s.x, z: s.z }));
    const hops: Array<{ what: string; need: number }> = [];
    // Entry: from the near shore onto the first pad. The pad's radius counts,
    // the shore's does not.
    hops.push({ what: 'bank → stone 1', need: nearestDryFrom(pads[0].x, pads[0].z, 1) - STONE_R });
    for (let i = 1; i < pads.length; i++) {
      // Take off from the centre of one pad, land on the near lip of the next.
      // Nobody should have to use the far lip.
      hops.push({
        what: `stone ${i} → ${i + 1}`,
        need: Math.hypot(pads[i].x - pads[i - 1].x, pads[i].z - pads[i - 1].z) - STONE_R,
      });
    }
    const last = pads[pads.length - 1];
    hops.push({ what: `stone ${pads.length} → bank`, need: nearestDryFrom(last.x, last.z, -1) });

    let worst = { what: '', need: 0 };
    for (const h of hops) {
      if (h.need > worst.need) worst = h;
      if (h.need > reach) {
        console.error(
          `[L0] ${h.what} needs ${h.need.toFixed(2)} m but the jump reaches ${reach.toFixed(2)} m — unreachable`,
        );
      }
    }
    const tops = this.stones.map(
      (s) => s.position.y + (s as THREE.Mesh<THREE.CylinderGeometry>).geometry.parameters.height / 2,
    );
    const wet = tops.filter((t) => t <= waterY + 0.05).length;
    if (wet) console.error(`[L0] ${wet} stone tops are at or below the water line`);
    console.info(
      `[L0] crossing: ${STONES.length} stones, hardest is ${worst.what} at ${worst.need.toFixed(2)} m ` +
        `of ${reach.toFixed(2)} m reach — ${((reach / worst.need - 1) * 100).toFixed(0)}% margin`,
    );
  }

  /** Fallback lantern if neither GLB is usable — the beat must still work. */
  private makeSimpleLantern(): THREE.Group {
    const g = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x6f5b45, roughness: 0.85 });
    const glass = new THREE.MeshStandardMaterial({
      color: 0xfff3cf, roughness: 0.35, transparent: true, opacity: 0.75,
    });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.14, 8), metal);
    base.position.y = 0.07;
    const pane = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.52, 8), glass);
    pane.position.y = 0.4;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.2, 8), metal);
    cap.position.y = 0.76;
    g.add(base, pane, cap);
    return g;
  }

  private pushHud() {
    const n = this.nick;
    let speaker = 'Барсик';
    let line = '';
    let objective = '';
    const p = this.phase;
    const wet = performance.now() < this.wetUntil;

    if (p === 'intro') {
      const lines = [
        this.copy(
          'Ночью по лесу прошёл ветер. Утро тихое — и где-то далеко играет домбра.',
          'Түнде орманнан жел өтті. Таң тынық — алыстан домбыра үні естіледі.',
        ),
        this.copy(
          `Я барсёнок с гор, ${n}. Здесь, внизу, всё чужое — а музыка знакомая.`,
          `Мен таудан келген барыс баласымын, ${n}. Мұнда бәрі бөтен — ал әуен таныс.`,
        ),
        this.copy(
          'Пойдём на звук. Он то громче, то обрывается…',
          'Дыбысқа қарай жүрейік. Бірде күшейеді, бірде үзіледі…',
        ),
      ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = this.copy('🎵 Иди на звук домбры', '🎵 Домбыра үніне қарай жүр');
    } else if (p === 'follow') {
      line = this.nearness > 0.35
        ? this.copy('Громче! Значит, туда.', 'Қаттырақ! Демек, ол жаққа.')
        : this.copy('Двигайся — по звуку слышно, теплее или холоднее.', 'Қозғал — дыбыс бойынша жақын ба, алыс па білінеді.');
      objective = this.copy('🎵 Иди на звук домбры', '🎵 Домбыра үніне қарай жүр');
    } else if (p === 'lanterns') {
      line = performance.now() < this.praiseUntil
        ? this.copy('Горит! Дорогу видно дальше.', 'Жанды! Жол әрі көрінеді.')
        : this.copy(
            'Ветер повалил фонари на тропе. Подними — они сами загорятся.',
            'Жел соқпақтағы шамдарды құлатқан. Тұрғыз — олар өздері жанады.',
          );
      objective = this.copy(
        `🏮 Фонари: ${this.lanternsUp}/${this.lanternsTotal}`,
        `🏮 Шамдар: ${this.lanternsUp}/${this.lanternsTotal}`,
      );
    } else if (p === 'crossing') {
      line = wet
        ? this.copy('Бр-р! Вода холодная. Ничего, вылезаю и пробую снова.', 'Бр-р! Су суық. Ештеңе етпейді, шығып тағы көремін.')
        : this.copy(
            'Ручей поднялся за ночь. По камням — прыжками.',
            'Бұлақ түнде көтеріліпті. Тастармен — секіріп өт.',
          );
      objective = this.isMobile
        ? this.copy('⬆️ Нажми «Прыжок», чтобы перескочить', '⬆️ Секіру үшін «Секіру» түймесін бас')
        : this.copy('⬆️ Пробел — прыжок', '⬆️ Бос орын — секіру');
    } else if (p === 'mend') {
      line = performance.now() < this.praiseUntil
        ? this.copy('Держится!', 'Ұсталды!')
        : this.copy(
            'Юрта! Ветер сорвал войлок — он хлопает. Прижми колышками.',
            'Киіз үй! Жел киізді жұлып кетіпті — сартылдап тұр. Қазықпен бекіт.',
          );
      objective = this.copy(
        `⛺ Колышки: ${this.pegsDone}/${this.pegsTotal}`,
        `⛺ Қазықтар: ${this.pegsDone}/${this.pegsTotal}`,
      );
    } else if (p === 'enter') {
      speaker = this.copy('Садовник', 'Бағбан');
      line = this.copy(
        'Спасибо. Заходи в юрту — там тепло, и там я тебе кое-что покажу.',
        'Рақмет. Киіз үйге кір — онда жылы, саған бірдеңе көрсетемін.',
      );
      objective = this.copy('🚪 Войди в юрту', '🚪 Киіз үйге кір');
    } else if (p === 'inside') {
      speaker = this.copy('Садовник', 'Бағбан');
      if (this.kuiListening) {
        line = this.copy(
          'Слушай. Домбра говорит — а ты повтори.',
          'Тыңда. Домбыра сөйлейді — сен қайтала.',
        );
        objective = this.copy('👂 Слушай мелодию', '👂 Әуенді тыңда');
      } else {
        line = performance.now() < this.praiseUntil
          ? this.copy('Так! Ещё раз, длиннее.', 'Дәл солай! Тағы да, ұзынырақ.')
          : this.copy(
              'Теперь ты. Наступай на круги в том же порядке.',
              'Енді сен. Дөңгелектерді сол ретпен бас.',
            );
        objective = this.copy(
          `🎵 Повтори: ${this.kuiEchoed}/${this.kuiPhrase.length}`,
          `🎵 Қайтала: ${this.kuiEchoed}/${this.kuiPhrase.length}`,
        );
      }
    } else if (p === 'song') {
      speaker = this.copy('Садовник', 'Бағбан');
      line = this.copy(
        'Вот теперь кюй звучит целиком — и играешь его ты. Мелодия рвалась не от ветра. Её просто некому было доиграть.',
        'Міне, енді күй толық шырқалды — оны сен тартып тұрсың. Әуен желден үзілмеген. Оны аяқтайтын адам болмаған.',
      );
      objective = this.copy('🎶 Кюй звучит целиком', '🎶 Күй толық шырқалды');
    } else if (p === 'outro') {
      speaker = this.copy('Садовник', 'Бағбан');
      line = this.copy(
        `Ты ведь сверху, ${n}? Там снег и твои. Дойдёшь — если по дороге будешь чинить, а не только идти.`,
        `Сен жоғарыдансың ғой, ${n}? Онда қар және сенің ағайының. Жетесің — жолда жөндеп жүрсең, тек жүрмей.`,
      );
      objective = this.copy('🏔️ Дорога к горам открыта', '🏔️ Тауға жол ашылды');
    }

    this.onHud?.({
      phase: p,
      speaker,
      line,
      objective,
      lanternsUp: this.lanternsUp,
      lanternsTotal: this.lanternsTotal,
      pegsDone: this.pegsDone,
      pegsTotal: this.pegsTotal,
      nearness: +this.nearness.toFixed(2),
      wet,
      fade: +this.fade.toFixed(3),
      kuiRound: Math.min(this.kuiRound + 1, this.kuiRounds.length),
      kuiTotal: this.kuiRounds.length,
      kuiListening: this.kuiListening,
      kuiEchoed: this.kuiEchoed,
      kuiLength: this.kuiPhrase.length,
      stars: this.stars,
      canInteract: Boolean(this.interactTarget),
      showMoveHint: !this.hasTakenFirstStep && (p === 'intro' || p === 'follow'),
      showActionHint: Boolean(this.interactTarget),
      outro: p === 'outro',
    });
  }

  /**
   * Distances on the ground plane, never in 3D — a target's height must not
   * cost the player reach. See the note in Level9Scene for what that bug
   * looked like when it was live.
   */
  private nearestInteract(): THREE.Object3D | null {
    const hp = this.hero.position;
    const flat = (o: THREE.Object3D) => Math.hypot(hp.x - o.position.x, hp.z - o.position.z);
    let best: THREE.Object3D | null = null;
    let bestD = 2.3;

    if (this.phase === 'lanterns') {
      for (const l of this.lanterns) {
        if (l.userData.done) continue;
        const d = flat(l);
        if (d < bestD) { bestD = d; best = l; }
      }
    } else if (this.phase === 'mend') {
      for (const p of this.panels) {
        if (p.userData.done) continue;
        const d = flat(p);
        if (d < bestD) { bestD = d; best = p; }
      }
    } else if (this.phase === 'inside' && !this.kuiListening) {
      // The pads are a metre across and two and a half apart, so a generous
      // reach here still cannot pick the wrong one.
      bestD = 2.0;
      for (const p of this.pads) {
        const d = flat(p);
        if (d < bestD) { bestD = d; best = p; }
      }
    }
    return best;
  }

  private objectiveWorldPos(): THREE.Vector3 | null {
    if (this.phase === 'follow' || this.phase === 'intro') {
      // Deliberately silent for the first few seconds: the sound is the
      // navigation, and an arrow offered immediately would teach a child to
      // watch the arrow instead of the world for the rest of the season.
      // It appears once they have taken a step and had a moment to listen.
      if (!this.hasTakenFirstStep || this.nearness < 0.08) return null;
      return new THREE.Vector3(YURT.x, 0, YURT.z);
    }
    if (this.phase === 'lanterns') {
      const next = this.lanterns.find((l) => !l.userData.done);
      return next?.position.clone() ?? null;
    }
    if (this.phase === 'crossing') {
      const s = this.stones[0];
      return s ? new THREE.Vector3(s.position.x, 0, s.position.z) : null;
    }
    if (this.phase === 'mend') {
      const next = this.panels.find((p) => !p.userData.done);
      return next?.position.clone() ?? null;
    }
    if (this.phase === 'enter') {
      return new THREE.Vector3(YURT.x, 0, YURT.z + 3.6);
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
      if (this.introI >= 3) {
        this.phase = 'follow';
        this.nextAt = now + 400;
      } else {
        this.nextAt = now + 3000;
      }
      this.pushHud();
    }

    // ── The doorway ──────────────────────────────────────────────
    // A blackout, not a cross-fade: for the two locations to stay secret from
    // each other the screen has to be fully black at the moment the hero
    // moves. The teleport is deferred to that frame.
    const fadeWas = this.fade;
    this.fade += (this.fadeTo - this.fade) * Math.min(1, dt * 7);
    // The blackout is drawn by the HUD, so it has to be told about it on every
    // frame it is moving — pushHud otherwise only fires when a beat changes.
    if (Math.abs(this.fade - fadeWas) > 0.004) this.pushHud();
    if (this.pendingTeleport && this.fade > 0.96) {
      this.pendingTeleport();
      this.pendingTeleport = null;
      this.fadeTo = 0;
      this.pushHud();
    }

    if (this.doorMarker) {
      const dm = this.doorMarker.material as THREE.MeshBasicMaterial;
      const target = this.phase === 'enter' ? 0.55 + Math.sin(now * 0.005) * 0.25 : 0;
      dm.opacity += (target - dm.opacity) * Math.min(1, dt * 5);
    }

    if (this.phase === 'enter' && !this.pendingTeleport && this.fade < 0.02) {
      const door = new THREE.Vector3(YURT.x, 0, YURT.z + 3.6);
      if (Math.hypot(this.hero.position.x - door.x, this.hero.position.z - door.z) < 1.9) {
        this.fadeTo = 1;
        AudioManager.sfx('whoosh');
        this.pendingTeleport = () => {
          this.enterYurt();
        };
      }
    }

    // ── The kui ──────────────────────────────────────────────────
    if (this.phase === 'inside' && this.kuiListening && now >= this.kuiNextNoteAt) {
      if (this.kuiPlayI < this.kuiPhrase.length) {
        this.flashString(this.kuiPhrase[this.kuiPlayI], 1);
        AudioManager.sfx('tick');
        this.kuiPlayI += 1;
        this.kuiNextNoteAt = now + 620;
      } else {
        this.kuiListening = false;
        this.kuiPlayI = -1;
        this.pushHud();
      }
    }

    // Strings and pads decay back to dark after each pluck.
    for (const s of this.interior?.strings ?? []) {
      const lit = Math.max(0, (s.userData.lit as number) - dt * 2.2);
      s.userData.lit = lit;
      ((s.userData.core as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity = lit * 1.6;
      ((s.userData.glow as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = lit * 0.5;
    }
    for (const p of this.pads) {
      const lit = Math.max(0, ((p.userData.lit as number) ?? 0) - dt * 1.7);
      p.userData.lit = lit;
      ((p.userData.disc as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity =
        0.06 + lit * 2.4;
      ((p.userData.halo as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = lit * 0.8;
      ((p.userData.beam as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = lit * 0.42;
      const s = 1 + lit * 0.12;
      p.scale.set(s, 1, s);
      p.position.y = lit * 0.05;
    }
    if (this.interior) {
      // Firelight breathes; the dust in the shaft turns.
      this.interior.hearthLight.intensity = 2.4 + Math.sin(now * 0.006) * 0.35;
      this.interior.motes.rotation.y += dt * 0.06;
    }

    const canMove = !['intro', 'song', 'outro'].includes(this.phase) && this.fade < 0.5;
    if (this.insideYurt) {
      // A closed room needs no corridor: the walls are the bounds, and
      // `clampToPlayArea` is overridden to a circle while we are in here.
      this.updateMovement(dt, canMove, this.baseSpeed * 0.92, -60, 60, YURT_INSIDE.z - 60, YURT_INSIDE.z + 60);
    } else {
      this.updateMovement(dt, canMove, this.baseSpeed, -26, 26, YURT.z - 10, SPAWN_Z + 3);
    }

    // How close the dombra sounds. This is the level's navigation, so it is
    // computed every frame and fed to the HUD as a meter rather than left as
    // an audio-only cue a child on a muted phone would never get.
    const dz = Math.hypot(this.hero.position.x - YURT.x, this.hero.position.z - YURT.z);
    const span = Math.hypot(YURT.x, SPAWN_Z - YURT.z);
    this.nearness = this.insideYurt ? 1 : Math.max(0, Math.min(1, 1 - dz / span));
    // A chime whose gap shortens as you close — audible "warmer". It is the
    // outdoor navigation and has nothing to say once the walk is over, so it
    // stops at the door rather than ticking under the mini-game.
    const gap = 2600 - this.nearness * 1700;
    if (canMove && !this.insideYurt && this.phase !== 'enter' && now - this.lastChime > gap) {
      this.lastChime = now;
      AudioManager.sfx(this.nearness > 0.6 ? 'sparkle' : 'tick');
    }

    // follow → lanterns, once the first fallen lantern is in sight.
    if (this.phase === 'follow' && this.hero.position.z < LANTERNS[0].z + 6) {
      this.phase = 'lanterns';
      this.pushHud();
    }

    // Lanterns rise and light.
    for (const l of this.lanterns) {
      const done = l.userData.done as boolean;
      const target = done ? 0 : (l.userData.restZ as number);
      l.rotation.z += (target - l.rotation.z) * Math.min(1, dt * 6);
      const flame = l.userData.flame as THREE.Mesh;
      const fm = flame.material as THREE.MeshStandardMaterial;
      fm.emissiveIntensity += ((done ? 0.9 + Math.sin(now * 0.006) * 0.15 : 0) - fm.emissiveIntensity) * Math.min(1, dt * 4);
      const glow = l.userData.glow as THREE.Mesh;
      (glow.material as THREE.MeshBasicMaterial).opacity = done ? 0.28 : 0.4 + Math.sin(now * 0.004) * 0.12;
    }

    // ── The stream ───────────────────────────────────────────────
    // One uniform. This used to rewrite 595 vertex positions in JavaScript
    // on every frame to make a single sine ripple.
    this.river?.update(now * 0.001);
    // ── The crossing ─────────────────────────────────────────────
    if (this.phase === 'crossing') {
      const h = this.hero.position;
      // Standing *on* it, not merely near it. The old radius check called a
      // hero treading water beside a stone "standing", which is how a fall
      // could go unnoticed.
      const standing = this.stones.find((s) => this.isStandingOn(s));

      // Sinking stones. The only pressure in the level, and deliberately
      // gentle: about a second and a half of standing before it goes under,
      // and it floats back the moment you are off it. A child who freezes
      // loses a hop, not the section.
      for (const s of this.stones) {
        if (!s.userData.sink) continue;
        const loaded = s === standing && !this.airborne;
        const target = loaded ? Math.min(1, (s.userData.sunk as number) + dt / 1.5) : 0;
        s.userData.sunk = loaded ? target : Math.max(0, (s.userData.sunk as number) - dt * 1.6);
        s.position.y = (s.userData.restY as number) - (s.userData.sunk as number) * 0.75;
      }
      const sunkUnder = standing && (standing.userData.sunk as number) > 0.92;

      const inChannel = h.z < CROSSING_FROM + 1.5 && h.z > CROSSING_TO - 1.5;
      // Judged at the water line, not at the river bed. Waiting for the hero
      // to touch bottom meant a metre of swimming underwater before the
      // splash — the fall has to answer the moment it is a fall.
      const wet = inChannel && (!standing || sunkUnder) && h.y < this.waterY + 0.05;
      if (wet && now > this.wetUntil) {
        this.wetUntil = now + 1500;
        AudioManager.sfx('stumble');
        this.spawnSparks(h.clone(), 18, [0x2aa8d8, 0xffffff]);
        // Back to the near bank of this section, not to the level start. The
        // cost of a miss is the stones you had already crossed, which is what
        // makes them worth crossing carefully — and nothing else is taken.
        h.z = CROSSING_FROM + 2.6;
        h.x = routeX(h.z);
        h.y = this.groundHeightAt(h.x, h.z);
        this.jumpVelocity = 0;
        this.airborne = false;
        for (const s of this.stones) {
          s.userData.sunk = 0;
          s.position.y = s.userData.restY as number;
        }
        this.pushHud();
      }

      if (!this.crossed && h.z < CROSSING_TO - 1.0) {
        this.crossed = true;
        this.phase = 'mend';
        this.stars += 8;
        AudioManager.sfx('success');
        this.spawnSparks(h.clone(), 24, [0xf0d24a, 0x5fbf7a]);
        this.pushHud();
      }
    }

    // Отошедший войлок хлопает; прижатый ложится, и колышек встаёт в него.
    for (const p of this.panels) {
      const panel = p.userData.panel as THREE.Mesh;
      const curl = p.userData.curl as THREE.Mesh | undefined;
      const peg = p.userData.peg as THREE.Object3D | undefined;
      if (p.userData.done) {
        const k = Math.min(1, dt * 5);
        panel.rotation.x += (-1.44 - panel.rotation.x) * k;
        panel.position.y += (0.1 - panel.position.y) * k;
        if (curl) {
          curl.rotation.x += (-1.3 - curl.rotation.x) * k;
          curl.position.y += (0.14 - curl.position.y) * k;
          curl.position.z += (-0.95 - curl.position.z) * k;
        }
        if (peg) {
          peg.position.x += (0 - peg.position.x) * k;
          peg.position.y += (0.02 - peg.position.y) * k;
          peg.position.z += (-0.1 - peg.position.z) * k;
          peg.rotation.y += (0 - peg.rotation.y) * k;
          peg.rotation.z += (0.14 - peg.rotation.z) * k;
        }
      } else {
        // Качается вокруг поднятой позы, а не вокруг нуля: ноль — это плашмя,
        // и старая анимация складывала войлок в землю на каждом полупериоде.
        panel.rotation.x = -0.62 + Math.sin(now * 0.005 + (p.userData.sway as number)) * 0.26;
      }
    }

    if (this.dombra) {
      this.dombra.position.y =
        this.groundHeightAt(this.dombra.position.x, this.dombra.position.z) + 0.55 +
        Math.sin(now * 0.002) * (this.phase === 'song' || this.phase === 'outro' ? 0.09 : 0.02);
      if (this.phase === 'song' || this.phase === 'outro') this.dombra.rotation.z = -0.5 + Math.sin(now * 0.009) * 0.12;
    }

    if (this.phase === 'song' && now > this.nextAt) {
      this.phase = 'outro';
      this.pushHud();
    }

    for (const b of this.butterflies) {
      const ph = (b.userData.phase as number) + now * 0.001;
      b.position.x = (b.userData.ox as number) + Math.sin(ph) * 1.6;
      b.position.z = (b.userData.oz as number) + Math.cos(ph * 0.8) * 1.6;
      b.position.y = this.groundHeightAt(b.position.x, b.position.z) + 1.15 + Math.sin(ph * 1.5) * 0.4;
      b.rotation.y = ph;
    }

    this.updateGuideArrow(now, this.objectiveWorldPos(), ['intro', 'song', 'outro']);

    const prev = this.interactTarget;
    this.interactTarget = this.nearestInteract();
    if (prev !== this.interactTarget) this.pushHud();

    this.updateAmbient(dt, now);

    if (this.phase === 'intro') {
      const idx = Math.min(this.introI, 2);
      const from = [
        new THREE.Vector3(10, 9, SPAWN_Z + 13),
        new THREE.Vector3(4.5, 5.2, SPAWN_Z + 9),
        new THREE.Vector3(0, 5.4, SPAWN_Z + 7),
      ];
      const at = [
        // Open on the far end of the walk — the place the music is coming
        // from — then come down behind the hero.
        new THREE.Vector3(YURT.x, 2.2, YURT.z + 12),
        new THREE.Vector3(routeX(2), 1.4, 2),
        new THREE.Vector3(0, 1.1, SPAWN_Z - 4),
      ];
      const ease = idx === 0 ? 0.35 : idx === 1 ? 0.1 : 0.02;
      this.camera.position.lerp(from[idx], 1 - Math.pow(ease, dt));
      this.camera.lookAt(at[idx]);
    } else if (this.insideYurt && (this.phase === 'song' || this.phase === 'outro')) {
      // The closing shot is on the instrument, from across the room.
      this.updateCamera(
        new THREE.Vector3(YURT_INSIDE.x + 2.6, 3.8, YURT_INSIDE.z + 2.6),
        new THREE.Vector3(YURT_INSIDE.x, 2.6, YURT_INSIDE.z - 6.2),
        0.02,
        dt,
      );
    } else if (this.insideYurt) {
      // Pulled in and lifted, because the outdoor rig would put the camera
      // through the felt.
      const cx = YURT_INSIDE.x + (this.hero.position.x - YURT_INSIDE.x) * 0.6;
      this.updateCamera(
        new THREE.Vector3(cx, this.hero.position.y + 4.2, this.hero.position.z + 7.4),
        new THREE.Vector3(cx, this.hero.position.y + 1.4, this.hero.position.z - 3.2),
        0.0015,
        dt,
      );
      this.keepCameraInsideYurt();
    } else if (this.phase === 'song' || this.phase === 'outro') {
      const gy = this.groundHeightAt(YURT.x, YURT.z);
      this.updateCamera(
        new THREE.Vector3(YURT.x + 4.2, gy + 3.4, YURT.z + 9.5),
        new THREE.Vector3(YURT.x, gy + 1.4, YURT.z + 3.4),
        0.02,
        dt,
      );
    } else {
      const f = this.cameraFraming();
      this.updateCamera(
        new THREE.Vector3(
          this.cameraLateral(this.hero.position.x) + f.lateral,
          this.hero.position.y + 5.2 * f.heightMul,
          this.hero.position.z + 8.6 + f.backAdd,
        ),
        new THREE.Vector3(
          this.cameraLateral(this.hero.position.x),
          this.hero.position.y + 1.2 + f.lookUp,
          this.hero.position.z - 2.4 - f.lookAhead,
        ),
        0.0015,
        dt,
      );
    }

    this.renderFrame();
  };
}

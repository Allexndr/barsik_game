import * as THREE from 'three';

/**
 * A visual profile is art direction, not another post-processing preset.
 *
 * The same colours drive sky, fog and the light rig, so distant geometry
 * fades into the horizon instead of looking pasted onto it. Profiles stay
 * deliberately small: one level may pick a mood without owning a new shader
 * stack or another set of full-screen passes.
 */
export interface VisualProfile {
  id: 'forest' | 'dombra-golden' | 'orchard' | 'winter' | 'ice-trail';
  fogColor: number;
  fogNear: number;
  fogFar: number;
  sky: readonly [string, string, string];
  sunColor: number;
  sunIntensity: number;
  sunPosition: readonly [number, number, number];
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  fillColor: number;
  fillIntensity: number;
  rimColor: number;
  rimIntensity: number;
  ambientIntensity: number;
  exposureScale: number;
  bloomStrength?: number;
  bloomRadius?: number;
  bloomThreshold?: number;
  grass?: {
    root: number;
    tip: number;
    warmTip: number;
  };
  /** Baked into the sky texture: no extra geometry or draw call. */
  sunDisc?: {
    u: number;
    v: number;
    radius: number;
    inner: string;
    outer: string;
  };
}

export const VISUAL_PROFILES = {
  forest: {
    id: 'forest',
    fogColor: 0xb9d8d5,
    fogNear: 30,
    fogFar: 142,
    sky: ['#69BDEA', '#BFE8F2', '#F4EBCB'],
    sunColor: 0xffedbd,
    sunIntensity: 2.05,
    sunPosition: [-14, 24, 12],
    hemiSky: 0xd9eff4,
    hemiGround: 0x3f8248,
    hemiIntensity: 0.4,
    fillColor: 0xbcd6f5,
    fillIntensity: 0.18,
    rimColor: 0xdcefff,
    rimIntensity: 0.3,
    ambientIntensity: 0.045,
    exposureScale: 1,
    bloomStrength: 0.22,
    bloomRadius: 0.36,
    bloomThreshold: 0.82,
    grass: { root: 0x4f8c43, tip: 0x8fc45f, warmTip: 0xd1bd69 },
    sunDisc: {
      u: 0.34, v: 0.28, radius: 58,
      inner: 'rgba(255,248,211,0.88)', outer: 'rgba(255,211,122,0)',
    },
  },
  dombraGolden: {
    id: 'dombra-golden',
    fogColor: 0xc2d8c4,
    fogNear: 28,
    fogFar: 138,
    sky: ['#5DB6E5', '#B9E2E8', '#F6DFA9'],
    sunColor: 0xffd994,
    sunIntensity: 2.18,
    sunPosition: [-22, 23, 10],
    hemiSky: 0xd7edf0,
    hemiGround: 0x477d3d,
    hemiIntensity: 0.38,
    fillColor: 0xafd2ec,
    fillIntensity: 0.17,
    rimColor: 0xffebc5,
    rimIntensity: 0.3,
    ambientIntensity: 0.04,
    exposureScale: 1.01,
    bloomStrength: 0.3,
    bloomRadius: 0.4,
    bloomThreshold: 0.76,
    grass: { root: 0x4d853f, tip: 0x91bd55, warmTip: 0xd8b75d },
    sunDisc: {
      u: 0.3, v: 0.34, radius: 72,
      inner: 'rgba(255,247,211,0.96)', outer: 'rgba(255,181,74,0)',
    },
  },
  orchard: {
    id: 'orchard',
    fogColor: 0xc1e3dc,
    fogNear: 25,
    fogFar: 128,
    sky: ['#70C5EF', '#C6EEF1', '#F7ECC5'],
    sunColor: 0xffefbf,
    sunIntensity: 2.08,
    sunPosition: [-16, 25, 9],
    hemiSky: 0xe2f3ef,
    hemiGround: 0x4b944f,
    hemiIntensity: 0.4,
    fillColor: 0xb8dbef,
    fillIntensity: 0.17,
    rimColor: 0xf8f2cf,
    rimIntensity: 0.28,
    ambientIntensity: 0.045,
    exposureScale: 0.99,
    bloomStrength: 0.18,
    bloomRadius: 0.32,
    bloomThreshold: 0.86,
    grass: { root: 0x579347, tip: 0x9acb62, warmTip: 0xe1c968 },
    sunDisc: {
      u: 0.66, v: 0.26, radius: 52,
      inner: 'rgba(255,252,220,0.9)', outer: 'rgba(255,215,112,0)',
    },
  },
  winter: {
    id: 'winter',
    fogColor: 0xc6dbe7,
    fogNear: 24,
    fogFar: 132,
    sky: ['#6EA7CB', '#BBDCEB', '#F4FAFD'],
    sunColor: 0xfff1d8,
    sunIntensity: 2.05,
    sunPosition: [-17, 22, 8],
    hemiSky: 0xe2f2fa,
    hemiGround: 0x91aabe,
    hemiIntensity: 0.48,
    fillColor: 0xabcde4,
    fillIntensity: 0.2,
    rimColor: 0xf7fbff,
    rimIntensity: 0.34,
    ambientIntensity: 0.06,
    exposureScale: 0.98,
    bloomStrength: 0.2,
    bloomRadius: 0.34,
    bloomThreshold: 0.84,
    sunDisc: {
      u: 0.34, v: 0.24, radius: 46,
      inner: 'rgba(255,252,236,0.8)', outer: 'rgba(255,240,205,0)',
    },
  },
  iceTrail: {
    id: 'ice-trail',
    fogColor: 0xc7dfea,
    fogNear: 22,
    fogFar: 122,
    sky: ['#619AC2', '#B5D9E9', '#F5FBFF'],
    sunColor: 0xfff4df,
    sunIntensity: 2.12,
    sunPosition: [-18, 24, 6],
    hemiSky: 0xe4f3fa,
    hemiGround: 0x86a9be,
    hemiIntensity: 0.48,
    fillColor: 0x9fc8e0,
    fillIntensity: 0.2,
    rimColor: 0xe9fbff,
    rimIntensity: 0.38,
    ambientIntensity: 0.055,
    exposureScale: 0.97,
    bloomStrength: 0.27,
    bloomRadius: 0.38,
    bloomThreshold: 0.76,
    sunDisc: {
      u: 0.32, v: 0.22, radius: 48,
      inner: 'rgba(255,253,241,0.84)', outer: 'rgba(221,246,255,0)',
    },
  },
} satisfies Record<string, VisualProfile>;

export type VisualProfileName = keyof typeof VISUAL_PROFILES;

export function profileVector(position: readonly [number, number, number]) {
  return new THREE.Vector3(position[0], position[1], position[2]);
}

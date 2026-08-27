import type { PlushCharacterOptions } from './PlushCharacter';

/**
 * Season 1 human cast. Defined once so a character looks identical in every
 * level they appear in, and so the palette stays inside ART_DIRECTION.
 */

/** Айя — Barsik's first friend. Braids and a bright kerchief. */
export const AYA_LOOK: PlushCharacterOptions = {
  skin: 0xf4c49b,
  hair: 0x2f2018,
  top: 0xa29bfe,
  bottom: 0x6c5ce7,
  accent: 0xfd79a8,
  eye: 0x3d5a80,
  hairStyle: 'braids',
  height: 1.08,
};

/** Жұлдыз — the gardener who tends the orchard. */
export const ZHULDYZ_LOOK: PlushCharacterOptions = {
  skin: 0xefbe95,
  hair: 0x241a14,
  top: 0x00b894,
  bottom: 0x4a6fa5,
  accent: 0xfdcb6e,
  eye: 0x2f4858,
  hairStyle: 'bun',
  height: 1.28,
};

/** Айбек — the boy from the village fair. */
export const AIBEK_LOOK: PlushCharacterOptions = {
  skin: 0xf2c096,
  hair: 0x1f1712,
  top: 0x0984e3,
  bottom: 0x2d3436,
  accent: 0xe17055,
  eye: 0x34495e,
  hairStyle: 'cap',
  height: 1.12,
};

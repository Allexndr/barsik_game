import type { PlushCharacterOptions } from './PlushCharacter';

/**
 * Люди из состава первого сезона. Описаны один раз, чтобы персонаж выглядел
 * одинаково на каждом уровне, где появляется, и чтобы палитра не выходила за
 * рамки ART_DIRECTION.
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

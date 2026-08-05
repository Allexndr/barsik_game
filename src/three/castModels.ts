/**
 * Season 1 cast → Meshy / public GLB filenames under /assets/models/chars|props.
 * Used by levels, city, and finale group photo so NPCs share one mapping.
 */
export const CAST_CHAR_GLB: Record<string, string> = {
  gardener: 'zhuldyz.glb',
  gardener_l1: 'zhuldyz.glb',
  aya: 'aya.glb',
  hedgehog: 'hedgehog.glb',
  squirrel: 'squirrel.glb',
  putalo: 'putalo.glb',
  yagodka_rare: 'yagodka.glb',
  yagodka: 'yagodka.glb',
  ice_master: 'ice_master.glb',
  aibek: 'aibek.glb',
  bird: 'bird.glb',
  ice_friend_rare: 'aibek.glb',
  /** Discover extras (ambient / city / L10 farewell). */
  fox: 's1_fox.glb',
  rabbit: 's1_rabbit.glb',
  owl: 's1_owl.glb',
  frog: 's1_frog.glb',
  /** Kenney pets kit — ambient critters. */
  deer: 'pets/s1_kit_deer.glb',
  beaver: 'pets/s1_kit_beaver.glb',
  penguin: 'pets/s1_kit_penguin.glb',
  bee: 'pets/s1_kit_bee.glb',
  polar: 'pets/s1_kit_polar.glb',
  chick: 'pets/s1_kit_chick.glb',
  kit_cat: 'pets/s1_kit_cat.glb',
};

export const CAST_PROP_GLB: Record<string, string> = {
  snowman: 'snowman.glb',
  ice_rabbit: 'ice_rabbit.glb',
  /** Prefer Discover cartoon sign; fall back to original Meshy sign in placeWoodSign. */
  wood_sign: 'wood_sign_cartoon.glb',
  stump: 's1_stump_moss.glb',
  treasure_chest: 'treasure_chest.glb',
  golden_key: 'golden_key.glb',
  cabin: 'cabin.glb',
  treehouse: 'treehouse.glb',
  /** Season 1 unique props (Discover + Text-to-3D). */
  apple: 's1_gen_apple.glb',
  apple_gold: 's1_gen_apple_gold.glb',
  apple_discover: 's1_apple.glb',
  basket_red: 's1_gen_basket_red.glb',
  basket_green: 's1_gen_basket_green.glb',
  basket_blue: 's1_gen_basket_blue.glb',
  lantern: 's1_gen_lantern.glb',
  garland: 's1_gen_garland.glb',
  party_table: 's1_gen_party_table.glb',
  table: 's1_table.glb',
  mushroom_cottage: 's1_mushroom_cottage.glb',
  pine_tree: 's1_pine_tree.glb',
  rock_snow: 's1_rock_snow.glb',
  carrot: 's1_carrot.glb',
  pinecone: 's1_pinecone.glb',
  acorn_key: 's1_gen_acorn_key.glb',
  ice_crystal: 's1_gen_ice_crystal.glb',
  ice_key_prop: 's1_gen_ice_key.glb',
  camera: 's1_gen_camera.glb',
  snowflake: 's1_gen_snowflake.glb',
  map_scroll: 's1_gen_map_scroll.glb',
  wood_bridge: 's1_gen_wood_bridge.glb',
  /** Kenney kit fill; Meshy scarf wired when present. */
  fence: 's1_kit_fence.glb',
  fence_gate: 's1_kit_fence_gate.glb',
  bench: 'town/s1_kit_bench.glb',
  campfire: 'survival/s1_kit_campfire.glb',
  snow_pile: 'holiday/s1_kit_snow_pile.glb',
  tree_decorated: 'holiday/s1_kit_tree_decorated.glb',
  present: 'holiday/s1_kit_present.glb',
  present_b: 'holiday/s1_kit_present_b.glb',
  winter_hat: 'holiday/s1_kit_winter_hat.glb',
  scarf: 's1_gen_scarf.glb',
  strawberry: 'food/s1_kit_strawberry.glb',
  cake: 'food/s1_kit_cake.glb',
  honey: 'food/s1_kit_honey.glb',
  star: 'platformer/s1_kit_star.glb',
  flag: 'platformer/s1_kit_flag.glb',
  bridge_mini: 'miniforest/s1_kit_bridge_mini.glb',
  tent: 'survival/s1_kit_tent.glb',
  berry: 's1_gen_berry.glb',
  mushroom: 's1_gen_mushroom.glb',
  lantern_wood: 'holiday/s1_kit_lantern_wood.glb',
  lantern_hang: 'holiday/s1_kit_lantern_hang.glb',
  apple_kit: 'food/s1_kit_apple.glb',
  flowers: 'platformer/s1_kit_flowers.glb',
  flowers_tall: 'platformer/s1_kit_flowers_tall.glb',
  flower_red: 's1_kit_flower_red.glb',
};

/** Inventory keys (localStorage) shared across levels. */
export const KEY_ACORN = 'barsik_acorn_key';
export const KEY_ICE = 'barsik_ice_key';

export function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function writeFlag(key: string, on = true): void {
  try {
    if (on) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

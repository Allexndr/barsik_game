# Season 1 unique models inventory

Updated 2026-08-03. Style: soft-3D plush / cute Discover + Text-to-3D.  
Placement helper: `src/three/s1Place.ts` · map: `src/three/castModels.ts` · loader: `createGameGltfLoader` (Draco).

## Discover (curated)

| File | Role | Wired |
|------|------|-------|
| `chars/s1_fox.glb` | ambient fox | L8/10/11/14/15/16, City |
| `chars/s1_rabbit.glb` | ambient rabbit | M0/M1/L3/7/10/11/14/16, City |
| `chars/s1_frog.glb` | ambient frog | M0/M1/L3/6 |
| `chars/s1_owl.glb` | ambient owl | L3/6/7/9/10/15/16, City |
| `props/s1_apple.glb` | apple alt | L2 |
| `props/s1_carrot.glb` | snowman nose prop | L11/15 |
| `props/s1_pinecone.glb` | forest detail | L3/5/6/9/M1… |
| `props/s1_mushroom_cottage.glb` | landmark | L3/L7 |
| `props/s1_stump_moss.glb` | talking stump | L6 + L10 decor |
| `props/s1_rock_snow.glb` | winter rock | L4/11–15 |
| `props/s1_table.glb` | party table | L8 fallback |
| `props/s1_pine_tree.glb` | winter pine | L4/11–16 |
| + earlier | wood_sign_*, cabin, treehouse, chest, key, squirrel | M0/L5/9/16/signs |

## Text-to-3D (`s1_gen_*`)

| File | Role | Wired |
|------|------|-------|
| `apple` / `apple_gold` | orchard | L2 (+ L8 gold accent) |
| `basket_{red,green,blue}` | sort | L2 |
| `lantern` / `garland` | party | L8 + ambient M0/L7/9/14/City |
| `acorn_key` | quest key | L5/L9 |
| `ice_crystal` | shards/path | L11–13/16 |
| `ice_key` | winter key | L13/L16 |
| `camera` | Putalo | L7 |
| `party_table` | feast | L8 + City |
| `mushroom` / `berry` | trail decor | M0–L10… |
| `snowflake` | winter accent | L11/12/15/16 |
| `map_scroll` | quest lore | L8/9/10 |
| `wood_bridge` | creek/gorge | M0/M1/L4 |
| `fence` | (missing until credits) | skip |

## Kenney kit aliases (`s1_kit_*`) — free CC0, already in repo

Meshy credits blocked fence/bench/scarf gens → used packs instead.

| Alias | Source | Wired |
|-------|--------|-------|
| fence / fence_gate / bench | nature + town | M0, City, L3 |
| campfire / tent | survival | L14 |
| snow_pile / tree_decorated / winter_hat / present* | holiday | L11/14/15/16 |
| strawberry / cake / honey | food | M0/M1/L3/L8 |
| star / flag | platformer | L8/L16/City |
| bridge_mini | miniforest | M1 |
| deer / beaver / penguin / bee / polar | pets | ambient forest+winter |

## Still wanted when Meshy credits return

- `s1_gen_scarf.glb` (L14) — winter_hat is stand-in
- plush fence/bench (style match) — kit OK for now
- Discover auth refresh for more cute community props

## Laconic placement rule

2–6 landmarks per level + 1–3 ambient critters. Gameplay props first (keys, chests, baskets, crystals), then 1 landmark cottage/cabin/bridge, then small trail treats — never clutter the critical path.

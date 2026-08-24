# BARSIK Season 1 release-readiness roll-up

- Date: 2026-08-24
- Scope: Level 0 through Level 16 on the current stacked Codex branch chain
- Decision: **feature-complete at the scene-patch level; not yet a certified gold master**
- Production deployment: not performed

## Analysis

Season 1 is no longer a collection of untouched prototype scenes. Every level
has received an authored gameplay, reachability, camera, state-honesty or
render-budget pass. Shared camera-relative controls, the Level 0 yurt contract,
visual profiles, water and the complete RU/KK authored voice pack are also in
the branch chain.

The evidence is not uniform, however. A mount sweep proves that all seventeen
scenes initialize without browser errors; it does not prove that every mobile
quest can be completed from start to outro. The matrix below therefore keeps
full golden-route evidence separate from touch smoke evidence.

## Verified level matrix

| Level | Authored contract now covered | Desktop route | Mobile route | Current evidence status |
| ---: | --- | --- | --- | --- |
| 0 | Dombra trail, three lanterns, twelve-stone crossing/recovery, three visible yurt pegs, explicit door entry, interior kui | Full, 252.62 s, 0 errors | Full, 171.79/179.89 s, 0 errors | Certified in both tested browser profiles |
| 1 | Camera-relative rescue route and distant-decoration shadow budget | Full, 30.57 s, 0 errors | Full, 70.50 s, 9 interactions, 0 errors | Certified in both tested browser profiles |
| 2 | Honest orchard boundary, sorting, irrigation, golden-apple delivery and reduced orchard budget | Full, 81.72 s, 0 errors | First learning loop, touch action and boundary profile, 19.10 s | Mobile irrigation/outro route still required |
| 3 | Connected paw-print route, reachable terrain-attached sectors/bonuses/hedgehog, persistent search and instanced trail | Full 5/5 + hedgehog, 0 errors | Full 5/5 + 4/4 bonuses + hedgehog, 239.05 s, 0 errors | Certified in both tested browser profiles |
| 4 | Bridge batching/shadows, three planks, five child-readable timed sections, fail/retry, winch and Aya crossing | Full, 0 errors | Full, 145.89 s incl. 4 stumble recoveries, 0 errors | Certified in both tested browser profiles |
| 5 | Honest full corridor, squirrel escort, spill recovery, two blockages, basket handover, three story stops, terrain-attached carrier/markers and mobile enclosure budget | Full, 292.29 s, 0 errors | Full, 206.54 s, 0 errors | Certified in both tested browser profiles |
| 6 | Reachable clue/riddle route, wrong-answer recovery and distant shadow budget | Full, 71.02 s, 0 errors | Full 3/3 clues + 3/3 riddles + real wrong-answer recovery, 222.37 s, 0 errors | Certified in both tested browser profiles |
| 7 | Connected stealth route, trust recovery, choice and photographs | Full, 144.31 s, 0 errors | Full, 173.76 s, 0 errors | Certified in both tested browser profiles |
| 8 | Festival boundary, lanterns, garlands, fruit loop, gathering/photo and texture budget | Full, 75.52 s, 0 errors | First lantern, touch movement/orbit | Mobile full festival route still required |
| 9 | Twelve reachable berries, three guardian branches/trades, honest chest bypass and persistent pickups | Full, including wrong-symbol reset, 0 errors | First pickup plus reload/resource contract | Mobile guardians/chest/outro route still required |
| 10 | 21-step farewell clearing, five memories/gifts/farewells and exit map | Full, 0 errors | First gift plus touch movement/orbit | Mobile full farewell route still required |
| 11 | Honest catch heights, build-state snowman, golden catch, visible boundary and shadow budget | Full, 87.70 s, 0 errors | Full, 58.17 s, 0 errors | Certified in both tested browser profiles |
| 12 | Camera-relative ice physics, shared collision resolver, ordered crystals and physical finish gate | Full, 198.54 s, 0 errors | Full, 221.93 s, 0 errors | Certified in both tested browser profiles |
| 13 | Persistent delivered shards, honest sculpture growth/polish and reduced shadow budget | Full, 81.69 s, 0 errors | Full, 79.03 s, 0 errors | Certified in both tested browser profiles |
| 14 | Ordered eight-drift search, meaningful warmth/fires, scarf and firewood rescue | Full, 157.93 s, 0 errors | Full, 143.19 s, 0 errors | Certified in both tested browser profiles |
| 15 | Honest timed snow chunks, persistent delivered state, spare-snow retirement and complete snowman | Full incl. failure/retry, 130.08 s, 0 errors | Full, 105.86 s, 0 errors | Certified in both tested browser profiles |
| 16 | Five personal friend greetings/procession, three-crystal lock, carried key and visibly hinged finale chest | Full, 60.06 s, 0 errors | Full, 63.97 s, 0 errors | Certified in both tested browser profiles |

## Patch inventory

- Shared player contract: free 360° follow camera, camera-relative keyboard and
  joystick movement, desktop touch-control suppression and mobile safe insets.
- Space/readability: visible boundaries replace logical invisible gaps on the
  audited routes; interaction markers and persistent collected/delivered states
  make quest state readable in the world.
- Rendering: local instancing/merging, shared geometry/material families,
  shadow-caster reductions and profile-owned water/grass/ice treatments replace
  indiscriminate global quality cuts.
- Audio: 754 deterministic authored clips (381 RU, 373 KK), missing `0`, orphan
  `0`; actual RU desktop and KK mobile playback requests return audio with no
  browser errors.
- Engineering gates: current source passes TypeScript, ESLint with one known
  non-gameplay warning, production build, voice freshness and diff checks.

## Remaining release gates

### P0 — required before calling Season 1 bug-free

1. Run the missing full mobile golden routes for Level 2 and Levels 8–10. Do not
   promote touch smoke to completion evidence.
2. Complete one continuous new-save run from onboarding through Level 16 on
   the production build. Verify progress persistence, both keys, friends,
   rewards, language, reload recovery and map transitions without direct state
   mutation.
3. Test real Safari/iOS and Chrome/Android devices. The existing headless
   390×844 profile validates layout/input logic, not thermals, memory pressure,
   audio policy, WebGL context loss or vendor GPU drivers.
4. Merge the stacked work as one integration tip (or in commit order). Do not
   independently merge every derived branch as if they were parallel patches.

### P1 — quality target not yet proven

1. The original requirement that every level sustain more than five minutes is
   not certified. Automated sprint routes range from 30.57 to 252.62 seconds;
   child-paced playtests and telemetry are needed before adding filler or
   slowing movement.
2. Arbitrary runtime-interpolated narration can still miss a static clip.
   Decide which changing counters should stay visual-only and author finite
   spoken variants for the rest.
3. Measure frame-time percentiles, memory and temperature during complete
   routes on representative low/normal/high devices. Scene-start draw-call and
   triangle snapshots are necessary but not a sustained-performance proof.
4. Perform hands-on art-direction acceptance for Barsik, NPC animation,
   silhouettes and close-up material quality. The code pass establishes a
   coherent stylized frame and browser budget; it does not replace final
   character art production.

### P2 — engineering cleanup

1. Resolve or explicitly waive the existing `src/main.tsx` Fast Refresh lint
   warning.
2. Profile the 561.81 kB minified Three vendor chunk and loading waterfall. It
   is 143.48 kB gzip and level code is already lazy, so this is a measured load
   task rather than a reason to remove scene detail blindly.
3. Add the voice freshness check to CI so a dialogue rewrite cannot merge with
   a stale manifest again.

## QA route for release candidate

1. Start with empty local storage; complete onboarding, Level 0 and every map
   transition through Level 16 without a URL mission launcher.
2. Repeat the unverified mobile routes using only visible touch controls. At
   every phase rotate beyond 360°, hold joystick-forward after a 180° turn and
   probe visible boundaries/colliders.
3. Exercise fail/retry paths: river fall, bridge stumble, wrong riddle, wrong
   chest symbol, warmth recovery and melted snow chunk.
4. Run once in Russian and once in Kazakh with TTS enabled. Confirm every
   story/event line produces the intended language and mute/pause interrupts
   it immediately.
5. Record median and p95 frame time, peak renderer memory and WebGL errors at
   intro, densest gameplay phase and outro for each level on the device matrix.
6. Leave the game open for 30 minutes, background/foreground it, rotate the
   device, reload mid-level and finish the route. Require no duplicated actors,
   lost inventory, stuck input, leaked audio or black canvas.

## Release conclusion

The first-season scene work is substantial and test-backed, but the honest
answer is **not yet "everything is closed and optimization is at the maximum"**.
The code and authored-content foundation are ready for an integration release
candidate. Gold-master status waits on the four incomplete mobile routes, one
continuous save run and real-device performance/audio QA.

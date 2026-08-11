# 004 — Level 0 forest-floor quality stays inside the mobile budget

**Decision.** Level 0 is the visual reference pass for the season, but its
ground improvement stays procedural and scoped: a 256 px locally generated
floor map, baked terrain vertex colours, and crossed grass tufts in the
existing instanced grass mesh.

**Why.** The prior forest floor had good relief but read as a broad flat colour
field, while each grass instance was one card. The result did not establish the
close-up material quality expected of the first level or give the path a clear
relationship to its banks.

**Budget.** The terrain treatment is generated once at load and has no network
request or runtime post-process. The floor map is deliberately small and uses
anisotropy 2. Grass remains one draw call: Level 0 uses 5,000 two-blade tufts
on mobile (10,000 triangles) and 12,000 three-blade tufts on desktop (36,000
triangles). This is a controlled increase from the old 5,000 / 14,000 single
triangles, not a move to individual grass meshes or real-time volumetrics.

**Scope boundary.** `TerrainSurfaceOptions` is opt-in. Only Level 0 enables it
in this change, so no later Season 1 level is repainted accidentally. We did
not split grass into many culling chunks: this field is a camera-contained
single area, and extra draw calls would be a worse phone trade-off than the
bounded triangle increase. Revisit chunk culling only after real device frame
captures show it is necessary.

#!/usr/bin/env node
/**
 * What is actually inside a GLB.
 *
 * Written because two separate assumptions in this project turned out to be
 * wrong when checked rather than read:
 *
 *   * the hero was believed to be unriggable — true, but so is every other
 *     character, and the interesting number was that they are *all* single
 *     statues;
 *   * two characters rendered as black silhouettes in game, and the cause was
 *     visible here in one line: `materials: 0`. A primitive with no material
 *     gets three.js's default, which is metalness 1, and a metal with nothing
 *     to reflect is black.
 *
 * Parses the JSON chunk directly — no three.js, no loader, no guessing.
 *
 * Usage:
 *   node scripts/probe-glb.mjs public/assets/models/chars/barsik.glb
 *   node scripts/probe-glb.mjs 'public/assets/models/chars/*.glb'
 */
import { readFileSync, statSync } from 'node:fs';
import { globSync } from 'node:fs';

function probe(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${path}: not a GLB`);
  const chunkLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + chunkLen).toString('utf8'));

  let verts = 0;
  for (const mesh of json.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      const acc = prim.attributes?.POSITION;
      if (acc !== undefined) verts += json.accessors[acc]?.count ?? 0;
    }
  }

  return {
    file: path.split('/').pop(),
    kb: Math.round(statSync(path).size / 1024),
    verts,
    meshes: (json.meshes ?? []).length,
    materials: (json.materials ?? []).length,
    textures: (json.textures ?? []).length,
    skins: (json.skins ?? []).length,
    animations: (json.animations ?? []).length,
    clips: (json.animations ?? []).map((a) => a.name).filter(Boolean),
  };
}

const patterns = process.argv.slice(2);
if (!patterns.length) {
  console.error('usage: probe-glb.mjs <file.glb|glob> …');
  process.exit(1);
}

const files = patterns.flatMap((p) => (p.includes('*') ? globSync(p) : [p])).sort();
for (const f of files) {
  const r = probe(f);
  const flags = [];
  // No material at all means the loader's metalness-1 default, which renders
  // black with no environment map.
  if (r.materials === 0) flags.push('NO MATERIAL — renders black');
  if (r.textures === 0 && r.materials > 0) flags.push('untextured');
  if (r.skins === 0) flags.push('no skeleton');
  if (r.animations === 0) flags.push('no clips');
  if (r.verts > 40000) flags.push(`heavy (${r.verts} verts)`);
  console.log(
    `${r.file.padEnd(26)} ${String(r.kb).padStart(5)} KB  ` +
      `${String(r.verts).padStart(6)} v  ` +
      `mat ${r.materials}  tex ${r.textures}  skin ${r.skins}  anim ${r.animations}` +
      (flags.length ? `   ← ${flags.join(', ')}` : ''),
  );
  if (r.clips.length) console.log(`${' '.repeat(28)}clips: ${r.clips.join(', ')}`);
}

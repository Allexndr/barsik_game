#!/usr/bin/env node
/**
 * Give Barsik a skeleton.
 *
 * This is the one thing standing between the hero and looking as good as
 * everyone else in the game, and it is not a code problem.
 *
 * Every character GLB in this project is a single-mesh statue — verified by
 * parsing the glTF JSON chunk: barsik.glb, squirrel.glb, aya.glb and the rest
 * all report `skins: 0, animations: 0, nodes: 1, meshes: 1`. That is fine for
 * the squirrel, who stands at her shrine. It is not fine for the one character
 * who has to walk, run, jump and turn through seventeen levels: a statue that
 * does those things reads as broken, which is why the hero currently uses a
 * procedural jointed avatar instead of the far nicer-looking model.
 *
 * Meshy — already paid for, the key is already in .env.local — rigs a textured
 * humanoid GLB and hands back walk and run clips. barsik.glb qualifies on
 * every published requirement: .glb, textured (4 maps), humanoid, 8 086
 * vertices against Meshy's 300,000-face service ceiling. That provider limit
 * is not the game budget: the runtime quality gate is intentionally stricter.
 *
 * A generated output is a candidate, not an automatic release. The runtime
 * probes only `barsik_rigged.glb` and accepts it only after its mesh budget,
 * PBR textures, real skin, and named idle + walk/run clips pass the quality
 * gate. A one-clip rigging result may still need a DCC animation pass.
 *
 * Usage (costs Meshy credits, so this is yours to run, not mine):
 *   node scripts/rig-barsik.mjs
 *   node scripts/rig-barsik.mjs --height 1.45 --in public/assets/models/chars/barsik.glb
 *
 * Reads MESHY_API_KEY from the environment or from .env.local.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const API = 'https://api.meshy.ai/openapi/v1/rigging';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function apiKey() {
  if (process.env.MESHY_API_KEY) return process.env.MESHY_API_KEY;
  const envPath = join(ROOT, '.env.local');
  if (!existsSync(envPath)) return null;
  const line = (await readFile(envPath, 'utf8'))
    .split('\n')
    .find((l) => l.startsWith('MESHY_API_KEY='));
  return line ? line.slice('MESHY_API_KEY='.length).trim().replace(/^["']|["']$/g, '') : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const key = await apiKey();
  if (!key) {
    console.error('No MESHY_API_KEY (environment or .env.local).');
    process.exit(1);
  }

  const inPath = join(ROOT, arg('in', 'public/assets/models/chars/barsik.glb'));
  const outPath = join(ROOT, arg('out', 'public/assets/models/chars/barsik_rigged.glb'));
  const height = Number(arg('height', '1.45')); // the hero height the levels use

  const glb = await readFile(inPath);
  const mb = glb.length / 1024 / 1024;
  console.log(`Input: ${inPath} (${mb.toFixed(2)} MB)`);
  if (mb > 12) {
    // The documented limit is on face count, but a data URI this large is a
    // request body nobody enjoys debugging. Host it and pass a URL instead.
    console.error('Too large for a data URI. Upload it and pass --model-url.');
    process.exit(1);
  }

  const modelUrl =
    arg('model-url', null) ?? `data:model/gltf-binary;base64,${glb.toString('base64')}`;

  console.log('Creating rigging task…');
  const created = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model_url: modelUrl, height_meters: height }),
  });
  if (!created.ok) {
    console.error(`POST failed: ${created.status} ${await created.text()}`);
    // The most common rejection is orientation: Meshy requires the character
    // to face +Z. If that is the complaint, rotate the model in Blender and
    // re-export rather than trying to correct it here.
    process.exit(1);
  }
  const { result: id } = await created.json();
  console.log(`Task ${id}`);

  let task;
  for (let i = 0; i < 180; i++) {
    await sleep(5000);
    const res = await fetch(`${API}/${id}`, { headers: { Authorization: `Bearer ${key}` } });
    task = await res.json();
    process.stdout.write(`\r${task.status}  ${task.progress ?? 0}%   `);
    if (['SUCCEEDED', 'FAILED', 'CANCELED'].includes(task.status)) break;
  }
  console.log();

  if (task?.status !== 'SUCCEEDED') {
    console.error(`Rigging did not succeed: ${task?.status} ${task?.task_error?.message ?? ''}`);
    process.exit(1);
  }

  // The result carries several variants; the walking GLB is the one the game
  // wants, because `loadBarsikHeroRig` picks its walk clip by name and falls
  // back to clip 0 for idle.
  const r = task.result ?? {};
  const url =
    r.basic_animations?.animated_walking_glb_url ??
    r.animated_walking_glb_url ??
    r.rigged_character_glb_url ??
    r.glb_url;
  if (!url) {
    console.error('No GLB in the result. Raw result:');
    console.error(JSON.stringify(r, null, 2));
    process.exit(1);
  }

  console.log(`Downloading ${url.slice(0, 80)}…`);
  const glbOut = Buffer.from(await (await fetch(url)).arrayBuffer());
  await writeFile(outPath, glbOut);
  console.log(`Wrote ${outPath} (${(glbOut.length / 1024).toFixed(0)} KB)`);

  console.log('\nTreat the downloaded GLB as a candidate, not an auto-approved hero:');
  console.log('  node scripts/probe-glb.mjs public/assets/models/chars/barsik_rigged.glb');
  console.log('Expect a real skin, Idle plus Walk/Run clips, PBR textures, and the mobile budget.');
  console.log('Then test ?mission=0&hero=glb; the runtime falls back to the avatar if it rejects the asset.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

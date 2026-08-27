#!/usr/bin/env node
/**
 * Merge Meshy per-clip GLBs (same rig) into one GLB with named clips.
 *
 * Usage:
 *   node scripts/merge-glb-anims.mjs --out out.glb --clip Idle=Idle.glb --clip Walk=Walk.glb --clip Wave=Wave.glb
 *
 * Base mesh/skin comes from the first clip; other files contribute AnimationClips only
 * (tracks are bone-name based and share the Meshy skeleton).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

function parseArgs(argv) {
  const outIdx = argv.indexOf('--out');
  if (outIdx < 0 || !argv[outIdx + 1]) {
    console.error('Need --out path');
    process.exit(1);
  }
  const out = argv[outIdx + 1];
  const clips = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--clip' && argv[i + 1]) {
      const [name, path] = argv[i + 1].split('=');
      if (!name || !path) {
        console.error(`Bad --clip ${argv[i + 1]} (want Name=path.glb)`);
        process.exit(1);
      }
      clips.push({ name, path });
      i++;
    }
  }
  if (!clips.length) {
    console.error('Need at least one --clip Name=path.glb');
    process.exit(1);
  }
  return { out, clips };
}

function loadGlb(loader, path) {
  const buf = readFileSync(path);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((resolve, reject) => {
    loader.parse(
      ab,
      pathToFileURL(path).href.replace(/[^/]+$/, ''),
      resolve,
      reject,
    );
  });
}

async function main() {
  const { out, clips } = parseArgs(process.argv.slice(2));
  const loader = new GLTFLoader();

  const base = await loadGlb(loader, clips[0].path);
  const animations = [];

  for (const { name, path } of clips) {
    const gltf = path === clips[0].path ? base : await loadGlb(loader, path);
    if (!gltf.animations?.length) {
      console.warn(`No animations in ${path}`);
      continue;
    }
    // Prefer a clip whose name already matches; else first clip.
    const clip =
      gltf.animations.find((c) => c.name.toLowerCase() === name.toLowerCase()) ||
      gltf.animations[0];
    const renamed = clip.clone();
    renamed.name = name;
    animations.push(renamed);
    console.log(`+ ${name} from ${path} (tracks=${renamed.tracks.length}, dur=${renamed.duration.toFixed(2)}s)`);
  }

  if (!animations.length) {
    console.error('Nothing to merge');
    process.exit(1);
  }

  const exporter = new GLTFExporter();
  const arrayBuffer = await exporter.parseAsync(base.scene, {
    binary: true,
    animations,
    onlyVisible: false,
  });

  writeFileSync(out, Buffer.from(arrayBuffer));
  console.log(`Wrote ${out} (${(arrayBuffer.byteLength / 1024).toFixed(0)} KB) clips=${animations.map((a) => a.name).join(',')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

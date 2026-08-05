import * as THREE from 'three';

/**
 * Procedural snow-leopard coat.
 *
 * The rig was jointed and posed correctly and still read as a plastic toy,
 * because every surface on it was an untextured MeshStandardMaterial on a
 * smooth sphere. Next to the Meshy friends — which carry a painted fur map —
 * it looked like a different game's asset.
 *
 * Rosettes used to be flattened spheres stuck onto the body. Five of them, at
 * hand-picked positions, which is both too few to read as a coat and obviously
 * appliqué up close. Painting them into the map instead gives dozens of them,
 * following the surface, for one texture and no extra geometry.
 *
 * The bump map is the same noise at higher frequency. It costs nothing extra
 * at runtime and is what stops the fur reading as painted plastic: it breaks
 * the specular highlight that a bare sphere spreads evenly across the whole
 * face.
 */

const SIZE = 512;

/** Deterministic noise, so a coat is identical every run and never shimmers. */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function ctx2d(size = SIZE) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas.getContext('2d')!;
}

function hex(color: number) {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/**
 * One rosette: a broken ring of dark fur around a slightly warmer centre.
 * Drawn as a handful of arcs rather than a circle — a solid ring reads as a
 * polka dot, and a snow leopard's markings are open-sided.
 */
function rosette(c: CanvasRenderingContext2D, x: number, y: number, r: number, rng: () => number, spots: string) {
  c.save();
  c.translate(x, y);
  c.rotate(rng() * Math.PI * 2);
  c.strokeStyle = spots;
  c.lineCap = 'round';
  c.lineWidth = r * 0.42;
  const arcs = 2 + Math.floor(rng() * 2);
  let angle = rng() * Math.PI * 2;
  for (let i = 0; i < arcs; i++) {
    const span = 1.1 + rng() * 1.0;
    c.beginPath();
    c.arc(0, 0, r * (0.82 + rng() * 0.2), angle, angle + span);
    c.stroke();
    angle += span + 0.5 + rng() * 0.6;
  }
  // Centre, dimmer than the ring — the mark that separates a rosette from a
  // plain ring.
  c.globalAlpha = 0.35;
  c.fillStyle = spots;
  c.beginPath();
  c.arc(0, 0, r * 0.34, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/** Fine directional grain, so the surface is never flat between rosettes. */
function grain(c: CanvasRenderingContext2D, rng: () => number, color: string, count: number, alpha: number) {
  c.save();
  c.globalAlpha = alpha;
  c.strokeStyle = color;
  c.lineWidth = 1.1;
  c.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = rng() * SIZE;
    const y = rng() * SIZE;
    const len = 3 + rng() * 7;
    // Mostly downward: fur lies along the body, and consistent direction is
    // what stops the grain reading as television static.
    const a = Math.PI / 2 + (rng() - 0.5) * 0.9;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    c.stroke();
  }
  c.restore();
}

export interface FurMaps {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  dispose(): void;
}

const cache = new Map<string, FurMaps>();

/**
 * Coat colour map plus a matching bump map.
 *
 * `density` scales how many rosettes are drawn: the head wants fewer and
 * larger, a flank wants many. Cached per (fur, spots, density) because every
 * avatar in a scene shares the same coat and generating it is a few hundred
 * canvas operations.
 */
export function furMaps(fur: number, spots: number, density = 1): FurMaps {
  const key = `${fur}-${spots}-${density}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const rng = makeRng(0x5eed + fur + spots * 31 + Math.round(density * 1000));
  const colour = ctx2d();
  colour.fillStyle = hex(fur);
  colour.fillRect(0, 0, SIZE, SIZE);

  // Shade the belly side lighter. The V coordinate of a sphere runs pole to
  // pole, so a vertical gradient becomes top-to-bottom shading on the body.
  const grad = colour.createLinearGradient(0, 0, 0, SIZE);
  grad.addColorStop(0, 'rgba(255,255,255,0.16)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.10)');
  colour.fillStyle = grad;
  colour.fillRect(0, 0, SIZE, SIZE);

  grain(colour, rng, hex(spots), Math.round(1400 * density), 0.10);
  grain(colour, rng, '#ffffff', Math.round(900 * density), 0.13);

  const count = Math.round(26 * density);
  for (let i = 0; i < count; i++) {
    const r = (14 + rng() * 16) / density ** 0.5;
    const x = rng() * SIZE;
    // Keep the poles clear: a sphere's UVs pinch there and a rosette drawn
    // across the seam smears into a stripe.
    const y = SIZE * 0.12 + rng() * SIZE * 0.76;
    rosette(colour, x, y, r, rng, hex(spots));
    // Wrap horizontally so the seam has no bald line down it.
    if (x < r * 1.5) rosette(colour, x + SIZE, y, r, rng, hex(spots));
    if (x > SIZE - r * 1.5) rosette(colour, x - SIZE, y, r, rng, hex(spots));
  }

  const bumpRng = makeRng(0xb00b + fur);
  const bump = ctx2d();
  bump.fillStyle = '#808080';
  bump.fillRect(0, 0, SIZE, SIZE);
  grain(bump, bumpRng, '#ffffff', 2600, 0.30);
  grain(bump, bumpRng, '#000000', 2600, 0.26);

  const map = new THREE.CanvasTexture(colour.canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;

  const bumpMap = new THREE.CanvasTexture(bump.canvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;

  const maps: FurMaps = {
    map,
    bumpMap,
    dispose() {
      map.dispose();
      bumpMap.dispose();
      cache.delete(key);
    },
  };
  cache.set(key, maps);
  return maps;
}

/** Knit weave for the hoodie, so clothing is not plastic either. */
export function fabricMap(color: number): THREE.CanvasTexture {
  const key = `fabric-${color}`;
  const hit = cache.get(key);
  if (hit) return hit.map;

  const rng = makeRng(0xfab0 + color);
  const c = ctx2d(256);
  c.fillStyle = hex(color);
  c.fillRect(0, 0, 256, 256);
  c.globalAlpha = 0.07;
  for (let y = 0; y < 256; y += 3) {
    c.fillStyle = y % 6 === 0 ? '#ffffff' : '#000000';
    c.fillRect(0, y, 256, 1.4);
  }
  c.globalAlpha = 0.05;
  for (let i = 0; i < 500; i++) {
    c.fillStyle = rng() > 0.5 ? '#ffffff' : '#000000';
    c.fillRect(rng() * 256, rng() * 256, 2, 2);
  }

  const tex = new THREE.CanvasTexture(c.canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  cache.set(key, { map: tex, bumpMap: tex, dispose: () => { tex.dispose(); cache.delete(key); } });
  return tex;
}

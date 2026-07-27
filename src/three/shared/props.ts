import * as THREE from 'three';

/** Roblox-style zone disc on grass (readable area identity). */
export function zoneDisc(x: number, z: number, r: number, color: number, y = 0.02) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(r, 48),
    new THREE.MeshStandardMaterial({ color, roughness: 0.92, transparent: true, opacity: 0.92 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = false;
  m.castShadow = false;
  return m;
}

/** Floating path chevron — classic adventure “go this way”. */
export function pathArrow(x: number, z: number, rotY: number) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffe066,
    emissive: 0xf1c40f,
    emissiveIntensity: 0.85,
    roughness: 0.4,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 1.0), mat);
  body.position.y = 0.12;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.65, 3), mat);
  tip.rotation.x = Math.PI / 2;
  tip.position.set(0, 0.12, -0.7);
  body.castShadow = false;
  body.receiveShadow = false;
  tip.castShadow = false;
  tip.receiveShadow = false;
  // Ground glow marker for readability from distance
  const glow = new THREE.Mesh(
    new THREE.RingGeometry(0.6, 0.85, 18),
    new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.02;
  glow.castShadow = false;
  glow.receiveShadow = false;
  g.add(body, tip, glow);
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  g.userData.bob = Math.random() * Math.PI * 2;
  return g;
}

/** Bob the floating path chevrons in place. */
export function bobPathArrows(arrows: THREE.Group[], now: number) {
  for (const a of arrows) {
    a.position.y = 0.08 + Math.sin(now * 0.004 + (a.userData.bob as number)) * 0.06;
  }
}

/** Spawn pad under player (Roblox spawn energy). */
export function spawnPad(x: number, z: number) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.25, 40),
    new THREE.MeshStandardMaterial({ color: 0xa29bfe, emissive: 0x6c5ce7, emissiveIntensity: 0.85, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 32),
    new THREE.MeshStandardMaterial({ color: 0xdfe6e9, emissive: 0x74b9ff, emissiveIntensity: 0.25 }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.03;
  disc.castShadow = false;
  disc.receiveShadow = false;
  ring.castShadow = false;
  ring.receiveShadow = false;
  g.add(disc, ring);
  g.position.set(x, 0, z);
  return g;
}

/** Roblox-style quest beam + “!” above an NPC. */
export function questMarker(color = 0xffeaa7, emissive = 0xfdcb6e) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.18, 3.2, 10),
    new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 1.1, transparent: true, opacity: 0.75 }),
  );
  beam.position.y = 2.4;
  const bang = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xf1c40f, emissiveIntensity: 0.9 }),
  );
  bang.position.y = 4.2;
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshStandardMaterial({ color: 0x2d3436 }));
  dot.position.y = 4.05;
  beam.castShadow = false;
  beam.receiveShadow = false;
  bang.castShadow = false;
  bang.receiveShadow = false;
  dot.castShadow = false;
  dot.receiveShadow = false;
  g.add(beam, bang, dot);
  g.userData.beam = beam;
  g.userData.bang = bang;
  return g;
}

/** Spin and bob the “!” of a visible quest marker. */
export function animateQuestMarker(marker: THREE.Group, now: number, dt: number) {
  const bang = marker.userData.bang as THREE.Object3D;
  bang.position.y = 4.2 + Math.sin(now * 0.006) * 0.15;
  bang.rotation.y += dt * 2;
}

export function butterfly(x: number, z: number, color: number) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, side: THREE.DoubleSide });
  const w1 = new THREE.Mesh(new THREE.CircleGeometry(0.18, 8), mat);
  const w2 = w1.clone();
  w1.position.x = -0.12;
  w2.position.x = 0.12;
  w1.castShadow = false;
  w1.receiveShadow = false;
  w2.castShadow = false;
  w2.receiveShadow = false;
  g.add(w1, w2);
  g.position.set(x, 1.2 + Math.random(), z);
  g.userData.phase = Math.random() * Math.PI * 2;
  g.userData.ox = x;
  g.userData.oz = z;
  return g;
}

/** Loop butterflies around their spawn point. */
export function flutterButterflies(butterflies: THREE.Group[], now: number) {
  for (const b of butterflies) {
    const ph = (b.userData.phase as number) + now * 0.001;
    b.position.x = (b.userData.ox as number) + Math.sin(ph) * 1.2;
    b.position.z = (b.userData.oz as number) + Math.cos(ph * 0.8) * 1.2;
    b.position.y = 1.1 + Math.sin(ph * 1.5) * 0.4;
    b.rotation.y = ph;
  }
}

export function bush(x: number, z: number, scale = 1) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x27ae60 });
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry((0.45 + Math.random() * 0.25) * scale, 8, 8), mat);
    s.position.set((Math.random() - 0.5) * 0.55 * scale, 0.35 * scale, (Math.random() - 0.5) * 0.55 * scale);
    s.castShadow = false;
    s.receiveShadow = false;
    g.add(s);
  }
  g.position.set(x, 0, z);
  return g;
}

export function tulip(x: number, z: number, color: number) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.04, 0.55, 5),
    new THREE.MeshStandardMaterial({ color: 0x27ae60 }),
  );
  stem.position.y = 0.28;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), new THREE.MeshStandardMaterial({ color }));
  head.position.y = 0.58;
  head.scale.set(1, 1.35, 1);
  stem.castShadow = false;
  stem.receiveShadow = false;
  head.castShadow = false;
  head.receiveShadow = false;
  g.add(stem, head);
  g.position.set(x, 0, z);
  return g;
}

export function streamSegment(x1: number, z1: number, x2: number, z2: number, w: number) {
  const g = new THREE.Group();
  const len = Math.hypot(x2 - x1, z2 - z1);
  const ang = Math.atan2((x2 - x1) / len, (z2 - z1) / len);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(w, len),
    new THREE.MeshStandardMaterial({
      color: 0x29b6f6,
      emissive: 0x0288d1,
      emissiveIntensity: 0.08,
      roughness: 0.12,
      metalness: 0.15,
      transparent: true,
      opacity: 0.85,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.rotation.z = -ang;
  water.position.set((x1 + x2) / 2, 0.02, (z1 + z2) / 2);
  water.castShadow = false;
  water.receiveShadow = false;
  g.add(water);
  return g;
}

export interface BridgeOptions {
  /** Planks are laid at i * 0.42 for i in [-halfPlanks, halfPlanks]. */
  halfPlanks?: number;
  /** Plank length across the crossing direction. */
  deck?: number;
  railLength?: number;
  railOffset?: number;
}

export function bridge(x: number, z: number, rotY: number, opts: BridgeOptions = {}) {
  const { halfPlanks = 2, deck = 1.8, railLength = 2.6, railOffset = 0.85 } = opts;
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 1 });
  for (let i = -halfPlanks; i <= halfPlanks; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, deck), wood);
    plank.position.set(i * 0.42, 0.25, 0);
    plank.castShadow = true;
    plank.receiveShadow = true;
    g.add(plank);
  }
  const railL = new THREE.Mesh(new THREE.BoxGeometry(railLength, 0.1, 0.1), wood);
  railL.position.set(0, 0.55, -railOffset);
  const railR = railL.clone();
  railR.position.z = railOffset;
  g.add(railL, railR);
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  return g;
}

import * as THREE from 'three';

/**
 * Measure a level instead of guessing at it.
 *
 * Six level revisions this season each turned up the same handful of defect
 * shapes, and every one of them was found by hand, late, and usually by
 * noticing something odd in a screenshot:
 *
 *   * an interactable that no standing position can reach — L3's last
 *     search stop, unreachable because the distance was measured in 3D to a
 *     point two metres below the terrain;
 *   * props at absolute world zero over sculpted ground — L2's apples buried,
 *     twenty of L10's bushes underground;
 *   * a mesh with no material, which three.js renders pure black;
 *   * the hero walking out of frame, because fifteen scenes followed only a
 *     fraction of his sideways movement.
 *
 * Finding those one level at a time is the expensive way. Each check below is
 * generic — none of them know anything about a particular level — so the whole
 * season can be swept in one pass and the work ordered by what is actually
 * broken rather than by which level I looked at last.
 *
 * Usage, in the browser with a level open (dev build only):
 *
 *   await window.__audit()
 *   await window.__audit({ grid: 1.5 })   // finer sweep, slower
 */

export interface AuditFinding {
  kind: string;
  detail: string;
  severity: 'block' | 'high' | 'low';
}

export interface AuditReport {
  level: string;
  phase: string;
  playArea: { minX: number; maxX: number; minZ: number; maxZ: number; metres2: number };
  interactables: { reachable: number; unreachable: number };
  findings: AuditFinding[];
}

/** The scene shape the audit needs. Deliberately loose — this is a dev tool. */
interface AuditableScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  hero: THREE.Object3D;
  clock: { getDelta: () => number };
  loop: () => void;
  devTeleport: (x: number, z: number) => void;
  groundHeightAt: (x: number, z: number) => number;
  currentPhase: () => string;
  [key: string]: unknown;
}

/**
 * The area the player actually uses, taken from where the level put the things
 * it wants interacted with — plus a margin to walk round them.
 *
 * Not from every child in the scene: the first version did that and got
 * x −56…54, which is the mountain backdrop. Everything downstream then
 * measured the wrong place — the reachability sweep spent its budget on
 * hillside, and the camera test walked the hero out past the rim.
 */
function bounds(scene: THREE.Scene, hero: THREE.Object3D) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  const take = (p: THREE.Vector3) => {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  };
  take(hero.position);
  for (const o of declaredInteractables(scene)) take(o.getWorldPosition(new THREE.Vector3()));
  const pad = 6;
  return { minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad };
}

/**
 * Everything the level treats as interactable, found without asking the level
 * what those are: sweep standing positions across the play area, ask
 * `nearestInteract()` at each, and collect whatever comes back.
 *
 * Anything carrying an `is…` flag that never comes back from anywhere is
 * something a player cannot reach.
 */
function sweepInteractables(L: AuditableScene, step: number) {
  const b = bounds(L.scene, L.hero);
  const reachable = new Set<THREE.Object3D>();
  const nearest = (L as unknown as { nearestInteract?: () => THREE.Object3D | null }).nearestInteract;
  if (typeof nearest !== 'function') return { reachable, swept: 0, unsupported: true };

  const save = L.hero.position.clone();
  let swept = 0;
  for (let x = b.minX; x <= b.maxX; x += step) {
    for (let z = b.minZ; z <= b.maxZ; z += step) {
      L.devTeleport(x, z);
      swept++;
      const t = nearest.call(L);
      if (t) reachable.add(t);
    }
  }
  L.hero.position.copy(save);
  return { reachable, swept, unsupported: false };
}

/** Objects the level flagged as interactive, by convention: userData.isSomething. */
function declaredInteractables(scene: THREE.Scene) {
  const out: THREE.Object3D[] = [];
  scene.traverse((o) => {
    for (const k of Object.keys(o.userData)) {
      if (/^is[A-Z]/.test(k) && o.userData[k] === true) { out.push(o); return; }
    }
  });
  return out;
}

/** The `isSomething` flag an object carries, e.g. `isClue`. */
function interactKind(o: THREE.Object3D): string | null {
  for (const k of Object.keys(o.userData)) {
    if (/^is[A-Z]/.test(k) && o.userData[k] === true) return k;
  }
  return null;
}

export async function auditLevel(opts: { grid?: number } = {}): Promise<AuditReport> {
  const L = (window as unknown as { __level?: AuditableScene }).__level;
  if (!L) throw new Error('No level open. Load ?mission=N first.');
  const step = opts.grid ?? 2.5;
  const findings: AuditFinding[] = [];

  const b = bounds(L.scene, L.hero);
  const area = Math.round((b.maxX - b.minX) * (b.maxZ - b.minZ));

  // ── Reachability ───────────────────────────────────────────────
  const { reachable, unsupported } = sweepInteractables(L, step);
  const declared = declaredInteractables(L.scene);
  // Reachability is per phase: in L6's `seek` only clues answer, so the trees
  // are legitimately not targets and flagging them was a false alarm. Restrict
  // the check to the kinds this phase actually offered.
  const liveKinds = new Set([...reachable].map(interactKind).filter(Boolean));
  const missed = declared.filter(
    (o) => !reachable.has(o) && o.userData.done !== true && o.visible
      && liveKinds.has(interactKind(o)),
  );
  if (unsupported) {
    findings.push({ kind: 'no-sweep', severity: 'low', detail: 'scene has no nearestInteract()' });
  } else if (missed.length) {
    findings.push({
      kind: 'unreachable',
      severity: 'block',
      detail: `${missed.length} interactable(s) no standing position can reach: ` +
        missed.slice(0, 4).map((o) => `(${o.position.x.toFixed(0)},${o.position.z.toFixed(0)})`).join(' '),
    });
  }

  // ── Grounding ──────────────────────────────────────────────────
  const off: string[] = [];
  for (const o of L.scene.children) {
    if (!o.visible || o.children.length === 0) continue;
    if (Math.abs(o.position.x) > 60 || Math.abs(o.position.z) > 70) continue;   // backdrop
    const g = L.groundHeightAt(o.position.x, o.position.z);
    const gap = o.position.y - g;
    // Sky, clouds and quest beams legitimately float; anything sitting at
    // exactly world zero over raised ground is the bug.
    if (Math.abs(o.position.y) < 1e-6 && Math.abs(g) > 0.4) {
      off.push(`(${o.position.x.toFixed(0)},${o.position.z.toFixed(0)}) ground ${g.toFixed(1)}`);
    } else if (gap < -0.5 && gap > -8) {
      off.push(`(${o.position.x.toFixed(0)},${o.position.z.toFixed(0)}) sunk ${gap.toFixed(1)}`);
    }
  }
  if (off.length) {
    findings.push({
      kind: 'off-ground', severity: off.length > 4 ? 'high' : 'low',
      detail: `${off.length}: ${off.slice(0, 4).join(', ')}`,
    });
  }

  // ── Black materials ────────────────────────────────────────────
  let black = 0;
  L.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      // Any metal at all, not just the loader's default: there is no
      // environment map in this game, so a metallic surface has nothing to
      // reflect and renders black. Every CC0 model ships metallicFactor 1.
      const std = mat as THREE.MeshStandardMaterial;
      if (std?.isMeshStandardMaterial && std.metalness > 0.5
          && !std.metalnessMap && !std.envMap) black++;
    }
  });
  if (black) findings.push({ kind: 'black-material', severity: 'high', detail: `${black} mesh(es)` });

  // ── Camera keeps the hero ──────────────────────────────────────
  // Walk to the far corners of the play area and watch how close to the edge
  // of frame the hero gets. 1.0 is the edge.
  const realDelta = L.clock.getDelta;
  L.clock.getDelta = () => 1 / 60;
  let worst = 0;
  for (const [tx, tz] of [[b.minX, b.minZ], [b.maxX, b.minZ], [b.minX, b.maxZ], [b.maxX, b.maxZ]]) {
    L.devTeleport(0, 0);
    for (let i = 0; i < 40; i++) L.loop();
    for (let i = 0; i < 260; i++) {
      const h = L.hero.position;
      const dx = tx - h.x, dz = tz - h.z, d = Math.hypot(dx, dz);
      if (d > 1) { h.x += (dx / d) * 0.055; h.z += (dz / d) * 0.055; }
      h.y = L.groundHeightAt(h.x, h.z);
      L.loop();
      const p = h.clone().project(L.camera);
      worst = Math.max(worst, Math.abs(p.x));
    }
  }
  L.clock.getDelta = realDelta;
  if (worst > 0.85) {
    findings.push({ kind: 'hero-off-frame', severity: worst > 1 ? 'block' : 'high',
      detail: `worst |x| ${worst.toFixed(2)} of 1.0 at the play area corners` });
  }

  return {
    level: document.title,
    phase: L.currentPhase(),
    playArea: { ...b, metres2: area },
    interactables: { reachable: reachable.size, unreachable: missed.length },
    findings,
  };
}

if (import.meta.env.DEV) {
  (window as unknown as { __audit?: typeof auditLevel }).__audit = auditLevel;
}

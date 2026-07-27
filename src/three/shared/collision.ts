export const PLAYER_RADIUS = 0.45;

export type AabbCollider = { kind: 'aabb'; x: number; z: number; halfW: number; halfD: number };
export type CircleCollider = { kind: 'circle'; x: number; z: number; r: number };
export type Collider = AabbCollider | CircleCollider;

function pushAabb(nx: number, nz: number, c: AabbCollider) {
  const dx = Math.abs(nx - c.x);
  const dz = Math.abs(nz - c.z);
  if (dx < c.halfW + PLAYER_RADIUS && dz < c.halfD + PLAYER_RADIUS) {
    const pushX = c.halfW + PLAYER_RADIUS - dx;
    const pushZ = c.halfD + PLAYER_RADIUS - dz;
    if (pushX < pushZ) {
      nx = nx < c.x ? c.x - c.halfW - PLAYER_RADIUS : c.x + c.halfW + PLAYER_RADIUS;
    } else {
      nz = nz < c.z ? c.z - c.halfD - PLAYER_RADIUS : c.z + c.halfD + PLAYER_RADIUS;
    }
  }
  return { x: nx, z: nz };
}

function pushCircle(nx: number, nz: number, c: CircleCollider) {
  const dx = nx - c.x;
  const dz = nz - c.z;
  const dist = Math.hypot(dx, dz);
  const minDist = c.r + PLAYER_RADIUS;
  if (dist >= minDist) return { x: nx, z: nz };
  if (dist < 0.001) return { x: nx + minDist, z: nz };
  const scale = minDist / dist;
  return { x: c.x + dx * scale, z: c.z + dz * scale };
}

export function resolveCollisions(nx: number, nz: number, colliders: Collider[]) {
  for (const c of colliders) {
    const p = c.kind === 'aabb' ? pushAabb(nx, nz, c) : pushCircle(nx, nz, c);
    nx = p.x;
    nz = p.z;
  }
  return { x: nx, z: nz };
}

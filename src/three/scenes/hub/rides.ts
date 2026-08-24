import * as THREE from 'three';
import { assemble } from './arbatProps';
import { buildCarouselDisc, buildSeesawPlank, CIVIC } from './civicProps';

/**
 * Аттракционы.
 *
 * Главное решение — что по сети их синхронизировать не нужно. Ребёнок,
 * который сел на карусель, продолжает слать свои координаты десять раз в
 * секунду, ровно как при ходьбе: соседи видят, что он едет по кругу, без
 * единого лишнего пакета и без риска, что карусели на двух экранах разойдутся
 * по фазе. Аттракцион — вещь местная, общая только его геометрия.
 *
 * Кооперативность встроена в физику, а не в правило. Балансир не качается,
 * пока на нём один: доска просто перевешивает на его сторону. Карусель одному
 * поддаётся еле-еле. Ребёнку не пишут «нужен второй» — он это чувствует.
 */

export type RideKind = 'seesaw' | 'carousel' | 'swing';

export interface Ride {
  id: string;
  kind: RideKind;
  /** Где стоит и в каком радиусе предлагается сесть. */
  x: number;
  z: number;
  r: number;
  seats: number;
  ru: string;
  kk: string;
  /** Движущаяся часть — её и добавляют в сцену. */
  group: THREE.Group;
  /** Кто занял какие места. Индекс — номер места, значение — метка седока. */
  occupied: Array<string | null>;
  /** Шаг анимации. Возвращает, «работает» ли аттракцион по-настоящему. */
  update(dt: number, t: number): boolean;
  /** Куда посадить седока места `seat` прямо сейчас. */
  seatAt(seat: number, out: THREE.Vector3): number;
  dispose(): void;
}

function riders(ride: Ride): number {
  return ride.occupied.reduce<number>((n, o) => n + (o ? 1 : 0), 0);
}

// ── Балансир ────────────────────────────────────────────────────────────────

/**
 * Качели-балансир: два места на концах доски.
 *
 * Один седок — доска ложится на его сторону и стоит. Двое — качается. Это и
 * есть весь кооператив: механика сама объясняет, что нужен друг.
 */
export function createSeesaw(id: string, x: number, z: number): Ride {
  const group = new THREE.Group();
  group.position.set(x, 1.05, z);
  const plank = assemble(buildSeesawPlank(CIVIC.swing), `${id}-plank`);
  group.add(plank);

  let angle = 0;
  let velocity = 0;

  const ride: Ride = {
    id, kind: 'seesaw', x, z, r: 3.4, seats: 2,
    ru: 'качели-балансир', kk: 'тепе-теңдік әткеншегі',
    group,
    occupied: [null, null],
    update(dt) {
      const n = riders(ride);
      const both = ride.occupied[0] && ride.occupied[1];
      if (both) {
        // Двое: свободные колебания с лёгким подкачиванием, чтобы не затухли.
        velocity += -angle * 7.0 * dt;
        velocity *= 0.995;
        if (Math.abs(angle) < 0.02 && Math.abs(velocity) < 0.05) velocity += 0.9;
      } else if (n === 1) {
        // Один: перевешивает на свою сторону и там остаётся.
        const side = ride.occupied[0] ? -1 : 1;
        const rest = side * 0.34;
        velocity += (rest - angle) * 12 * dt;
        velocity *= 0.86;
      } else {
        velocity += -angle * 9 * dt;
        velocity *= 0.88;
      }
      angle = THREE.MathUtils.clamp(angle + velocity * dt, -0.38, 0.38);
      group.rotation.x = angle;
      return Boolean(both);
    },
    seatAt(seat, out) {
      const s = seat === 0 ? -1 : 1;
      const dz = s * 2.4;
      out.set(x, 1.05 + Math.sin(angle) * dz * -1 + 0.32, z + Math.cos(angle) * dz);
      return 0;
    },
    dispose() {
      plank.geometry.dispose();
    },
  };
  return ride;
}

// ── Карусель ────────────────────────────────────────────────────────────────

/**
 * Вертушка на шесть мест.
 *
 * Скорость растёт от числа седоков: одному она поддаётся еле-еле, вчетвером
 * летит. Не запрет, а приглашение позвать друзей.
 */
export function createCarousel(id: string, x: number, z: number): Ride {
  const group = new THREE.Group();
  group.position.set(x, 1.0, z);
  const disc = assemble(buildCarouselDisc(), `${id}-disc`);
  group.add(disc);

  let spin = 0;
  let speed = 0;

  const ride: Ride = {
    id, kind: 'carousel', x, z, r: 4.2, seats: 6,
    ru: 'карусель', kk: 'карусель',
    group,
    occupied: [null, null, null, null, null, null],
    update(dt) {
      const n = riders(ride);
      // Целевая скорость: один — 0.5 рад/с, шестеро — 2.6. Разгон плавный,
      // иначе карусель дёргается при каждом посадившемся.
      const target = n === 0 ? 0 : 0.35 + n * 0.38;
      speed += (target - speed) * Math.min(1, dt * 1.4);
      spin += speed * dt;
      group.rotation.y = spin;
      return n > 0;
    },
    seatAt(seat, out) {
      const a = (seat / 6) * Math.PI * 2 + spin;
      out.set(x + Math.cos(a) * 2.35, 1.16, z + Math.sin(a) * 2.35);
      return -a + Math.PI / 2;
    },
    dispose() {
      disc.geometry.dispose();
    },
  };
  return ride;
}

// ── Качели ──────────────────────────────────────────────────────────────────

/** Обычные качели: два независимых сиденья, каждое качается само по себе. */
export function createSwing(id: string, x: number, z: number): Ride {
  const group = new THREE.Group();
  const seats: THREE.Group[] = [];
  const angles = [0, 0];
  const vels = [0, 0];

  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(x + s * 1.5, 3.35, z);
    for (const t of [-0.24, 0.24]) {
      const rope = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 2.3, 5),
        new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.8 }),
      );
      rope.position.set(t, -1.15, 0);
      pivot.add(rope);
    }
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.1, 0.4),
      new THREE.MeshStandardMaterial({ color: CIVIC.swingAlt, roughness: 0.7 }),
    );
    seat.position.set(0, -2.3, 0);
    pivot.add(seat);
    group.add(pivot);
    seats.push(pivot);
  }

  const ride: Ride = {
    id, kind: 'swing', x, z, r: 3.6, seats: 2,
    ru: 'качели', kk: 'әткеншек',
    group,
    occupied: [null, null],
    update(dt) {
      let any = false;
      for (let i = 0; i < 2; i++) {
        const busy = Boolean(ride.occupied[i]);
        any = any || busy;
        if (busy) {
          vels[i] += -angles[i] * 9 * dt;
          vels[i] *= 0.998;
          if (Math.abs(angles[i]) < 0.03 && Math.abs(vels[i]) < 0.06) vels[i] += 1.1;
        } else {
          vels[i] += -angles[i] * 9 * dt;
          vels[i] *= 0.9;
        }
        angles[i] = THREE.MathUtils.clamp(angles[i] + vels[i] * dt, -0.85, 0.85);
        seats[i].rotation.x = angles[i];
      }
      return any;
    },
    seatAt(seat, out) {
      const a = angles[seat];
      const s = seat === 0 ? -1 : 1;
      out.set(x + s * 1.5, 3.35 - Math.cos(a) * 2.3 + 0.34, z + Math.sin(a) * 2.3);
      return 0;
    },
    dispose() {
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry.dispose();
        (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => mm?.dispose());
      });
    },
  };
  return ride;
}

/**
 * Свободное место поближе к ребёнку.
 *
 * Не первое попавшееся: на балансире это решает, качнётся доска или нет.
 * Садим на дальний от занятого конец, чтобы двое всегда оказались напротив
 * друг друга и аттракцион заработал.
 */
export function pickSeat(ride: Ride, from: THREE.Vector3): number {
  if (ride.kind === 'seesaw') {
    const taken = ride.occupied.findIndex((o) => o);
    if (taken >= 0) return ride.occupied[1 - taken] ? -1 : 1 - taken;
  }
  const scratch = new THREE.Vector3();
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < ride.seats; i++) {
    if (ride.occupied[i]) continue;
    ride.seatAt(i, scratch);
    const d = scratch.distanceTo(from);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

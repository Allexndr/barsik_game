import * as THREE from 'three';

/**
 * Измерять уровень, а не гадать о нём.
 *
 * Шесть переработок уровней за сезон дали одну и ту же горстку форм дефектов, и
 * каждая находилась вручную, поздно и обычно по чему-то странному на скриншоте:
 *
 *   * интерактивный объект, до которого не дотянуться ни из одной точки, — на L3
 *     последняя остановка поиска была недостижима, потому что расстояние мерилось
 *     в 3D до точки на два метра ниже рельефа;
 *   * предметы на абсолютном мировом нуле над скульптурной землёй — закопанные
 *     яблоки на L2, двадцать кустов под землёй на L10;
 *   * меш без материала, который three.js рисует чисто чёрным;
 *   * герой, уходящий из кадра, потому что пятнадцать сцен следовали лишь за
 *     долей его бокового смещения.
 *
 * Искать это по одному уровню — дорогой путь. Каждая проверка ниже универсальна:
 * ни одна ничего не знает про конкретный уровень, — поэтому весь сезон
 * прочёсывается за один проход, и работа выстраивается по тому, что действительно
 * сломано, а не по тому, какой уровень я смотрел последним.
 *
 * Использование в браузере с открытым уровнем (только в отладочной сборке):
 *
 *   await window.__audit()
 *   await window.__audit({ grid: 1.5 })   // мельче шаг, медленнее
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

/** Тот вид сцены, который нужен аудиту. Намеренно нестрогий: это отладочный инструмент. */
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
 * Область, которой игрок реально пользуется: берётся из того, куда уровень
 * поставил объекты для взаимодействия, плюс запас, чтобы их обойти.
 *
 * Не по всем потомкам сцены: первая версия делала именно так и получала x −56…54,
 * то есть горный задник. После этого всё дальше мерило не то место — перебор
 * достижимости тратил бюджет на склон, а проверка камеры уводила героя за край.
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
 * Всё, что уровень считает интерактивным, найденное без вопроса к самому уровню:
 * перебираем позиции стояния по игровой зоне, в каждой спрашиваем
 * `nearestInteract()` и собираем то, что вернулось.
 *
 * Всё, что несёт флаг `is…` и не возвращается ниоткуда, — это то, до чего игрок
 * дойти не может.
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

/** Объекты, помеченные уровнем как интерактивные по соглашению userData.isЧтоТо. */
function declaredInteractables(scene: THREE.Scene) {
  const out: THREE.Object3D[] = [];
  scene.traverse((o) => {
    for (const k of Object.keys(o.userData)) {
      if (/^is[A-Z]/.test(k) && o.userData[k] === true) { out.push(o); return; }
    }
  });
  return out;
}

/** Флаг вида `isЧтоТо`, который несёт объект, например `isClue`. */
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

  // ── Достижимость ───────────────────────────────────────────────
  const { reachable, unsupported } = sweepInteractables(L, step);
  const declared = declaredInteractables(L.scene);
  // Достижимость считается по фазам: в фазе `seek` на L6 отвечают только улики,
  // поэтому деревья законно не являются целями, и отметка о них была ложной
  // тревогой. Ограничиваем проверку теми видами, которые эта фаза действительно
  // предлагала.
  const liveKinds = new Set([...reachable].map(interactKind).filter(Boolean));
  const missed = declared.filter(
    (o) => !reachable.has(o) && o.userData.done !== true && o.visible
      && liveKinds.has(interactKind(o)),
  );
  if (unsupported) {
    findings.push({ kind: 'no-sweep', severity: 'low', detail: 'scene has no nearestInteract()' });
  } else if (reachable.size === 0 && declared.length > 0) {
    // `missed` фильтруется по `liveKinds`, который берётся из `reachable`, —
    // поэтому пустой `reachable` молча делает пустым и `missed`, и отчёт
    // показывает чистые «0 недостижимых», что на деле означает «в этой фазе не
    // проверено ничего осмысленного». Так и остался незамеченным BUG-001 —
    // недостижимый фрукт на тропе L1: он жил в фазе 'trail', а каждый вызов
    // аудита приходился на 'intro', где ещё ничего не активно. Заставить
    // переключиться в другие фазы универсально нельзя — имена фаз здесь
    // неизвестны, — но можно не дать отчёту выглядеть чистым, когда он не чист.
    findings.push({
      kind: 'phase-scoped-sweep', severity: 'low',
      detail: `${declared.length} is*-flagged object(s) exist in the scene but none were ` +
        `reachable in the current phase ('${L.currentPhase()}') — re-run after advancing ` +
        `phase to actually check reachability`,
    });
  } else if (missed.length) {
    findings.push({
      kind: 'unreachable',
      severity: 'block',
      detail: `${missed.length} interactable(s) no standing position can reach: ` +
        missed.slice(0, 4).map((o) => `(${o.position.x.toFixed(0)},${o.position.z.toFixed(0)})`).join(' '),
    });
  }

  // ── Посадка на землю ───────────────────────────────────────────
  const off: string[] = [];
  for (const o of L.scene.children) {
    if (!o.visible || o.children.length === 0) continue;
    if (Math.abs(o.position.x) > 60 || Math.abs(o.position.z) > 70) continue;   // backdrop
    const g = L.groundHeightAt(o.position.x, o.position.z);
    const gap = o.position.y - g;
    // Небо, облака и лучи целей парят законно; ошибка — это то, что стоит ровно на
    // мировом нуле над поднятой землёй.
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

  // ── Чёрные материалы ───────────────────────────────────────────
  let black = 0;
  L.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      // Любой металл вообще, а не только значение по умолчанию у загрузчика: карты
      // окружения в игре нет, металлической поверхности нечего отражать, и она
      // рисуется чёрной. Все модели CC0 приходят с metallicFactor 1.
      // Исключение: ненулевое свечение — это признанная правка ровно этой проблемы
      // (L4, L9 и L16 в этом сезоне), оно несёт цвет поверхности, не требуя
      // отражения. Без такого исключения каждый уже починенный случай вечно
      // всплывал бы той же находкой.
      const std = mat as THREE.MeshStandardMaterial;
      const emissiveCompensated = !!std?.emissive
        && (std.emissive.r > 0 || std.emissive.g > 0 || std.emissive.b > 0)
        && std.emissiveIntensity > 0;
      if (std?.isMeshStandardMaterial && std.metalness > 0.5
          && !std.metalnessMap && !std.envMap && !emissiveCompensated) black++;
    }
  });
  if (black) findings.push({ kind: 'black-material', severity: 'high', detail: `${black} mesh(es)` });

  // ── Камера не теряет героя ─────────────────────────────────────
  // Обходим дальние углы игровой зоны и смотрим, насколько близко герой подходит к
  // краю кадра. 1.0 — это край.
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
  // `worst > 0.85` ложно для NaN — та же ловушка, что и везде в JS: вырожденная
  // проекция камеры, например направление взгляда нулевой длины, молча дала бы
  // чистый уровень вместо провалившегося замера. Подтверждено вживую: один прогон
  // попал ровно в это после постороннего телепорта посреди сопровождения, который
  // оставил камеру в вырожденном состоянии.
  if (Number.isNaN(worst)) {
    findings.push({ kind: 'audit-error', severity: 'block',
      detail: 'hero-off-frame measurement produced NaN — camera projection failed, not a clean result' });
  } else if (worst > 0.85) {
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

if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __audit?: typeof auditLevel }).__audit = auditLevel;
}

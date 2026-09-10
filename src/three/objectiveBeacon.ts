import * as THREE from 'three';

/**
 * Столб света, стоящий над текущей целью.
 *
 * Стрелка-указатель говорит, в какую сторону; сказать, *где*, она не может, а на
 * уровнях, чьи биты стоят в десятках метров друг от друга, этого мало: пять
 * остановок поиска на L3 разнесены на 26–36 м, и между ними ничего нет, — дети на
 * тестах говорили «я не знаю, куда идти дальше» и называли уровень трудным. Одно
 * направление предлагает ребёнку идти через пустое поле на веру; маяк на
 * горизонте — это место, к которому можно пойти.
 *
 * Рисуется без проверки глубины, чтобы читаться поверх холма, а не тонуть в нём:
 * весь смысл в том, чтобы его было видно раньше, чем саму цель. Кольцо на земле
 * глубину сохраняет, поэтому маяк по-прежнему стоит *на* мире.
 */

const BEACON_COLOR = 0xffc857;
const COLUMN_HEIGHT = 7.5;
const COLUMN_RADIUS = 0.42;

export function createObjectiveBeacon(): THREE.Group {
  const group = new THREE.Group();
  group.userData.isGuideArrow = true; // audits treat it as guidance, not a prop
  group.renderOrder = 790;
  group.visible = false;

  const columnGeo = new THREE.CylinderGeometry(COLUMN_RADIUS * 0.45, COLUMN_RADIUS, COLUMN_HEIGHT, 12, 1, true);
  const columnMat = new THREE.MeshBasicMaterial({
    color: BEACON_COLOR,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
  });
  const column = new THREE.Mesh(columnGeo, columnMat);
  column.position.y = COLUMN_HEIGHT / 2;
  column.userData.isGuideArrow = true;

  // Лежит на земле и подчиняется глубине, поэтому маяк остаётся частью мира, а не
  // висит перед ним.
  const ringGeo = new THREE.RingGeometry(0.75, 1.15, 40);
  const ringMat = new THREE.MeshBasicMaterial({
    color: BEACON_COLOR,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  ring.userData.isGuideArrow = true;

  group.add(column, ring);

  // Собственного освобождения ресурсов нет: маяк — потомок сцены, а её разбор уже
  // обходит его и освобождает геометрию и материалы.
  return group;
}

/**
 * Ставит маяк и заставляет его дышать.
 *
 * Кольцо пульсирует тем чаще, чем ближе герой, — «теплее», без слов и без цифр, а
 * это единственный вид показания расстояния, который работает для ребёнка, ещё не
 * умеющего читать. `dist` — плоское расстояние, уже посчитанное вызывающим.
 */
export function aimObjectiveBeacon(
  beacon: THREE.Group,
  target: THREE.Vector3,
  groundY: number,
  dist: number,
  now: number,
) {
  beacon.position.set(target.x, groundY, target.z);

  // 0 — далеко, 1 — прямо над ним.
  const closeness = THREE.MathUtils.clamp(1 - dist / 40, 0, 1);
  const pulseHz = 0.9 + closeness * 2.4;
  const pulse = 0.5 + 0.5 * Math.sin((now / 1000) * pulseHz * Math.PI * 2);

  const [column, ring] = beacon.children as THREE.Mesh[];

  const columnMat = column.material as THREE.MeshBasicMaterial;
  // Гаснет по мере подхода: стоять внутри светового столба читается поломкой, а к
  // этому моменту цель и сама себе указатель.
  columnMat.opacity = 0.1 + 0.14 * pulse * (1 - closeness * 0.55);

  const ringMat = ring.material as THREE.MeshBasicMaterial;
  ringMat.opacity = 0.3 + 0.35 * pulse;
  const ringScale = 1 + pulse * 0.22;
  ring.scale.set(ringScale, ringScale, 1);
}

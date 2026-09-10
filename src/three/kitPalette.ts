import * as THREE from 'three';

/**
 * Перекрашивает модели наборов CC0 в мировую палитру игры.
 *
 * Природный набор Kenney сделан в бирюзе и персике: листва — голубой #6fe5d5,
 * кора — персиковый #f1bc9c, камень — бледный голубовато-белый. Долина Барсика —
 * тёплая жёлто-зелёная: земля от #4e8f45 до #8fc46e, тропа #c9a86a. Поставленный
 * без изменений, любой предмет набора читается чужеродным объектом, положенным на
 * траву, а не частью пейзажа, — именно от этого сцена выглядит замусоренной, как
 * бы аккуратно ни были расставлены предметы.
 *
 * Набор называет свои материалы осмысленно (`leafsGreen`, `woodBark`, `stone`) и
 * переиспользует эти имена во всех 329 моделях, поэтому переназначение по имени
 * приводит к общему виду сразу всю библиотеку.
 *
 * Листва намеренно оставлена чуть темнее и холоднее луга, чтобы деревья и кусты
 * читались на фоне земли, а не сливались с ней.
 */
const WORLD_PALETTE: Record<string, number> = {
  leafsGreen: 0x5f9e46,
  leafsDark: 0x417b3a,
  leafsFall: 0xd8964a,
  grass: 0x6ba64d,
  woodBark: 0x8a6242,
  woodBarkDark: 0x6b4a32,
  wood: 0xa8794f,
  woodDark: 0x74513a,
  woodInner: 0xc39a6b,
  woodBirch: 0xe6dccb,
  dirt: 0x9c7850,
  dirtDark: 0x7d5f3f,
  stone: 0xa9a69c,
  stoneDark: 0x87847b,
  water: 0x5fa8d3,
  corn: 0xe8c069,
};

/**
 * Применяет мировую палитру к одному материалу.
 * Возвращает true, если материал был перекрашен, чтобы вызывающий мог пропустить
 * собственные правки цвета.
 */
export function harmonizeKitMaterial(material: THREE.Material): boolean {
  const standard = material as THREE.MeshStandardMaterial;
  if (!standard.color) return false;
  // Текстурированные модели — наборы с общим атласом `colormap` — используют
  // `color` как множитель, поэтому их перекраска запачкала бы весь атлас.
  if (standard.map) return false;
  const target = WORLD_PALETTE[material.name];
  if (target === undefined) return false;
  standard.color.setHex(target);
  standard.needsUpdate = true;
  return true;
}

/**
 * Делает материал набора CC0 пригодным к отрисовке при освещении этого проекта и
 * переводит его в мировую палитру. Любой путь, загружающий модель из набора,
 * обязан пройти через это: в исходном виде наборы непригодны.
 *
 * Наборы Kenney образца 2020 года приходят с `metallicFactor: 1`, а карты
 * окружения в сцене нет — и они рисуются почти чёрным пластиком; одного этого
 * хватило, чтобы вся кромка леса на главном уровне выглядела силуэтами. Более
 * новые наборы делят один атлас `colormap`, где при линейном увеличении соседние
 * ячейки палитры затекают друг в друга.
 */
export function normalizeKitMaterial(material: THREE.Material): void {
  const standard = material as THREE.MeshStandardMaterial;
  if (!standard.isMeshStandardMaterial) return;
  harmonizeKitMaterial(standard);
  standard.metalness = 0;
  if (standard.roughness > 0.95) standard.roughness = 0.82;
  const map = standard.map;
  if (map) {
    map.colorSpace = THREE.SRGBColorSpace;
    map.magFilter = THREE.NearestFilter;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.generateMipmaps = true;
    map.anisotropy = 4;
    map.needsUpdate = true;
  }
  standard.needsUpdate = true;
}

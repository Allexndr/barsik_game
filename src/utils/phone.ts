/**
 * Отображение мобильного номера Казахстана и общего пространства +7:
 * +7 777 777 77 77. Всегда показывает ведущий плюс и группирует цифры 3-3-2-2.
 */

export function phoneDigits(raw: string): string {
  let d = raw.replace(/\D/g, '');
  // Междугородная восьмёрка превращается в семёрку.
  if (d.startsWith('8')) d = `7${d.slice(1)}`;
  // Набрано без кода страны — считаем, что +7.
  if (d.length > 0 && !d.startsWith('7')) d = `7${d}`;
  return d.slice(0, 11);
}

/** Формат для поля ввода во время набора. Пусто — пустая строка. */
export function formatPhoneDisplay(raw: string): string {
  const d = phoneDigits(raw);
  if (!d) return '';

  let out = `+${d[0]}`;
  const rest = d.slice(1);
  const groups = [3, 3, 2, 2];
  let i = 0;
  for (const g of groups) {
    if (i >= rest.length) break;
    out += ` ${rest.slice(i, i + g)}`;
    i += g;
  }
  return out;
}

/** Для мягкого гейта: полный казахстанский мобильный — 11 цифр, семёрка и десять. */
export function isPhoneComplete(raw: string): boolean {
  return phoneDigits(raw).length >= 11;
}

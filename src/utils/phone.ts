/**
 * Kazakhstan / shared +7 mobile display: +7 777 777 77 77
 * Always shows leading +, groups national digits 3-3-2-2.
 */

export function phoneDigits(raw: string): string {
  let d = raw.replace(/\D/g, '');
  // local trunk 8… → 7…
  if (d.startsWith('8')) d = `7${d.slice(1)}`;
  // typed without country code → assume +7
  if (d.length > 0 && !d.startsWith('7')) d = `7${d}`;
  return d.slice(0, 11);
}

/** Format for the input field while typing. Empty → "". */
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

/** Soft-gate: full KZ mobile is 11 digits (7 + 10). */
export function isPhoneComplete(raw: string): boolean {
  return phoneDigits(raw).length >= 11;
}

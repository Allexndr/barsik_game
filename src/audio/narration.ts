/** Не произносить текст-заглушку и быстро меняющиеся строки обратного отсчёта. */
export function shouldNarrateHudLine(line: string): boolean {
  const text = line.trim();
  if (!text || text === '…') return false;
  return !/\d+\s*(?:сек(?:унд[ыау]?)?|с)\b/i.test(text);
}

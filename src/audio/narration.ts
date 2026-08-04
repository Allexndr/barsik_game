/** Avoid speaking placeholder text and fast-changing countdown status lines. */
export function shouldNarrateHudLine(line: string): boolean {
  const text = line.trim();
  if (!text || text === '…') return false;
  return !/\d+\s*(?:сек(?:унд[ыау]?)?|с)\b/i.test(text);
}

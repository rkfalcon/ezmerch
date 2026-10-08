/** A preparation target, not a guarantee: every product still checks its actual print area. */
export function enhancementScale(width: number, height: number) {
  if (![width, height].every((n) => Number.isFinite(n) && n > 0)) return 1;
  return Math.max(
    1,
    Math.min(
      4,
      Math.floor(6000 / Math.max(width, height)),
      Math.floor(Math.sqrt(25_000_000 / (width * height))),
    ),
  );
}
export function needsAutomaticEnhancement(width: number, height: number) {
  return Math.max(width, height) < 3000 && enhancementScale(width, height) >= 2;
}

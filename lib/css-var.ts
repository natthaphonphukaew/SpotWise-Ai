/** Read a design token (CSS custom property) at runtime, e.g. cssVar("--color-comp"). */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

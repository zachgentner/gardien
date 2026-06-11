/**
 * Frost detection from a forecast. Pure functions over daily minimum
 * temperatures so the rule is trivially testable. A hard frost (<= 0°C by
 * default) threatens tender plants; a light frost (<= 2°C) is a heads-up.
 */

export type FrostSeverity = 'frost' | 'light-frost';

export interface FrostWarning {
  date: string;
  tempMinC: number;
  severity: FrostSeverity;
}

export interface FrostOptions {
  /** At or below this minimum is a hard frost (default 0°C). */
  frostC?: number;
  /** At or below this minimum (but above frostC) is a light frost (default 2°C). */
  lightFrostC?: number;
}

/**
 * Return a frost warning for every forecast day whose minimum is at or below
 * the light-frost threshold, classified by severity. Days without a known
 * minimum are skipped (we don't warn on data we don't have).
 */
export function frostWarnings(
  days: { date: string; tempMinC: number | null }[],
  options: FrostOptions = {},
): FrostWarning[] {
  const frostC = options.frostC ?? 0;
  const lightFrostC = options.lightFrostC ?? 2;

  const warnings: FrostWarning[] = [];
  for (const d of days) {
    if (d.tempMinC === null) continue;
    if (d.tempMinC <= frostC) {
      warnings.push({ date: d.date, tempMinC: d.tempMinC, severity: 'frost' });
    } else if (d.tempMinC <= lightFrostC) {
      warnings.push({ date: d.date, tempMinC: d.tempMinC, severity: 'light-frost' });
    }
  }
  return warnings;
}

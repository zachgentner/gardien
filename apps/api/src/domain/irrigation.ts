/**
 * Fail-safe automatic-irrigation decision. A pure function so the safety rules
 * — which keep a stuck valve or a bad sensor from flooding a bed — are
 * exhaustively unit-tested. The bias is always toward OFF: whenever an input is
 * missing, stale, or implausible, irrigation is withheld.
 */

export interface IrrigationInput {
  /** Latest soil-moisture reading (%), or null if unavailable. */
  soilMoisturePct: number | null;
  /** Irrigate only when moisture is below this (%). */
  thresholdPct: number;
  /** True when the latest reading is too old to trust. */
  sensorStale?: boolean;
  /** End time (ms epoch) of the previous run, if any. */
  lastRunEndedAt?: number | null;
  /** Minimum gap (ms) between runs — anti-flood. */
  minIntervalMs: number;
  /** Hard cap (ms) on a single run — the fail-safe timeout. */
  maxRunMs: number;
  /** Desired run length (ms). */
  requestedRunMs: number;
  /** Current time (ms epoch). */
  now: number;
}

export interface IrrigationDecision {
  irrigate: boolean;
  /** Run length in ms; always clamped to `maxRunMs` and 0 when not irrigating. */
  runMs: number;
  reason: string;
}

export function decideIrrigation(input: IrrigationInput): IrrigationDecision {
  const off = (reason: string): IrrigationDecision => ({ irrigate: false, runMs: 0, reason });

  // Fail safe: never run on missing, stale, or implausible data.
  if (input.sensorStale) return off('Soil-moisture reading is stale; holding off.');
  if (input.soilMoisturePct === null) return off('No soil-moisture reading; holding off.');
  if (input.soilMoisturePct < 0 || input.soilMoisturePct > 100) {
    return off('Soil-moisture reading is out of range; holding off.');
  }

  if (input.soilMoisturePct >= input.thresholdPct) {
    return off('Soil is moist enough.');
  }

  // Anti-flood: don't re-run before the minimum interval has elapsed.
  if (input.lastRunEndedAt != null && input.now - input.lastRunEndedAt < input.minIntervalMs) {
    return off('Irrigated too recently; waiting before running again.');
  }

  // Clamp the run to the hard maximum (stuck-valve timeout).
  const runMs = Math.min(Math.max(0, input.requestedRunMs), input.maxRunMs);
  if (runMs <= 0) return off('No run time requested.');

  return { irrigate: true, runMs, reason: 'Soil is dry; irrigating.' };
}

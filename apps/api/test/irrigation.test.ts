import { describe, it, expect } from 'vitest';
import { decideIrrigation, type IrrigationInput } from '../src/domain/irrigation.js';

const base: IrrigationInput = {
  soilMoisturePct: 20,
  thresholdPct: 30,
  minIntervalMs: 60 * 60 * 1000, // 1h
  maxRunMs: 5 * 60 * 1000, // 5m
  requestedRunMs: 2 * 60 * 1000, // 2m
  now: 10_000_000,
  lastRunEndedAt: null,
};

describe('decideIrrigation', () => {
  it('irrigates when soil is dry and everything is safe', () => {
    const d = decideIrrigation(base);
    expect(d.irrigate).toBe(true);
    expect(d.runMs).toBe(base.requestedRunMs);
  });

  it('clamps the run to the hard maximum', () => {
    const d = decideIrrigation({ ...base, requestedRunMs: 60 * 60 * 1000 });
    expect(d.irrigate).toBe(true);
    expect(d.runMs).toBe(base.maxRunMs);
  });

  it('holds off when soil is already moist', () => {
    expect(decideIrrigation({ ...base, soilMoisturePct: 35 }).irrigate).toBe(false);
  });

  it('fails safe on a stale reading', () => {
    expect(decideIrrigation({ ...base, sensorStale: true }).irrigate).toBe(false);
  });

  it('fails safe on a missing reading', () => {
    expect(decideIrrigation({ ...base, soilMoisturePct: null }).irrigate).toBe(false);
  });

  it('fails safe on an out-of-range reading', () => {
    expect(decideIrrigation({ ...base, soilMoisturePct: 250 }).irrigate).toBe(false);
  });

  it('does not re-run within the minimum interval (anti-flood)', () => {
    const d = decideIrrigation({ ...base, lastRunEndedAt: base.now - 10 * 60 * 1000 }); // 10m ago
    expect(d.irrigate).toBe(false);
    expect(d.reason).toMatch(/too recently/i);
  });

  it('runs again once the interval has passed', () => {
    const d = decideIrrigation({ ...base, lastRunEndedAt: base.now - 2 * 60 * 60 * 1000 }); // 2h ago
    expect(d.irrigate).toBe(true);
  });

  it('holds off when no run time is requested', () => {
    expect(decideIrrigation({ ...base, requestedRunMs: 0 }).irrigate).toBe(false);
  });
});

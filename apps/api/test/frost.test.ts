import { describe, it, expect } from 'vitest';
import { frostWarnings } from '../src/domain/frost.js';

describe('frostWarnings', () => {
  const days = [
    { date: '2026-04-01', tempMinC: -3 }, // hard frost
    { date: '2026-04-02', tempMinC: 1.5 }, // light frost
    { date: '2026-04-03', tempMinC: 8 }, // safe
    { date: '2026-04-04', tempMinC: 0 }, // hard frost (boundary)
    { date: '2026-04-05', tempMinC: null }, // unknown
  ];

  it('classifies hard vs light frost and skips safe/unknown days', () => {
    const w = frostWarnings(days);
    expect(w).toEqual([
      { date: '2026-04-01', tempMinC: -3, severity: 'frost' },
      { date: '2026-04-02', tempMinC: 1.5, severity: 'light-frost' },
      { date: '2026-04-04', tempMinC: 0, severity: 'frost' },
    ]);
  });

  it('respects custom thresholds', () => {
    const w = frostWarnings([{ date: 'd', tempMinC: 4 }], { frostC: 2, lightFrostC: 5 });
    expect(w).toEqual([{ date: 'd', tempMinC: 4, severity: 'light-frost' }]);
  });

  it('returns nothing for an all-warm forecast', () => {
    expect(frostWarnings([{ date: 'd', tempMinC: 12 }])).toEqual([]);
  });
});

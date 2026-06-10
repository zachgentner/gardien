import { describe, it, expect } from 'vitest';
import { footprintSqM, evaluateCapacity } from '../src/domain/spacing.js';

describe('footprintSqM', () => {
  it('multiplies in-row by row spacing (mm) into m^2', () => {
    expect(footprintSqM(600, 750)).toBeCloseTo(0.45, 5);
  });
  it('falls back to a square when row spacing is missing', () => {
    expect(footprintSqM(300)).toBeCloseTo(0.09, 5);
    expect(footprintSqM(300, null)).toBeCloseTo(0.09, 5);
  });
  it('is null when spacing is unknown or non-positive', () => {
    expect(footprintSqM(null)).toBeNull();
    expect(footprintSqM(0)).toBeNull();
  });
});

describe('evaluateCapacity', () => {
  it('sums footprint × quantity and stays within a roomy bed', () => {
    const res = evaluateCapacity(
      [{ plantName: 'Tomato', quantity: 4, spacingMm: 600 }],
      2.88,
    );
    expect(res.usedSqM).toBeCloseTo(1.44, 3);
    expect(res.over).toBe(false);
    expect(res.overBy).toBe(0);
    expect(res.unknown).toEqual([]);
  });

  it('flags overcrowding and reports the overflow', () => {
    const res = evaluateCapacity(
      [
        { plantName: 'Tomato', quantity: 4, spacingMm: 600 }, // 1.44
        { plantName: 'Potato', quantity: 12, spacingMm: 300 }, // 1.08
      ],
      2.0,
    );
    expect(res.usedSqM).toBeCloseTo(2.52, 3);
    expect(res.over).toBe(true);
    expect(res.overBy).toBeCloseTo(0.52, 3);
  });

  it('lists plants without spacing instead of counting them as zero', () => {
    const res = evaluateCapacity(
      [{ plantName: 'Mystery herb', quantity: 3, spacingMm: null }],
      1.0,
    );
    expect(res.usedSqM).toBe(0);
    expect(res.unknown).toEqual(['Mystery herb']);
  });

  it("can't judge capacity without a bed area", () => {
    const res = evaluateCapacity([{ plantName: 'Tomato', quantity: 4, spacingMm: 600 }], null);
    expect(res.over).toBe(false);
    expect(res.areaSqM).toBeNull();
  });
});

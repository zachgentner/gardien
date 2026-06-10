import { describe, it, expect } from 'vitest';
import { deriveAreaSqM, partitionPlantings, type PlantingStatus } from '../src/domain/bed.js';

describe('deriveAreaSqM', () => {
  it('multiplies millimetre dimensions into square metres', () => {
    expect(deriveAreaSqM(2400, 1200)).toBeCloseTo(2.88, 5);
    expect(deriveAreaSqM(1000, 1000)).toBeCloseTo(1, 5);
  });
  it('is undefined when either dimension is missing', () => {
    expect(deriveAreaSqM(2400, null)).toBeUndefined();
    expect(deriveAreaSqM(undefined, 1200)).toBeUndefined();
    expect(deriveAreaSqM(null, null)).toBeUndefined();
  });
});

describe('partitionPlantings', () => {
  const mk = (id: string, status: PlantingStatus) => ({ id, status });

  it('separates current (planned/planted) from history (harvested/removed)', () => {
    const { current, history } = partitionPlantings([
      mk('a', 'planned'),
      mk('b', 'planted'),
      mk('c', 'harvested'),
      mk('d', 'removed'),
    ]);
    expect(current.map((p) => p.id)).toEqual(['a', 'b']);
    expect(history.map((p) => p.id)).toEqual(['c', 'd']);
  });

  it('preserves input order within each group', () => {
    const { history } = partitionPlantings([
      mk('z', 'removed'),
      mk('y', 'harvested'),
    ]);
    expect(history.map((p) => p.id)).toEqual(['z', 'y']);
  });

  it('handles an empty list', () => {
    expect(partitionPlantings([])).toEqual({ current: [], history: [] });
  });
});

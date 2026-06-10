import { describe, it, expect } from 'vitest';
import {
  monthInRange,
  isPlantableInMonth,
  plantSuitableInZone,
  effectiveWindow,
  filterByZoneAndMonth,
  type PlantingWindow,
} from '../src/domain/planting.js';

describe('monthInRange', () => {
  it('handles a normal range', () => {
    expect(monthInRange(4, 3, 6)).toBe(true);
    expect(monthInRange(7, 3, 6)).toBe(false);
  });
  it('handles a wrap-around range (Nov-Feb)', () => {
    expect(monthInRange(12, 11, 2)).toBe(true);
    expect(monthInRange(1, 11, 2)).toBe(true);
    expect(monthInRange(2, 11, 2)).toBe(true);
    expect(monthInRange(6, 11, 2)).toBe(false);
  });
  it('rejects out-of-bounds months', () => {
    expect(monthInRange(0, 1, 12)).toBe(false);
    expect(monthInRange(13, 1, 12)).toBe(false);
  });
});

const curated: PlantingWindow = {
  zone: '8a',
  plantStartMonth: 3,
  plantEndMonth: 5,
  harvestStartMonth: 6,
  harvestEndMonth: 8,
  ownerId: null,
};
const override: PlantingWindow = {
  zone: '8a',
  plantStartMonth: 2,
  plantEndMonth: 4,
  ownerId: 'user-1',
};
const otherZone: PlantingWindow = { zone: '5b', plantStartMonth: 5, plantEndMonth: 6, ownerId: null };

describe('isPlantableInMonth', () => {
  it('uses the plant month range', () => {
    expect(isPlantableInMonth(curated, 4)).toBe(true);
    expect(isPlantableInMonth(curated, 9)).toBe(false);
  });
});

describe('plantSuitableInZone', () => {
  it('is true when a window exists for the zone', () => {
    expect(plantSuitableInZone([curated, otherZone], '8a')).toBe(true);
    expect(plantSuitableInZone([curated], '9b')).toBe(false);
  });
});

describe('effectiveWindow', () => {
  it('prefers a user override over the curated window', () => {
    const w = effectiveWindow([curated, override], '8a', 'user-1');
    expect(w?.plantStartMonth).toBe(2);
  });
  it('falls back to curated when the user has no override', () => {
    const w = effectiveWindow([curated, override], '8a', 'user-2');
    expect(w?.ownerId).toBeNull();
  });
  it('returns null when no window covers the zone', () => {
    expect(effectiveWindow([curated], '9b')).toBeNull();
  });
});

describe('filterByZoneAndMonth', () => {
  const plants = [
    { id: 'tomato', windows: [curated] },
    { id: 'kale', windows: [{ zone: '8a', plantStartMonth: 9, plantEndMonth: 10, ownerId: null }] },
    { id: 'cold-only', windows: [otherZone] },
  ];
  it('filters by zone suitability', () => {
    expect(filterByZoneAndMonth(plants, '8a').map((p) => p.id)).toEqual(['tomato', 'kale']);
  });
  it('filters by zone and month together', () => {
    expect(filterByZoneAndMonth(plants, '8a', 4).map((p) => p.id)).toEqual(['tomato']);
    expect(filterByZoneAndMonth(plants, '8a', 9).map((p) => p.id)).toEqual(['kale']);
  });
});

import { describe, it, expect } from 'vitest';
import { formatLength, formatArea, formatDimensions, UnitSystem } from '@gardien/shared';

describe('formatLength', () => {
  it('shows metres for metric, feet for imperial', () => {
    expect(formatLength(2400, UnitSystem.Metric)).toBe('2.4 m');
    expect(formatLength(1200, UnitSystem.Imperial)).toBe('3.94 ft');
  });
  it('drops trailing zeros', () => {
    expect(formatLength(1000, UnitSystem.Metric)).toBe('1 m');
  });
});

describe('formatArea', () => {
  it('shows m² for metric and ft² for imperial', () => {
    expect(formatArea(2.88, UnitSystem.Metric)).toBe('2.88 m²');
    expect(formatArea(1, UnitSystem.Imperial)).toBe('10.76 ft²');
  });
});

describe('formatDimensions', () => {
  it('joins length × width in the chosen system', () => {
    expect(formatDimensions(2400, 1200, UnitSystem.Metric)).toBe('2.4 m × 1.2 m');
  });
  it('is null when a dimension is missing', () => {
    expect(formatDimensions(2400, null, UnitSystem.Metric)).toBeNull();
    expect(formatDimensions(null, undefined, UnitSystem.Imperial)).toBeNull();
  });
});

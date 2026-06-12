import { describe, it, expect } from 'vitest';
import { planLimit, withinLimit } from '../src/domain/plan.js';

describe('plan limits', () => {
  it('caps the free plan and allows up to the limit', () => {
    expect(planLimit('free', 'gardens')).toBe(3);
    expect(withinLimit('free', 'gardens', 2)).toBe(true); // creating the 3rd
    expect(withinLimit('free', 'gardens', 3)).toBe(false); // 4th blocked
  });

  it('limits free devices', () => {
    expect(withinLimit('free', 'devices', 1)).toBe(true);
    expect(withinLimit('free', 'devices', 2)).toBe(false);
  });

  it('treats pro as effectively unlimited', () => {
    expect(planLimit('pro', 'gardens')).toBe(Infinity);
    expect(withinLimit('pro', 'devices', 9999)).toBe(true);
  });
});

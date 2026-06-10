import { describe, it, expect, vi } from 'vitest';
import {
  parseOpenMeteoResponse,
  forecastCacheKey,
  resolveForecast,
  WeatherUnavailableError,
  type ForecastCacheRow,
  type ResolveForecastDeps,
} from '../src/services/weather.js';

describe('forecastCacheKey', () => {
  it('rounds coordinates so nearby points share a key', () => {
    expect(forecastCacheKey(33.749, -84.388)).toBe('33.75,-84.39');
  });
});

describe('parseOpenMeteoResponse', () => {
  it('maps the daily arrays into forecast days', () => {
    const parsed = parseOpenMeteoResponse({
      latitude: 33.75,
      longitude: -84.39,
      daily: {
        time: ['2026-04-01', '2026-04-02'],
        temperature_2m_min: [-2, 5],
        temperature_2m_max: [10, 18],
        precipitation_sum: [0, 3.2],
      },
    });
    expect(parsed?.latitude).toBe(33.75);
    expect(parsed?.days).toEqual([
      { date: '2026-04-01', tempMinC: -2, tempMaxC: 10, precipMm: 0 },
      { date: '2026-04-02', tempMinC: 5, tempMaxC: 18, precipMm: 3.2 },
    ]);
  });

  it('returns null without coordinates or a daily block', () => {
    expect(parseOpenMeteoResponse({ latitude: 1, longitude: 2 })).toBeNull();
    expect(parseOpenMeteoResponse(null)).toBeNull();
  });
});

function makeDeps(overrides: Partial<ResolveForecastDeps> = {}): ResolveForecastDeps {
  return {
    getCache: vi.fn().mockResolvedValue(null),
    saveCache: vi.fn().mockResolvedValue(undefined),
    fetchUpstream: vi.fn().mockResolvedValue({
      latitude: 1,
      longitude: 2,
      daily: { time: ['2026-04-01'], temperature_2m_min: [3], temperature_2m_max: [9], precipitation_sum: [0] },
    }),
    now: () => 1_000_000,
    maxAgeMs: 60_000,
    ...overrides,
  };
}

const freshRow: ForecastCacheRow = {
  latitude: 1,
  longitude: 2,
  days: [{ date: '2026-04-01', tempMinC: 4, tempMaxC: 10, precipMm: 0 }],
  fetchedAt: new Date(1_000_000 - 1000),
};

describe('resolveForecast', () => {
  it('returns a fresh cache hit without calling upstream', async () => {
    const deps = makeDeps({ getCache: vi.fn().mockResolvedValue(freshRow) });
    const result = await resolveForecast(1, 2, deps);
    expect(result.source).toBe('cache');
    expect(deps.fetchUpstream).not.toHaveBeenCalled();
  });

  it('fetches upstream and caches on a miss', async () => {
    const deps = makeDeps();
    const result = await resolveForecast(1, 2, deps);
    expect(result.source).toBe('api');
    expect(result.days[0]?.tempMinC).toBe(3);
    expect(deps.saveCache).toHaveBeenCalledOnce();
  });

  it('degrades to a stale cache when upstream fails', async () => {
    const staleRow: ForecastCacheRow = { ...freshRow, fetchedAt: new Date(0) };
    const deps = makeDeps({
      getCache: vi.fn().mockResolvedValue(staleRow),
      fetchUpstream: vi.fn().mockRejectedValue(new Error('network down')),
    });
    const result = await resolveForecast(1, 2, deps);
    expect(result.source).toBe('stale-cache');
  });

  it('throws when upstream fails and there is no cache', async () => {
    const deps = makeDeps({ fetchUpstream: vi.fn().mockRejectedValue(new Error('down')) });
    await expect(resolveForecast(1, 2, deps)).rejects.toBeInstanceOf(WeatherUnavailableError);
  });
});

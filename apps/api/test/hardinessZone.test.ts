import { describe, it, expect, vi } from 'vitest';
import {
  normalizeZip,
  parsePhzmapiResponse,
  resolveZone,
  InvalidZipError,
  ZoneUnavailableError,
  type ZoneCacheRow,
  type ResolveZoneDeps,
} from '../src/services/hardinessZone.js';

describe('normalizeZip', () => {
  it('accepts a 5-digit ZIP', () => {
    expect(normalizeZip('90210')).toBe('90210');
  });
  it('accepts ZIP+4 and surrounding whitespace, keeping the 5-digit base', () => {
    expect(normalizeZip('  12345-6789 ')).toBe('12345');
  });
  it('rejects non-ZIP input', () => {
    expect(normalizeZip('abc')).toBeNull();
    expect(normalizeZip('1234')).toBeNull();
    expect(normalizeZip('123456')).toBeNull();
  });
});

describe('parsePhzmapiResponse', () => {
  it('extracts zone, coordinates, and temperature range', () => {
    const parsed = parsePhzmapiResponse('90210', {
      zone: '10b',
      temperature_range: '35 to 40',
      coordinates: { lat: 34.1, lon: -118.4 },
    });
    expect(parsed).toEqual({
      zip: '90210',
      hardinessZone: '10b',
      latitude: 34.1,
      longitude: -118.4,
      temperatureRange: '35 to 40',
    });
  });

  it('coerces string coordinates and tolerates missing fields', () => {
    const parsed = parsePhzmapiResponse('00001', { zone: '7a', coordinates: { lat: '40.0' } });
    expect(parsed?.latitude).toBe(40);
    expect(parsed?.longitude).toBeNull();
    expect(parsed?.temperatureRange).toBeNull();
  });

  it('returns null when there is no usable zone', () => {
    expect(parsePhzmapiResponse('90210', {})).toBeNull();
    expect(parsePhzmapiResponse('90210', null)).toBeNull();
  });
});

function makeDeps(overrides: Partial<ResolveZoneDeps> = {}): ResolveZoneDeps {
  return {
    getCache: vi.fn().mockResolvedValue(null),
    saveCache: vi.fn().mockResolvedValue(undefined),
    fetchUpstream: vi.fn().mockResolvedValue({ zone: '7b', coordinates: { lat: 1, lon: 2 } }),
    now: () => 1_000_000,
    maxAgeMs: 60_000,
    ...overrides,
  };
}

const freshRow: ZoneCacheRow = {
  zip: '30301',
  hardinessZone: '8a',
  latitude: 33.7,
  longitude: -84.4,
  temperatureRange: '10 to 15',
  fetchedAt: new Date(1_000_000 - 1000), // 1s old
};

describe('resolveZone', () => {
  it('rejects an invalid ZIP before any I/O', async () => {
    const deps = makeDeps();
    await expect(resolveZone('nope', deps)).rejects.toBeInstanceOf(InvalidZipError);
    expect(deps.fetchUpstream).not.toHaveBeenCalled();
  });

  it('returns a fresh cache hit without calling upstream', async () => {
    const deps = makeDeps({ getCache: vi.fn().mockResolvedValue(freshRow) });
    const result = await resolveZone('30301', deps);
    expect(result.source).toBe('cache');
    expect(result.hardinessZone).toBe('8a');
    expect(deps.fetchUpstream).not.toHaveBeenCalled();
  });

  it('fetches upstream and caches on a miss', async () => {
    const deps = makeDeps();
    const result = await resolveZone('12345', deps);
    expect(result.source).toBe('api');
    expect(result.hardinessZone).toBe('7b');
    expect(deps.saveCache).toHaveBeenCalledOnce();
  });

  it('refreshes a stale cache entry from upstream', async () => {
    const staleRow: ZoneCacheRow = { ...freshRow, fetchedAt: new Date(0) };
    const deps = makeDeps({ getCache: vi.fn().mockResolvedValue(staleRow) });
    const result = await resolveZone('30301', deps);
    expect(result.source).toBe('api');
    expect(deps.fetchUpstream).toHaveBeenCalledOnce();
  });

  it('degrades to a stale cache when upstream fails', async () => {
    const staleRow: ZoneCacheRow = { ...freshRow, fetchedAt: new Date(0) };
    const deps = makeDeps({
      getCache: vi.fn().mockResolvedValue(staleRow),
      fetchUpstream: vi.fn().mockRejectedValue(new Error('network down')),
    });
    const result = await resolveZone('30301', deps);
    expect(result.source).toBe('stale-cache');
    expect(result.hardinessZone).toBe('8a');
  });

  it('throws ZoneUnavailableError when upstream fails and there is no cache', async () => {
    const deps = makeDeps({
      fetchUpstream: vi.fn().mockRejectedValue(new Error('network down')),
    });
    await expect(resolveZone('12345', deps)).rejects.toBeInstanceOf(ZoneUnavailableError);
  });
});

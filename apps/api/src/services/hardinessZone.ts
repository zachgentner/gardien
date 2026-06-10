/**
 * USDA hardiness-zone lookup from a US ZIP code.
 *
 * Source: phzmapi.org (`https://phzmapi.org/{zip}.json`), which returns the
 * USDA zone, a temperature range, and coordinates for a ZIP.
 *
 * The pure pieces here (ZIP normalisation, response parsing, and the
 * cache/degradation policy in `resolveZone`) take their I/O via injected
 * dependencies so they are fully unit-testable without a network or database.
 */

export interface ZoneData {
  zip: string;
  hardinessZone: string;
  latitude: number | null;
  longitude: number | null;
  temperatureRange: string | null;
}

export interface ZoneResult extends ZoneData {
  /** Where the answer came from, so callers/clients can reason about freshness. */
  source: 'api' | 'cache' | 'stale-cache';
}

/** Raised when the zone cannot be resolved (bad upstream and no cache to fall back on). */
export class ZoneUnavailableError extends Error {
  constructor(message = 'Hardiness zone lookup is currently unavailable.') {
    super(message);
    this.name = 'ZoneUnavailableError';
  }
}

/** Thrown for input that is not a valid US ZIP. */
export class InvalidZipError extends Error {
  constructor(message = 'A valid 5-digit US ZIP code is required.') {
    super(message);
    this.name = 'InvalidZipError';
  }
}

/**
 * Normalise free-form input to a 5-digit ZIP, or return null if it isn't one.
 * Accepts ZIP+4 (`12345-6789`) and surrounding whitespace.
 */
export function normalizeZip(raw: string): string | null {
  const trimmed = raw.trim();
  const match = /^(\d{5})(?:-\d{4})?$/.exec(trimmed);
  return match ? match[1]! : null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Defensively parse a phzmapi.org response into ZoneData. Returns null if the
 * payload doesn't contain at least a usable zone.
 */
export function parsePhzmapiResponse(zip: string, data: unknown): ZoneData | null {
  if (typeof data !== 'object' || data === null) return null;
  const obj = data as Record<string, unknown>;

  const zone = typeof obj.zone === 'string' ? obj.zone.trim() : '';
  if (!zone) return null;

  const coords =
    typeof obj.coordinates === 'object' && obj.coordinates !== null
      ? (obj.coordinates as Record<string, unknown>)
      : {};

  const temperatureRange =
    typeof obj.temperature_range === 'string' ? obj.temperature_range : null;

  return {
    zip,
    hardinessZone: zone,
    latitude: toNumber(coords.lat),
    longitude: toNumber(coords.lon),
    temperatureRange,
  };
}

export interface ZoneCacheRow extends ZoneData {
  fetchedAt: Date;
}

export interface ResolveZoneDeps {
  /** Read a cached row for the ZIP, or null. */
  getCache: (zip: string) => Promise<ZoneCacheRow | null>;
  /** Persist a freshly fetched row. */
  saveCache: (data: ZoneData) => Promise<void>;
  /** Fetch the raw upstream payload; may throw on network/HTTP failure. */
  fetchUpstream: (zip: string) => Promise<unknown>;
  /** Cache entries older than this are refreshed when possible (default 30d). */
  maxAgeMs?: number;
  /** Clock seam for tests. */
  now?: () => number;
}

const DEFAULT_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

/**
 * Resolve a ZIP to a hardiness zone with caching and graceful degradation:
 *   1. fresh cache hit  -> return it (no upstream call)
 *   2. otherwise fetch upstream; on success cache + return
 *   3. upstream fails but a (possibly stale) cache exists -> return it
 *   4. upstream fails and no cache -> throw ZoneUnavailableError
 */
export async function resolveZone(rawZip: string, deps: ResolveZoneDeps): Promise<ZoneResult> {
  const zip = normalizeZip(rawZip);
  if (!zip) throw new InvalidZipError();

  const maxAgeMs = deps.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const now = deps.now ?? Date.now;

  const cached = await deps.getCache(zip);
  if (cached && now() - cached.fetchedAt.getTime() < maxAgeMs) {
    return { ...stripRow(cached), source: 'cache' };
  }

  try {
    const payload = await deps.fetchUpstream(zip);
    const parsed = parsePhzmapiResponse(zip, payload);
    if (!parsed) throw new ZoneUnavailableError('Upstream returned no usable zone.');
    await deps.saveCache(parsed);
    return { ...parsed, source: 'api' };
  } catch (err) {
    // Degrade gracefully: serve a stale cache entry if we have one.
    if (cached) return { ...stripRow(cached), source: 'stale-cache' };
    if (err instanceof ZoneUnavailableError) throw err;
    throw new ZoneUnavailableError();
  }
}

function stripRow(row: ZoneCacheRow): ZoneData {
  return {
    zip: row.zip,
    hardinessZone: row.hardinessZone,
    latitude: row.latitude,
    longitude: row.longitude,
    temperatureRange: row.temperatureRange,
  };
}

/** Production upstream fetch with a hard timeout so a hung API can't hang us. */
export async function fetchPhzmapi(zip: string, timeoutMs = 5000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://phzmapi.org/${zip}.json`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!res.ok) throw new ZoneUnavailableError(`Upstream responded ${res.status}.`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

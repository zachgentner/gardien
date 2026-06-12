/**
 * Localized weather forecast lookup from latitude/longitude.
 *
 * Source: Open-Meteo (`https://api.open-meteo.com/v1/forecast`), which returns a
 * daily forecast (min/max temperature, precipitation) with no API key.
 *
 * As with the hardiness-zone service, the pure pieces (response parsing and the
 * cache/degradation policy in `resolveForecast`) take their I/O via injected
 * dependencies, so they unit-test without a network or database.
 */

export interface ForecastDay {
  date: string; // YYYY-MM-DD
  tempMinC: number | null;
  tempMaxC: number | null;
  precipMm: number | null;
}

export interface Forecast {
  latitude: number;
  longitude: number;
  days: ForecastDay[];
}

export interface ForecastResult extends Forecast {
  /** Where the answer came from, so clients can reason about freshness. */
  source: 'api' | 'cache' | 'stale-cache';
}

export class WeatherUnavailableError extends Error {
  constructor(message = 'Weather forecast is currently unavailable.') {
    super(message);
    this.name = 'WeatherUnavailableError';
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Cache key from coordinates, rounded so nearby lookups share an entry. */
export function forecastCacheKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
}

/** Defensively parse an Open-Meteo response into a Forecast, or null. */
export function parseOpenMeteoResponse(data: unknown): Forecast | null {
  if (typeof data !== 'object' || data === null) return null;
  const obj = data as Record<string, unknown>;

  const latitude = toNumber(obj.latitude);
  const longitude = toNumber(obj.longitude);
  const daily =
    typeof obj.daily === 'object' && obj.daily !== null
      ? (obj.daily as Record<string, unknown>)
      : null;
  if (latitude === null || longitude === null || daily === null) return null;

  const time = Array.isArray(daily.time) ? daily.time : null;
  if (!time) return null;
  const mins = Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min : [];
  const maxs = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max : [];
  const precs = Array.isArray(daily.precipitation_sum) ? daily.precipitation_sum : [];

  const days: ForecastDay[] = time.map((t, i) => ({
    date: String(t),
    tempMinC: toNumber(mins[i]),
    tempMaxC: toNumber(maxs[i]),
    precipMm: toNumber(precs[i]),
  }));

  return { latitude, longitude, days };
}

export interface ForecastCacheRow extends Forecast {
  fetchedAt: Date;
}

export interface ResolveForecastDeps {
  getCache: (key: string) => Promise<ForecastCacheRow | null>;
  saveCache: (key: string, forecast: Forecast) => Promise<void>;
  fetchUpstream: (latitude: number, longitude: number) => Promise<unknown>;
  /** Cache entries older than this are refreshed when possible (default 3h). */
  maxAgeMs?: number;
  now?: () => number;
}

const DEFAULT_MAX_AGE_MS = 1000 * 60 * 60 * 3;

/**
 * Resolve a forecast for coordinates with caching and graceful degradation:
 *   1. fresh cache hit  -> return it (no upstream call)
 *   2. otherwise fetch upstream; on success cache + return
 *   3. upstream fails but a (possibly stale) cache exists -> return it
 *   4. upstream fails and no cache -> throw WeatherUnavailableError
 */
export async function resolveForecast(
  latitude: number,
  longitude: number,
  deps: ResolveForecastDeps,
): Promise<ForecastResult> {
  const key = forecastCacheKey(latitude, longitude);
  const maxAgeMs = deps.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const now = deps.now ?? Date.now;

  const cached = await deps.getCache(key);
  if (cached && now() - cached.fetchedAt.getTime() < maxAgeMs) {
    return { latitude: cached.latitude, longitude: cached.longitude, days: cached.days, source: 'cache' };
  }

  try {
    const payload = await deps.fetchUpstream(latitude, longitude);
    const parsed = parseOpenMeteoResponse(payload);
    if (!parsed) throw new WeatherUnavailableError('Upstream returned no usable forecast.');
    await deps.saveCache(key, parsed);
    return { ...parsed, source: 'api' };
  } catch (err) {
    if (cached) {
      return {
        latitude: cached.latitude,
        longitude: cached.longitude,
        days: cached.days,
        source: 'stale-cache',
      };
    }
    if (err instanceof WeatherUnavailableError) throw err;
    throw new WeatherUnavailableError();
  }
}

/** Production upstream fetch with a hard timeout so a hung API can't hang us. */
export async function fetchOpenMeteo(
  latitude: number,
  longitude: number,
  timeoutMs = 5000,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&daily=temperature_2m_min,temperature_2m_max,precipitation_sum&timezone=auto&forecast_days=7`;
    const res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new WeatherUnavailableError(`Upstream responded ${res.status}.`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

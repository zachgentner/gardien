import { useEffect, useState } from 'react';
import { UnitSystem, celsiusToFahrenheit } from '@gardien/shared';
import { api, ApiRequestError, type WeatherAlerts } from '../api/client';

function fmtTemp(c: number | null, system: string): string {
  if (c === null) return '—';
  const v = system === UnitSystem.Imperial ? celsiusToFahrenheit(c) : c;
  return `${Math.round(v)}°`;
}

function weekday(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { weekday: 'short' });
}

function dayNum(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : String(d.getDate());
}

function frostDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Phase 6 — localized forecast, frost warnings, and a pest/disease watch. */
export function WeatherPanel({ unitSystem }: { unitSystem: string }) {
  const [data, setData] = useState<WeatherAlerts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unit = unitSystem === UnitSystem.Imperial ? '°F' : '°C';

  useEffect(() => {
    let cancelled = false;
    api
      .getWeather()
      .then((w) => !cancelled && setData(w))
      .catch((err) => !cancelled && setError(err instanceof ApiRequestError ? err.message : 'Could not load weather.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section aria-labelledby="weather-heading" className="card">
      <div className="card__header">
        <h3 id="weather-heading">Weather &amp; frost</h3>
        {data?.source && data.source !== 'api' && (
          <span className="badge" title="Showing a cached forecast">
            {data.source === 'stale-cache' ? 'offline · cached' : 'cached'}
          </span>
        )}
      </div>

      {loading ? (
        <p>Loading forecast…</p>
      ) : error ? (
        <p className="form__error" role="alert">
          {error}
        </p>
      ) : !data?.located ? (
        <p className="muted">
          Set your location to see a local forecast and frost warnings.{' '}
          <a href="#/settings">Go to Settings →</a>
        </p>
      ) : (
        <>
          {data.frostWarnings.length > 0 && (
            <div className="frost-banner" role="alert">
              <strong>Frost expected.</strong>{' '}
              {data.frostWarnings.map((f, i) => (
                <span key={f.date}>
                  {i > 0 ? ', ' : ''}
                  {frostDate(f.date)} ({fmtTemp(f.tempMinC, unitSystem)}
                  {unit.slice(1)}
                  {f.severity === 'light-frost' ? ', light' : ''})
                </span>
              ))}
              . Protect or harvest tender crops.
            </div>
          )}

          {data.forecast.length === 0 ? (
            <p className="muted">Forecast is unavailable right now.</p>
          ) : (
            <ul className="forecast" aria-label={`7-day forecast in ${unit}`}>
              {data.forecast.map((d) => {
                const isFrost = data.frostWarnings.some((f) => f.date === d.date);
                return (
                  <li key={d.date} className={`forecast__day${isFrost ? ' is-frost' : ''}`}>
                    <span className="forecast__dow">{weekday(d.date)}</span>
                    <span className="forecast__date">{dayNum(d.date)}</span>
                    <span className="forecast__temp">
                      <span className="forecast__max">{fmtTemp(d.tempMaxC, unitSystem)}</span>
                      <span className="forecast__min">{fmtTemp(d.tempMinC, unitSystem)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {data.pestWatch.length > 0 && (
            <section>
              <h5>Watch for</h5>
              <ul className="list">
                {data.pestWatch.map((p) => (
                  <li key={`${p.plantName}-${p.name}`} className="list__item">
                    <strong>{p.name}</strong> <span className="badge">{p.kind}</span>
                    <span className="muted"> · {p.plantName}</span>
                    {p.management && <p className="muted">{p.management}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </section>
  );
}

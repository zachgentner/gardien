import { useCallback, useEffect, useState } from 'react';
import { api, ApiRequestError, type AccountLocation, type ZoneLookup } from '../api/client';

/**
 * Location & hardiness zone (Phase 1): look up a USDA zone from a ZIP code,
 * review it, save it to the account, or set a manual override (microclimates).
 */
export function LocationZone() {
  const [location, setLocation] = useState<AccountLocation | null>(null);
  const [zip, setZip] = useState('');
  const [preview, setPreview] = useState<ZoneLookup | null>(null);
  const [manualZone, setManualZone] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .getZone()
      .then((loc) => {
        setLocation(loc);
        if (loc.zipCode) setZip(loc.zipCode);
      })
      .catch(() => {
        /* not fatal — leave empty */
      });
  }, []);

  const onLookup = useCallback(async () => {
    setBusy(true);
    setError(null);
    setStatus(null);
    setPreview(null);
    try {
      const result = await api.lookupZone(zip);
      setPreview(result);
      if (result.source !== 'api') {
        setStatus(
          result.source === 'stale-cache'
            ? 'Zone API is unavailable — showing a previously cached result.'
            : 'Loaded from cache.',
        );
      }
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Lookup failed.');
    } finally {
      setBusy(false);
    }
  }, [zip]);

  const save = useCallback(async (input: { zip?: string; hardinessZone?: string }) => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const loc = await api.setZone(input);
      setLocation(loc);
      setPreview(null);
      setManualZone('');
      setStatus('Saved.');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save zone.');
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <section aria-labelledby="zone-heading" className="card">
      <h3 id="zone-heading">Location &amp; hardiness zone</h3>

      <p className="zone-current" role="status" aria-live="polite">
        {location?.hardinessZone ? (
          <>
            Current zone: <strong>{location.hardinessZone}</strong>
            {location.zoneIsManual && <span className="badge">manual</span>}
            {location.zipCode && <span className="muted"> · ZIP {location.zipCode}</span>}
          </>
        ) : (
          'No hardiness zone set yet.'
        )}
      </p>

      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void onLookup();
        }}
      >
        <div className="form__row">
          <label htmlFor="zip">ZIP code</label>
          <div className="inline">
            <input
              id="zip"
              inputMode="numeric"
              autoComplete="postal-code"
              pattern="\d{5}(-\d{4})?"
              placeholder="e.g. 30301"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
            />
            <button type="submit" disabled={busy || zip.trim().length < 5}>
              {busy ? 'Looking up…' : 'Look up zone'}
            </button>
          </div>
        </div>
      </form>

      {preview && (
        <div className="zone-preview" role="group" aria-label="Lookup result">
          <p>
            ZIP {preview.zip} is in zone <strong>{preview.hardinessZone}</strong>
            {preview.temperatureRange && <span className="muted"> ({preview.temperatureRange})</span>}.
          </p>
          <button type="button" disabled={busy} onClick={() => void save({ zip: preview.zip })}>
            Save this zone to my account
          </button>
        </div>
      )}

      <details className="zone-manual">
        <summary>Set zone manually (override)</summary>
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            if (manualZone.trim()) void save({ hardinessZone: manualZone.trim() });
          }}
        >
          <div className="form__row">
            <label htmlFor="manual-zone">Hardiness zone</label>
            <div className="inline">
              <input
                id="manual-zone"
                placeholder="e.g. 7b"
                maxLength={8}
                value={manualZone}
                onChange={(e) => setManualZone(e.target.value)}
              />
              <button type="submit" disabled={busy || !manualZone.trim()}>
                Save override
              </button>
            </div>
          </div>
        </form>
      </details>

      {status && (
        <p className="form__status" role="status" aria-live="polite">
          {status}
        </p>
      )}
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  ApiRequestError,
  type Device,
  type DeviceWithToken,
  type SensorReading,
  type SensorMetric,
  type IrrigationStatus,
  type IrrigationConfig,
  type Bed,
  type Garden,
} from '../api/client';

const METRIC_LABELS: Record<SensorMetric, string> = {
  air_temp: 'Air temp',
  humidity: 'Humidity',
  soil_moisture: 'Soil moisture',
  water_level: 'Water level',
  light: 'Light',
};
const METRIC_ORDER: SensorMetric[] = ['soil_moisture', 'air_temp', 'humidity', 'water_level', 'light'];

function fmtWhen(iso: string | null): string {
  if (!iso) return 'never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return d.toLocaleDateString();
}
const msToMin = (ms: number) => Math.round((ms / 60000) * 10) / 10;
const minToMs = (min: number) => Math.round(min * 60000);

/** Phase 7 — devices, sensor history, health, and irrigation control. */
export function Monitor() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listDevices();
      setDevices(list);
      setSelectedId((cur) => cur ?? list[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load devices.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    api
      .listGardens()
      .then((gs: Garden[]) => Promise.all(gs.map((g) => api.listBeds(g.id))))
      .then((lists) => setBeds(lists.flat()))
      .catch(() => undefined);
  }, [load]);

  const bedName = useMemo(() => {
    const m = new Map(beds.map((b) => [b.id, b.name]));
    return (id: string | null) => (id ? (m.get(id) ?? 'a bed') : '');
  }, [beds]);

  const selected = devices.find((d) => d.id === selectedId) ?? null;

  return (
    <section aria-labelledby="monitor-heading" className="card">
      <h3 id="monitor-heading">Monitor</h3>

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p>Loading devices…</p>
      ) : devices.length === 0 ? (
        <p className="muted">
          No devices yet. Register an ESP32 (or similar) controller below to start collecting
          sensor readings and automate irrigation.
        </p>
      ) : (
        <ul className="list">
          {devices.map((d) => (
            <li key={d.id} className="list__item">
              <button
                type="button"
                className="link-button"
                aria-pressed={selectedId === d.id}
                onClick={() => setSelectedId((cur) => (cur === d.id ? null : d.id))}
              >
                <strong>{d.name}</strong>
                {d.bedId && <span className="muted"> · {bedName(d.bedId)}</span>}
                <span className="muted"> · seen {fmtWhen(d.lastSeenAt)}</span>
                {d.batteryPct != null && <span className="badge">{Math.round(d.batteryPct)}%</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <DeviceForm beds={beds} onSaved={load} />

      {selected && (
        <DeviceDetail
          key={selected.id}
          device={selected}
          bedName={bedName}
          onChanged={load}
          onArchived={async () => {
            setSelectedId(null);
            await load();
          }}
        />
      )}
    </section>
  );
}

/** Register a device; reveal its one-time token. */
function DeviceForm({ beds, onSaved }: { beds: Bed[]; onSaved: () => Promise<void> | void }) {
  const [name, setName] = useState('');
  const [bedId, setBedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minted, setMinted] = useState<DeviceWithToken | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const dev = await api.createDevice({ name: name.trim(), bedId: bedId || undefined });
      setMinted(dev);
      setName('');
      setBedId('');
      await onSaved();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not register device.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="manage-add">
      <summary>Register a device</summary>
      {minted && <TokenReveal token={minted.token} onDismiss={() => setMinted(null)} />}
      <form className="form form--wide" onSubmit={submit}>
        <div className="form__row">
          <label htmlFor="dv-name">Name</label>
          <input
            id="dv-name"
            required
            maxLength={120}
            placeholder="e.g. Bed A controller"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="form__row">
          <label htmlFor="dv-bed">Bed (optional)</label>
          <select id="dv-bed" value={bedId} onChange={(e) => setBedId(e.target.value)}>
            <option value="">None</option>
            {beds.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <p className="form__error form--wide__full" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="form--wide__full" disabled={busy || !name.trim()}>
          {busy ? 'Registering…' : 'Register device'}
        </button>
      </form>
    </details>
  );
}

function TokenReveal({ token, onDismiss }: { token: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="token-reveal" role="alert">
      <p>
        <strong>Device token — shown once.</strong> Flash it to the device now; it can&apos;t be
        retrieved later (rotate to issue a new one).
      </p>
      <code className="token-reveal__code">{token}</code>
      <div className="inline">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(token);
            setCopied(true);
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button type="button" className="button--ghost" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

function DeviceDetail({
  device,
  bedName,
  onChanged,
  onArchived,
}: {
  device: Device;
  bedName: (id: string | null) => string;
  onChanged: () => Promise<void> | void;
  onArchived: () => Promise<void> | void;
}) {
  const [readings, setReadings] = useState<SensorReading[] | null>(null);
  const [rotated, setRotated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadReadings = useCallback(async () => {
    try {
      setReadings(await api.getDeviceReadings(device.id, undefined, 200));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load readings.');
    }
  }, [device.id]);

  useEffect(() => {
    void loadReadings();
  }, [loadReadings]);

  const byMetric = useMemo(() => {
    const m = new Map<SensorMetric, SensorReading[]>();
    for (const r of readings ?? []) {
      const arr = m.get(r.metric) ?? [];
      arr.push(r);
      m.set(r.metric, arr);
    }
    return m;
  }, [readings]);

  const archive = async () => {
    if (!window.confirm(`Archive “${device.name}”? Its readings are preserved.`)) return;
    try {
      await api.archiveDevice(device.id);
      await onArchived();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not archive device.');
    }
  };

  const rotate = async () => {
    try {
      const d = await api.rotateDeviceToken(device.id);
      setRotated(d.token);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not rotate token.');
    }
  };

  return (
    <article className="bed-detail" aria-live="polite">
      <div className="card__header">
        <h4>{device.name}</h4>
        <div className="inline">
          <button type="button" className="button--ghost" onClick={rotate}>
            Rotate token
          </button>
          <button type="button" className="button--danger" onClick={archive}>
            Archive
          </button>
        </div>
      </div>

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
      {rotated && <TokenReveal token={rotated} onDismiss={() => setRotated(null)} />}

      <dl className="plant-card__attrs">
        <Attr label="Last seen" value={fmtWhen(device.lastSeenAt)} />
        <Attr label="Battery" value={device.batteryPct != null ? `${Math.round(device.batteryPct)}%` : '—'} />
        <Attr label="Firmware" value={device.firmwareVersion ?? '—'} />
        <Attr label="Bed" value={device.bedId ? bedName(device.bedId) : '—'} />
      </dl>

      <h5>Sensors</h5>
      {readings == null ? (
        <p className="muted">Loading…</p>
      ) : byMetric.size === 0 ? (
        <p className="muted">No readings yet. The device sends these via the ingest API.</p>
      ) : (
        <ul className="sensor-grid">
          {METRIC_ORDER.filter((m) => byMetric.has(m)).map((m) => {
            const series = (byMetric.get(m) ?? []).slice().reverse(); // chronological
            const latest = series[series.length - 1]!;
            return (
              <li key={m} className="sensor">
                <span className="sensor__label">{METRIC_LABELS[m]}</span>
                <span className="sensor__value">
                  {latest.value}
                  <span className="sensor__unit"> {latest.unit}</span>
                </span>
                <Sparkline values={series.map((r) => r.value)} />
              </li>
            );
          })}
        </ul>
      )}

      <IrrigationPanel deviceId={device.id} onRan={() => Promise.all([loadReadings(), onChanged()])} />
    </article>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <svg className="sparkline" viewBox="0 0 100 28" aria-hidden="true" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = 26 - ((v - min) / span) * 24;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg className="sparkline" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IrrigationPanel({
  deviceId,
  onRan,
}: {
  deviceId: string;
  onRan: () => Promise<unknown> | void;
}) {
  const [status, setStatus] = useState<IrrigationStatus | null>(null);
  const [form, setForm] = useState<IrrigationConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await api.getIrrigation(deviceId);
      setStatus(s);
      setForm(s.config);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load irrigation.');
    }
  }, [deviceId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!form || !status) return null;

  const set = <K extends keyof IrrigationConfig>(k: K, v: IrrigationConfig[K]) =>
    setForm({ ...form, [k]: v });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.updateIrrigation(deviceId, form);
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save policy.');
    } finally {
      setBusy(false);
    }
  };

  const runNow = async () => {
    setBusy(true);
    try {
      await api.irrigateNow(deviceId);
      await load();
      await onRan();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not run irrigation.');
    } finally {
      setBusy(false);
    }
  };

  const d = status.decision;

  return (
    <section className="irrigation">
      <h5>Irrigation</h5>
      <p className={`conflict ${d.irrigate ? 'is-good' : ''}`}>
        <strong>{d.irrigate ? `Would irrigate ${msToMin(d.runMs)} min` : 'Holding off'}:</strong>{' '}
        {d.reason}
        {d.soilMoisturePct != null && <span className="muted"> · soil {d.soilMoisturePct}%</span>}
      </p>

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      <form className="form form--wide" onSubmit={save}>
        <div className="form__row">
          <label htmlFor="ir-enabled">Automatic</label>
          <input
            id="ir-enabled"
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => set('enabled', e.target.checked)}
          />
        </div>
        <div className="form__row">
          <label htmlFor="ir-threshold">Irrigate below (% moisture)</label>
          <input
            id="ir-threshold"
            type="number"
            min={0}
            max={100}
            value={form.thresholdPct}
            onChange={(e) => set('thresholdPct', Number(e.target.value))}
          />
        </div>
        <div className="form__row">
          <label htmlFor="ir-run">Run length (min)</label>
          <input
            id="ir-run"
            type="number"
            min={0}
            step="0.5"
            value={msToMin(form.requestedRunMs)}
            onChange={(e) => set('requestedRunMs', minToMs(Number(e.target.value)))}
          />
        </div>
        <div className="form__row">
          <label htmlFor="ir-max">Max run (min)</label>
          <input
            id="ir-max"
            type="number"
            min={0}
            step="0.5"
            value={msToMin(form.maxRunMs)}
            onChange={(e) => set('maxRunMs', minToMs(Number(e.target.value)))}
          />
        </div>
        <div className="form__row">
          <label htmlFor="ir-interval">Min interval (hours)</label>
          <input
            id="ir-interval"
            type="number"
            min={0}
            step="0.5"
            value={Math.round((form.minIntervalMs / 3600000) * 10) / 10}
            onChange={(e) => set('minIntervalMs', Math.round(Number(e.target.value) * 3600000))}
          />
        </div>
        <div className="inline form--wide__full">
          <button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save policy'}
          </button>
          <button type="button" className="button--ghost" onClick={runNow} disabled={busy}>
            Run check now
          </button>
        </div>
      </form>

      {status.recentRuns.length > 0 && (
        <>
          <h5>Recent runs</h5>
          <ul className="list">
            {status.recentRuns.map((r) => (
              <li key={r.id} className="list__item">
                <strong>{msToMin(r.runMs)} min</strong>
                <span className="muted"> · {new Date(r.startedAt).toLocaleString()}</span>
                <div className="muted">{r.reason}</div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Attr({ label, value }: { label: string; value: string }) {
  return (
    <div className="attr">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

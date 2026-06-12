import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  UnitSystem,
  LengthUnit,
  lengthToMillimeters,
  millimetersTo,
  formatArea,
  formatDimensions,
} from '@gardien/shared';
import {
  api,
  ApiRequestError,
  type Garden,
  type Bed,
  type BedType,
  type BedDetail,
  type BedPlanting,
  type Season,
  type PlantRecommendation,
} from '../api/client';

const BED_TYPES: { value: BedType; label: string }[] = [
  { value: 'raised_bed', label: 'Raised bed' },
  { value: 'in_ground', label: 'In-ground' },
  { value: 'container', label: 'Container' },
  { value: 'greenhouse', label: 'Greenhouse' },
];

const SENSOR_LABELS: Record<string, string> = {
  air_temp: 'Air temp',
  humidity: 'Humidity',
  soil_moisture: 'Soil moisture',
  water_level: 'Water level',
  light: 'Light',
};

const STATUS_LABELS: Record<string, string> = {
  planned: 'Planned',
  planted: 'Planted',
  harvested: 'Harvested',
  removed: 'Removed',
};

/** Phase 3 — manage gardens & beds and view each bed's plantings and history. */
export function GardenManager({ unitSystem }: { unitSystem: string }) {
  const system: UnitSystem =
    unitSystem === UnitSystem.Metric ? UnitSystem.Metric : UnitSystem.Imperial;
  const lengthUnit = system === UnitSystem.Metric ? LengthUnit.Meter : LengthUnit.Foot;
  const lengthLabel = system === UnitSystem.Metric ? 'm' : 'ft';

  const [gardens, setGardens] = useState<Garden[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedGardenId, setSelectedGardenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const seasonName = useMemo(() => {
    const map = new Map(seasons.map((s) => [s.id, s.name]));
    return (id: string | null) => (id ? (map.get(id) ?? '') : '');
  }, [seasons]);

  const loadGardens = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listGardens();
      setGardens(list);
      setSelectedGardenId((cur) => cur ?? list[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load gardens.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGardens();
    api.listSeasons().then(setSeasons).catch(() => undefined);
  }, [loadGardens]);

  const selectedGarden = gardens.find((g) => g.id === selectedGardenId) ?? null;

  return (
    <section aria-labelledby="gm-heading" className="card">
      <h3 id="gm-heading">Gardens &amp; beds</h3>

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      <div className="form__row">
        <label htmlFor="gm-garden">Garden</label>
        <div className="inline">
          <select
            id="gm-garden"
            value={selectedGardenId ?? ''}
            onChange={(e) => setSelectedGardenId(e.target.value || null)}
            disabled={loading || gardens.length === 0}
          >
            {gardens.length === 0 && <option value="">No gardens yet</option>}
            {gardens.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
                {g.hardinessZone ? ` — Zone ${g.hardinessZone}` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <GardenForm
        onSaved={async (g) => {
          await loadGardens();
          setSelectedGardenId(g.id);
        }}
      />

      {selectedGarden && (
        <>
          <GardenActions
            garden={selectedGarden}
            onChanged={loadGardens}
          />
          <BedSection
            garden={selectedGarden}
            system={system}
            lengthUnit={lengthUnit}
            lengthLabel={lengthLabel}
            seasonName={seasonName}
            seasons={seasons}
          />
        </>
      )}
    </section>
  );
}

/** Create a new garden. */
function GardenForm({ onSaved }: { onSaved: (g: Garden) => Promise<void> | void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [hardinessZone, setZone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const garden = await api.createGarden({
        name,
        description: description || undefined,
        hardinessZone: hardinessZone || undefined,
      });
      setName('');
      setDescription('');
      setZone('');
      await onSaved(garden);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not create garden.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="manage-add">
      <summary>Add a garden</summary>
      <form className="form" onSubmit={submit}>
        <div className="form__row">
          <label htmlFor="gf-name">Name</label>
          <input
            id="gf-name"
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="form__row">
          <label htmlFor="gf-desc">Description</label>
          <input
            id="gf-desc"
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="form__row">
          <label htmlFor="gf-zone">Hardiness zone</label>
          <input
            id="gf-zone"
            maxLength={8}
            placeholder="e.g. 8a"
            value={hardinessZone}
            onChange={(e) => setZone(e.target.value)}
          />
        </div>
        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || !name}>
          {busy ? 'Saving…' : 'Add garden'}
        </button>
      </form>
    </details>
  );
}

/** Rename / re-zone or archive the selected garden. */
function GardenActions({ garden, onChanged }: { garden: Garden; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(garden.name);
  const [hardinessZone, setZone] = useState(garden.hardinessZone ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form when the selected garden changes.
  useEffect(() => {
    setEditing(false);
    setName(garden.name);
    setZone(garden.hardinessZone ?? '');
  }, [garden.id, garden.name, garden.hardinessZone]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.updateGarden(garden.id, { name, hardinessZone: hardinessZone || undefined });
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not update garden.');
    } finally {
      setBusy(false);
    }
  };

  const archive = async () => {
    if (!window.confirm(`Archive “${garden.name}”? Its beds and history are preserved.`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.archiveGarden(garden.id);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not archive garden.');
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <div className="manage-actions">
        {garden.description && <p className="muted">{garden.description}</p>}
        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}
        <div className="inline">
          <button type="button" className="button--ghost" onClick={() => setEditing(true)}>
            Edit garden
          </button>
          <button type="button" className="button--danger" onClick={archive} disabled={busy}>
            Archive garden
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={save}>
      <div className="form__row">
        <label htmlFor="ge-name">Name</label>
        <input id="ge-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="form__row">
        <label htmlFor="ge-zone">Hardiness zone</label>
        <input
          id="ge-zone"
          maxLength={8}
          value={hardinessZone}
          onChange={(e) => setZone(e.target.value)}
        />
      </div>
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
      <div className="inline">
        <button type="submit" disabled={busy || !name}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="button--ghost" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Beds within a garden: list, add, edit, archive, and drill into detail. */
function BedSection({
  garden,
  system,
  lengthUnit,
  lengthLabel,
  seasonName,
  seasons,
}: {
  garden: Garden;
  system: UnitSystem;
  lengthUnit: LengthUnit;
  lengthLabel: string;
  seasonName: (id: string | null) => string;
  seasons: Season[];
}) {
  const [beds, setBeds] = useState<Bed[]>([]);
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listBeds(garden.id);
      setBeds(list);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load beds.');
    } finally {
      setLoading(false);
    }
  }, [garden.id]);

  // Reset selection when switching gardens, then load.
  useEffect(() => {
    setSelectedBedId(null);
    void load();
  }, [load]);

  const selectedBed = beds.find((b) => b.id === selectedBedId) ?? null;

  return (
    <div className="bed-section">
      <h4>Beds in {garden.name}</h4>

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p>Loading beds…</p>
      ) : beds.length === 0 ? (
        <p className="muted">No beds yet. Add one below.</p>
      ) : (
        <ul className="list">
          {beds.map((b) => {
            const dims = formatDimensions(b.lengthMm, b.widthMm, system);
            return (
              <li key={b.id} className="list__item">
                <button
                  type="button"
                  className="link-button"
                  aria-pressed={selectedBedId === b.id}
                  onClick={() => setSelectedBedId((cur) => (cur === b.id ? null : b.id))}
                >
                  <strong>{b.name}</strong>
                  <span className="badge">
                    {BED_TYPES.find((t) => t.value === b.bedType)?.label ?? b.bedType}
                  </span>
                  {dims && <span className="muted"> · {dims}</span>}
                  {b.location && <span className="muted"> · {b.location}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <BedForm
        gardenId={garden.id}
        lengthUnit={lengthUnit}
        lengthLabel={lengthLabel}
        onSaved={async (b) => {
          await load();
          setSelectedBedId(b.id);
        }}
      />

      {selectedBed && (
        <BedDetailPanel
          bed={selectedBed}
          system={system}
          lengthUnit={lengthUnit}
          lengthLabel={lengthLabel}
          seasonName={seasonName}
          seasons={seasons}
          onChanged={async () => {
            await load();
          }}
          onArchived={async () => {
            setSelectedBedId(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

/** Add a bed. Dimensions are entered in the user's unit system. */
function BedForm({
  gardenId,
  lengthUnit,
  lengthLabel,
  onSaved,
}: {
  gardenId: string;
  lengthUnit: LengthUnit;
  lengthLabel: string;
  onSaved: (b: Bed) => Promise<void> | void;
}) {
  const [name, setName] = useState('');
  const [bedType, setBedType] = useState<BedType>('raised_bed');
  const [location, setLocation] = useState('');
  const [soilType, setSoilType] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toMm = (value: string): number | undefined => {
    const n = Number(value);
    return value !== '' && Number.isFinite(n) && n >= 0
      ? Math.round(lengthToMillimeters(n, lengthUnit))
      : undefined;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const bed = await api.createBed({
        gardenId,
        name,
        bedType,
        location: location || undefined,
        soilType: soilType || undefined,
        lengthMm: toMm(length),
        widthMm: toMm(width),
      });
      setName('');
      setLocation('');
      setSoilType('');
      setLength('');
      setWidth('');
      setBedType('raised_bed');
      await onSaved(bed);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not create bed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="manage-add">
      <summary>Add a bed</summary>
      <form className="form form--wide" onSubmit={submit}>
        <div className="form__row">
          <label htmlFor="bf-name">Name</label>
          <input
            id="bf-name"
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="form__row">
          <label htmlFor="bf-type">Type</label>
          <select id="bf-type" value={bedType} onChange={(e) => setBedType(e.target.value as BedType)}>
            {BED_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form__row">
          <label htmlFor="bf-length">Length ({lengthLabel})</label>
          <input
            id="bf-length"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={length}
            onChange={(e) => setLength(e.target.value)}
          />
        </div>
        <div className="form__row">
          <label htmlFor="bf-width">Width ({lengthLabel})</label>
          <input
            id="bf-width"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
          />
        </div>
        <div className="form__row">
          <label htmlFor="bf-location">Location</label>
          <input
            id="bf-location"
            maxLength={500}
            placeholder="e.g. South fence"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
        <div className="form__row">
          <label htmlFor="bf-soil">Soil type</label>
          <input
            id="bf-soil"
            maxLength={120}
            placeholder="e.g. Sandy loam"
            value={soilType}
            onChange={(e) => setSoilType(e.target.value)}
          />
        </div>
        {error && (
          <p className="form__error form--wide__full" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="form--wide__full" disabled={busy || !name}>
          {busy ? 'Saving…' : 'Add bed'}
        </button>
      </form>
    </details>
  );
}

/** A bed's dimensions plus current plantings, history, and amendments. */
function BedDetailPanel({
  bed,
  system,
  lengthUnit,
  lengthLabel,
  seasonName,
  seasons,
  onChanged,
  onArchived,
}: {
  bed: Bed;
  system: UnitSystem;
  lengthUnit: LengthUnit;
  lengthLabel: string;
  seasonName: (id: string | null) => string;
  seasons: Season[];
  onChanged: () => Promise<void> | void;
  onArchived: () => Promise<void> | void;
}) {
  const [detail, setDetail] = useState<BedDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDetail(await api.getBedDetail(bed.id));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load bed.');
    } finally {
      setLoading(false);
    }
  }, [bed.id]);

  useEffect(() => {
    setEditing(false);
    void load();
  }, [load]);

  const archive = async () => {
    if (!window.confirm(`Archive “${bed.name}”? Its planting history is preserved.`)) return;
    try {
      await api.archiveBed(bed.id);
      await onArchived();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not archive bed.');
    }
  };

  const dims = formatDimensions(bed.lengthMm, bed.widthMm, system);

  return (
    <article className="bed-detail" aria-live="polite">
      <div className="card__header">
        <h4>{bed.name}</h4>
        <div className="inline">
          <button type="button" className="button--ghost" onClick={() => setEditing((v) => !v)}>
            {editing ? 'Close' : 'Edit bed'}
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

      <dl className="plant-card__attrs">
        {dims && <Attr label="Dimensions" value={dims} />}
        {bed.areaSqM != null && <Attr label="Area" value={formatArea(bed.areaSqM, system)} />}
        {bed.location && <Attr label="Location" value={bed.location} />}
        {bed.soilType && <Attr label="Soil" value={bed.soilType} />}
      </dl>

      {editing && (
        <BedEditForm
          bed={bed}
          lengthUnit={lengthUnit}
          lengthLabel={lengthLabel}
          onSaved={async () => {
            setEditing(false);
            await onChanged();
            await load();
          }}
        />
      )}

      {loading ? (
        <p>Loading bed…</p>
      ) : detail ? (
        <>
          {detail.sensors.length > 0 && (
            <section>
              <h5>Current conditions</h5>
              <dl className="plant-card__attrs">
                {detail.sensors.map((s) => (
                  <Attr
                    key={s.metric}
                    label={SENSOR_LABELS[s.metric] ?? s.metric}
                    value={`${s.value} ${s.unit}`}
                  />
                ))}
              </dl>
              <p className="muted settings-note">Live readings from this bed&apos;s device.</p>
            </section>
          )}
          <PlantingGroup title="Currently growing" items={detail.current} seasonName={seasonName} />
          <PlantingGroup
            title="Planting history"
            items={detail.history}
            seasonName={seasonName}
            empty="No past plantings yet."
          />

          <Recommendations bedId={bed.id} seasons={seasons} seasonName={seasonName} />

          <section>
            <h5>Soil amendments</h5>
            {detail.amendments.length === 0 ? (
              <p className="muted">None recorded.</p>
            ) : (
              <ul className="list">
                {detail.amendments.map((a) => (
                  <li key={a.id} className="list__item">
                    <strong>{a.name}</strong>
                    {a.amount != null && (
                      <span className="muted">
                        {' '}
                        · {a.amount}
                        {a.amountUnit ? ` ${a.amountUnit}` : ''}
                      </span>
                    )}
                    <span className="muted"> · {fmtDate(a.appliedOn)}</span>
                    {seasonName(a.seasonId) && <span className="badge">{seasonName(a.seasonId)}</span>}
                    {a.notes && <p className="muted">{a.notes}</p>}
                  </li>
                ))}
              </ul>
            )}
            <AmendmentForm bedId={bed.id} seasons={seasons} onAdded={load} />
          </section>
        </>
      ) : null}
    </article>
  );
}

/** "What to plant here next", from the bed's rotation history (Phase 5). */
function Recommendations({
  bedId,
  seasons,
  seasonName,
}: {
  bedId: string;
  seasons: Season[];
  seasonName: (id: string | null) => string;
}) {
  const seasonId = seasons.find((s) => s.isActive)?.id ?? seasons[0]?.id ?? '';
  const [recs, setRecs] = useState<PlantRecommendation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!seasonId) {
      setRecs([]);
      return;
    }
    let cancelled = false;
    api
      .getBedRecommendations(bedId, seasonId)
      .then((r) => !cancelled && setRecs(r.recommendations))
      .catch(
        (err) =>
          !cancelled &&
          setError(err instanceof ApiRequestError ? err.message : 'Could not load recommendations.'),
      );
    return () => {
      cancelled = true;
    };
  }, [bedId, seasonId]);

  if (!seasonId) return null;

  return (
    <section>
      <h5>Recommended next{seasonName(seasonId) ? ` · ${seasonName(seasonId)}` : ''}</h5>
      {error ? (
        <p className="form__error" role="alert">
          {error}
        </p>
      ) : recs == null ? (
        <p className="muted">Loading…</p>
      ) : recs.length === 0 ? (
        <p className="muted">
          No recommendations yet — set a hardiness zone, or this bed&apos;s recent history rules the
          options out.
        </p>
      ) : (
        <ul className="list">
          {recs.map((r) => (
            <li key={r.plantId} className="list__item">
              <strong>{r.name}</strong>
              <p className="muted">{r.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Record a soil amendment against the bed (Phase 5). */
function AmendmentForm({
  bedId,
  seasons,
  onAdded,
}: {
  bedId: string;
  seasons: Season[];
  onAdded: () => Promise<void> | void;
}) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [amountUnit, setAmountUnit] = useState('');
  const [seasonId, setSeasonId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createAmendment({
        bedId,
        name: name.trim(),
        amount: amount !== '' ? Number(amount) : undefined,
        amountUnit: amountUnit.trim() || undefined,
        seasonId: seasonId || undefined,
      });
      setName('');
      setAmount('');
      setAmountUnit('');
      setSeasonId('');
      await onAdded();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not record amendment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="manage-add">
      <summary>Record an amendment</summary>
      <form className="form form--wide" onSubmit={submit}>
        <div className="form__row">
          <label htmlFor="am-name">Amendment</label>
          <input
            id="am-name"
            required
            maxLength={120}
            placeholder="e.g. Compost"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="form__row">
          <label htmlFor="am-amount">Amount</label>
          <input
            id="am-amount"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="form__row">
          <label htmlFor="am-unit">Unit</label>
          <input
            id="am-unit"
            maxLength={24}
            placeholder="kg, cu ft…"
            value={amountUnit}
            onChange={(e) => setAmountUnit(e.target.value)}
          />
        </div>
        <div className="form__row">
          <label htmlFor="am-season">Season</label>
          <select id="am-season" value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
            <option value="">None</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
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
          {busy ? 'Saving…' : 'Record amendment'}
        </button>
      </form>
    </details>
  );
}

function PlantingGroup({
  title,
  items,
  seasonName,
  empty = 'Nothing here.',
}: {
  title: string;
  items: BedPlanting[];
  seasonName: (id: string | null) => string;
  empty?: string;
}) {
  return (
    <section>
      <h5>{title}</h5>
      {items.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul className="list">
          {items.map((p) => (
            <li key={p.id} className="list__item">
              <strong>{p.plantName}</strong>
              {p.quantity > 1 && <span className="muted"> ×{p.quantity}</span>}
              <span className="badge">{STATUS_LABELS[p.status] ?? p.status}</span>
              {seasonName(p.seasonId) && <span className="muted"> · {seasonName(p.seasonId)}</span>}
              {p.plantedOn && <span className="muted"> · planted {fmtDate(p.plantedOn)}</span>}
              {p.harvestedOn && <span className="muted"> · harvested {fmtDate(p.harvestedOn)}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Edit an existing bed (dimensions shown in the user's unit system). */
function BedEditForm({
  bed,
  lengthUnit,
  lengthLabel,
  onSaved,
}: {
  bed: Bed;
  lengthUnit: LengthUnit;
  lengthLabel: string;
  onSaved: () => Promise<void> | void;
}) {
  const toDisplay = (mm: number | null): string =>
    mm == null ? '' : String(Number(millimetersTo(mm, lengthUnit).toFixed(2)));

  const [name, setName] = useState(bed.name);
  const [bedType, setBedType] = useState<BedType>(bed.bedType);
  const [location, setLocation] = useState(bed.location ?? '');
  const [soilType, setSoilType] = useState(bed.soilType ?? '');
  const [length, setLength] = useState(toDisplay(bed.lengthMm));
  const [width, setWidth] = useState(toDisplay(bed.widthMm));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toMm = (value: string): number | undefined => {
    const n = Number(value);
    return value !== '' && Number.isFinite(n) && n >= 0
      ? Math.round(lengthToMillimeters(n, lengthUnit))
      : undefined;
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.updateBed(bed.id, {
        name,
        bedType,
        location: location || undefined,
        soilType: soilType || undefined,
        lengthMm: toMm(length),
        widthMm: toMm(width),
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not update bed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form form--wide" onSubmit={save}>
      <div className="form__row">
        <label htmlFor="be-name">Name</label>
        <input id="be-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="form__row">
        <label htmlFor="be-type">Type</label>
        <select id="be-type" value={bedType} onChange={(e) => setBedType(e.target.value as BedType)}>
          {BED_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div className="form__row">
        <label htmlFor="be-length">Length ({lengthLabel})</label>
        <input
          id="be-length"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={length}
          onChange={(e) => setLength(e.target.value)}
        />
      </div>
      <div className="form__row">
        <label htmlFor="be-width">Width ({lengthLabel})</label>
        <input
          id="be-width"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={width}
          onChange={(e) => setWidth(e.target.value)}
        />
      </div>
      <div className="form__row">
        <label htmlFor="be-location">Location</label>
        <input
          id="be-location"
          maxLength={500}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>
      <div className="form__row">
        <label htmlFor="be-soil">Soil type</label>
        <input
          id="be-soil"
          maxLength={120}
          value={soilType}
          onChange={(e) => setSoilType(e.target.value)}
        />
      </div>
      {error && (
        <p className="form__error form--wide__full" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="form--wide__full" disabled={busy || !name}>
        {busy ? 'Saving…' : 'Save bed'}
      </button>
    </form>
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

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

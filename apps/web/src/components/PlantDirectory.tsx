import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  ApiRequestError,
  type Plant,
  type PlantDetail,
  type PlantFamily,
} from '../api/client';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const TYPES = ['vegetable', 'fruit', 'herb', 'flower', 'cover_crop'];

function titleCase(value: string | null): string {
  if (!value) return '';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Phase 2 — browse and search the plant directory. */
export function PlantDirectory() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [families, setFamilies] = useState<PlantFamily[]>([]);
  const [selected, setSelected] = useState<PlantDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [zone, setZone] = useState('');
  const [month, setMonth] = useState('');

  const familyName = useMemo(() => {
    const map = new Map(families.map((f) => [f.id, f.name]));
    return (id: string | null) => (id ? (map.get(id) ?? '') : '');
  }, [families]);

  const plantName = useMemo(() => {
    const map = new Map(plants.map((p) => [p.id, p.commonName]));
    return (id: string) => map.get(id) ?? 'Unknown plant';
  }, [plants]);

  // Prefill the zone filter from the account's saved zone.
  useEffect(() => {
    api.listFamilies().then(setFamilies).catch(() => undefined);
    api
      .getZone()
      .then((loc) => {
        if (loc.hardinessZone) setZone(loc.hardinessZone);
      })
      .catch(() => undefined);
  }, []);

  const search = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await api.searchPlants({
        q: q || undefined,
        type: type || undefined,
        zone: zone || undefined,
        month: month ? Number(month) : undefined,
      });
      setPlants(results);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Search failed.');
    } finally {
      setLoading(false);
    }
  }, [q, type, zone, month]);

  useEffect(() => {
    void search();
    // initial + whenever filters change
  }, [search]);

  const openPlant = useCallback(async (id: string) => {
    setError(null);
    try {
      setSelected(await api.getPlant(id));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load plant.');
    }
  }, []);

  return (
    <section aria-labelledby="dir-heading" className="card">
      <h3 id="dir-heading">Plant directory</h3>

      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <div className="form__row">
          <label htmlFor="dir-q">Search</label>
          <input
            id="dir-q"
            type="search"
            placeholder="Tomato, basil…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="form__row">
          <label htmlFor="dir-type">Type</label>
          <select id="dir-type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Any</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {titleCase(t)}
              </option>
            ))}
          </select>
        </div>
        <div className="form__row">
          <label htmlFor="dir-zone">Zone</label>
          <input
            id="dir-zone"
            placeholder="e.g. 8a"
            maxLength={8}
            value={zone}
            onChange={(e) => setZone(e.target.value)}
          />
        </div>
        <div className="form__row">
          <label htmlFor="dir-month">Plantable in</label>
          <select
            id="dir-month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            disabled={!zone}
            title={zone ? undefined : 'Set a zone to filter by month'}
          >
            <option value="">Any month</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </form>

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      <div className="directory">
        <div className="directory__list" aria-busy={loading}>
          {loading ? (
            <p>Loading…</p>
          ) : plants.length === 0 ? (
            <p>No plants match those filters.</p>
          ) : (
            <ul className="list">
              {plants.map((p) => (
                <li key={p.id} className="list__item">
                  <button
                    type="button"
                    className="link-button"
                    aria-pressed={selected?.id === p.id}
                    onClick={() => void openPlant(p.id)}
                  >
                    <strong>{p.commonName}</strong>
                    <span className="badge">{titleCase(p.type)}</span>
                    {familyName(p.familyId) && (
                      <span className="muted"> · {familyName(p.familyId)}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="directory__detail" aria-live="polite">
          {selected ? (
            <PlantCard plant={selected} familyName={familyName} plantName={plantName} />
          ) : (
            <p className="muted">Select a plant to see details.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function PlantCard({
  plant,
  familyName,
  plantName,
}: {
  plant: PlantDetail;
  familyName: (id: string | null) => string;
  plantName: (id: string) => string;
}) {
  const companions = plant.companions.filter((c) => c.relation === 'companion');
  const antagonists = plant.companions.filter((c) => c.relation === 'antagonist');

  return (
    <article className="plant-card">
      <header>
        <h4>{plant.commonName}</h4>
        {plant.scientificName && <p className="muted plant-card__sci">{plant.scientificName}</p>}
      </header>

      <dl className="plant-card__attrs">
        {familyName(plant.familyId) && (
          <Attr label="Family" value={familyName(plant.familyId)} />
        )}
        {plant.sun && <Attr label="Sun" value={titleCaseLocal(plant.sun)} />}
        {plant.water && <Attr label="Water" value={titleCaseLocal(plant.water)} />}
        {plant.spacingMm != null && <Attr label="Spacing" value={`${plant.spacingMm} mm`} />}
        {plant.daysToMaturityMin != null && (
          <Attr
            label="Days to maturity"
            value={
              plant.daysToMaturityMax != null
                ? `${plant.daysToMaturityMin}–${plant.daysToMaturityMax}`
                : `${plant.daysToMaturityMin}`
            }
          />
        )}
      </dl>

      {plant.windows.length > 0 && (
        <section>
          <h5>Planting windows</h5>
          <ul className="list">
            {plant.windows.map((w) => (
              <li key={w.id} className="list__item">
                <strong>Zone {w.zone}</strong>
                {w.ownerId && <span className="badge">your override</span>} — plant{' '}
                {monthRangeLocal(w.plantStartMonth, w.plantEndMonth)}
                {w.harvestStartMonth != null && w.harvestEndMonth != null && (
                  <> · harvest {monthRangeLocal(w.harvestStartMonth, w.harvestEndMonth)}</>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {companions.length > 0 && (
        <section>
          <h5>Companions</h5>
          <p>{companions.map((c) => plantName(c.plantId)).join(', ')}</p>
        </section>
      )}
      {antagonists.length > 0 && (
        <section>
          <h5>Keep apart</h5>
          <p>{antagonists.map((c) => plantName(c.plantId)).join(', ')}</p>
        </section>
      )}

      {plant.issues.length > 0 && (
        <section>
          <h5>Pests &amp; diseases</h5>
          <ul className="list">
            {plant.issues.map((i) => (
              <li key={i.id} className="list__item">
                <strong>{i.name}</strong> <span className="badge">{i.kind}</span>
                {i.description && <p>{i.description}</p>}
                {i.management && (
                  <p className="muted">
                    <em>Manage:</em> {i.management}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {plant.growingTips && (
        <section>
          <h5>Growing tips</h5>
          <p>{plant.growingTips}</p>
        </section>
      )}
      {plant.commonMistakes && (
        <section>
          <h5>Common mistakes</h5>
          <p>{plant.commonMistakes}</p>
        </section>
      )}

      {plant.source && <p className="muted plant-card__source">Source: {plant.source}</p>}
    </article>
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

// Local copies so this file is self-contained (avoids cross-component imports).
function titleCaseLocal(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
function monthRangeLocal(start: number, end: number): string {
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const s = m[start - 1] ?? '?';
  const e = m[end - 1] ?? '?';
  return start === end ? s : `${s}–${e}`;
}

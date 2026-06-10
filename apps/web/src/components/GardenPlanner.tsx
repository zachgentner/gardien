import { useCallback, useEffect, useState } from 'react';
import {
  api,
  ApiRequestError,
  type Season,
  type Garden,
  type Bed,
  type Plant,
  type BedPlan,
  type PlanPlant,
  type PlantingStatus,
} from '../api/client';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STATUSES: PlantingStatus[] = ['planned', 'planted', 'harvested', 'removed'];
const SEASON_TYPES = ['spring', 'summer', 'fall', 'winter'];

function titleCase(v: string): string {
  return v.replace(/\b\w/g, (c) => c.toUpperCase());
}
function monthInRange(m: number, start: number, end: number): boolean {
  return start <= end ? m >= start && m <= end : m >= start || m <= end;
}
function monthRange(start: number, end: number): string {
  return start === end ? MONTHS[start - 1]! : `${MONTHS[start - 1]}–${MONTHS[end - 1]}`;
}
function windowText(p: PlanPlant): string {
  if (p.plantStartMonth == null || p.plantEndMonth == null) return 'No window for this zone';
  const plant = `Plant ${monthRange(p.plantStartMonth, p.plantEndMonth)}`;
  const harvest =
    p.harvestStartMonth != null && p.harvestEndMonth != null
      ? ` · Harvest ${monthRange(p.harvestStartMonth, p.harvestEndMonth)}`
      : '';
  return plant + harvest;
}

/** Phase 4 — plan a season: assign plants to beds on a month calendar with
 *  plan-time conflict detection. */
export function GardenPlanner() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [gardens, setGardens] = useState<Garden[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [seasonId, setSeasonId] = useState('');
  const [gardenId, setGardenId] = useState('');
  const [bedId, setBedId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.listSeasons(), api.listGardens(), api.searchPlants({})])
      .then(([ss, gs, ps]) => {
        setSeasons(ss);
        setGardens(gs);
        setPlants(ps);
        setSeasonId(ss.find((s) => s.isActive)?.id ?? ss[0]?.id ?? '');
        setGardenId(gs[0]?.id ?? '');
      })
      .catch((err) =>
        setError(err instanceof ApiRequestError ? err.message : 'Could not load planner.'),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!gardenId) {
      setBeds([]);
      setBedId('');
      return;
    }
    api
      .listBeds(gardenId)
      .then((bs) => {
        setBeds(bs);
        setBedId(bs[0]?.id ?? '');
      })
      .catch(() => undefined);
  }, [gardenId]);

  const onSeasonCreated = useCallback(async (s: Season) => {
    const list = await api.listSeasons();
    setSeasons(list);
    setSeasonId(s.id);
  }, []);

  const season = seasons.find((s) => s.id === seasonId) ?? null;

  return (
    <section aria-labelledby="planner-heading" className="card">
      <h3 id="planner-heading">Garden Planner</h3>

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p>Loading planner…</p>
      ) : (
        <>
          <div className="planner__controls">
            <div className="form__row">
              <label htmlFor="pl-season">Season</label>
              <select
                id="pl-season"
                value={seasonId}
                onChange={(e) => setSeasonId(e.target.value)}
                disabled={seasons.length === 0}
              >
                {seasons.length === 0 && <option value="">No seasons yet</option>}
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.isActive ? ' (active)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="form__row">
              <label htmlFor="pl-garden">Garden</label>
              <select
                id="pl-garden"
                value={gardenId}
                onChange={(e) => setGardenId(e.target.value)}
                disabled={gardens.length === 0}
              >
                {gardens.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form__row">
              <label htmlFor="pl-bed">Bed</label>
              <select
                id="pl-bed"
                value={bedId}
                onChange={(e) => setBedId(e.target.value)}
                disabled={beds.length === 0}
              >
                {beds.length === 0 && <option value="">No beds in this garden</option>}
                {beds.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <SeasonForm onCreated={onSeasonCreated} />

          {bedId && season ? (
            <PlanBoard
              key={`${bedId}:${seasonId}`}
              bedId={bedId}
              seasonId={seasonId}
              seasonYear={season.year}
              plants={plants}
            />
          ) : (
            <p className="muted">
              {seasons.length === 0
                ? 'Add a season to start planning.'
                : 'Add a bed in Garden Manager to start planning.'}
            </p>
          )}
        </>
      )}
    </section>
  );
}

/** Create a season so the planner is self-sufficient. */
function SeasonForm({ onCreated }: { onCreated: (s: Season) => Promise<void> | void }) {
  const [seasonType, setSeasonType] = useState('spring');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const s = await api.createSeason({
        name: name.trim() || `${titleCase(seasonType)} ${year}`,
        seasonType,
        year: Number(year),
        isActive,
      });
      setName('');
      setIsActive(false);
      await onCreated(s);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not create season.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="manage-add">
      <summary>Add a season</summary>
      <form className="form form--wide" onSubmit={submit}>
        <div className="form__row">
          <label htmlFor="se-type">Type</label>
          <select id="se-type" value={seasonType} onChange={(e) => setSeasonType(e.target.value)}>
            {SEASON_TYPES.map((t) => (
              <option key={t} value={t}>
                {titleCase(t)}
              </option>
            ))}
          </select>
        </div>
        <div className="form__row">
          <label htmlFor="se-year">Year</label>
          <input
            id="se-year"
            type="number"
            min={1900}
            max={2200}
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </div>
        <div className="form__row">
          <label htmlFor="se-name">Name (optional)</label>
          <input
            id="se-name"
            maxLength={120}
            placeholder={`${titleCase(seasonType)} ${year}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="form__row">
          <label htmlFor="se-active">Active</label>
          <input
            id="se-active"
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
        </div>
        {error && (
          <p className="form__error form--wide__full" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="form--wide__full" disabled={busy}>
          {busy ? 'Saving…' : 'Add season'}
        </button>
      </form>
    </details>
  );
}

/** The plan for one bed in one season: calendar, conflicts, and assignment. */
function PlanBoard({
  bedId,
  seasonId,
  seasonYear,
  plants,
}: {
  bedId: string;
  seasonId: string;
  seasonYear: number;
  plants: Plant[];
}) {
  const [plan, setPlan] = useState<BedPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPlan(await api.getBedPlan(bedId, seasonId));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load the plan.');
    } finally {
      setLoading(false);
    }
  }, [bedId, seasonId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (plantingId: string, status: PlantingStatus) => {
    try {
      await api.updatePlanting(plantingId, { status });
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not update planting.');
    }
  };
  const remove = async (plantingId: string) => {
    try {
      await api.archivePlanting(plantingId);
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not remove planting.');
    }
  };

  if (loading) return <p>Loading plan…</p>;
  if (error)
    return (
      <p className="form__error" role="alert">
        {error}
      </p>
    );
  if (!plan) return null;

  return (
    <div className="planboard">
      <ConflictPanel plan={plan} />

      <h4>
        Calendar
        {plan.zone ? <span className="badge">Zone {plan.zone}</span> : null}
      </h4>
      {plan.plants.length === 0 ? (
        <p className="muted">No plants assigned yet. Add one below.</p>
      ) : (
        <>
          <div className="calendar" aria-hidden="true">
            <div className="calendar__row calendar__head">
              <span className="calendar__label" />
              {MONTHS.map((m) => (
                <span key={m} className="cal-month">
                  {m[0]}
                </span>
              ))}
            </div>
            {plan.plants.map((p) => (
              <div key={p.plantingId} className="calendar__row">
                <span className="calendar__label">{p.name}</span>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                  const inPlant =
                    p.plantStartMonth != null &&
                    p.plantEndMonth != null &&
                    monthInRange(m, p.plantStartMonth, p.plantEndMonth);
                  const inHarvest =
                    p.harvestStartMonth != null &&
                    p.harvestEndMonth != null &&
                    monthInRange(m, p.harvestStartMonth, p.harvestEndMonth);
                  const cls = inHarvest ? 'is-harvest' : inPlant ? 'is-plant' : '';
                  return <span key={m} className={`cal-cell ${cls}`} />;
                })}
              </div>
            ))}
          </div>
          <div className="cal-legend">
            <span className="cal-key is-plant" /> Planting
            <span className="cal-key is-harvest" /> Harvest
          </div>

          <ul className="list plan-rows">
            {plan.plants.map((p) => (
              <li key={p.plantingId} className="list__item plan-row">
                <div>
                  <strong>{p.name}</strong>
                  {p.quantity > 1 && <span className="muted"> ×{p.quantity}</span>}
                  <div className="muted plan-row__win">{windowText(p)}</div>
                </div>
                <div className="inline">
                  <label className="sr-only" htmlFor={`st-${p.plantingId}`}>
                    Status for {p.name}
                  </label>
                  <select
                    id={`st-${p.plantingId}`}
                    value={p.status}
                    onChange={(e) => void setStatus(p.plantingId, e.target.value as PlantingStatus)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {titleCase(s)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="button--danger"
                    onClick={() => void remove(p.plantingId)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <AssignForm
        bedId={bedId}
        seasonId={seasonId}
        seasonYear={seasonYear}
        plants={plants}
        onAssigned={load}
      />
    </div>
  );
}

function ConflictPanel({ plan }: { plan: BedPlan }) {
  const cap = plan.capacity;
  const pct = cap.areaSqM ? Math.min(100, Math.round((cap.usedSqM / cap.areaSqM) * 100)) : 0;

  return (
    <div className="conflicts">
      {cap.areaSqM != null && (
        <div className="capacity">
          <div className="capacity__bar">
            <div
              className={`capacity__fill ${cap.over ? 'is-over' : ''}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="muted">
            {cap.usedSqM} / {cap.areaSqM} m² used
            {cap.over ? ` · over by ${cap.overBy} m²` : ''}
            {cap.unknown.length > 0 ? ` · ${cap.unknown.length} without spacing` : ''}
          </span>
        </div>
      )}

      {plan.antagonists.map((a, i) => (
        <p key={`a${i}`} className="conflict is-warn">
          <strong>Keep apart:</strong> {a.plantAName} &amp; {a.plantBName}
          {a.reason ? ` — ${a.reason}` : ''}
        </p>
      ))}
      {plan.rotation.map((r, i) => (
        <p key={`r${i}`} className="conflict is-warn">
          <strong>Rotation ({r.plantName}):</strong> {r.message}
        </p>
      ))}
      {cap.over && (
        <p className="conflict is-warn">
          <strong>Overcrowded:</strong> planned footprints exceed the bed by {cap.overBy} m².
        </p>
      )}
      {plan.unsuitable.map((u, i) => (
        <p key={`u${i}`} className="conflict is-warn">
          <strong>Zone:</strong> {u.plantName} has no planting window for zone {u.zone}.
        </p>
      ))}
      {plan.companions.map((c, i) => (
        <p key={`c${i}`} className="conflict is-good">
          <strong>Good pairing:</strong> {c.plantAName} &amp; {c.plantBName}
          {c.reason ? ` — ${c.reason}` : ''}
        </p>
      ))}
      {plan.warningCount === 0 && plan.plants.length > 0 && (
        <p className="conflict is-good">No conflicts — this plan looks good.</p>
      )}
    </div>
  );
}

function AssignForm({
  bedId,
  seasonId,
  seasonYear,
  plants,
  onAssigned,
}: {
  bedId: string;
  seasonId: string;
  seasonYear: number;
  plants: Plant[];
  onAssigned: () => Promise<void> | void;
}) {
  const [plantId, setPlantId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [month, setMonth] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plantId) return;
    setBusy(true);
    setError(null);
    try {
      await api.createPlanting({
        bedId,
        seasonId,
        plantId,
        quantity: Number(quantity) || 1,
        status: 'planned',
        plannedPlantDate: month
          ? new Date(seasonYear, Number(month) - 1, 1).toISOString()
          : undefined,
      });
      setPlantId('');
      setQuantity('1');
      setMonth('');
      await onAssigned();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not add planting.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form form--wide assign-form" onSubmit={submit}>
      <div className="form__row">
        <label htmlFor="as-plant">Add plant</label>
        <select id="as-plant" value={plantId} onChange={(e) => setPlantId(e.target.value)}>
          <option value="">Choose a plant…</option>
          {plants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.commonName}
            </option>
          ))}
        </select>
      </div>
      <div className="form__row">
        <label htmlFor="as-qty">Quantity</label>
        <input
          id="as-qty"
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </div>
      <div className="form__row">
        <label htmlFor="as-month">Target month</label>
        <select id="as-month" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="">From window</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p className="form__error form--wide__full" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="form--wide__full" disabled={busy || !plantId}>
        {busy ? 'Adding…' : 'Add to plan'}
      </button>
    </form>
  );
}

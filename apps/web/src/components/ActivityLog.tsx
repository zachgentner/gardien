import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiRequestError } from '../api/client';
import {
  buildActivity,
  formatActivityDate,
  type Activity,
  type ActivityKind,
} from '../activity';

const KINDS: { id: ActivityKind; label: string }[] = [
  { id: 'planted', label: 'Planted' },
  { id: 'harvested', label: 'Harvested' },
  { id: 'amended', label: 'Amended' },
];

/**
 * Journal — a reverse-chronological record of garden activity, derived from
 * planting records (planted / harvested events) and soil amendments. Watering
 * and fertilizing logs join this feed once those are modelled in a later phase.
 */
export function ActivityLog() {
  const [events, setEvents] = useState<Activity[]>([]);
  const [filter, setFilter] = useState<ActivityKind | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [gardens, plants, plantings, amendments] = await Promise.all([
        api.listGardens(),
        api.searchPlants({}),
        api.listPlantings(),
        api.listAmendments(),
      ]);
      const bedLists = await Promise.all(gardens.map((g) => api.listBeds(g.id, true)));
      const bedNames = new Map(bedLists.flat().map((b) => [b.id, b.name]));
      const plantNames = new Map(plants.map((p) => [p.id, p.commonName]));
      setEvents(buildActivity(plantings, amendments, plantNames, bedNames));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load activity.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(
    () => (filter === 'all' ? events : events.filter((e) => e.kind === filter)),
    [events, filter],
  );

  return (
    <section aria-labelledby="journal-heading" className="card">
      <div className="card__header">
        <h3 id="journal-heading">Journal</h3>
        <div className="chips" role="group" aria-label="Filter activity">
          <button
            type="button"
            className="chip"
            aria-pressed={filter === 'all'}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              className="chip"
              aria-pressed={filter === k.id}
              onClick={() => setFilter(k.id)}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p>Loading activity…</p>
      ) : shown.length === 0 ? (
        <p className="muted">
          {events.length === 0
            ? 'No activity recorded yet. Planting, harvesting, and soil amendments will appear here as you record them.'
            : 'No activity of this kind.'}
        </p>
      ) : (
        <ol className="timeline">
          {shown.map((e) => (
            <li key={e.id} className={`timeline__item is-${e.kind}`}>
              <time className="timeline__date" dateTime={e.date}>
                {formatActivityDate(e.date)}
              </time>
              <div className="timeline__body">
                <span className="timeline__title">{e.title}</span>
                <span className="muted"> · {e.bed}</span>
              </div>
              <span className="badge timeline__badge">{e.kind}</span>
            </li>
          ))}
        </ol>
      )}

      <p className="muted settings-note">
        Watering and fertilizing logs will join this feed once those activities are
        tracked in a later phase.
      </p>
    </section>
  );
}

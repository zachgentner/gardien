import { useCallback, useEffect, useState } from 'react';
import type { AuthUser } from '@gardien/shared';
import { api, ApiRequestError, type Season } from '../api/client';
import { buildActivity, formatActivityDate, type Activity } from '../activity';

interface Notice {
  id: string;
  tone: 'warn' | 'info';
  text: string;
  cta?: string;
  href?: string;
}

interface Dashboard {
  zone: string | null;
  gardenCount: number;
  bedCount: number;
  activeSeason: Season | null;
  notices: Notice[];
  recent: Activity[];
}

/**
 * Home — the at-a-glance landing: hardiness zone and counts, computed
 * notifications, a reserved weather/frost panel (Phase 6), and recent activity.
 */
export function Home({ user }: { user: AuthUser }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [loc, gardens, seasons, plants, plantings, amendments] = await Promise.all([
        api.getZone(),
        api.listGardens(),
        api.listSeasons(),
        api.searchPlants({}),
        api.listPlantings(),
        api.listAmendments(),
      ]);
      const bedLists = await Promise.all(gardens.map((g) => api.listBeds(g.id, true)));
      const beds = bedLists.flat();
      const activeBeds = beds.filter((b) => !b.deletedAt);
      const bedNames = new Map(beds.map((b) => [b.id, b.name]));
      const plantNames = new Map(plants.map((p) => [p.id, p.commonName]));

      const notices: Notice[] = [];
      if (!loc.hardinessZone) {
        notices.push({
          id: 'zone',
          tone: 'warn',
          text: 'No hardiness zone set — planting windows and suitability need it.',
          cta: 'Set zone',
          href: '#/settings',
        });
      }
      if (gardens.length === 0) {
        notices.push({
          id: 'no-garden',
          tone: 'info',
          text: 'You have no gardens yet.',
          cta: 'Create one',
          href: '#/garden',
        });
      }
      const bedsByGarden = new Map<string, number>();
      for (const b of activeBeds) bedsByGarden.set(b.gardenId, (bedsByGarden.get(b.gardenId) ?? 0) + 1);
      for (const g of gardens) {
        if (!bedsByGarden.get(g.id)) {
          notices.push({
            id: `empty-${g.id}`,
            tone: 'info',
            text: `“${g.name}” has no beds yet.`,
            cta: 'Add beds',
            href: '#/garden',
          });
        }
      }

      setData({
        zone: loc.hardinessZone,
        gardenCount: gardens.length,
        bedCount: activeBeds.length,
        activeSeason: seasons.find((s) => s.isActive) ?? null,
        notices,
        recent: buildActivity(plantings, amendments, plantNames, bedNames).slice(0, 5),
      });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load your garden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const name = user.displayName ?? user.email.split('@')[0];

  return (
    <div className="stack">
      <section aria-labelledby="home-heading" className="card dash-hero">
        <span className="app__eyebrow">{today}</span>
        <h3 id="home-heading">Welcome back, {name}</h3>
        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}
        <div className="dash-tiles">
          <Tile label="Hardiness zone" value={data?.zone ?? (loading ? '…' : '—')} />
          <Tile label="Gardens" value={loading ? '…' : String(data?.gardenCount ?? 0)} />
          <Tile label="Beds" value={loading ? '…' : String(data?.bedCount ?? 0)} />
          <Tile
            label="Active season"
            value={loading ? '…' : (data?.activeSeason?.name ?? '—')}
          />
        </div>
      </section>

      <section aria-labelledby="notices-heading" className="card">
        <h3 id="notices-heading">Notifications</h3>
        {loading ? (
          <p>Checking…</p>
        ) : (data?.notices.length ?? 0) === 0 ? (
          <p className="muted">All clear — nothing needs your attention.</p>
        ) : (
          <ul className="notices">
            {data!.notices.map((n) => (
              <li key={n.id} className={`notice notice--${n.tone}`}>
                <span className="notice__text">{n.text}</span>
                {n.href && (
                  <a className="notice__link" href={n.href}>
                    {n.cta} →
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="weather-heading" className="card">
        <h3 id="weather-heading">Weather &amp; frost</h3>
        <div className="placeholder placeholder--inline">
          <p className="muted">
            Localized forecasts, frost warnings tied to your plantings, and pest/disease
            alerts arrive in a later phase — they'll surface here, right where you start
            your day.
          </p>
        </div>
      </section>

      <section aria-labelledby="recent-heading" className="card">
        <div className="card__header">
          <h3 id="recent-heading">Recent activity</h3>
          <a className="dash-link" href="#/journal">
            Open journal →
          </a>
        </div>
        {loading ? (
          <p>Loading…</p>
        ) : (data?.recent.length ?? 0) === 0 ? (
          <p className="muted">No activity yet. Planting and amendments will show up here.</p>
        ) : (
          <ol className="timeline">
            {data!.recent.map((e) => (
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
      </section>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="tile">
      <span className="tile__label">{label}</span>
      <span className="tile__value">{value}</span>
    </div>
  );
}

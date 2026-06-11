import { useState } from 'react';
import type { AuthUser } from '@gardien/shared';
import { api, ApiRequestError } from '../api/client';
import { LocationZone } from './LocationZone';

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Settings — account summary, measurement units, and the location & hardiness
 * zone (which drives planting windows and suitability across the app).
 */
export function Settings({ user }: { user: AuthUser }) {
  return (
    <div className="stack">
      <section aria-labelledby="account-heading" className="card">
        <h3 id="account-heading">Account</h3>
        <dl className="settings-grid">
          <Field label="Name" value={user.displayName ?? '—'} />
          <Field label="Email" value={user.email} />
          <Field label="Role" value={titleCase(user.role)} />
          <Field label="Units" value={titleCase(user.unitSystem)} />
          <Field label="Plan" value={titleCase(user.plan)} />
        </dl>
        <p className="muted settings-note">
          Measurement units are set per account and applied across beds and the plant
          directory. Editable account settings (units, password, display name) arrive in a
          later phase.
        </p>
      </section>

      <LocationZone />

      <DataCard />
    </div>
  );
}

/** Export everything in the account as JSON — "own your data". */
function DataCard() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportData = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await api.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gardien-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Export failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="data-heading" className="card">
      <h3 id="data-heading">Your data</h3>
      <p className="muted">
        Download everything in your account — gardens, beds, seasons, plantings, and amendments —
        as a JSON file. Own your data; nothing is locked in.
      </p>
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
      <button type="button" onClick={exportData} disabled={busy}>
        {busy ? 'Exporting…' : 'Export data (JSON)'}
      </button>
      <p className="muted settings-note">Importing a previous export will arrive in a follow-up.</p>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="attr">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

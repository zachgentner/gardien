import type { AuthUser } from '@gardien/shared';
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
        </dl>
        <p className="muted settings-note">
          Measurement units are set per account and applied across beds and the plant
          directory. Editable account settings (units, password, display name) arrive in a
          later phase.
        </p>
      </section>

      <LocationZone />
    </div>
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

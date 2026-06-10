import type { AuthUser } from '@gardien/shared';
import { ShieldMark } from './ShieldMark';
import { SECTIONS, type ViewId } from './sections';

export function Sidebar({
  active,
  onNavigate,
  user,
  onLogout,
}: {
  active: ViewId;
  onNavigate: (view: ViewId) => void;
  user: AuthUser;
  onLogout: () => void;
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <ShieldMark className="sidebar__mark" />
        <span className="sidebar__wordmark">Gardien</span>
      </div>

      <nav className="sidebar__nav" aria-label="Primary">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className="nav-item"
            aria-current={active === s.id ? 'page' : undefined}
            onClick={() => onNavigate(s.id)}
          >
            <span className="nav-item__icon" aria-hidden="true">
              {s.icon()}
            </span>
            <span className="nav-item__text">
              <span className="nav-item__label">{s.label}</span>
              <span className="nav-item__eyebrow">{s.eyebrow}</span>
            </span>
          </button>
        ))}
      </nav>

      <div className="sidebar__foot">
        <div className="sidebar__user">
          <span className="sidebar__avatar" aria-hidden="true">
            {(user.displayName ?? user.email).charAt(0).toUpperCase()}
          </span>
          <span className="sidebar__user-name" title={user.email}>
            {user.displayName ?? user.email}
          </span>
        </div>
        <button type="button" className="button--ghost sidebar__signout" onClick={onLogout}>
          Sign out
        </button>
      </div>
    </aside>
  );
}

import { useCallback, useEffect, useState } from 'react';
import type { AuthUser } from '@gardien/shared';
import { api, ApiRequestError, getToken } from './api/client';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useHashRoute } from './hooks/useHashRoute';
import { Sidebar } from './components/Sidebar';
import { ShieldMark } from './components/ShieldMark';
import { SECTIONS, type ViewId } from './components/sections';
import { Home } from './components/Home';
import { GardenManager } from './components/GardenManager';
import { GardenPlanner } from './components/GardenPlanner';
import { PlantDirectory } from './components/PlantDirectory';
import { ActivityLog } from './components/ActivityLog';
import { Monitor } from './components/Monitor';
import { Settings } from './components/Settings';

const ROUTES = SECTIONS.map((s) => s.id);

export default function App() {
  const online = useOnlineStatus();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);

  // Restore an existing session on load.
  useEffect(() => {
    if (!getToken()) {
      setChecking(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => api.logout())
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="boot">
        <p>Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen online={online} onAuthenticated={setUser} />;
  }

  return <AppShell user={user} online={online} onLogout={() => setUser(null)} />;
}

/** Signed-in layout: a persistent left nav and the active feature area. */
function AppShell({
  user,
  online,
  onLogout,
}: {
  user: AuthUser;
  online: boolean;
  onLogout: () => void;
}) {
  const [view, setView] = useHashRoute<ViewId>(ROUTES, 'home');
  const active = SECTIONS.find((s) => s.id === view) ?? SECTIONS[0]!;

  const signOut = useCallback(() => {
    api.logout();
    onLogout();
  }, [onLogout]);

  return (
    <div className="shell">
      <Sidebar active={view} onNavigate={setView} user={user} onLogout={signOut} />

      <div className="workspace">
        <header className="workspace__bar">
          <div className="workspace__heading">
            <span className="workspace__eyebrow">{active.eyebrow}</span>
            <h1 className="workspace__title">{active.label}</h1>
          </div>
          <p
            className={`app__status ${online ? 'is-online' : 'is-offline'}`}
            role="status"
            aria-live="polite"
          >
            {online ? 'Online' : 'Offline — syncs when reconnected'}
          </p>
        </header>

        <main className="workspace__main" id="main" tabIndex={-1} key={view}>
          {view === 'home' && <Home user={user} />}
          {view === 'garden' && <GardenManager unitSystem={user.unitSystem} />}
          {view === 'planner' && <GardenPlanner />}
          {view === 'directory' && <PlantDirectory />}
          {view === 'journal' && <ActivityLog />}
          {view === 'monitor' && <Monitor />}
          {view === 'settings' && <Settings user={user} />}
        </main>
      </div>
    </div>
  );
}

/** Signed-out layout: masthead + centered sign-in. */
function AuthScreen({
  online,
  onAuthenticated,
}: {
  online: boolean;
  onAuthenticated: (user: AuthUser) => void;
}) {
  return (
    <div className="app">
      <header className="app__header">
        <div className="app__masthead">
          <span className="app__eyebrow">The garden almanac</span>
          <h1 className="app__title">
            <ShieldMark />
            Gardien
          </h1>
        </div>
        <p
          className={`app__status ${online ? 'is-online' : 'is-offline'}`}
          role="status"
          aria-live="polite"
        >
          {online ? 'Online' : 'Offline — syncs when reconnected'}
        </p>
      </header>

      <main className="app__main">
        <LoginForm onAuthenticated={onAuthenticated} />
      </main>

      <footer className="app__footer">
        <p>
          Field notes for your garden · API reference at{' '}
          <a href="/docs" rel="noreferrer">
            /docs
          </a>
          .
        </p>
      </footer>
    </div>
  );
}

function LoginForm({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setBusy(true);
      setError(null);
      try {
        const res = await api.login(email, password);
        onAuthenticated(res.user);
      } catch (err) {
        setError(err instanceof ApiRequestError ? err.message : 'Login failed.');
      } finally {
        setBusy(false);
      }
    },
    [email, password, onAuthenticated],
  );

  return (
    <section aria-labelledby="login-heading" className="card card--auth">
      <p className="auth-eyebrow">Welcome back</p>
      <h2 id="login-heading">Sign in</h2>
      <form onSubmit={onSubmit} className="form">
        <div className="form__row">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="form__row">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </section>
  );
}

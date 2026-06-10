import { useCallback, useEffect, useState } from 'react';
import type { AuthUser } from '@gardien/shared';
import { api, ApiRequestError, getToken, type Garden } from './api/client';
import { useOnlineStatus } from './hooks/useOnlineStatus';

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

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">
          <span aria-hidden="true">🌱</span> Gardien
        </h1>
        <p
          className={`app__status ${online ? 'is-online' : 'is-offline'}`}
          role="status"
          aria-live="polite"
        >
          {online ? 'Online' : 'Offline — changes will sync when reconnected'}
        </p>
      </header>

      <main className="app__main">
        {checking ? (
          <p>Loading…</p>
        ) : user ? (
          <Dashboard user={user} onLogout={() => setUser(null)} />
        ) : (
          <LoginForm onAuthenticated={setUser} />
        )}
      </main>

      <footer className="app__footer">
        <p>
          Phase 0 foundation. API docs at{' '}
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
    <section aria-labelledby="login-heading" className="card">
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

function Dashboard({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [gardens, setGardens] = useState<Garden[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    api
      .listGardens()
      .then(setGardens)
      .catch((err) =>
        setError(err instanceof ApiRequestError ? err.message : 'Could not load gardens.'),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(refresh, [refresh]);

  return (
    <section aria-labelledby="dash-heading" className="card">
      <div className="card__header">
        <h2 id="dash-heading">Welcome, {user.displayName ?? user.email}</h2>
        <button
          type="button"
          className="button--ghost"
          onClick={() => {
            api.logout();
            onLogout();
          }}
        >
          Sign out
        </button>
      </div>

      <h3>Your gardens</h3>
      {loading ? (
        <p>Loading gardens…</p>
      ) : error ? (
        <p className="form__error" role="alert">
          {error}
        </p>
      ) : gardens.length === 0 ? (
        <p>No gardens yet. The seed script creates a demo garden for local development.</p>
      ) : (
        <ul className="list">
          {gardens.map((g) => (
            <li key={g.id} className="list__item">
              <strong>{g.name}</strong>
              {g.hardinessZone && <span className="badge">Zone {g.hardinessZone}</span>}
              {g.description && <p>{g.description}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

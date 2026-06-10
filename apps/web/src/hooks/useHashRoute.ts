import { useCallback, useEffect, useState } from 'react';

/**
 * Minimal hash-based routing for the app shell: keeps the active section in the
 * URL (e.g. `#/garden`) so views are deep-linkable and the browser back button
 * works, without pulling in a router dependency. Falls back to `fallback` for
 * any unknown hash.
 */
export function useHashRoute<T extends string>(
  valid: readonly T[],
  fallback: T,
): [T, (view: T) => void] {
  const read = useCallback((): T => {
    const hash = window.location.hash.replace(/^#\/?/, '');
    return (valid as readonly string[]).includes(hash) ? (hash as T) : fallback;
  }, [valid, fallback]);

  const [route, setRoute] = useState<T>(read);

  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, [read]);

  const navigate = useCallback((view: T) => {
    if (window.location.hash !== `#/${view}`) {
      window.location.hash = `#/${view}`;
    }
    setRoute(view);
  }, []);

  return [route, navigate];
}

/**
 * Thin typed API client. Talks to the documented Gardien API contract; shared
 * response types come from @gardien/shared so the client can't drift from the
 * server. The JWT is persisted to localStorage so a single-user session
 * survives reloads (and works against the offline cache).
 */
import type { AuthResponse } from '@gardien/shared';

const TOKEN_KEY = 'gardien.token';

// In dev the Vite proxy forwards /api to the backend; in prod set VITE_API_BASE_URL.
const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // non-JSON error body; keep statusText
    }
    throw new ApiRequestError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface Garden {
  id: string;
  name: string;
  description: string | null;
  hardinessZone: string | null;
}

export interface AccountLocation {
  zipCode: string | null;
  hardinessZone: string | null;
  zoneIsManual: boolean;
  latitude: number | null;
  longitude: number | null;
}

export interface ZoneLookup {
  zip: string;
  hardinessZone: string;
  latitude: number | null;
  longitude: number | null;
  temperatureRange: string | null;
  source: 'api' | 'cache' | 'stale-cache';
}

export const api = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(res.token);
    return res;
  },
  logout(): void {
    setToken(null);
  },
  me() {
    return request<AuthResponse['user']>('/api/auth/me');
  },
  listGardens() {
    return request<Garden[]>('/api/gardens');
  },
  createGarden(input: { name: string; description?: string; hardinessZone?: string }) {
    return request<Garden>('/api/gardens', { method: 'POST', body: JSON.stringify(input) });
  },
  getZone() {
    return request<AccountLocation>('/api/zone');
  },
  lookupZone(zip: string) {
    return request<ZoneLookup>(`/api/zone/lookup?zip=${encodeURIComponent(zip)}`);
  },
  setZone(input: { zip?: string; hardinessZone?: string }) {
    return request<AccountLocation>('/api/zone', {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },
};

export * from './units.js';
export * from './enums.js';

/** Shape of the API auth response — shared so the web client stays in sync. */
export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  unitSystem: string;
  plan: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

/** Standard error envelope returned by the API. */
export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
}

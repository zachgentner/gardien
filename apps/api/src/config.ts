/** Centralised, validated environment configuration. Fail fast on misconfig. */
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';

// Load the repo-root .env in development; in production env vars come from the
// orchestrator (docker compose / host). `override: false` keeps real env wins.
loadDotenv({ path: resolve(process.cwd(), '../../.env'), override: false });
loadDotenv({ override: false });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const isProd = process.env.NODE_ENV === 'production';

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd,
  host: process.env.API_HOST ?? '0.0.0.0',
  port: Number(process.env.API_PORT ?? 3000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required(
    'JWT_SECRET',
    isProd ? undefined : 'dev-insecure-secret-change-me',
  ),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
} as const;

export type AppConfig = typeof config;

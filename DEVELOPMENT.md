# Gardien — Development Guide (Phase 0)

A single-user PWA monorepo: a Fastify + Prisma API (the documented contract for
the PWA, a future mobile client, and the ESP32 layer) and a React + Vite PWA.

## Stack

| Area      | Choice                                                      |
| --------- | ---------------------------------------------------------- |
| Monorepo  | npm workspaces (`packages/*`, `apps/*`)                    |
| API       | Fastify 5 + TypeBox + `@fastify/swagger` (OpenAPI)         |
| Database  | PostgreSQL + Prisma                                        |
| Auth      | JWT (`@fastify/jwt`), bcrypt; single-user, multi-user-ready |
| Web       | React 19 + Vite 6 + `vite-plugin-pwa` (offline-capable)   |
| Shared    | `@gardien/shared` — units, enums, response types           |
| CI        | GitHub Actions (lint, typecheck, test, OpenAPI check, build) |
| Deploy    | Docker + docker-compose (db, api, web, nightly backups)   |

## Layout

```
packages/shared   Domain enums, explicit-unit helpers, shared API types
apps/api          Fastify API, Prisma schema + seed, domain rule logic + tests
apps/web          React PWA (app shell, API client, offline status)
ops/backup.sh     Automated pg_dump backup with retention
.github/workflows CI pipeline
```

## Prerequisites

- Node.js 20+
- A PostgreSQL 16 database. Easiest is Docker: `docker compose up db -d`.
  Without Docker, install Postgres locally and point `DATABASE_URL` at it.

## First-time setup

```bash
cp .env.example .env          # then set a real JWT_SECRET
npm install                   # installs all workspaces
npm run prisma:generate -w @gardien/api
npm run prisma:deploy   -w @gardien/api   # apply migrations
npm run seed            -w @gardien/api   # demo data + admin user
```

The seed creates an owner account from `SEED_ADMIN_EMAIL` /
`SEED_ADMIN_PASSWORD` (defaults `admin@example.com` / `changeme123`).

## Day-to-day

```bash
npm run dev:api    # API at http://localhost:3000  (docs at /docs)
npm run dev:web    # PWA at http://localhost:5173   (/api proxied to the API)

npm run lint
npm run typecheck
npm test           # domain rule tests (rotation, companions) + more
npm run build
```

### API contract (API-first)

The OpenAPI document is generated from the route schemas and committed at
`apps/api/openapi.json`. Regenerate after changing any route:

```bash
npm run openapi -w @gardien/api
```

CI fails if `openapi.json` is out of date.

## Running the whole stack with Docker

```bash
cp .env.example .env          # set JWT_SECRET
docker compose up --build
# web  -> http://localhost:8080
# api  -> http://localhost:3000  (docs at /docs)
```

Nightly backups are written to `./backups` by the `backup` service
(schedule `BACKUP_CRON`, retention `BACKUP_KEEP_DAYS`). Run one on demand:

```bash
docker compose run --rm backup sh /usr/local/bin/backup.sh
```

## Conventions baked in (cross-cutting principles)

- **Explicit units** — lengths stored in millimetres, areas in m²; the user's
  display preference lives on `User.unitSystem`. See `packages/shared/units.ts`.
- **Soft deletes / archiving** — every entity has `deletedAt`; `DELETE`
  endpoints archive rather than destroy, so history is never lost.
- **Seasons are first-class** — their own table; plantings & amendments scope to
  a season.
- **Multi-user-ready** — user-owned rows carry `ownerId`; the plant directory is
  global today but allows per-user entries later, so Phase 8 is not a retrofit.
- **Tested rule logic** — rotation & companion rules are pure functions in
  `apps/api/src/domain` with unit tests; this is the core value.
- **Accessible & responsive** — visible focus, touch targets, reduced-motion and
  dark-mode support, `jsx-a11y` lint rules.

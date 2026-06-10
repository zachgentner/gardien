# Gardien

A smart garden planning, management, and monitoring system. Gardien helps you
plan what to grow, track what's planted where, and learn from each season — with
an optional IoT layer (ESP32) for automated monitoring and irrigation in a later
phase.

> **Scope today:** a single-user **Progressive Web App (PWA)** focused on
> planning, management, and a plant knowledge base. Hardware/sensor integration
> and an optional public/SaaS offering are planned for later phases (see Roadmap).

---

## Vision

Gardening rewards good planning and good record-keeping: knowing your climate,
choosing compatible plants, timing planting and harvest, and rotating crops so
the soil stays healthy. Gardien aims to make all of that easy, and eventually to
close the loop with real-world sensor data and automated irrigation.

---

## Core Concepts

- **Hardiness zone** — your USDA zone (derived from ZIP code) drives planting
  windows, plant suitability, and frost timing.
- **Garden & beds** — the physical spaces you grow in (raised beds, tillable
  areas, containers), each with a name, location, and history.
- **Plant directory** — a knowledge base of vegetables and flowers with growing
  requirements, companion relationships, common pests/diseases, and pitfalls.
- **Plant families** — rotation and disease logic operate at the family level
  (e.g. nightshades, brassicas), so families are modeled explicitly.
- **Seasons** — first-class entities; planting records, amendments, and history
  are all scoped to a season.
- **Planting records** — what was planted where and when, plus soil amendments,
  enabling crop-rotation recommendations season over season.

---

## Cross-Cutting Principles

These apply across every phase rather than to a single feature, and should be in
place from the start:

- **API-first design** — the PWA, a future mobile client, and the ESP32 all
  consume one documented API contract.
- **PWA / offline-friendly** — gardeners are often outdoors with poor signal;
  management views work offline and sync when reconnected. (Note: iOS limits
  background sync, so Phase 6 alerts need an email fallback.)
- **Accessibility & responsive design** — usable on phone, tablet, and desktop,
  meeting accessibility standards from day one.
- **Automated tests** — especially for the rotation/companion-rule logic, which
  is the core value and easy to get subtly wrong.
- **Manual overrides everywhere** — zone, planting windows, and recommendations
  are suggestions the user can override (microclimates are real).
- **Own your data** — units stored explicitly (metric + imperial display),
  soft-deletes/archiving so history is never lost, and export/import support.

---

## Roadmap

The roadmap is organized into phases. Earlier phases deliver a fully useful
planning/management tool on their own; hardware and multi-tenancy come later.
Robustness work is folded into the phase it belongs to.

### Phase 0 — Foundation
Get a deployable, single-user PWA skeleton in place.
See [DEVELOPMENT.md](./DEVELOPMENT.md) for setup and the chosen stack.
- [x] Choose and scaffold the web stack (frontend, backend/API, database).
      _npm-workspaces monorepo: Fastify + Prisma + Postgres API, React + Vite PWA._
- [x] **API-first**: define and document the API contract before building UI.
      _OpenAPI generated from route schemas, served at `/docs`, committed at
      `apps/api/openapi.json` (CI enforces it stays current)._
- [x] **PWA shell**: installable app, service worker, offline caching strategy.
      _`vite-plugin-pwa`: precached app shell + network-first API caching._
- [x] Define the core data model: users, gardens, beds, plants, plant families,
      seasons, planting records, soil amendments. _Prisma schema._
- [x] Bake in **explicit units**, **soft deletes/archiving**, and
      **seasons as first-class entities** at the schema level.
- [x] Authentication scaffolding — single-user now, but structured so multi-user
      can be enabled later (see Phase 8) rather than retrofitted.
- [x] CI pipeline with **automated tests** wired up from the first commit.
      _GitHub Actions: lint, typecheck, rotation/companion tests, build._
- [x] **Seed/fixture data** for local development and demos.
- [x] **Automated database backups** and environment config (dev/prod).
      _Nightly `pg_dump` backup service + `.env`-driven config._
- [x] Establish accessibility/responsive baseline (linting, component patterns).
      _`jsx-a11y` lint rules + accessible, responsive base styles._

### Phase 1 — Location & Hardiness Zone
- [x] Enter a ZIP code to look up the USDA hardiness zone.
      _`GET /api/zone/lookup?zip=` via phzmapi.org._
- [x] Associate the zone with the account; **allow manual override**.
      _`PUT /api/zone` (ZIP auto-lookup or manual `hardinessZone`); `zoneIsManual`
      flag protects overrides._
- [x] Store latitude/longitude (for later weather and frost features).
      _Saved on the account from the lookup result._
- [x] **Cache lookups** and degrade gracefully when the zone API is unavailable.
      _`ZoneLookupCache` table; serves stale cache when upstream is down._

### Phase 2 — Plant Directory
The knowledge base that powers planning.
- [ ] Catalog of plants (vegetables and flowers) with:
  - [ ] **Plant family** association (drives rotation/disease rules).
  - [ ] Planting and harvest windows by hardiness zone (**overridable**).
  - [ ] Companion plants and plants to keep apart (e.g. peppers and jalapeños
        cross-pollinating).
  - [ ] Preferred soil type, sun, water, and spacing needs.
  - [ ] Common pests and diseases (e.g. tomato hornworms).
  - [ ] Common mistakes and growing tips.
  - [ ] **Source/attribution** for each entry so reliability is judgeable.
- [ ] Search and filter (by zone suitability, type, season, companions).
- [ ] Seed the directory with an initial curated dataset.

### Phase 3 — Garden & Bed Management
- [ ] Create gardens and define how much growing space is available.
- [ ] Add beds/areas (raised beds, tillable areas, containers) with names,
      dimensions (**with units**), and locations.
- [ ] View each bed's current plantings, past planting history, and soil
      amendments.
- [ ] **Archive (soft-delete) beds** instead of destroying their history.

### Phase 4 — Garden Planning
- [ ] Plan a season: assign plants to beds based on available space.
- [ ] **Conflict detection at plan time** — warn on incompatible neighbors,
      overcrowding, or rotation violations *before* planting.
- [ ] Generate a planting/harvest calendar from zone-based windows.
- [ ] Track plan vs. actual (what you intended vs. what got planted).
- [ ] **Tests** covering the companion/spacing/conflict rules.

### Phase 5 — History & Recommendations
- [ ] Record what was planted in each bed each season.
- [ ] Track soil amendments per bed over time.
- [ ] Recommend plants per bed based on rotation history (e.g. follow heavy
      feeders with soil-enriching legumes) — **family-aware** and **overridable**.
- [ ] Surface warnings (e.g. planting the same family in the same bed too soon).
- [ ] **Data export/import** (CSV/JSON) — also eases the eventual SaaS migration.
- [ ] **Tests** covering the rotation/recommendation logic.

### Phase 6 — Weather-Driven Alerts
Builds on the location data from Phase 1.
- [ ] Pull localized weather forecasts (**cached, degrade gracefully**).
- [ ] Frost warnings based on forecast and your plantings.
- [ ] Location-based pest and disease alerts.
- [ ] Notification delivery with an **email fallback** where PWA push is limited.

### Phase 7 — Hardware Integration (IoT Controller & Data Gathering)
The ESP32 monitoring and irrigation layer.
- [ ] ESP32 firmware to read sensors and report to the app via the shared API.
- [ ] Sensor data collection and storage:
  - [ ] Air temperature
  - [ ] Humidity
  - [ ] Soil moisture
  - [ ] Water level
  - [ ] Light
- [ ] **Buffer readings on-device** and sync when connectivity returns.
- [ ] Dashboards and historical charts for sensor data.
- [ ] Automatic irrigation based on pre-set criteria (e.g. soil moisture
      thresholds), tied to specific beds.
- [ ] **Fail-safe irrigation** — hard limits/timeouts so a stuck valve or bad
      reading can't flood a bed; alert on anomalies.
- [ ] **Device health monitoring** — battery, last-seen, calibration tracking.
- [ ] **Secure device auth** — per-device credentials/tokens, not shared keys.
- [ ] Tie sensor/irrigation data back into planting records and recommendations.

### Phase 8 — Public / Commercial (SaaS) — *Future, optional*
A path to opening Gardien up beyond personal use.
- [ ] Multi-user tenancy with per-account data isolation.
- [ ] Account onboarding, roles/permissions.
- [ ] Billing, plans/tiers, and usage limits.
- [ ] Operational concerns: monitoring, backups, rate limiting, support.

---

## Statistics (Phase 7)

Sensor metrics the IoT layer will collect:

- Air temperature
- Humidity
- Soil moisture
- Water level
- Light

---

## Status

**Phase 0 (Foundation) is in place** — a deployable single-user PWA skeleton:
monorepo, documented API contract, PWA shell, full core data model, auth
scaffolding, CI with tests, seed data, backups, and an accessibility baseline.
See [DEVELOPMENT.md](./DEVELOPMENT.md) to run it.

The current focus is Phases 1–5 (location/zone, plant directory, garden &
bed management, planning, and history/recommendations) as a single-user PWA.

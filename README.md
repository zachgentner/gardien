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
- [x] Catalog of plants (vegetables and flowers) with:
  - [x] **Plant family** association (drives rotation/disease rules).
  - [x] Planting and harvest windows by hardiness zone (**overridable**).
        _`PlantingWindow` model (month ranges, wrap-around); user overrides via
        `ownerId`. Effective-window/suitability logic is unit-tested._
  - [x] Companion plants and plants to keep apart (e.g. peppers and jalapeños
        cross-pollinating).
  - [x] Preferred soil type, sun, water, and spacing needs.
  - [x] Common pests and diseases (e.g. tomato hornworms). _`PlantIssue` model._
  - [x] Common mistakes and growing tips.
  - [x] **Source/attribution** for each entry so reliability is judgeable.
- [x] Search and filter (by zone suitability, type, season, companions).
      _`GET /api/plants?q&type&familyId&zone&month&companionOf`._
- [x] Seed the directory with an initial curated dataset.
      _12 plants, families, companions, zone 7b/8a windows, pests/diseases._

### Phase 3 — Garden & Bed Management
- [x] Create gardens and define how much growing space is available.
      _`/api/gardens` CRUD; a garden carries an optional zone override and beds._
- [x] Add beds/areas (raised beds, tillable areas, containers) with names,
      dimensions (**with units**), and locations.
      _`/api/beds` CRUD; dimensions entered in the user's unit system and stored
      canonically in millimetres, area derived in m². Bed type, location, and
      soil captured too._
- [x] View each bed's current plantings, past planting history, and soil
      amendments. _`GET /api/beds/:id/detail` returns the bed plus its current
      vs. past plantings (split by status) and amendments; surfaced in the
      "Gardens & beds" panel._
- [x] **Archive (soft-delete) beds** instead of destroying their history.
      _`DELETE /api/beds/:id` and `/api/gardens/:id` set `deletedAt`; lists hide
      archived rows unless `includeArchived` is passed._

### Phase 4 — Garden Planning
- [x] Plan a season: assign plants to beds based on available space.
      _Planner assigns planned `PlantingRecord`s to a (bed, season); a season is
      the container and months are the resolution._
- [x] **Conflict detection at plan time** — warn on incompatible neighbors,
      overcrowding, or rotation violations *before* planting.
      _`GET /api/beds/:id/plan?seasonId=` composes companion, rotation, spacing,
      and zone-suitability rules into a single report with a `warningCount`._
- [x] Generate a planting/harvest calendar from zone-based windows.
      _The planner renders a 12-month calendar; plant/harvest bars come from each
      plant's effective zone window (override beats curated)._
- [x] Track plan vs. actual (what you intended vs. what got planted).
      _Plantings carry planned vs. actual dates and advance planned → planted →
      harvested from the planner._
- [x] **Tests** covering the companion/spacing/conflict rules.
      _`spacing.test.ts` (capacity) joins the existing companion/rotation/window
      tests — 59 in total._

### Phase 5 — History & Recommendations
- [x] Record what was planted in each bed each season.
      _Planting records (bed + season + plant + status/dates); surfaced in the
      bed detail and the Journal._
- [x] Track soil amendments per bed over time.
      _`/api/amendments` CRUD with a "Record an amendment" form on the bed detail._
- [x] Recommend plants per bed based on rotation history (e.g. follow heavy
      feeders with soil-enriching legumes) — **family-aware** and **overridable**.
      _`GET /api/beds/:id/recommendations` ranks by feeder succession, excluding
      rotation conflicts and zone-unsuitable plants; shown as "Recommended next"._
- [x] Surface warnings (e.g. planting the same family in the same bed too soon).
      _Rotation, companion, and overcrowding warnings appear in the planner's
      conflict panel at plan time._
- [x] **Data export/import** (CSV/JSON) — also eases the eventual SaaS migration.
      _JSON export (`GET /api/export`) and import (`POST /api/import`, additive
      with ID remapping + plant-slug resolution) both shipped, with download/upload
      in Settings. CSV is a later add._
- [x] **Tests** covering the rotation/recommendation logic.
      _`recommend.test.ts` joins the rotation tests — 58 in total._

### Phase 6 — Weather-Driven Alerts
Builds on the location data from Phase 1.
- [x] Pull localized weather forecasts (**cached, degrade gracefully**).
      _`GET /api/weather` via Open-Meteo (no API key); `WeatherCache` with a 3h
      freshness window and stale-cache fallback when upstream is down._
- [x] Frost warnings based on forecast and your plantings.
      _`domain/frost.ts` classifies hard/light frost from daily minima; shown as
      a dashboard banner with affected days highlighted._
- [x] Location-based pest and disease alerts.
      _A "Watch for" list built from the pests/diseases of what you're currently
      growing._
- [ ] Notification delivery with an **email fallback** where PWA push is limited.
      _Deferred follow-up; alerts surface in-app on the Home dashboard for now._

### Phase 7 — Hardware Integration (IoT Controller & Data Gathering)
The ESP32 monitoring and irrigation layer. _The app side (API + dashboards) is
built; the firmware itself is out of scope but consumes the documented ingest
contract below._
- [ ] ESP32 firmware to read sensors and report to the app via the shared API.
      _Firmware out of scope; the contract it targets (`POST /api/devices/ingest`,
      device-token auth) is built and documented._
- [x] Sensor data collection and storage:
  - [x] Air temperature
  - [x] Humidity
  - [x] Soil moisture
  - [x] Water level
  - [x] Light
        _`SensorReading` (metric enum) + `POST /api/devices/ingest`._
- [x] **Buffer readings on-device** and sync when connectivity returns.
      _Ingest is a batch upsert that's idempotent on `(device, metric, recordedAt)`,
      so re-sending a buffer never duplicates._
- [x] Dashboards and historical charts for sensor data.
      _The "Monitor" panel shows per-metric latest value + a sparkline history._
- [x] Automatic irrigation based on pre-set criteria (e.g. soil moisture
      thresholds), tied to specific beds.
      _`IrrigationConfig` per device; `POST /api/devices/:id/irrigate`._
- [x] **Fail-safe irrigation** — hard limits/timeouts so a stuck valve or bad
      reading can't flood a bed; alert on anomalies.
      _`domain/irrigation.ts` (9 tests): hard run cap, anti-flood interval, and
      OFF on missing/stale/out-of-range readings._
- [x] **Device health monitoring** — battery, last-seen, calibration tracking.
      _Battery/firmware/last-seen updated on every ingest; shown in Monitor._
- [x] **Secure device auth** — per-device credentials/tokens, not shared keys.
      _One-time `<deviceId>.<secret>` token; only its SHA-256 hash is stored;
      constant-time compare; rotatable._
- [ ] Tie sensor/irrigation data back into planting records and recommendations.
      _Future follow-up._

### Phase 8 — Public / Commercial (SaaS) — *Future, optional*
A path to opening Gardien up beyond personal use.
- [~] Multi-user tenancy with per-account data isolation.
      _Per-account isolation is already enforced — every query is scoped to the
      owning user. An org/team tenancy model (vs. user-as-tenant) is a product
      decision still open._
- [~] Account onboarding, roles/permissions.
      _Open registration + an `owner`/`member` role exist from Phase 0; richer
      role enforcement is pending the tenancy decision._
- [~] Billing, plans/tiers, and usage limits.
      _Plans (`free`/`pro`) and **usage limits** are enforced (e.g. free caps
      gardens/devices); the plan shows in Settings. Actual **billing/charging**
      still needs a payment-provider decision._
- [~] Operational concerns: monitoring, backups, rate limiting, support.
      _Backups (Phase 0) and **rate limiting** are in place (global per-IP limit +
      stricter auth limits); monitoring/support remain._

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

**Phases 0–6 are in place.** Phase 0 laid a deployable single-user PWA skeleton
(monorepo, documented API contract, PWA shell, full core data model, auth
scaffolding, CI with tests, seed data, backups, accessibility baseline). Phase 1
added location & USDA hardiness zone; Phase 2 the plant directory; Phase 3
garden & bed management; Phase 4 garden planning — a calendar-centric planner
with plan-time conflict detection; Phase 5 history & recommendations — per-bed
plant recommendations from rotation history, amendment logging, and JSON export;
Phase 6 weather-driven alerts — a localized forecast with frost warnings and a
pest/disease watch; Phase 7 hardware/IoT — the device + sensor API (per-device
token auth, idempotent ingestion), fail-safe irrigation control, and a "Monitor"
panel with sensor charts and device health. The app shell is a left-sidebar
layout (Home, Garden Manager, Garden Planner, Plant Directory, Journal, Monitor,
Settings). See [DEVELOPMENT.md](./DEVELOPMENT.md) to run it.

Remaining: Phase 8 (multi-tenant SaaS), plus deferred follow-ups — Phase 5 data
import, Phase 6 push/email notifications, ESP32 firmware, and tying sensor data
back into recommendations.

# SolarTrack — Waaree Solar Telemetry, Physics & Intelligence Monorepo

SolarTrack is an enterprise-grade solar monitoring, physics simulation, and yield reconciliation engine for rooftop solar photovoltaic installations (supporting Waaree inverters, dynamic astronomical tracking, and multi-timescale analysis).

---

## 1. Monorepo Architecture

```
waaree-dashboard/
├── apps/
│   ├── server/                         # Express 5 Node.js Backend
│   │   ├── src/
│   │   │   ├── server.js               # Composition root & HTTP server entry
│   │   │   ├── config.js               # Environment variables, ports, directory resolution
│   │   │   ├── routes/                 # Express route controllers
│   │   │   │   ├── syncRoutes.js       # /api/live/sync, /api/day-comparison, /api/daily-history
│   │   │   │   ├── intelligenceRoutes.js # /api/solar-intelligence, /api/weather/solar
│   │   │   │   ├── proxyRoutes.js      # /api/proxy/status, /api/proxy/refresh, accounts
│   │   │   │   └── settingsRoutes.js   # /api/settings, /api/settings/clean-panels
│   │   │   └── services/               # Core backend services
│   │   │       ├── telemetrySyncService.js # Waaree Cloud poller & packet cache manager
│   │   │       ├── canonicalBuilderService.js # Canonical telemetry snapshot builder
│   │   │       ├── intelligenceService.js  # PV physics model & site calibration engine
│   │   │       ├── weatherService.js   # Open-Meteo solar forecast & historical cache
│   │   │       ├── settingsStore.js    # Thread-safe atomic settings persistence
│   │   │       └── accountsStore.js    # Multi-account station credential storage
│   │   └── public/                     # Vite production build artifacts (index.html, JS, CSS)
│   │
│   └── web/                            # React 19 + TypeScript + Vite 8 Frontend
│       └── src/
│           ├── app/                    # Global app state hooks, telemetry, toasts
│           ├── features/               # Domain-driven feature modules
│           │   ├── layout/             # TopHeader, MobileNav
│           │   ├── overview/           # Hero card, live generation chart, hygiene card
│           │   ├── performance/        # Multi-timescale stage, SVG charts, calendar popover
│           │   ├── health/             # 14-channel telemetry audit, conversion curves
│           │   ├── financials/         # DISCOM net-metering cycles, P&L, payback horizon
│           │   ├── settings/           # System, DISCOM, hardware anchor registers
│           │   └── modals/             # Account, DataCatalog, Location, DailyReport modals
│           └── shared/                 # Reusable UI primitives, API client, utilities
│
├── packages/
│   └── solar-core/                     # Shared TypeScript Engine (ESM / Node & Browser)
│       └── src/
│           ├── index.ts                # Package entrypoint & type exports
│           ├── solarTruthEngine.ts     # Astronomical sun math & PV physics model
│           ├── solarIntelligenceEngine.ts # Sensorless soiling, degradation & tilt loss
│           ├── buildCanonicalSolarSnapshot.ts # Outage gap detection & water-fill engine
│           ├── auditRawChannels.ts     # Inverter hardware telemetry validation
│           ├── solarComparisonMath.ts  # Daily/weekly/monthly aggregation & delta stats
│           ├── performanceAnalytics.ts # Horizon projections, percentile envelopes
│           ├── systemHealthAnalytics.ts # Inverter efficiency curves, voltage tracking
│           └── financialAnalytics.ts   # DISCOM slab models, net-metering cashflow
│
├── data/                               # Local persistent JSON state & cached telemetries
├── tests/                              # Comprehensive automated test suites
│   ├── unit/                           # Core physics & water-filling invariants
│   ├── integration/                    # Server Express endpoints & cache mutations
│   └── e2e/                            # Live solar 8-scenario outage matrix
├── package.json                        # Monorepo workspaces & scripts
└── tsconfig.base.json                  # Shared strict TypeScript configuration
```

---

## 2. Quick Start & Developer Scripts

Run all commands from the repository root:

```bash
# Install dependencies
npm install

# Full workspace verification (lint + typecheck + build)
npm run check

# Run all test suites (unit, integration, E2E)
npm test

# Run linter across all web and core files (oxlint)
npm run lint

# Run strict TypeScript checks (apps/web + packages/solar-core)
npm run typecheck

# Build frontend for production (emits to apps/server/public)
npm run build

# Start production server daemon (serves SPA and API on PORT 3000)
npm start
```

---

## 3. Environment Variables & Data Directory Contract

SolarTrack supports running in both development and containerized production environments:

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PORT` | `3000` | HTTP port for the unified Express server and static assets. |
| `PROXY_PORT` | `3001` | Dedicated reverse proxy port for Waaree Cloud requests. |
| `PROXY_AUTH_TOKEN` | *(auto-generated)* | Secure bearer token for internal API proxy calls. |
| `SOLAR_DATA_DIR` | `./data` | Directory where `settings.json`, station accounts, and cached daily telemetries are persisted. |

---

## 4. Hardware Water-Filling Reconciliation Architecture

Waaree cloud report endpoints (`/generic/v0/plant/history/report`) calculate monthly and lifetime yields as the sum of cloud daily bars. However, when local Wi-Fi or Internet outages cross midnight (such as during storm blackouts or router restarts):
1. The inverter hardware accumulates physical generation in internal EEPROM registers (`EMonth` and `ETotal`).
2. Cloud daily bars fail to backfill missed intervals, causing cloud aggregates to lag behind physical production.

SolarTrack solves this through its **Universal Water-Fill Reconciliation Engine**:
- **Baseline Physics Twin**: Simulates clear-sky irradiance, temperature derating, inverter clipping, and seasonal tilt to derive expected generation for unmonitored windows.
- **Hardware Register Anchors**: The user can input the exact `Monthly Energy` (`122.60 kWh`) or `Lifetime Yield` (`140.90 kWh`) shown on the inverter LCD or Waaree app.
- **Proportional Gap Filling**: The engine allocates the exact unlogged kWh delta across verified outage intervals (flagged as `BUFFER_ESTIMATED` vs `EEPROM_CONFIRMED`), guaranteeing 100% mathematical reconciliation with the physical meter while retaining transparent audit trails.

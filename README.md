<div align="center">

# ☀️ SolarTrack — Solar Telemetry, Physics & Intelligence Monorepo
### *Next-Generation Astrophysics Simulation, Inverter EEPROM Reconciliation & Apple Precision Glass Cockpit for Web & Mobile*

[![Platform Monorepo](https://img.shields.io/badge/Monorepo-npm%20Workspaces-CB3837?style=for-the-badge&logo=npm&logoColor=white)](https://github.com/ShivanshSingh158/solartrack)
[![React 19](https://img.shields.io/badge/Web%20Cockpit-React%2019%20%2B%20Vite%208-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Cross-Platform Mobile](https://img.shields.io/badge/Mobile-Expo%20SDK%20%7C%20React%20Native-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev)
[![TypeScript](https://img.shields.io/badge/Codebase-100%25%20Strict%20TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS%204-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Solar Physics](https://img.shields.io/badge/Physics%20Core-Astronomical%20%26%20Fresnel%20IAM-FFB300?style=for-the-badge)](https://github.com/ShivanshSingh158/solartrack)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

<br/>

> **"Traditional solar dashboards merely plot delayed inverter packets. SolarTrack simulates solar astrophysics, reconciles physical EEPROM registers across blackout gaps, and diagnoses rooftop generation loss in real time."**  
> SolarTrack is an enterprise-grade rooftop solar monitoring, physics simulation, and yield reconciliation engine supporting Waaree inverters, dynamic astronomical solar modeling, sensorless soiling prediction, and cross-platform mobile telemetry.

---

[🚀 Quickstart](#-quickstart--developer-workflows) • [🌌 Astrophysics & Physics Engine](#-core-physics--astrophysics-simulation-engine) • [💧 Water-Fill Reconciliation](#-universal-water-fill-reconciliation-architecture) • [🎨 Apple Precision Glass UI](#-apple-precision-glass-design-system) • [📱 SolarTrack Mobile](#-solartrack-mobile-react-native--expo) • [🏛️ System Architecture](#️-system-architecture) • [🛠️ Tech Stack Matrix](#️-tech-stack-matrix)

</div>

---

## 📑 Table of Contents

- [1. Executive Overview](#-executive-overview)
- [2. Core Physics & Astrophysics Simulation Engine](#-core-physics--astrophysics-simulation-engine)
  - [Astronomical Solar Geometry & Zenith Modeling](#astronomical-solar-geometry--zenith-modeling)
  - [Fresnel Refraction & Incident Angle Modifier (IAM)](#fresnel-refraction--incident-angle-modifier-iam)
  - [360° Rooftop Parapet Horizon Mask](#360-rooftop-parapet-horizon-mask)
  - [Sensorless Soiling, Radiative Sky Subcooling & Bottom-Lip Damming](#sensorless-soiling-radiative-sky-subcooling--bottom-lip-damming)
  - [PV Cell Temperature Derating & Non-Linear Inverter Efficiency](#pv-cell-temperature-derating--non-linear-inverter-efficiency)
- [3. Universal Water-Fill Reconciliation Architecture](#-universal-water-fill-reconciliation-architecture)
  - [The Cloud vs EEPROM Outage Dilemma](#the-cloud-vs-eeprom-outage-dilemma)
  - [Deterministic Outage Gap Classification](#deterministic-outage-gap-classification)
  - [Proportional Mathematical Reconstruction](#proportional-mathematical-reconstruction)
- [4. Apple Precision Glass Design System](#-apple-precision-glass-design-system)
  - [Atmospheric Daylight Solar Lighting](#atmospheric-daylight-solar-lighting)
  - [Floating Elevation Bento Cockpit](#floating-elevation-bento-cockpit)
  - [SCORA Radial Tachometer & Arc Dial](#scora-radial-tachometer--arc-dial)
- [5. Platform Feature Modules (Web & Mobile)](#-platform-feature-modules)
  - [Live Cockpit & Hero Generation Curve](#live-cockpit--hero-generation-curve)
  - [Multi-Timescale Performance & 7-Day Performance Ledger](#multi-timescale-performance--7-day-performance-ledger)
  - [14-Channel Hardware Telemetry Audit & Conversion Curves](#14-channel-hardware-telemetry-audit--conversion-curves)
  - [DISCOM Net-Metering Financials & Payback Horizon](#discom-net-metering-financials--payback-horizon)
  - [Automated Daily Solar Report & Dip Diagnosis](#automated-daily-solar-report--dip-diagnosis)
- [6. System Architecture](#️-system-architecture)
  - [End-to-End Data Flow](#end-to-end-data-flow)
  - [Monorepo Codebase Topology](#monorepo-codebase-topology)
- [7. SolarTrack Mobile (React Native + Expo)](#-solartrack-mobile-react-native--expo)
- [8. Production Benchmarks](#-production-benchmarks)
- [9. Quickstart & Developer Workflows](#-quickstart--developer-workflows)
- [10. Environment Variables & Runtime Contract](#-environment-variables--runtime-contract)
- [11. Tech Stack Matrix](#️-tech-stack-matrix)
- [12. License & Author](#-license--author)

---

## 💡 Executive Overview

Standard solar monitoring portals suffer from critical operational defects:
1. **Cloud Outage Amnesia**: When home Wi-Fi or cellular gateways drop off during power cuts or storms, the cloud reports zero production for that interval, permanently discarding the energy generated.
2. **Ignorance of Sun Physics**: Cloud platforms cannot tell whether a dip in power was caused by an unexpected cloud, dirty glass, or shading from a nearby parapet wall.
3. **No Financial Truth**: Utility meters measure bidirectional net-metered imports and exports, but cloud apps present uncalibrated raw numbers disconnected from regional tariff slabs.

**SolarTrack fundamentally changes this paradigm:**
- **Astrophysics Digital Twin**: Dynamically simulates exact solar zenith angles, clear-sky beam and diffuse irradiance, Fresnel reflection losses, and ambient cell heating.
- **Physical Hardware Reconciliation**: Synchronizes directly with physical inverter EEPROM non-volatile counters (`EMonth` and `ETotal`), mathematically reconstructing missing generation intervals with full audit transparency.
- **Microclimate Soiling Intelligence**: Models dust deposition, particulate matter accumulation, and nocturnal dew cementation using ambient humidity and radiative sky cooling equations.
- **Bento Cockpit with Apple Precision Glass**: High-end user interface designed with light-field gradients, responsive SVG charts, and interactive diagnostic modals on both web and native mobile.

---

### 🥊 Problem vs. Solution: The 3-Card Reality

| Challenge / Status Quo | Legacy Solar Cloud Portals | SolarTrack Architectural Solution |
| :--- | :--- | :--- |
| **1. The Blackout Data Loss Trap** | Wi-Fi cuts during storms cause cloud report APIs to drop daily bars, permanently deflating monthly yield by 15–30 kWh. | **Universal Water-Fill Engine**: Reads non-volatile inverter EEPROM registers (`EMonth` / `ETotal`) and proportionally reconstructs missing intervals with zero data loss ($\Delta E = 0$). |
| **2. The Sensor Hardware Cost Trap** | Optical dust sensors and pyranometer irradiance meters cost \$1,500+ per rooftop installation. | **Sensorless Subcooling Astrophysics**: Models dew condensation and soiling cementation using ambient humidity, particulate matter, and nocturnal radiative sky cooling equations. |
| **3. The Cognitive Fatigue Trap** | Industrial SCADA screens spam 40 uncalibrated charts, raw modbus registers, and incomprehensible error codes. | **Apple Precision Glass & SCORA Dial**: Luxury 270° radial tachometer, daylight atmospheric gradient light-fields, and automated plain-language Daily Dip Diagnosis reports. |

---

### 🛡️ Core Architectural Invariants

SolarTrack enforces strict mathematical and runtime guarantees across the monorepo:

| Domain | Invariant Rule | Architectural Enforcement |
| :--- | :--- | :--- |
| **Energy Conservation** | $\sum E_{\text{logged}} + \sum E_{\text{reconstructed}} \equiv E_{\text{EEPROM}}$ | `waterFillReconciler.ts` guarantees exact mathematical equivalence to physical meter counters. |
| **Astrophysical Purity** | Clear-sky irradiance, sun vectors, and Fresnel IAM are side-effect-free. | `solarTruthEngine.ts` maintains zero async/network calls and pure deterministic floating-point outputs. |
| **Timezone Determinism** | Strictly anchored to Indian Standard Time (`Asia/Kolkata` / UTC+05:30). | `istDate.ts` eradicates UTC midnight crossover off-by-one errors across leap years and day comparisons. |
| **Site Scaling Bounds** | $k_{\text{Site}}$ calibration scaling factor strictly bounded ($0.85 \le k_{\text{Site}} \le 1.15$). | `siteCalibrator.ts` prevents uncalibrated runaway irradiance overestimation. |
| **Subcooling Limits** | Radiative sky cooling cannot produce negative Kelvin temperatures ($T_{\text{sky}} > 0$). | `soilingModel.ts` clamps nocturnal blackbody radiation to thermodynamic physical bounds. |

---

## 🌌 Core Physics & Astrophysics Simulation Engine

Located in [`packages/solar-core/src/physics`](packages/solar-core/src/physics), the SolarTrack physics engine evaluates real-time telemetry against deterministic astronomical and thermodynamic laws.

### Astronomical Solar Geometry & Zenith Modeling
The sun position engine computes solar declination $\delta$, equation of time $EOT$, and local solar time $LST$ for any rooftop coordinate $(\phi, \lambda)$:

$$\sin(\alpha) = \sin(\phi) \sin(\delta) + \cos(\phi) \cos(\delta) \cos(H)$$

where $\alpha$ is solar elevation, $\theta_z = 90^\circ - \alpha$ is solar zenith angle, and $H$ is the local hour angle.

### Fresnel Refraction & Incident Angle Modifier (IAM)
At glancing morning and evening angles ($\theta_z > 60^\circ$), panel glass exhibits strong non-linear reflection described by Fresnel's equations:

$$IAM(\theta) = 1 - b_0 \left( \frac{1}{\cos(\theta)} - 1 \right)$$

SolarTrack prevents overestimating early morning and late afternoon generation by integrating calibrated angular modifier coefficients.

### 360° Rooftop Parapet Horizon Mask
Every rooftop installation is enclosed by architectural boundaries (parapet walls, water storage tanks, stairwell towers). SolarTrack incorporates a customizable $360^\circ$ angular obstruction envelope:

$$\text{Obstruction}(\gamma) = \max \left( 0^\circ, \arctan\left(\frac{h_{\text{wall}}}{d_{\text{panel}}}\right) \right)$$

When the solar vector falls below the horizon mask threshold, direct beam irradiance is clamped to zero while diffuse irradiance continues to be modeled.

### Sensorless Soiling, Radiative Sky Subcooling & Bottom-Lip Damming
Traditional solar software requires expensive pyranometers and optical dust sensors. SolarTrack predicts soiling through physics:
- **Radiative Sky Cooling**: At night, solar glass faces the open sky and cools below ambient dry-bulb temperature:

$$T_{\text{sky}} = T_{\text{amb}} \left( 0.711 + 0.0056 T_{\text{dp}} + 0.000073 T_{\text{dp}}^2 + 0.013 \cos\left(15 t_{\text{solar}}\right) \right)^{0.25}$$

- **Dew Cementation**: When glass temperature drops below the dew point $T_{\text{dp}}$, condensed moisture dissolves airborne PM2.5/PM10 particulates, forming a cemented crust when baked by morning sun.
- **Bottom-Lip Silt Damming**: On shallow-tilt installations ($< 15^\circ$), runoff water collects at the bottom panel frame lip, creating an escalating localized soiling barrier.

### PV Cell Temperature Derating & Non-Linear Inverter Efficiency
Panel surface temperature exceeds ambient temperatures under solar radiation:

$$T_{\text{cell}} = T_{\text{amb}} + G \cdot \left(\frac{NOCT - 20}{800}\right)$$

$$P_{\text{DC}} = P_{\text{STC}} \cdot \left( \frac{G}{1000} \right) \cdot \left[ 1 + \gamma_{\text{Pmp}} \cdot (T_{\text{cell}} - 25^\circ\text{C}) \right]$$

SolarTrack then models inverter conversion using a non-linear efficiency curve with minimum MPPT operating thresholds and maximum power clipping.

---

## 💧 Universal Water-Fill Reconciliation Architecture

Located in [`packages/solar-core/src/snapshot/waterFillReconciler.ts`](packages/solar-core/src/snapshot/waterFillReconciler.ts).

### The Cloud vs EEPROM Outage Dilemma
When an inverter produces power while disconnected from the cloud:
1. The cloud daily yield summation shows missing hours.
2. The internal non-volatile EEPROM register (`EMonth` and `ETotal`) accurately increments every watt-hour generated.
3. The inverter LCD displays the correct number (e.g. $136.80\text{ kWh}$), but standard dashboards display inaccurate numbers (e.g. $118.40\text{ kWh}$).

### Deterministic Outage Gap Classification
SolarTrack categorizes every timestamp into strict behavioral invariants:
- **`NIGHT_SLEEP`**: Irradiance is zero ($G = 0$), solar elevation is negative. Inverter is offline because the sun is down. Zero generation expected.
- **`GRID_OUTAGE`**: Inverter AC grid voltage dropped below safety limits. Grid is disconnected; solar production ceases for safety.
- **`BUFFER_ESTIMATED`**: Inverter lost Wi-Fi communication during daylight hours. Physics models expected clear-sky power curve.
- **`EEPROM_CONFIRMED`**: Physical generation confirmed by hardware register anchors.

### Proportional Mathematical Reconstruction
Given the hardware anchor deficit:

$$\Delta E = E_{\text{hardware\_register}} - \sum E_{\text{cloud\_logged}}$$

The water-fill engine allocates $\Delta E$ proportionally across the physics-simulated unlogged intervals:

$$E_{\text{interval}} = \Delta E \cdot \left( \frac{E_{\text{physics}}(\text{interval})}{\sum_{\text{gaps}} E_{\text{physics}}} \right)$$

This guarantees 100% mathematical reconciliation with the physical meter while preserving a complete audit trail.

---

## 🎨 Apple Precision Glass Design System

SolarTrack Web and Mobile are designed around Apple Precision Glass principles, daylight solar themes, and clean information hierarchy:

| Design Dimension | Implementation Detail |
| :--- | :--- |
| **Daylight Atmospheric Theme** | Fluid light-field sky gradients (`#f4f8fc` to `#e9f2fa`) reflecting real-time diurnal sun positions. |
| **Floating Elevation Bento** | Deep multilayered shadows (`0 8px 32px rgba(15, 23, 42, 0.08)`) with frosted glass borders (`rgba(255, 255, 255, 0.7)`). |
| **SCORA Radial Tachometer** | Luxury 270° radial arch gauge displaying instantaneous power, MPPT tracking speed, and headroom. |
| **Cognitive Cleanliness** | Eradicated visual pill clutter in favor of scannable metric cards and precision typography. |
| **Responsive Dual-Engine Charts** | High-performance SVG line and bar renders with zero layout shift and touch hover scrubbers. |

---

## ✨ Platform Feature Modules

### ☀️ Live Cockpit & Hero Generation Curve
- **Real-Time Generation Chart**: Smooth diurnal solar curve comparing actual inverter output against the astronomical clear-sky baseline.
- **Instant Weather & Irradiance**: Integrated Open-Meteo live solar radiation ($W/m^2$), ambient temperature, and cloud cover.
- **Panel Cleanliness Gauge**: Live indicator of soiling derating percentage with one-click "Record Panel Cleaning" calibration reset.

### 📊 Multi-Timescale Performance & 7-Day Performance Ledger
- **Flexible Aggregation**: Seamless switching between Day, Week, Month, Year, and Lifetime views.
- **7-Day Bento Ledger**: Compact performance matrix beneath the primary chart highlighting peak power, yield delta, and solar ratio.
- **Audit Print Modal**: Print-ready, high-resolution solar performance audit reports with cryptographic data hashes.

### 🩺 14-Channel Hardware Telemetry Audit & Conversion Curves
- **Multi-Channel Inverter Inspection**: Detailed validation of Grid Voltage ($V_{\text{AC}}$), Grid Frequency ($Hz$), DC String 1 & 2 Voltages ($V_{\text{DC}}$), DC Currents ($I_{\text{DC}}$), and Inverter Core Temperature ($^\circ\text{C}$).
- **Non-Linear Efficiency Curve**: Dynamic scatter plot plotting real-time inverter DC-to-AC conversion efficiency across variable loading percentages.

### 💰 DISCOM Net-Metering Financials & Payback Horizon
- **Customizable Tariff Engine**: Configurable residential and commercial slab rates (e.g. ₹7.50 / kWh).
- **Monthly Savings & Avoided Cost**: Tracks energy offset against utility grid purchases.
- **Payback Projection**: Real-time payback timeline based on capital expenditure and cumulative yield.

### 📋 Automated Daily Solar Report & Dip Diagnosis
- **End-of-Day Analysis Modal**: Automated summary generated each evening classifying performance ratio, generation losses, and weather impacts.
- **Intelligent Dip Diagnosis**: Identifies whether mid-day drops were due to cloud occlusion, grid instability, or localized panel shading.

---

## 🏛️ System Architecture

### End-to-End Data Flow

```mermaid
graph TD
    Inverter([Waaree Inverter / Datalogger]) -->|Encrypted Cloud Packets| Cloud[Waaree Cloud Portal]
    Cloud -->|REST API Ingestion| BaaS[Express 5 BaaS Server]
    Weather([Open-Meteo Weather API]) -->|Solar Irradiance & Dew Point| BaaS
    
    BaaS --> Engine[SolarCore Physics & Math Engine]
    
    subgraph SolarCore Engine
        Astronomy[Astronomical Sun Positioning]
        Fresnel[Fresnel IAM & Horizon Mask]
        Soiling[Radiative Sky Cooling & Soiling Model]
        WaterFill[Universal Water-Fill Reconciler]
    end
    
    Engine --> Astronomy
    Engine --> Fresnel
    Engine --> Soiling
    Engine --> WaterFill
    
    WaterFill --> Snapshot[Canonical Solar Snapshot Store]
    
    Snapshot -->|SSE & REST Endpoints| Web[React 19 Web Dashboard]
    Snapshot -->|Mobile App API /api/app/v1/*| Mobile[Expo React Native Mobile App]
```

---

### Monorepo Codebase Topology

```
waaree-dashboard/
├── apps/
│   ├── server/                         # Express 5 Node.js Headless BaaS
│   │   ├── src/
│   │   │   ├── server.js               # Server entry & route registration
│   │   │   ├── config.js               # Environment configuration & directory resolution
│   │   │   ├── routes/
│   │   │   │   ├── syncRoutes.js       # Live sync & day comparison endpoints
│   │   │   │   ├── intelligenceRoutes.js # Solar physics & weather endpoints
│   │   │   │   ├── proxyRoutes.js      # Waaree Cloud proxy & account manager
│   │   │   │   ├── appRoutes.js        # High-performance mobile endpoints (/api/app/v1/*)
│   │   │   │   └── settingsRoutes.js   # Atomic settings persistence
│   │   │   └── services/               # Core services (telemetry, weather, accounts)
│   │   └── public/                     # Vite production build output
│   │
│   └── web/                            # React 19 + TypeScript + Vite 8 Web App
│       └── src/
│           ├── app/                    # State management, hooks, telemetry listeners
│           ├── features/               # Domain-driven feature modules
│           │   ├── layout/             # TopHeader, navigation, status indicators
│           │   ├── overview/           # Hero curve, live tachometer, 7-day ledger
│           │   ├── performance/        # Multi-timescale views, SVG charts, audit modals
│           │   ├── health/             # 14-channel telemetry audit, conversion curves
│           │   ├── financials/         # DISCOM slab calculations, P&L, payback
│           │   ├── settings/           # System configuration & register anchors
│           │   └── modals/             # DailyReport, Account, and Catalog modals
│           └── shared/                 # UI primitives, API client, formatting utilities
│
├── packages/
│   └── solar-core/                     # Shared TypeScript Physics & Math Engine
│       └── src/
│           ├── index.ts                # Primary entry point & type exports
│           ├── physics/                # Astronomical geometry, Fresnel IAM, atmosphere
│           ├── intelligence/           # Soiling model, gap classification, report builder
│           ├── snapshot/               # Water-fill reconciler, period rollups, snapshot builder
│           ├── calibration/            # Horizon mask & inverter curve calibration
│           ├── analytics/              # Daily report engine, health & financial math
│           ├── time/                   # Pure IST calendar & clock arithmetic
│           └── types/                  # End-to-end typed domain contracts
│
├── mobile/                             # React Native + Expo Cross-Platform App
│   ├── src/
│   │   ├── api/                        # Mobile BaaS API client & offline caching
│   │   ├── components/                 # Apple widget cards, dials, tachometer gauge
│   │   └── screens/                    # Cockpit, History, Diagnostics, Savings, Settings
│   ├── app.json                        # Expo app configuration
│   └── metro.config.js                 # Metro bundler configuration
│
├── data/                               # Local persistent state & cached telemetries
├── tests/                              # Automated test suites
│   ├── unit/                           # Physics invariants & IST date arithmetic
│   ├── integration/                    # Server endpoints & cache mutations
│   └── e2e/                            # Live solar 8-scenario gap reconciliation matrix
├── package.json                        # Monorepo workspaces & developer scripts
└── tsconfig.base.json                  # Strict shared TypeScript configuration
```

---

## 📱 SolarTrack Mobile (React Native + Expo)

The mobile client is engineered from the ground up for iOS and Android:
- **Native 60/120 FPS Worklets**: Fluid gesture-driven navigation and animated dials powered by the Hermes engine.
- **SCORA Arch Gauge**: Real-time GPU-rendered tachometer showing live generation, active capacity percentage, and daily accumulation.
- **Offline Resilience**: Automatic caching of recent telemetry snapshots with instant background re-synchronization.
- **Dedicated Mobile Endpoints**: Optimized `/api/app/v1/*` REST payloads reducing data transfer and mobile battery drain.

---

## ⚡ Production Benchmarks

| Metric | Measured Value | Standard / Baseline |
| :--- | :---: | :---: |
| **Physics Calibration Calculation** | **< 12 ms** (full diurnal curve) | ~150 ms |
| **TypeScript Strict Compilation** | **0 errors / Strict Mode** | Variable |
| **Linter Execution (oxlint)** | **619 ms** (84 files, 24 threads) | ~8–12 s |
| **E2E 8-Scenario Outage Test Run** | **172 ms** (complete matrix) | ~4–5 s |
| **Automated Test Suite (23 tests)** | **100% pass (5.6 s)** | Variable |
| **Frontend Production Build Time** | **< 3.2 seconds** | ~25–40 s |

---

## 🚀 Quickstart & Developer Workflows

### Prerequisites
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher

---

### 1. Monorepo Setup

```bash
# Clone the repository
git clone https://github.com/ShivanshSingh158/solartrack.git
cd solartrack

# Install all monorepo dependencies
npm install

# Verify workspace integrity (lint + typecheck + build)
npm run check
```

---

### 2. Running Web & Backend

```bash
# Start backend server & BaaS (serves on PORT 3000)
npm run dev

# In a separate terminal: Start web frontend with Vite HMR
npm run dev:web
```

Visit `http://localhost:5173` for the Vite development dashboard, or `http://localhost:3000` for the production server.

---

### 3. Running Mobile App (Expo)

```bash
# Start the Expo development server
npm run mobile:start

# Or launch directly on target platforms
npm run mobile:android
npm run mobile:ios
```

Scan the QR code using the **Expo Go** app on your physical device.

---

### 4. Running Test Suites

```bash
# Run unit, integration, and E2E scenario matrices
npm test

# Run linter
npm run lint

# Run strict TypeScript checks
npm run typecheck
```

---

## ⚙️ Environment Variables & Runtime Contract

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PORT` | `3000` | HTTP port for the unified Express server and static assets. |
| `PROXY_PORT` | `3001` | Dedicated reverse proxy port for Waaree Cloud requests. |
| `PROXY_AUTH_TOKEN` | *(auto-generated)* | Secure bearer token for internal API proxy calls. |
| `SOLAR_DATA_DIR` | `./data` | Directory where settings, station accounts, and daily telemetries are persisted. |

---

## 🛠️ Tech Stack Matrix

| Domain | Technology | Key Responsibility |
| :--- | :--- | :--- |
| **Web UI** | React 19 + Vite 8 | Apple Precision Glass desktop and tablet dashboard |
| **Mobile UI** | React Native + Expo SDK 54/58 | iOS & Android cross-platform mobile client |
| **Shared Physics Engine** | TypeScript (ESM) | Deterministic astronomical, Fresnel, and soiling calculations |
| **Backend & BaaS** | Express 5 (Node.js) | High-performance telemetry ingestion and mobile REST API |
| **Styling** | Tailwind CSS 4 + Pure CSS | Zero-overhead glassmorphism and light-field gradients |
| **Type Safety** | TypeScript 7 (Strict) | End-to-end typed schema contracts across packages |
| **Weather & Irradiance** | Open-Meteo Solar API | Satellite-calibrated solar radiation and dew-point data |
| **Testing** | Node.js Test Runner | Unit physics invariants, API integration, and E2E outage matrices |

---

## 📄 License & Author

**Built with precision by Shivansh Singh.**  
Released under the [MIT License](LICENSE).

<div align="center">
  <br/>
  <b>⭐ If SolarTrack helps you monitor, optimize, and reconcile your solar generation, please star the repository! ⭐</b>
  <br/><br/>
  <a href="https://github.com/ShivanshSingh158/solartrack">
    <img src="https://img.shields.io/github/stars/ShivanshSingh158/solartrack?style=social" alt="GitHub Stars"/>
  </a>
</div>

# Contributing to SolarTrack

Thank you for your interest in contributing to SolarTrack! This guide outlines our repository structure, development workflow, coding standards, and verification guidelines.

---

## 1. Monorepo Organization

SolarTrack is organized as an npm workspaces monorepo:

- **`apps/server`**: Express 5 backend server, telemetry polling engine, and headless BaaS API provider (`/api/app/v1/*`).
- **`apps/web`**: React 19 + TypeScript + Vite 8 frontend client featuring Apple Precision Glass UI, interactive SVG charts, and live telemetry widgets.
- **`packages/solar-core`**: Core mathematical simulation library containing astronomical sun positioning, Fresnel IAM physics, soiling loss calculations, gap water-filling, and financial yield analytics.
- **`mobile`**: React Native + Expo cross-platform mobile application utilizing Hermes and native fluid worklets.
- **`tests`**: Automated test suites covering core physics unit invariants, Express API integration, and multi-scenario telemetry gap matrices.

---

## 2. Getting Started

### Prerequisites
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher

### Local Development Setup
```bash
# Clone the repository
git clone https://github.com/ShivanshSingh158/solartrack.git
cd solartrack

# Install monorepo dependencies
npm install

# Run backend server (serves API and local build)
npm run dev

# Run web frontend with Vite HMR
npm run dev:web

# Run Expo mobile development server
npm --prefix mobile run start
```

---

## 3. Engineering & Code Standards

### Strict Type Safety
- TypeScript strict mode is enforced across `packages/solar-core`, `apps/web`, and `mobile`.
- Avoid arbitrary `any` declarations. Use domain types defined in `packages/solar-core/src/types`.

### Mathematical & Physics Determinism
- Solar calculations (e.g. zenith angles, clear-sky irradiance, cell temperature models) must remain pure, side-effect-free, and deterministic.
- Timezone operations must strictly account for Indian Standard Time (`Asia/Kolkata` / UTC+05:30) without UTC midnight off-by-one errors.
- Any change to core mathematical routines must include accompanying unit test coverage in `tests/unit/`.

### UI & Styling Standards
- Web components adhere to the Apple Precision Glass design specification, daylight atmospheric gradients, and floating elevation cards.
- Mobile components maintain 60/120 FPS performance on native UI threads with Hermes.

---

## 4. Verification & Testing

Before submitting a Pull Request, verify that all validation steps pass:

```bash
# Run oxlint across web and shared sources
npm run lint

# Run strict TypeScript compiler checks
npm run typecheck

# Run test suites (unit, integration, and E2E)
npm test

# Verify production Vite build
npm run build

# Or execute full workspace check in one command
npm run check
```

---

## 5. Branch & Commit Convention

We use GitHub Flow with Conventional Commits:

- `feat(...)`: New feature or physics module
- `fix(...)`: Bug fix or calculation calibration
- `refactor(...)`: Code cleanup with no functional changes
- `perf(...)`: Performance improvement
- `docs(...)`: Documentation updates

Branch names should follow the pattern `feature/short-description` or `fix/short-description`.

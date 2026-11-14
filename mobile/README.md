# SolarTrack Mobile

The official cross-platform mobile client for SolarTrack, engineered with **React Native**, **Expo SDK 54/58**, and the **Hermes JavaScript Engine**.

---

## 1. Overview & Architecture

SolarTrack Mobile brings real-time rooftop solar monitoring, inverter telemetry, and astrophysics-calibrated yield tracking directly to iOS and Android devices:

- **Apple Precision Daylight Aesthetic**: Frosted glass surfaces, clean typography, dynamic sun-arc atmospheric lighting, and high-contrast metric telemetry.
- **Radial Tachometer & Arc Dial**: Fluid, GPU-accelerated gauges indicating instantaneous solar output (kW), active inverter load percentage, and clear-sky benchmark comparisons.
- **5-Tab Mobile Cockpit**:
  - `Cockpit`: Instant live telemetry, diurnal generation curves, panel hygiene status, and real-time solar irradiance tracking.
  - `History`: Multi-timescale generation ledger (daily bars, weekly envelopes, monthly totals, and lifetime yield reconciliation).
  - `Diagnostics`: 14-channel inverter telemetry health audit, DC string voltage tracking, and conversion efficiency indicators.
  - `Savings`: Tariff-calibrated net metering financials, monthly bill reductions, and cumulative lifetime return-on-investment.
  - `Settings`: Inverter station account management, manual register calibration, and theme preferences.
- **BaaS API Integration**: Connects seamlessly to the SolarTrack Express BaaS endpoints (`/api/app/v1/*`) with offline caching and token management.

---

## 2. Directory Structure

```
mobile/
├── assets/                  # Icons, splash screens, and raster assets
├── src/
│   ├── api/
│   │   └── solarClient.ts   # BaaS HTTP client, cache wrapper, and auth persistence
│   ├── components/
│   │   ├── AtmosphericBackground.tsx # Dynamic diurnal sky gradient background
│   │   ├── FloatingPillTabBar.tsx    # Frosted floating capsule dock navigation
│   │   ├── ForecastRow.tsx           # Multi-day solar irradiance preview row
│   │   ├── MetricCard.tsx            # Apple iOS widget-style metric cards
│   │   ├── PanelCleanlinessCard.tsx  # Soiling status & subcooling dew-point card
│   │   ├── PowerDial.tsx             # Interactive solar generation arc dial
│   │   └── TachometerGauge.tsx       # Precision radial tachometer gauge
│   └── screens/
│       ├── CockpitScreen.tsx         # Live operational dashboard
│       ├── DiagnosticsScreen.tsx     # Inverter hardware telemetry health
│       ├── HistoryScreen.tsx         # Historical solar performance ledger
│       ├── LoginScreen.tsx           # Inverter cloud credential authentication
│       ├── SavingsScreen.tsx         # Net-metering financial analytics
│       └── SettingsScreen.tsx        # System configuration & register anchors
├── app.json                 # Expo configuration & app manifest
├── eas.json                 # Expo Application Services build profiles
├── index.ts                 # Application registration
└── metro.config.js          # Metro bundler resolver configuration
```

---

## 3. Running the Mobile App

Ensure dependencies are installed:

```bash
cd mobile
npm install
```

Start the Expo development server:

```bash
npm start
```

### Target Platforms
- **Android**: Press `a` or run `npm run android`
- **iOS**: Press `i` or run `npm run ios`
- **Web Preview**: Press `w` or run `npm run web`

---

## 4. Environment Configuration

The mobile application connects to the SolarTrack server URL configured in `solarClient.ts` (defaults to local network host or deployed endpoint).

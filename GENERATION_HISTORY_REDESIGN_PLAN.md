# Generation History Tab Redesign Plan

## 1. Executive Summary & Design Vision

The **Generation History** tab currently suffers from several design and usability friction points:
1. **Clunky, boxy bar charts** in Week and Month views that use nested cyan outline boxes, harsh tick marks, and ugly diagonal hatch patterns.
2. **Erratic tooltip behavior** where hovering displays a finicky "Click → 5-Min" prompt, but moving the cursor across narrow bars causes the tooltip to jump chaotically across dates before the user can interact.
3. **Overly dense engineering jargon** across KPI cards, chart subtitles, and bottom ledgers (e.g., *"3.27 kWp DC / 3.00 kW AC"*, *"Model-Normalized Daily Yield"*, *"Attribution Health 73% vs weather"*, *"213 W/m² · 14.8 MJ/m²"*, *"EDay-Confirmed Wi-Fi Gap"*).
4. **Repetitive and truncated strings** repeated across daily spark cards (*"Smooth unforecasted local haz..."*).
5. **Cluttered date-picker calendar popover** with four competing, brightly colored pill capsules at the bottom.
6. **Superfluous `Export` dropdown button** in the control header.

This plan outlines the complete restructuring of the Generation History tab into a **luxury Apple iOS aesthetic** (Apple Health, Fitness, and Stocks design language): clean rounded pill bars, smooth background track geometry, stable inspection badges, plain human-friendly vocabulary, and zero visual clutter.

---

## 2. Core Problem Analysis & Architectural Solutions

| Current Implementation | Apple Minimalist Redesign |
|---|---|
| ❌ Clunky box-inside-a-box bullet bars with cyan outlines & diagonal hatches | ✅ Sleek rounded capsule bars (iOS Fitness) with soft gray background potential track |
| ❌ Tooltip with finicky "Click → 5-Min" that jumps frantically on cursor move | ✅ Stable, smooth inspector badge with instant direct click-to-drilldown |
| ❌ Technical astrophysics/SCADA jargon ("GTI", "AOD", "kSite", "Attribution") | ✅ Plain, everyday language ("Solar Energy", "Expected Target", "Sunny Day") |
| ❌ Repeated tilt, capacity & text across cards | ✅ Single source of truth, zero truncation |
| ❌ Cluttered multi-color calendar pills | ✅ Structured iOS Calendar with clean rows |
| ❌ Unnecessary Export dropdown button | ✅ Clean, focused control bar (Export gone) |

---

## 3. Detailed Component-by-Component Specifications

### A. PerformanceControlHeader.tsx (Controls & Calendar Popover)
1. **Remove Export Button**:
   - Delete the entire `<div ref={exportRef}>...<Download /> Export...</div>` popover and button from lines 578–626.
   - Cleanly align the segmented `[Graph | Table]` toggle directly on the right edge.
2. **Clean Period Switcher**:
   - Keep the sliding 4-mode segmented pill track (`Day`, `Week`, `Month`, `Year`) with its smooth Apple glass spring indicator.
   - Simplify sub-labels:
     - `Day` · 5-Min
     - `Week` · 7 Days
     - `Month` · Daily
     - `Year` · Monthly

---

### B. SolarDateCalendarPopover.tsx (iOS Calendar Popover)
1. **Eliminate Noisy Pill Buttons**:
   - Remove the four disparate colored pill capsules (`Today (20 Nov)`, `Last Sync (19 Nov)`, `Peak 04 Nov (13.4)`, `Dip 02 Nov (2.0)`).
2. **Apple-Grade Structured Footer**:
   - Replace with a clean, structured segmented action bar:
     - Top row: Two elegant, neutral pill actions: `[ Today ]` and `[ Last Verified Day ]` with clean border and subtle hover state.
     - Bottom row: Subtle hairline summary displaying `Peak Day: 04 Nov · 13.4 kWh` and `Lowest Day: 02 Nov · 2.0 kWh` in quiet, tabular typography without aggressive background colors.
3. **Refined Calendar Grid**:
   - Day circles use iOS-style solid dark circle for active selection (`bg-slate-900 text-white`), subtle soft green dots for high-yield days, and crisp numeric typography.

---

### C. PerformanceBulletBarsSvg.tsx (Week & Month Bar Charts)
1. **Eliminate Boxy Containers & Hatch Patterns**:
   - Remove outer translucent cyan box outlines (`fill="rgba(2, 132, 199, 0.12)" stroke="rgba(2, 132, 199, 0.25)"`).
   - Remove diagonal striped patterns (`bridgedGapHatch`, `gapOutageHatch`).
2. **Implement Apple Rounded Capsule Bars**:
   - **Benchmark Track**: A clean, soft slate rounded pill (`fill="#F1F5F9" rx="full"`) showing the clear-sky potential for that day.
   - **Generation Capsule**: A vibrant, solid rounded pill (`rx="full"`) rising smoothly inside the track:
     - Emerald (`#10B981`) for normal/optimal solar production.
     - Warm Amber (`#F59E0B`) for weather/cloud reduction.
     - Soft Muted Slate (`#94A3B8`) for in-progress or past partial days.
3. **Hover & Interaction Improvements**:
   - Widen the invisible click/hover target rectangle over each column to eliminate flickering.
   - On hover, gently elevate the bar with subtle opacity (`opacity-100` vs `opacity-90`) and highlight the corresponding date label below.
   - Clicking any bar immediately selects that date and seamlessly opens its Day 5-Min curve.

---

### D. PerformanceStageTooltips.tsx (Hover Inspector)
1. **Remove Finicky "Click → 5-Min" Label**:
   - Eliminate the confusing call-to-action that users try to chase with their mouse.
2. **Stabilized Inspector Card**:
   - Positioned cleanly with smooth transition.
   - Uses plain, human-friendly terms:
     - Date & Weekday (e.g., `Sun, 15 Nov 2026`)
     - **Actual Solar Generation**: `11.1 kWh`
     - **Sunny Day Target**: `~11.9 kWh (93% captured)`
     - **Weather Conditions**: `Clear Sky` / `Passing Clouds` / `Haze`
3. **No Astrophysics Acronyms**:
   - Remove "Cloud Logged", "Outage Buffer", "Physics Model", "Clear-Sky Ceiling", "AOD", "kSite".

---

### E. performanceKpiAndTableBuilders.ts & PerformanceKpiStrip.tsx (KPIs)
1. **Human-Centric Metric Translations**:
   - **Week Tab**:
     - *Old*: `7-DAY REAL OUTPUT 65.8 kWh 7d cloud` → *New*: **7-Day Generation · 65.8 kWh** (Daily avg 9.4 kWh)
     - *Old*: `WEEK PHYSICS TARGET ~90.4 kWh weather-adj` → *New*: **Sunny Day Potential · 90.4 kWh** (Clear sky target)
     - *Old*: `DAILY AVG & BEST DAY 9.4 kWh/d Peak day 12.6 kWh (3.9/kWp)` → *New*: **Peak Production Day · 12.6 kWh** (18 Nov)
     - *Old*: `ATTRIBUTION HEALTH 73% vs weather Cloud -10.4 · Dirt -4.8 kWh` → *New*: **Weather Impact · 73% Captured** (-15.2 kWh lost to clouds/haze)
   - **Month Tab**:
     - *Old*: `MONTH-TO-DATE OUTPUT 210.50 kWh inverter synced 193.1 kWh Cloud + 17.40 kWh Inverter Register` → *New*: **Monthly Generation · 210.5 kWh** (19 days tracked)
     - *Old*: `MONTH PHYSICS MODEL ~238.5 kWh verified span` → *New*: **Estimated Potential · 238.5 kWh** (88% efficiency)
     - *Old*: `DAILY AVG & BEST DAY 10.2 kWh/d Best: 13.5 kWh (4.1/kWp)` → *New*: **Daily Average · 10.2 kWh/day** (Peak 13.5 kWh on 11 Nov)
     - *Old*: `PERIOD CAPTURE & COVERAGE 88% capture Specific 64.4 kWh/kWp` → *New*: **Estimated Savings · ₹1,547** (At ₹7.35/kWh)
   - **Day Tab**:
     - *Old*: `ACTUAL PRODUCTION 0.2 kWh till now` → *New*: **Solar Generation · 0.2 kWh** (Live 0.38 kW)
     - *Old*: `EXPECTED TARGET ~0.2 kWh till now Full day target: ~12.1 kWh (Clean Sky 15.1)` → *New*: **Target for Today · ~0.2 kWh** (Full day ~12.1 kWh)
     - *Old*: `PEAK POWER & EFFICIENCY 0.38 kW @ 07:54 AM 3.27 kWp DC / 3.00 kW AC 0.06 -> ~3.85 units/kWp today` → *New*: **Peak Output · 0.38 kW** (Recorded at 07:54 AM)
     - *Old*: `SUN & INVERTER EFFICIENCY 82.2% efficiency 10 data points 46% Direct / 54% Scattered 213 W/m²` → *New*: **Solar Efficiency · 82.2%** (Good sunlight conditions)
2. **Chart Titles & Subtitles**:
   - Day: `Friday, 20 Nov 2026 · 5-Minute Solar Generation Curve` | Subtitle: `Real inverter output compared to clear-sky benchmark`
   - Week: `7-Day Performance Trend` | Subtitle: `Daily energy generated vs expected sunny-day benchmark`
   - Month: `November 2026 · Daily Breakdown` | Subtitle: `Daily generation across the month (Average 10.2 kWh/day)`
   - Year: `2026 Annual Overview` | Subtitle: `Monthly solar production since commissioning`

---

### F. WeeklyEnvelopeStrip.tsx (7-Day Spark Cards)
1. **Eliminate Truncated Jargon Sentences**:
   - Remove truncated strings like *"Smooth unforecasted local haz..."* and *"Partial telemetry coverage (84..."*.
2. **Apple-Style Weather Badges**:
   - Replace with clean weather icons and short human descriptors:
     - `Sunny & Clear` (Emerald)
     - `Partly Cloudy` (Sky Blue)
     - `Morning Haze` (Warm Amber)
     - `Heavy Overcast` (Slate)
3. **Clean Visual Hierarchy**:
   - Top: Day of week (`Fri 14`, `Sat 15`, etc.) with Live badge on current day.
   - Middle: Smooth SVG area sparkline.
   - Bottom: Generation amount (`11.1 kWh`) with percentage of target (`89%`).

---

### G. PerformanceFooterLedgers.tsx (Bottom Information Cards)
1. **Left Card: "Solar & System Health"** (formerly "Solar & Inverter Breakdown"):
   - *Sunlight Conditions*: "Bright Direct Sunlight" / "Scattered Ambient Light" (instead of `46% Direct Sun - 54% Scattered Light`).
   - *Roof Sun Strength*: "High Sun (Clear Sky)" / "Moderate Sun" (remove `213 W/m² · 14.8 MJ/m² day`).
   - *System Conversion Efficiency*: "78.9% (Normal operational performance)".
   - *Inverter Status*: "Active & Synchronized" (remove `0.43 -> 0.38 kW - 82.2% weighted (10 pts)`).
2. **Right Card: "Where Did The Solar Energy Go?"**:
   - Retain the clean proportional multi-segment bar.
   - Clean labels:
     - `Delivered to Home & Grid (56%)`
     - `Lost to Clouds & Rain (-86.9 kWh)`
     - `Lost to Dust & Surface Soiling (-9.2 kWh)`
     - `Lost to Power Outages (-45.0 kWh)`
   - Bottom note: Replace technical Wi-Fi logs with a clean status message: *"All days recorded and verified"*.

---

## 4. File Modification Matrix

| File Path | Primary Changes |
|-----------|-----------------|
| `apps/web/src/features/performance/PerformanceControlHeader.tsx` | Remove `Export` dropdown button; refine spacing and alignment of `Graph \| Table` toggle. |
| `apps/web/src/features/overview/SolarDateCalendarPopover.tsx` | Replace multi-colored bottom pills with structured iOS-style action rows and subtle summary typography. |
| `apps/web/src/features/performance/PerformanceBulletBarsSvg.tsx` | Replace box-in-box bars with sleek rounded pill capsules; remove hatching and cyan borders. |
| `apps/web/src/features/performance/PerformanceStageTooltips.tsx` | Remove "Click → 5-Min"; simplify text to plain human terms; stabilize hover presentation. |
| `apps/web/src/features/performance/performanceKpiAndTableBuilders.ts` | Replace technical jargon with friendly, everyday language across all 4 timescale KPI strips. |
| `apps/web/src/features/performance/PerformanceTab.tsx` | Update chart titles/subtitles to clear, human-readable descriptions without repetitive hardware strings. |
| `apps/web/src/features/performance/WeeklyEnvelopeStrip.tsx` | Replace truncated strings with clean weather status badges and crisp metrics. |
| `apps/web/src/features/performance/PerformanceFooterLedgers.tsx` | Simplify bottom cards, replacing raw physics units with intuitive solar insights. |

---

## 5. Verification & Testing Strategy

1. **Static Typechecking & Linting**: Run `npm run typecheck` across `@solar-track/web` and `@solar-track/core`.
2. **Production Bundle Compilation**: Run `npm run build` to ensure assets compile cleanly into `apps/server/public`.
3. **Visual Quality Verification**:
   - Inspect Week view: Confirm elegant rounded capsule bars with zero cyan outline boxes or hatching.
   - Inspect Month view: Confirm 30 clean rounded bars with smooth hover and zero jitter.
   - Inspect Calendar popover: Confirm structured, aligned layout with zero noisy pills.
   - Verify complete absence of the Export button.
   - Verify plain human terms across all 4 timescales (Day, Week, Month, Year).

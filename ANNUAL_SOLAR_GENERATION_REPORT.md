# 12-Month Annual Solar Generation & Financial Report
### Station: 3.27 kWp DC Rooftop Array / 3.0 kW AC Inverter
**Projection Period:** November 2026 to November 2027  
**Engine:** SolarTrack Digital Twin Multi-Physics & Astronomical Horizon Engine  
**Hardware Anchors:** 3.27 kWp Mono PERC Panels · 26.5° Tilt True South · DISCOM Tariff: ₹7.35 / kWh  

---

## Executive Summary

| Key Metric | Value | Engine Context |
| :--- | :---: | :--- |
| **Total Annual Generation** | **4,508 kWh (Units)** | Full 12-month net AC electricity exported/consumed |
| **Annual Electricity Savings** | **₹33,135 / year** | Direct bill reduction at ₹7.35 / unit DISCOM tariff |
| **Daily Average Yield** | **12.35 Units / day** | Annual average specific yield: 3.78 kWh/kWp/day |
| **Peak Generation Month** | **March (439 Units)** | Highest yield: 14.15 kWh/day (optimal sun angle + pre-heat) |
| **Lowest Generation Month** | **August (321 Units)** | Monsoon cloud attenuation (rain natural washing active) |
| **Theoretical Clear-Sky Potential** | **5,239 Units** | Unconstrained 100% PR without weather/thermal attenuation |
| **Annual System Realization** | **86.1%** | Reflects realistic atmospheric, thermal, and shading factors |

---

## Month-by-Month Generation & Savings Table

The simulation models hourly solar elevation, direct vs diffuse beam separation, atmospheric aerosol extinction (AOD/PM10), two-stage cell temperature derating, inverter quadratic clipping, and seasonal soiling rates.

| Month | Days | Daily Average (kWh/day) | Monthly Units (kWh) | Monthly Savings (₹) | Solar & Weather Character |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **November** | 30 | 12.44 | **373** | **₹2,742** | Post-monsoon clear skies, moderate aerosol haze, early sunset (~05:18 PM). |
| **December** | 31 | 10.85 | **336** | **₹2,470** | Lowest sun elevation of year (40.2°), morning winter fog, obstacle shadows. |
| **January** | 31 | 11.52 | **357** | **₹2,624** | Dense morning fog lifting by noon; cool ambient temps boost panel efficiency. |
| **February** | 28 | 14.05 | **393** | **₹2,889** | Spring ramp, rising sun elevation, crisp unclouded skies, moderate heat. |
| **March** *(Peak)* | 31 | **14.15** | **439** | **₹3,227** | **Annual Peak Month.** Intense direct beam, sun near 65°, mild thermal loss. |
| **April** | 30 | 14.02 | **421** | **₹3,094** | High solar radiation; dry dusty winds increase daily dust accumulation. |
| **May** | 31 | 13.40 | **415** | **₹3,050** | Intense sun (82° elevation), but ambient heat (38–44°C) causes ~15% cell thermal loss. |
| **June** | 30 | 12.96 | **389** | **₹2,859** | Summer solstice; pre-monsoon cloud build-up and scattered convective rain. |
| **July** | 31 | 11.57 | **359** | **₹2,639** | Southwest monsoon; frequent clouds, natural rain washing (0% dust soiling). |
| **August** *(Low)* | 31 | **10.37** | **321** | **₹2,359** | **Lowest Month.** Heavy monsoon cloud cover, diffuse-dominant solar spectrum. |
| **September** | 30 | 10.76 | **323** | **₹2,374** | Monsoon withdrawal, intermittent cloud clearing, high humidity. |
| **October** | 31 | 12.33 | **382** | **₹2,808** | Post-monsoon transition; clean washed panels, clear blue autumn skies. |
| **FULL YEAR** | **365** | **12.35** | **4,508 Units** | **₹33,135** | **Net Annual Hardware Yield** |

---

## Seasonal Profile & Microclimate Dynamics

### 1. Spring & Early Summer Peak Window (February – May: ~1,668 Units)
- **Top Producing Period:** Generates **37%** of your entire annual solar yield in just 4 months.
- **March** is the standout champion month (**439 Units / ~14.2 kWh/day**) because ambient temperatures are not yet excessively high (limiting thermal loss), while the sun climbs to ~65° elevation directly facing the 26.5° South-tilted array.
- In **May**, while raw solar irradiance is highest, cell temperatures exceed **62°C**, causing an automatic thermal voltage derate of $\approx -0.38\% / ^\circ\text{C}$ that reduces conversion efficiency by 15–18%.

### 2. Southwest Monsoon Window (July – September: ~1,003 Units)
- **Cloud Attenuation vs Self-Cleaning:** Cloud cover attenuates direct beam radiation by 35–50%, making August the lowest month (**321 Units**).
- **Zero Soiling Advantage:** Frequent heavy rainfalls provide continuous natural washing, reducing dust/soiling losses to zero and eliminating cemented particulate films.

### 3. Indo-Gangetic Winter Window (November – January: ~1,066 Units)
- **Solar Slant & Aerosols:** In December and January, the sun tracks at a low southern declination (noon elevation drops to 40.2°).
- **Morning Fog Inversion:** Dense ground fog during 07:00–09:30 AM reduces morning generation before noon clearing.
- **Thermal Advantage:** Cold ambient air (18–22°C) keeps PV cells cool, operating at near-ideal electrical efficiency (~98–101% of STC) whenever sunshine breaks through.

---

## Financial & Payback Analysis

| Parameter | Value | Reference / Formula |
| :--- | :---: | :--- |
| **System Installed Cost (Turnkey)** | ₹1,85,000 | 3.27 kWp DC with structure & bi-directional meter |
| **PM Surya Ghar Subsidy** | ₹78,000 | Central Govt Rooftop Subsidy scheme |
| **Net Customer Investment** | **₹1,07,000** | Net out-of-pocket setup cost |
| **Year 1 Value Generated** | **₹33,135** | 4,508 units × ₹7.35 DISCOM rate |
| **Simple Payback Period** | **3.23 Years** | Net Cost / Annual Electricity Savings |
| **25-Year Cumulative Savings** | **₹7,45,000+** | Factoring 0.55%/yr degradation & zero tariff hike |
| **Return on Investment (ROI)** | **30.9% / year** | Tax-free annual financial return on capital |

---

## Optimal Maintenance Recommendations

1. **Winter Fog Cleaning (Dec – Jan):** Wash panels once every 18–20 days. Morning dew glues atmospheric smoke and dust into a sticky film. Wash strictly after 05:30 PM or before 07:30 AM to prevent glass thermal shock.
2. **Pre-Summer Rinse (Early March):** Perform a thorough wipe before March to ensure maximum capture during your highest revenue-generating month (March: ~₹3,227).
3. **Monsoon Standby (July – Aug):** Turn off manual washing; natural rain resets surface soiling to 0% automatically.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const solarCore = require('@solar-track/core');

describe('water-fill EMonth/ETotal hardware reconciliation invariants', () => {
  const baseClock = solarCore.getIstClockParts(new Date('2026-11-11T17:36:00+05:30'));

  const mockReport = {
    dailyLedger: [
      {
        ymd: '2026-10-28',
        isConfirmed: false,
        bufferKwh: 0.75,
        modeledAfterSoilingKwh: 1.0,
        dipCategory: 'WIFI_OUTAGE_UNLOGGED',
        gapHoles: [],
      },
      {
        ymd: '2026-11-02',
        isConfirmed: true,
        bufferKwh: 0,
        modeledAfterSoilingKwh: 12.1,
        dipCategory: 'GRID_CURTAILMENT',
        gapHoles: [],
      },
      {
        ymd: '2026-11-09',
        isConfirmed: true,
        bufferKwh: 1.34,
        modeledAfterSoilingKwh: 11.6,
        dipCategory: 'PARTIAL_WIFI_GAP',
        gapHoles: [
          { state: 'GAP_MIDDAY_DROPOUT', kind: 'EEPROM_CONFIRMED', startMin: 585, endMin: 809, allocatedKwh: 6.61 },
          { state: 'GAP_EVENING_TAIL', kind: 'BUFFER_ESTIMATED', startMin: 885, endMin: 1041, allocatedKwh: 1.34 },
        ],
      },
      {
        ymd: '2026-11-10',
        isConfirmed: false,
        bufferKwh: 12.75,
        modeledAfterSoilingKwh: 12.75,
        dipCategory: 'WIFI_OUTAGE_UNLOGGED',
        gapHoles: [],
      },
      {
        ymd: '2026-11-11',
        isConfirmed: true,
        bufferKwh: 3.81,
        modeledAfterSoilingKwh: 13.5,
        dipCategory: 'PARTIAL_WIFI_GAP',
        gapHoles: [
          { state: 'GAP_MORNING_OUTAGE', kind: 'BUFFER_ESTIMATED', startMin: 384, endMin: 632, allocatedKwh: 3.81 },
        ],
      },
    ],
  };

  it('water-fills monthly & lifetime registers proportionally to exact Waaree App anchors', () => {
    const res = solarCore.reconcileWaterFillBuffers({
      clock: baseClock,
      ymdYest: '2026-11-10',
      yestIsConfirmed: false,
      isTodayConfirmed: true,
      todayBufferKwh: 3.81,
      todayCloudKwh: 9.7,
      todayGapClassification: null,
      rep: mockReport,
      summary: {
        generationToday: 9.7,
        generationMonth: 105.1,
        generationTotal: 122.7,
        lastUpdateDate: '2026-11-11 17:22:00 IST+0530',
        capacity: '3.30',
        country: 'India',
      },
      monthDaysSum: 105.1,
      resolvedMonthCloudKwh: 105.1,
      mtdKwh: 105.1,
      tariffPerKwh: 7.35,
      co2FactorKgPerKwh: 0.85,
      manualGridOffSet: new Set(),
      physicalEmonthKwh: 122.6,
      physicalEmonthCloudRefKwh: 105.1,
      physicalEmonthYm: '2026-11',
      physicalEmonthSetAtYmd: '2026-11-11',
      physicalEmonthSetAtMin: 17 * 60 + 36,
      physicalEtotalKwh: 140.9,
      physicalEtotalCloudRefKwh: 122.7,
      physicalEtotalSetAtYmd: '2026-11-11',
      physicalEtotalSetAtMin: 17 * 60 + 36,
    });

    assert.equal(res.physicalMonthTotalKwh, 122.6);
    assert.equal(res.physicalLifetimeKwh, 140.9);
    assert.equal(res.effMonthSource, 'manual');
    assert.equal(res.effTotalSource, 'manual');
    assert.equal(res.reconciledBufferByYmd['2026-11-02'] ?? 0, 0);

    const novSum = Object.entries(res.reconciledBufferByYmd)
      .filter(([k]) => k.startsWith('2026-11-'))
      .reduce((acc, [, v]) => acc + v, 0);
    assert.ok(Math.abs(105.1 + novSum - 122.6) <= 0.05, `novSum mismatch: ${novSum}`);
  });

  it('zeroes manualGridOffDates cleanly even when offline buffer exists', () => {
    const res = solarCore.reconcileWaterFillBuffers({
      clock: baseClock,
      ymdYest: '2026-11-10',
      yestIsConfirmed: false,
      isTodayConfirmed: true,
      todayBufferKwh: 3.81,
      todayCloudKwh: 9.7,
      todayGapClassification: null,
      rep: mockReport,
      summary: {
        generationToday: 9.7,
        generationMonth: 105.1,
        generationTotal: 122.7,
        lastUpdateDate: '2026-11-11 17:22:00 IST+0530',
        capacity: '3.30',
        country: 'India',
      },
      monthDaysSum: 105.1,
      resolvedMonthCloudKwh: 105.1,
      mtdKwh: 105.1,
      tariffPerKwh: 7.35,
      co2FactorKgPerKwh: 0.85,
      manualGridOffSet: new Set(['2026-11-10']),
      physicalEmonthKwh: null,
      physicalEmonthCloudRefKwh: null,
      physicalEmonthYm: null,
      physicalEmonthSetAtYmd: null,
      physicalEmonthSetAtMin: null,
      physicalEtotalKwh: null,
      physicalEtotalCloudRefKwh: null,
      physicalEtotalSetAtYmd: null,
      physicalEtotalSetAtMin: null,
    });

    assert.equal(res.reconciledBufferByYmd['2026-11-10'] ?? 0, 0);
    assert.ok(Math.abs(res.unloggedMonthKwh - (1.34 + 3.81)) <= 0.05);
  });
});

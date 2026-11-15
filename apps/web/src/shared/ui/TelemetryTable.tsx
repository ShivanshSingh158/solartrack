import React, { useMemo, useState } from 'react';
import { Table, Input, Segmented, Alert, Button, Empty } from 'antd';
import type { TableColumnsType } from 'antd';
import {
  Search,
  RotateCcw,
  Zap,
  IndianRupee,
  Activity,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import type { TableRowData, TimescaleMode } from '@solar-track/core';

interface TelemetryTableProps {
  rows: TableRowData[];
  timescale?: TimescaleMode;
  tariffPerKwh?: number;
  onSelectDate?: (ymd: string) => void;
  onSelectMonth?: (ym: string) => void;
}

type TelemetryScope = 'all' | 'generating' | 'anomalies' | 'standby';

export const TelemetryTable: React.FC<TelemetryTableProps> = ({
  rows,
  timescale = 'day',
  tariffPerKwh = 7.35,
  onSelectDate,
  onSelectMonth,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeScope, setActiveScope] = useState<TelemetryScope>('all');

  const showModelCols = rows.some((r) => Boolean(r.model || r.capturePct || r.note));
  const showElectricalCols = timescale === 'day' || rows.some((r) => r.pv !== '---' || r.feedin !== '---');

  const getStatusBadgeClass = (status: string) => {
    const low = status.toLowerCase();
    if (
      low.includes('generating') ||
      low.includes('on track') ||
      low.includes('optimal') ||
      low.includes('production ok') ||
      low.includes('active')
    ) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200/70';
    }
    if (low.includes('cloud') || low.includes('rain')) {
      return 'bg-sky-50 text-sky-700 border-sky-200/70';
    }
    if (
      low.includes('fog') ||
      low.includes('haze') ||
      low.includes('interpolated') ||
      low.includes('pending') ||
      low.includes('telemetry')
    ) {
      return 'bg-amber-50 text-amber-700 border-amber-200/70';
    }
    if (low.includes('outage') || low.includes('soiling') || low.includes('gap')) {
      return 'bg-rose-50 text-rose-700 border-rose-200/70';
    }
    return 'bg-slate-100 text-slate-600 border-slate-200/70';
  };

  // 1. Astryx 3-way narrowing: Scope -> Text Search
  const visibleRows = useMemo(() => {
    return rows.filter((r) => {
      // Scope cut
      if (activeScope === 'generating') {
        const val = parseFloat(r.output.replace(/[^0-9.]/g, '') || '0');
        if (val <= 0.05) return false;
      } else if (activeScope === 'anomalies') {
        const stat = r.status.toLowerCase();
        if (
          !stat.includes('outage') &&
          !stat.includes('soiling') &&
          !stat.includes('gap') &&
          !stat.includes('cloud') &&
          !stat.includes('rain') &&
          !stat.includes('fog') &&
          !stat.includes('interpolated')
        ) {
          return false;
        }
      } else if (activeScope === 'standby') {
        const stat = r.status.toLowerCase();
        if (!stat.includes('standby') && !stat.includes('night') && !stat.includes('sleep')) {
          return false;
        }
      }

      // Free-text query cut
      if (searchQuery.trim()) {
        const term = searchQuery.toLowerCase().trim();
        const matchesTime = r.time.toLowerCase().includes(term);
        const matchesOutput = r.output.toLowerCase().includes(term);
        const matchesStatus = r.status.toLowerCase().includes(term);
        const matchesNote = (r.note || '').toLowerCase().includes(term);
        if (!matchesTime && !matchesOutput && !matchesStatus && !matchesNote) {
          return false;
        }
      }

      return true;
    });
  }, [rows, activeScope, searchQuery]);

  // 2. Astryx Fact Ribbon Derived Arithmetic (strictly calculated on visible rows)
  const factSummary = useMemo(() => {
    let totalEnergyKwh = 0;
    let peakPower = 0;
    let anomalyCount = 0;

    visibleRows.forEach((r) => {
      const num = parseFloat(r.output.replace(/[^0-9.]/g, '') || '0');
      if (timescale === 'day') {
        // 5-minute telemetry intervals in kW: kW * (5/60) h = kWh
        totalEnergyKwh += num * (5 / 60);
      } else {
        totalEnergyKwh += num;
      }
      if (num > peakPower) peakPower = num;

      const stat = r.status.toLowerCase();
      if (
        stat.includes('outage') ||
        stat.includes('soiling') ||
        stat.includes('gap') ||
        stat.includes('cloud') ||
        stat.includes('rain')
      ) {
        anomalyCount++;
      }
    });

    const totalSavings = totalEnergyKwh * tariffPerKwh;
    return {
      totalEnergyKwh,
      peakPower,
      totalSavings,
      anomalyCount,
    };
  }, [visibleRows, timescale, tariffPerKwh]);

  const hasActiveFilters = searchQuery.trim() !== '' || activeScope !== 'all';

  const handleResetFilters = () => {
    setSearchQuery('');
    setActiveScope('all');
  };

  const columns = useMemo<TableColumnsType<TableRowData>>(() => {
    const cols: TableColumnsType<TableRowData> = [
      {
        title: timescale === 'day' ? 'Timestamp (IST)' : timescale === 'year' ? 'Month' : 'Date',
        dataIndex: 'time',
        key: 'time',
        sorter: (a, b) => a.time.localeCompare(b.time),
        render: (time: string) => (
          <span className="font-semibold text-slate-700 whitespace-nowrap">{time}</span>
        ),
      },
      {
        title: timescale === 'day' ? 'AC Output' : 'Real Yield',
        dataIndex: 'output',
        key: 'output',
        align: 'right',
        sorter: (a, b) => {
          const numA = parseFloat(a.output.replace(/[^0-9.]/g, '') || '0');
          const numB = parseFloat(b.output.replace(/[^0-9.]/g, '') || '0');
          return numA - numB;
        },
        render: (output: string) => (
          <span className="font-bold text-slate-900 tabular-nums whitespace-nowrap">{output}</span>
        ),
      },
    ];

    if (showModelCols) {
      cols.push(
        {
          title: 'Physics Model',
          dataIndex: 'model',
          key: 'model',
          align: 'right',
          sorter: (a, b) => {
            const numA = parseFloat(a.model?.replace(/[^0-9.]/g, '') || '0');
            const numB = parseFloat(b.model?.replace(/[^0-9.]/g, '') || '0');
            return numA - numB;
          },
          render: (model?: string) => (
            <span className="font-medium text-sky-700 tabular-nums whitespace-nowrap">{model || '—'}</span>
          ),
        },
        {
          title: 'Capture',
          dataIndex: 'capturePct',
          key: 'capturePct',
          align: 'right',
          sorter: (a, b) => {
            const numA = parseFloat(a.capturePct?.replace(/[^0-9.]/g, '') || '0');
            const numB = parseFloat(b.capturePct?.replace(/[^0-9.]/g, '') || '0');
            return numA - numB;
          },
          render: (capturePct?: string) => (
            <span className="font-bold text-slate-700 tabular-nums whitespace-nowrap">{capturePct || '—'}</span>
          ),
        },
      );
    }

    if (showElectricalCols) {
      cols.push(
        {
          title: 'PV DC Power',
          dataIndex: 'pv',
          key: 'pv',
          align: 'right',
          render: (pv: string) => (
            <span className="font-medium text-amber-700 tabular-nums whitespace-nowrap">{pv}</span>
          ),
        },
        {
          title: 'Grid Export',
          dataIndex: 'feedin',
          key: 'feedin',
          align: 'right',
          render: (feedin: string) => (
            <span className="font-medium text-emerald-700 tabular-nums whitespace-nowrap">{feedin}</span>
          ),
        },
      );
    }

    cols.push({
      title: 'Status / Attribution',
      dataIndex: 'status',
      key: 'status',
      filters: [
        { text: 'Generating / Optimal', value: 'generating' },
        { text: 'Cloud / Rain', value: 'cloud' },
        { text: 'Grid Outage / Soiling', value: 'outage' },
        { text: 'Standby / Night', value: 'standby' },
      ],
      onFilter: (value, record) => {
        const val = (value as string).toLowerCase();
        const stat = record.status.toLowerCase();
        if (val === 'generating') {
          return (
            stat.includes('generating') ||
            stat.includes('on track') ||
            stat.includes('optimal') ||
            stat.includes('production ok')
          );
        }
        if (val === 'cloud') {
          return stat.includes('cloud') || stat.includes('rain');
        }
        if (val === 'outage') {
          return stat.includes('outage') || stat.includes('soiling') || stat.includes('gap');
        }
        return stat.includes(val);
      },
      render: (status: string) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold ${getStatusBadgeClass(status)}`}
        >
          {status}
        </span>
      ),
    });

    if (showModelCols) {
      cols.push({
        title: 'Notes',
        dataIndex: 'note',
        key: 'note',
        responsive: ['md'],
        render: (note?: string) => (
          <span className="text-[11.5px] text-slate-500">{note || '—'}</span>
        ),
      });
    }

    return cols;
  }, [timescale, showModelCols, showElectricalCols]);

  return (
    <div className="p-4 sm:p-5 space-y-4 bg-slate-50/50 rounded-2xl border border-slate-200/60">
      {/* 1. Astryx Fact Ribbon Header */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Yield */}
        <div className="p-3.5 rounded-2xl bg-white/80 border border-slate-200/70 shadow-2xs backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-medium">Filtered Energy</span>
            <Zap className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 mt-1 tabular-nums">
            {factSummary.totalEnergyKwh.toFixed(2)}{' '}
            <span className="text-xs font-normal text-slate-500">kWh</span>
          </div>
        </div>

        {/* Realized Savings */}
        <div className="p-3.5 rounded-2xl bg-white/80 border border-slate-200/70 shadow-2xs backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-medium">Calculated Value</span>
            <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-lg font-bold text-slate-900 mt-1 tabular-nums">
            ₹{factSummary.totalSavings.toFixed(0)}{' '}
            <span className="text-xs font-normal text-slate-500">saved</span>
          </div>
        </div>

        {/* Peak Power */}
        <div className="p-3.5 rounded-2xl bg-white/80 border border-slate-200/70 shadow-2xs backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-medium">Peak Output</span>
            <Activity className="w-3.5 h-3.5 text-sky-600" />
          </div>
          <div className="text-lg font-bold text-slate-900 mt-1 tabular-nums">
            {factSummary.peakPower.toFixed(2)}{' '}
            <span className="text-xs font-normal text-slate-500">
              {timescale === 'day' ? 'kW' : 'kWh'}
            </span>
          </div>
        </div>

        {/* Anomalies */}
        <div className="p-3.5 rounded-2xl bg-white/80 border border-slate-200/70 shadow-2xs backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-medium">Anomalies / Dips</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 mt-1 tabular-nums">
            {factSummary.anomalyCount}{' '}
            <span className="text-xs font-normal text-slate-500">
              {timescale === 'day' ? 'slices' : 'days'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Astryx 3-Way Narrowing Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 rounded-2xl bg-white/90 border border-slate-200/70 shadow-2xs">
        <Segmented<TelemetryScope>
          value={activeScope}
          onChange={setActiveScope}
          options={[
            { label: 'All Slices', value: 'all' },
            { label: 'Generating', value: 'generating' },
            { label: 'Anomalies & Dips', value: 'anomalies' },
            { label: 'Standby / Night', value: 'standby' },
          ]}
          className="apple-segmented text-xs font-medium"
        />

        <div className="flex items-center gap-2">
          <Input
            placeholder="Search timestamp or status..."
            prefix={<Search className="w-3.5 h-3.5 text-slate-400 mr-1" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            className="!rounded-xl text-xs sm:w-64"
            size="middle"
          />
          {hasActiveFilters && (
            <Button
              icon={<RotateCcw className="w-3 h-3" />}
              onClick={handleResetFilters}
              size="middle"
              className="!rounded-xl text-xs"
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* 3. Astryx Partial Totals Warning Banner */}
      {hasActiveFilters && visibleRows.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message={
            <div className="flex items-center justify-between text-xs">
              <span>
                <strong>Filtered Slice View:</strong> Showing {visibleRows.length} of {rows.length}{' '}
                rows. The figures in the fact ribbon above reflect only this filtered view.
              </span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="underline font-semibold ml-2 text-amber-800 hover:text-amber-900 cursor-pointer shrink-0"
              >
                Clear all filters
              </button>
            </div>
          }
          className="!rounded-xl !border-amber-200/80 !bg-amber-50/70"
        />
      )}

      {/* 4. Ant Design Table with Apple Glass Styling or Astryx Empty State */}
      <div className="rounded-2xl border border-slate-200/80 overflow-hidden bg-white shadow-2xs">
        {visibleRows.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <Empty
              description={
                <div className="space-y-1 mt-2">
                  <p className="text-sm font-semibold text-slate-800">
                    No matching telemetry intervals
                  </p>
                  <p className="text-xs text-slate-500">
                    No data slices match your query "{searchQuery}" or selected scope.
                  </p>
                </div>
              }
            >
              <Button
                type="primary"
                onClick={handleResetFilters}
                className="!rounded-xl !bg-slate-900 hover:!bg-slate-800 !text-xs !font-medium"
              >
                Clear Filters
              </Button>
            </Empty>
          </div>
        ) : (
          <Table<TableRowData>
            columns={columns}
            dataSource={visibleRows}
            rowKey={(record, index) => `${record.time}-${index}`}
            pagination={
              visibleRows.length > 20
                ? {
                    pageSize: 20,
                    showSizeChanger: true,
                    pageSizeOptions: ['10', '20', '50', '100'],
                    size: 'small',
                    className: '!px-4 !py-3',
                  }
                : false
            }
            scroll={{ y: 420, x: 'max-content' }}
            size="small"
            className="antd-apple-glass-table"
            onRow={(record) => {
              const isClickableDate =
                (timescale === 'week' || timescale === 'month') &&
                /^\d{4}-\d{2}-\d{2}/.test(record.time) &&
                Boolean(onSelectDate);
              const isClickableMonth =
                timescale === 'year' &&
                /^\d{4}-\d{2}$/.test(record.note || '') &&
                Boolean(onSelectMonth);

              return {
                onClick: () => {
                  if (isClickableDate && onSelectDate) {
                    onSelectDate(record.time.slice(0, 10));
                  } else if (isClickableMonth && onSelectMonth && record.note) {
                    onSelectMonth(record.note);
                  }
                },
                className:
                  isClickableDate || isClickableMonth
                    ? 'cursor-pointer hover:!bg-slate-50/90'
                    : undefined,
              };
            }}
          />
        )}
      </div>

      {/* 5. Minimalist Timestamp Footer Note */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 font-medium">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>Active Timescale: {timescale.toUpperCase()} &bull; 5-min intervals</span>
        </span>
        <span>
          Showing {visibleRows.length} of {rows.length} records
        </span>
      </div>
    </div>
  );
};

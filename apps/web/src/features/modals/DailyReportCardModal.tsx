import React from 'react';
import { X, Award, Share2, Sun, ArrowRight } from 'lucide-react';
import { formatINR } from '@solar-track/core';

interface DailyReportCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  dayYieldKwh?: number;
  tariffPerKwh?: number;
  peakKw?: number;
  peakTime?: string;
  activeHours?: string;
  systemCapacity?: number;
  tomorrowKwh?: number;
  plantName?: string;
  dateStr?: string;
  grade?: 'A' | 'B' | 'C';
  gradeLabel?: string;
  specificYield?: number;
}

export const DailyReportCardModal: React.FC<DailyReportCardModalProps> = ({
  isOpen,
  onClose,
  dayYieldKwh = 10.6,
  tariffPerKwh = 8.0,
  peakKw = 1.81,
  peakTime = '11:54 AM',
  activeHours = '10.5',
  systemCapacity = 3.0,
  tomorrowKwh = 12.1,
  plantName: _plantName,
  dateStr = 'Today',
  grade: propGrade,
  gradeLabel: propGradeLabel,
  specificYield: propSpecificYield,
}) => {
  if (!isOpen) return null;

  const savingsINR = Math.round(dayYieldKwh * tariffPerKwh);
  const specYieldNum =
    typeof propSpecificYield === 'number'
      ? propSpecificYield
      : systemCapacity > 0
        ? dayYieldKwh / systemCapacity
        : 0;
  const specificYield = specYieldNum.toFixed(2);
  const co2AvoidedKg = (dayYieldKwh * 0.85).toFixed(1);

  // Performance grade evaluation (specific-yield normalized across all array capacities)
  const resolvedGrade = propGrade || (specYieldNum >= 2.7 ? 'A' : specYieldNum >= 1.3 ? 'B' : 'C');
  const grade = `Grade ${resolvedGrade}`;
  const gradeDesc =
    propGradeLabel ||
    (resolvedGrade === 'A'
      ? 'Peak Yield Day'
      : resolvedGrade === 'B'
        ? 'Steady Generation'
        : 'Low Irradiance / Outage');
  const gradeBadge =
    resolvedGrade === 'A'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
      : resolvedGrade === 'B'
        ? 'bg-blue-100 text-blue-800 border-blue-300'
        : 'bg-amber-100 text-amber-800 border-amber-300';

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `SolarTrack Daily Report Card - ${dateStr}`,
        text: `My rooftop solar generated ${dayYieldKwh.toFixed(1)} kWh today (₹${savingsINR} saved), offsetting ${co2AvoidedKg} kg CO₂! Peak power was ${peakKw.toFixed(2)} kW.`,
      }).catch(() => {});
    } else {
      alert(`Daily Report Summary:\nYield: ${dayYieldKwh.toFixed(1)} kWh\nSavings: ₹${savingsINR}\nPeak: ${peakKw.toFixed(2)} kW\nCO₂ Avoided: ${co2AvoidedKg} kg`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-amber-500 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-white/90">
            <Award className="w-4 h-4" />
            <span>Sunset Daily Report Card</span>
          </div>
          
          <h2 className="text-2xl font-black mt-1 tracking-tight">
            Daily Solar Summary
          </h2>
          <p className="text-xs text-white/80 mt-0.5">
            {dateStr} · Astronomical Solar Day Complete
          </p>

          <div className="mt-4 flex items-center space-x-3">
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${gradeBadge}`}>
              ★ {grade} · {gradeDesc}
            </span>
            <span className="text-xs num font-semibold text-white/90">
              {specificYield} kWh/kWp
            </span>
          </div>
        </div>

        {/* Body Metrics Grid */}
        <div className="p-6 space-y-5">
          {/* Hero Numbers: Energy & Money */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Total Energy Generated
              </span>
              <div className="flex items-baseline space-x-1 mt-1">
                <span className="text-3xl font-black text-gray-900 num">
                  {dayYieldKwh.toFixed(1)}
                </span>
                <span className="text-xs font-bold text-gray-500">kWh</span>
              </div>
              <span className="text-[11px] text-emerald-600 font-semibold block mt-1">
                Area under daylight curve
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                Electricity Bill Saved
              </span>
              <div className="flex items-baseline space-x-1 mt-1">
                <span className="text-3xl font-black text-emerald-800 num">
                  ₹{savingsINR}
                </span>
              </div>
              <span className="text-[11px] text-emerald-700 font-medium block mt-1">
                At ₹{tariffPerKwh}/kWh DISCOM tariff
              </span>
            </div>
          </div>

          {/* Key Day Statistics */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase block">Peak Power</span>
              <span className="text-sm font-bold text-gray-900 num mt-0.5 block">{peakKw.toFixed(2)} kW</span>
              <span className="text-[9px] text-gray-500 block">{peakTime}</span>
            </div>
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase block">Active Sun</span>
              <span className="text-sm font-bold text-gray-900 num mt-0.5 block">{activeHours} hrs</span>
              <span className="text-[9px] text-gray-500 block">&gt; 50W generation</span>
            </div>
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase block">CO₂ Offset</span>
              <span className="text-sm font-bold text-emerald-700 num mt-0.5 block">{co2AvoidedKg} kg</span>
              <span className="text-[9px] text-emerald-600 block">Clean energy</span>
            </div>
          </div>

          {/* Tomorrow Solar Outlook Card */}
          <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <Sun className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">
                  Tomorrow's Solar Outlook
                </span>
                <p className="text-xs text-amber-800 font-medium">
                  Expected ~{tomorrowKwh} kWh yield ({formatINR(tomorrowKwh * tariffPerKwh)})
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-amber-600 shrink-0" />
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-3 pt-2">
            <button
              onClick={handleShare}
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center space-x-2 shadow-xs cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Share Daily Card</span>
            </button>
            <button
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

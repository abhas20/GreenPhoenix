import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Cell,
  CartesianGrid,
} from "recharts";
import { Scale, CheckCircle2, AlertTriangle } from "lucide-react";

interface DirGaugeChartProps {
  dirByLanguage: Record<string, number>;
  overallDir: number;
}

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English (Base)",
  es: "Spanish",
  hi: "Hindi",
  bn: "Bengali",
  ta: "Tamil",
  te: "Telugu",
  gu: "Gujarati",
  mr: "Marathi",
  pa: "Punjabi",
  ur: "Urdu",
  zh: "Mandarin",
  ht: "Haitian Creole",
  ar: "Arabic",
  ru: "Russian",
};

export const DirGaugeChart: React.FC<DirGaugeChartProps> = ({
  dirByLanguage,
  overallDir,
}) => {
  // Convert dict to chart array
  const data = Object.entries(dirByLanguage).map(([lang, ratio]) => ({
    lang,
    label: LANGUAGE_LABELS[lang] || lang.toUpperCase(),
    ratio: Number(ratio.toFixed(3)),
    isPass: ratio >= 0.8,
  }));

  // Sort: baseline en first, then lowest ratio to highest
  data.sort((a, b) => {
    if (a.lang === "en") return -1;
    if (b.lang === "en") return 1;
    return a.ratio - b.ratio;
  });

  const isCompliant = overallDir >= 0.8;

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col gap-4">
      {/* Title & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
              Disparate Impact Ratios (DIR) by Language
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Evaluated against the legal <strong>0.80 Four-Fifths (4/5ths)</strong> EEOC threshold
            relative to English baseline.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {isCompliant ? (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-1.5 font-mono">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>DIR {overallDir.toFixed(2)} • 100% Compliant</span>
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center gap-1.5 font-mono">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>DIR {overallDir.toFixed(2)} • Disparity Alert</span>
            </span>
          )}
        </div>
      </div>

      {/* Chart container */}
      <div className="h-64 sm:h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 15, right: 20, left: -10, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
            <XAxis
              dataKey="label"
              stroke="#94a3b8"
              fontSize={11}
              angle={-30}
              textAnchor="end"
              interval={0}
              height={45}
            />
            <YAxis
              domain={[0, 1.2]}
              ticks={[0, 0.4, 0.8, 1.0, 1.2]}
              stroke="#94a3b8"
              fontSize={11}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                borderColor: "#334155",
                borderRadius: "0.75rem",
                fontSize: "12px",
                color: "#ffffff",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
              }}
              labelStyle={{ color: "#ffffff", fontWeight: "bold", marginBottom: "4px" }}
              itemStyle={{ color: "#38bdf8", fontWeight: 600 }}
              formatter={(val: any) => [
                `${Number(val).toFixed(3)} ${Number(val) >= 0.8 ? "✓ (Pass)" : "✗ (Below 0.80)"}`,
                "Impact Ratio",
              ]}
            />
            {/* Legal 0.80 EEOC Threshold line */}
            <ReferenceLine
              y={0.8}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              strokeWidth={2}
              label={{
                value: "Legal 0.80 Benchmark",
                position: "insideTopRight",
                fill: "blue",
                fontSize: 10,
                fontWeight: "bold",
              }}
            />
            <ReferenceLine
              y={1.0}
              stroke="#64748b"
              strokeDasharray="2 2"
              strokeWidth={1}
            />
            <Bar dataKey="ratio" radius={[6, 6, 0, 0]}>
              {data.map((entry) => (
                <Cell
                  key={`cell-${entry.lang}`}
                  fill={
                    entry.lang === "en"
                      ? "#3b82f6" // blue for baseline
                      : entry.isPass
                      ? "#10b981" // emerald for passing
                      : "#f43f5e" // rose for disparity violation
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend & Explanations */}
      <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-blue-500 inline-block" />
            <span>English Baseline (1.00)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />
            <span>Passed (≥ 0.80)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" />
            <span>Statutory 0.80 Threshold</span>
          </span>
        </div>
        <span className="text-slate-400 font-mono">Formula: DIR = SelectionRate(Lang) / SelectionRate(Baseline)</span>
      </div>
    </div>
  );
};

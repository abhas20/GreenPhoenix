import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Globe2 } from "lucide-react";

interface LanguageParityChartProps {
  selectionRates: Record<string, number>;
}

const LANGUAGE_METADATA: Record<string, { label: string; native: string; group: "indian" | "global" }> = {
  en: { label: "English", native: "English", group: "global" },
  es: { label: "Spanish", native: "Español", group: "global" },
  hi: { label: "Hindi", native: "हिन्दी", group: "indian" },
  bn: { label: "Bengali", native: "বাংলা", group: "indian" },
  ta: { label: "Tamil", native: "தமிழ்", group: "indian" },
  te: { label: "Telugu", native: "తెలుగు", group: "indian" },
  gu: { label: "Gujarati", native: "ગુજરાતી", group: "indian" },
  mr: { label: "Marathi", native: "मराठी", group: "indian" },
  pa: { label: "Punjabi", native: "ਪੰਜਾਬੀ", group: "indian" },
  ur: { label: "Urdu", native: "اردو", group: "indian" },
  zh: { label: "Mandarin", native: "中文", group: "global" },
  ht: { label: "Haitian Creole", native: "Kreyòl", group: "global" },
  ar: { label: "Arabic", native: "العربية", group: "global" },
  ru: { label: "Russian", native: "Русский", group: "global" },
};

export const LanguageParityChart: React.FC<LanguageParityChartProps> = ({
  selectionRates,
}) => {
  const chartData = Object.entries(selectionRates).map(([lang, rate]) => {
    const meta = LANGUAGE_METADATA[lang] || {
      label: lang.toUpperCase(),
      native: lang,
      group: "global",
    };
    return {
      lang,
      label: meta.label,
      native: meta.native,
      rate: Number(rate.toFixed(2)),
      group: meta.group,
    };
  });

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
              Average Benefit Matches Per Scenario by Language
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Demonstrates algorithmic equivalence: non-English speakers receive identical statutory aid entitlements.
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 sm:h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 15, right: 20, left: -10, bottom: 25 }}
          >
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
            <YAxis stroke="#94a3b8" fontSize={11} />
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
              itemStyle={{ color: "#34d399", fontWeight: 600 }}
              formatter={(val: any, _name: any, item: any) => [
                `${Number(val).toFixed(2)} programs (${item.payload.native})`,
                "Avg. Matched Programs",
              ]}
            />
            <Bar dataKey="rate" fill="#10b981" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary caption */}
      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
        <span>High selection parity verifies translation pipeline accuracy and vector recall.</span>
        <span className="font-mono text-emerald-400">Target: High Cross-Lingual Parity</span>
      </div>
    </div>
  );
};

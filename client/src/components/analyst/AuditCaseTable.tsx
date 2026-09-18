import React, { useState } from "react";
import { Search, Shield, Filter, CheckCircle2 } from "lucide-react";
import type { AuditCase } from "../../types/audit";

interface AuditCaseTableProps {
  cases: AuditCase[];
}

export const AuditCaseTable: React.FC<AuditCaseTableProps> = ({ cases }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLang, setSelectedLang] = useState("All");

  const languages = Array.from(new Set(cases.map((c) => c.language))).sort();

  const filteredCases = cases.filter((c) => {
    const matchesSearch =
      c.scenario_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.test_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.matched_program_ids.some((id) =>
        id.toLowerCase().includes(searchTerm.toLowerCase())
      );

    const matchesLang =
      selectedLang === "All" || c.language.toLowerCase() === selectedLang.toLowerCase();

    return matchesSearch && matchesLang;
  });

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
              Synthetic Audit Scenario Explorer (Zero-PII)
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Cedar Policy #4 strictly prohibits applicant PII. All data records below represent
            standardized synthetic test cohorts.
          </p>
        </div>

        <span className="text-xs font-mono text-purple-300 bg-purple-500/10 border border-purple-500/30 px-2.5 py-1 rounded-full self-start sm:self-auto">
          {cases.length} Synthetic Replays
        </span>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search scenarios by name, ID, or matched program..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={selectedLang}
            onChange={(e) => setSelectedLang(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-purple-500"
          >
            <option value="All">All Languages ({languages.length})</option>
            {languages.map((l) => (
              <option key={l} value={l}>
                {l.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table container */}
      <div className="overflow-x-auto custom-scroll max-h-96 border border-slate-800/80 rounded-2xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 text-slate-400 uppercase text-[10px] font-semibold tracking-wider">
            <tr>
              <th className="py-3 px-4">Test ID</th>
              <th className="py-3 px-4">Scenario Archetype</th>
              <th className="py-3 px-4">Language</th>
              <th className="py-3 px-4">Mode</th>
              <th className="py-3 px-4">Matches</th>
              <th className="py-3 px-4">Matched Program IDs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50 text-slate-200">
            {filteredCases.map((c) => (
              <tr key={c.test_id} className="hover:bg-slate-850/50 transition-colors">
                <td className="py-3 px-4 font-mono text-[11px] text-purple-300 whitespace-nowrap">
                  {c.test_id}
                </td>
                <td className="py-3 px-4 font-semibold text-white max-w-xs truncate">
                  {c.scenario_name}
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                    {c.language.toUpperCase()}
                  </span>
                </td>
                <td className="py-3 px-4 text-slate-400 capitalize text-[11px]">
                  {c.execution_mode || "deterministic"}
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <span className="px-2 py-0.5 rounded-full font-mono text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    {c.match_count} aid programs
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1 max-w-md">
                    {c.matched_program_ids.map((id) => (
                      <span
                        key={id}
                        className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-950 text-slate-400 border border-slate-800"
                      >
                        {id}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
        <span>
          Showing <strong>{filteredCases.length}</strong> of <strong>{cases.length}</strong> synthetic replays
        </span>
        <span className="text-emerald-400 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>No PII Contained</span>
        </span>
      </div>
    </div>
  );
};

import React, { useState } from "react";
import {
  Search,
  RefreshCw,
  Eye,
  FileDown,
  FileText,
  Shield,
  Building2,
  Calendar,
  FolderOpen,
  DollarSign,
  Home,
  UserPlus,
} from "lucide-react";
import type { CaseDossier } from "../../types/caseworker";

interface CaseQueueTableProps {
  cases: CaseDossier[];
  isLoading: boolean;
  orgId: string;
  onRefresh: () => void;
  onOpenCreateModal: () => void;
  onSelectCase: (caseId: string) => void;
  onRevealPii: (caseId: string) => void;
  onExportCase: (caseId: string) => void;
}

export const CaseQueueTable: React.FC<CaseQueueTableProps> = ({
  cases,
  isLoading,
  orgId,
  onRefresh,
  onOpenCreateModal,
  onSelectCase,
  onRevealPii,
  onExportCase,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBorough, setSelectedBorough] = useState("All");

  const filteredCases = cases.filter((c) => {
    const matchesSearch =
      c.case_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.client_name_masked.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.sanitized_summary &&
        c.sanitized_summary.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.profile?.primary_needs &&
        c.profile.primary_needs.some((n) =>
          n.toLowerCase().includes(searchTerm.toLowerCase())
        ));

    const matchesBorough =
      selectedBorough === "All" ||
      (c.profile?.borough &&
        c.profile.borough.toLowerCase() === selectedBorough.toLowerCase());

    return matchesSearch && matchesBorough;
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden flex flex-col">
      {/* Table Toolbar */}
      <div className="p-4 sm:p-6 border-b border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-950/40">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search dossiers by Case ID, token, or needs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Borough Filter */}
          <select
            value={selectedBorough}
            onChange={(e) => setSelectedBorough(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="All">All Boroughs</option>
            <option value="Bronx">Bronx</option>
            <option value="Brooklyn">Brooklyn</option>
            <option value="Manhattan">Manhattan</option>
            <option value="Queens">Queens</option>
            <option value="Staten Island">Staten Island</option>
          </select>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh Dossier Table"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-blue-400" : ""}`} />
          </button>

          <button
            type="button"
            onClick={onOpenCreateModal}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Intake Client Case</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto custom-scroll flex-1 min-h-[350px]">
        {isLoading && cases.length === 0 ? (
          <div className="py-20 text-center text-xs text-slate-400">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
            <span>Querying Redis dossier cache scoped to agency "{orgId}"...</span>
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="py-16 px-4 text-center max-w-md mx-auto space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 text-slate-400 mx-auto flex items-center justify-center">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">No Client Dossiers Found</h4>
              <p className="text-xs text-slate-400 mt-1">
                {searchTerm || selectedBorough !== "All"
                  ? "No cases match your active filters. Try clearing search keywords."
                  : `There are currently no active cases recorded under organization scope "${orgId}".`}
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenCreateModal}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white inline-flex items-center gap-2 cursor-pointer transition-all"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Intake First Case for {orgId}</span>
            </button>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Case ID</th>
                <th className="py-3.5 px-4">Redacted Client Token</th>
                <th className="py-3.5 px-4">Jurisdiction & Financials</th>
                <th className="py-3.5 px-4">Identified Needs</th>
                <th className="py-3.5 px-4">Intake Date</th>
                <th className="py-3.5 px-4 text-right">Governed Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {filteredCases.map((c) => (
                <tr
                  key={c.case_id}
                  onClick={() => onSelectCase(c.case_id)}
                  className="hover:bg-slate-800/60 transition-colors group cursor-pointer"
                >
                  {/* Case ID & Org */}
                  <td className="py-3.5 px-4">
                    <div className="font-mono font-bold text-blue-300 hover:underline">{c.case_id}</div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3 h-3" />
                      <span>{c.org_id}</span>
                    </div>
                  </td>

                  {/* Masked Client Identifier */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">
                        {c.client_name_masked || "<PERSON_1>"}
                      </span>
                      <span
                        className="inline-flex items-center text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded"
                        title="Presidio PII Vault Token"
                      >
                        <Shield className="w-2.5 h-2.5 mr-0.5" />
                        Sanitized
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 line-clamp-1 max-w-xs mt-0.5">
                      {c.sanitized_summary || c.profile?.summary || "Intake record"}
                    </div>
                  </td>

                  {/* Jurisdiction & Financials */}
                  <td className="py-3.5 px-4">
                    <div className="font-medium text-slate-100">
                      {c.profile?.borough || "NYC"}
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-0.5">
                        <DollarSign className="w-3 h-3" />
                        ${c.profile?.annual_income?.toLocaleString() || 0}/yr
                      </span>
                      {c.profile?.monthly_rent && (
                        <span className="flex items-center gap-0.5">
                          <Home className="w-3 h-3" />
                          ${c.profile.monthly_rent}/mo
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Needs chips */}
                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {c.profile?.primary_needs && c.profile.primary_needs.length > 0 ? (
                        c.profile.primary_needs.slice(0, 2).map((n) => (
                          <span
                            key={n}
                            className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 border border-slate-700/80 truncate max-w-[130px]"
                          >
                            {n}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">General Intake</span>
                      )}
                      {c.profile?.primary_needs && c.profile.primary_needs.length > 2 && (
                        <span className="text-[10px] text-slate-400 self-center">
                          +{c.profile.primary_needs.length - 2} more
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Timestamp */}
                  <td className="py-3.5 px-4 text-[11px] text-slate-400 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 pl-5">
                      {new Date(c.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </td>

                  {/* Governed Actions */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCase(c.case_id);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="View Complete Case Dossier"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRevealPii(c.case_id);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Audited PII Rehydration"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Reveal PII</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onExportCase(c.case_id);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Export Consolidated Agency Packet"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        <span>Export</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Table Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span>
            Displaying <strong className="text-white">{filteredCases.length}</strong> of{" "}
            <strong className="text-white">{cases.length}</strong> active dossiers
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-blue-400 font-mono">Scoped: {orgId}</span>
          <span>•</span>
          <span className="text-emerald-400">Presidio Sanitized</span>
        </div>
      </div>
    </div>
  );
};

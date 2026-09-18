import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Calculator, FileText, Loader2, Sparkles } from "lucide-react";
import type { ProgramDocument } from "../types/program";
import { programService } from "../services/programService";
import { EligibilityTesterModal } from "../components/programs/EligibilityTesterModal";
import { ProgramDetailModal } from "../components/programs/ProgramDetailModal";

import fallbackProgramsData from "../data/fallbackPrograms.json";

const FALLBACK_PROGRAMS: ProgramDocument[] = fallbackProgramsData as ProgramDocument[];

const CATEGORIES = ["All", "housing", "food", "financial", "utilities", "childcare", "health"];

export const ProgramCatalogView: React.FC<{ initialProgramId?: string }> = ({
  initialProgramId,
}) => {
  const [searchParams] = useSearchParams();
  const effectiveProgramId = searchParams.get("id") || initialProgramId;
  const [query, setQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [programs, setPrograms] = useState<ProgramDocument[]>(FALLBACK_PROGRAMS);
  const [loading, setLoading] = useState<boolean>(false);

  const [selectedForTest, setSelectedForTest] = useState<ProgramDocument | null>(null);
  const [selectedForDetail, setSelectedForDetail] = useState<ProgramDocument | null>(null);

  // Initial fetch on mount: try live OpenSearch API first, fallback to JSON
  useEffect(() => {
    programService
      .searchPrograms("assistance", 20)
      .then((results) => {
        if (results && results.length > 0) {
          setPrograms(results);
        }
      })
      .catch(() => {
        // Fallback to FALLBACK_PROGRAMS remains active
      });
  }, []);

  // Auto-open if effectiveProgramId is provided
  useEffect(() => {
    if (effectiveProgramId) {
      const match = programs.find((p) => p.program_id === effectiveProgramId);
      if (match) setSelectedForTest(match);
    }
  }, [effectiveProgramId, programs]);

  // Search logic
  const handleSearch = async (searchTerm: string) => {
    setQuery(searchTerm);
    if (!searchTerm.trim()) {
      setPrograms(FALLBACK_PROGRAMS);
      return;
    }

    setLoading(true);
    try {
      const results = await programService.searchPrograms(searchTerm, 15);
      if (results && results.length > 0) {
        setPrograms(results);
      } else {
        // Filter local fallback
        const filtered = FALLBACK_PROGRAMS.filter(
          (p) =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.category.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setPrograms(filtered);
      }
    } catch {
      // Offline fallback
      const filtered = FALLBACK_PROGRAMS.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setPrograms(filtered);
    } finally {
      setLoading(false);
    }
  };

  const filteredPrograms = programs.filter((p) => {
    if (selectedCategory === "All") return true;
    return p.category.toLowerCase() === selectedCategory.toLowerCase();
  });

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
          <Sparkles className="w-4 h-4" /> OpenSearch Hybrid Retrieval & Deterministic Rules
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Public Aid Programs Catalog
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">
          Search over 50+ official NYC and New York State safety net programs. Every benefit includes statutory criteria evaluated deterministically without LLM hallucination.
        </p>
      </div>

      {/* Search Bar & Category Filters */}
      <div className="space-y-4 mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search aid by keyword (e.g. 'eviction rent grant', 'food groceries', 'disability freeze')..."
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-inner"
          />
          {loading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                selectedCategory === cat
                  ? "bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20"
                  : "bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Program Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredPrograms.map((prog) => (
          <div
            key={prog.program_id}
            className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 flex flex-col justify-between transition-all hover:shadow-xl group"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                  {prog.category}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {prog.region.toUpperCase()}
                </span>
              </div>

              <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                {prog.name}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 mb-3">{prog.organization}</p>

              <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed mb-4">
                {prog.description}
              </p>

              {prog.income_threshold && (
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-300 mb-4 line-clamp-2">
                  <span className="font-semibold text-amber-400">Income Limit: </span>
                  {prog.income_threshold}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setSelectedForDetail(prog)}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-750 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Details</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedForTest(prog)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:from-emerald-400 hover:to-teal-400 transition-all cursor-pointer shadow-sm shadow-emerald-500/20 flex items-center gap-1.5"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Check Eligibility</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredPrograms.length === 0 && (
        <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-slate-800 text-slate-400">
          <p className="text-base font-semibold text-slate-300">No aid programs found</p>
          <p className="text-xs mt-1">Try clearing your search query or selecting another category.</p>
        </div>
      )}

      {/* Modals */}
      <EligibilityTesterModal
        program={selectedForTest}
        onClose={() => setSelectedForTest(null)}
      />

      <ProgramDetailModal
        program={selectedForDetail}
        onClose={() => setSelectedForDetail(null)}
        onOpenTester={() => {
          if (selectedForDetail) setSelectedForTest(selectedForDetail);
        }}
      />
    </div>
  );
};

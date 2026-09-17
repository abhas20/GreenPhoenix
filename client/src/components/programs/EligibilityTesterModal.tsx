import React, { useState } from "react";
import { X, CheckCircle2, XCircle, Calculator, Loader2 } from "lucide-react";
import type { ProgramDocument, EligibilityCheckResponse } from "../../types/program";
import { programService } from "../../services/programService";

interface EligibilityTesterModalProps {
  program: ProgramDocument | null;
  onClose: () => void;
}

export const EligibilityTesterModal: React.FC<EligibilityTesterModalProps> = ({
  program,
  onClose,
}) => {
  const [income, setIncome] = useState<number | "">(32000);
  const [householdSize, setHouseholdSize] = useState<number | "">(3);
  const [age, setAge] = useState<number | "">(35);
  const [borough, setBorough] = useState<string>("brooklyn");
  const [rent, setRent] = useState<number | "">(1400);
  const [hasDisability, setHasDisability] = useState<boolean>(false);
  const [hasChildren, setHasChildren] = useState<boolean>(true);
  const [isHomeowner, setIsHomeowner] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<EligibilityCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!program) return null;

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await programService.checkEligibility(program.program_id, {
        annual_income: income === "" ? undefined : Number(income),
        household_size: householdSize === "" ? undefined : Number(householdSize),
        age: age === "" ? undefined : Number(age),
        region: borough,
        monthly_rent: rent === "" ? undefined : Number(rent),
        has_disability_benefits: hasDisability,
        has_children: hasChildren,
        is_homeowner: isHomeowner,
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Failed to evaluate eligibility");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl p-6 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <Calculator className="w-4 h-4" />
              <span>Deterministic Rule Evaluator</span>
            </div>
            <h3 className="text-xl font-bold text-white mt-1">{program.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{program.organization}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-5">
          <form onSubmit={handleEvaluate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Annual Household Income ($)
                </label>
                <input
                  type="number"
                  value={income}
                  onChange={(e) => setIncome(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
                  placeholder="e.g. 28000"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Household Size
                </label>
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={householdSize}
                  onChange={(e) => setHouseholdSize(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Primary Age
                </label>
                <input
                  type="number"
                  min="16"
                  max="110"
                  value={age}
                  onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Borough / Region
                </label>
                <select
                  value={borough}
                  onChange={(e) => setBorough(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="brooklyn">Brooklyn</option>
                  <option value="bronx">Bronx</option>
                  <option value="manhattan">Manhattan</option>
                  <option value="queens">Queens</option>
                  <option value="staten_island">Staten Island</option>
                  <option value="nyc">Other NYC</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Monthly Rent ($)
                </label>
                <input
                  type="number"
                  value={rent}
                  onChange={(e) => setRent(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
                  placeholder="e.g. 1500"
                />
              </div>
            </div>

            {/* Checkboxes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={hasDisability}
                  onChange={(e) => setHasDisability(e.target.checked)}
                  className="rounded text-emerald-500 focus:ring-0"
                />
                <span className="text-slate-300">Receives Disability (SSI/SSDI)</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={hasChildren}
                  onChange={(e) => setHasChildren(e.target.checked)}
                  className="rounded text-emerald-500 focus:ring-0"
                />
                <span className="text-slate-300">Has Children Under 5</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={isHomeowner}
                  onChange={(e) => setIsHomeowner(e.target.checked)}
                  className="rounded text-emerald-500 focus:ring-0"
                />
                <span className="text-slate-300">Owns Home (Primary)</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:from-emerald-400 hover:to-teal-400 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Evaluating Rules...
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4" /> Run Deterministic Eligibility Check
                </>
              )}
            </button>
          </form>

          {/* Results Box */}
          {result && (
            <div
              className={`p-4 rounded-2xl border transition-all animate-fade-in ${
                result.is_eligible
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-base mb-2">
                {result.is_eligible ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>Eligible under Deterministic Statutory Rules</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-rose-400" />
                    <span>Not Currently Eligible for this Benefit</span>
                  </>
                )}
              </div>

              {result.passed_criteria.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-emerald-400 mb-1">
                    Criteria Satisfied:
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-xs text-slate-300">
                    {result.passed_criteria.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.failing_criteria.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-rose-400 mb-1">
                    Eligibility Blockers:
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-xs text-slate-300">
                    {result.failing_criteria.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

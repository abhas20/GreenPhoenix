import React, { useEffect, useState } from "react";
import {
  X,
  CheckCircle2,
  XCircle,
  Calculator,
  Loader2,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import type { ProgramDocument, EligibilityCheckResponse } from "../../types/program";
import { programService } from "../../services/programService";
import { useLanguage } from "../../context/LanguageContext";

interface EligibilityTesterModalProps {
  program: ProgramDocument | null;
  onClose: () => void;
}

export const EligibilityTesterModal: React.FC<EligibilityTesterModalProps> = ({
  program,
  onClose,
}) => {
  const { t } = useLanguage();

  const getJurisdictionInfo = (prog: ProgramDocument | null) => {
    if (!prog) return { isIndia: false, isUK: false, isCanada: false, isUS: true, currency: "$", defaultRegion: "brooklyn", defaultIncome: 24000 };
    const r = (prog.region || "").toLowerCase();
    const pid = (prog.program_id || "").toLowerCase();

    if (r === "india" || pid.startsWith("in-")) {
      return { isIndia: true, isUK: false, isCanada: false, isUS: false, currency: "₹", defaultRegion: "india", defaultIncome: 50000 };
    }
    if (r === "uk" || pid.startsWith("uk-")) {
      return { isIndia: false, isUK: true, isCanada: false, isUS: false, currency: "£", defaultRegion: "uk", defaultIncome: 15000 };
    }
    if (r === "canada" || pid.startsWith("ca-")) {
      return { isIndia: false, isUK: false, isCanada: true, isUS: false, currency: "CA$", defaultRegion: "canada", defaultIncome: 35000 };
    }
    return { isIndia: false, isUK: false, isCanada: false, isUS: true, currency: "$", defaultRegion: "brooklyn", defaultIncome: 24000 };
  };

  const jurisdiction = getJurisdictionInfo(program);

  const [income, setIncome] = useState<number | "">(jurisdiction.defaultIncome);
  const [householdSize, setHouseholdSize] = useState<number | "">(3);
  const [age, setAge] = useState<number | "">(35);
  const [region, setRegion] = useState<string>(jurisdiction.defaultRegion);
  const [customRegion, setCustomRegion] = useState<string>("");
  const [rent, setRent] = useState<number | "">(jurisdiction.isIndia ? 0 : 1200);
  const [hasDisability, setHasDisability] = useState<boolean>(false);
  const [hasChildren, setHasChildren] = useState<boolean>(true);
  const [isHomeowner, setIsHomeowner] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<EligibilityCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Re-initialize state when switching programs
  useEffect(() => {
    if (program) {
      const j = getJurisdictionInfo(program);
      setIncome(j.defaultIncome);
      setRegion(j.defaultRegion);
      setCustomRegion("");
      setRent(j.isIndia ? 0 : 1200);
      setResult(null);
      setError(null);
    }
  }, [program?.program_id]);

  if (!program) return null;

  const handleClose = () => {
    setResult(null);
    setError(null);
    onClose();
  };

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const effectiveRegion = region === "custom" ? (customRegion.trim() || undefined) : region;
      const res = await programService.checkEligibility(program.program_id, {
        annual_income: income === "" ? undefined : Number(income),
        household_size: householdSize === "" ? undefined : Number(householdSize),
        age: age === "" ? undefined : Number(age),
        region: effectiveRegion,
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

  // Harmonize results regardless of backend attribute keys
  const isEligible: boolean | null | undefined =
    result?.is_eligible !== undefined ? result.is_eligible : (result as any)?.eligible;
  const passedCriteria: string[] =
    result?.passed_criteria || (result as any)?.passed_checks || [];
  const failingCriteria: string[] =
    result?.failing_criteria || (result as any)?.failing_reasons || [];
  const unverifiableChecks: string[] =
    result?.unverifiable_checks || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl p-6 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <Calculator className="w-4 h-4" />
              <span>{t("Deterministic Statutory Rule Evaluator")}</span>
            </div>
            <h3 className="text-xl font-bold text-white mt-1">{t(program.name)}</h3>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
              <span>{t(program.organization)}</span>
              <span>•</span>
              <span className="font-mono text-teal-400 uppercase">
                {program.region?.toUpperCase() || "GLOBAL"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
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
                  {t("Annual Household Income")} ({jurisdiction.currency})
                </label>
                <input
                  type="number"
                  value={income}
                  onChange={(e) => setIncome(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  placeholder={jurisdiction.isIndia ? "e.g. 50000" : "e.g. 24000"}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t("Household Size")}
                </label>
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={householdSize}
                  onChange={(e) => setHouseholdSize(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t("Primary Applicant Age")}
                </label>
                <input
                  type="number"
                  min="16"
                  max="110"
                  value={age}
                  onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t("Applicant Region / State")}
                </label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <optgroup label={t("India (National & States)")}>
                    <option value="india">🇮🇳 {t("All India (National / Central)")}</option>
                    <option value="maharashtra">{t("Maharashtra (Mumbai, Pune)")}</option>
                    <option value="delhi">{t("Delhi NCR")}</option>
                    <option value="karnataka">{t("Karnataka (Bengaluru)")}</option>
                    <option value="tamil_nadu">{t("Tamil Nadu (Chennai)")}</option>
                    <option value="uttar_pradesh">{t("Uttar Pradesh")}</option>
                    <option value="west_bengal">{t("West Bengal (Kolkata)")}</option>
                    <option value="gujarat">{t("Gujarat (Ahmedabad)")}</option>
                    <option value="telangana">{t("Telangana (Hyderabad)")}</option>
                  </optgroup>
                  <optgroup label={t("United States & NYC")}>
                    <option value="brooklyn">🇺🇸 {t("Brooklyn, NY")}</option>
                    <option value="bronx">{t("Bronx, NY")}</option>
                    <option value="manhattan">{t("Manhattan, NY")}</option>
                    <option value="queens">{t("Queens, NY")}</option>
                    <option value="staten_island">{t("Staten Island, NY")}</option>
                    <option value="nyc">{t("New York City (General)")}</option>
                    <option value="ny_state">{t("New York State")}</option>
                    <option value="us">{t("Other US State")}</option>
                  </optgroup>
                  <optgroup label={t("United Kingdom")}>
                    <option value="uk">🇬🇧 {t("United Kingdom (National)")}</option>
                    <option value="england">{t("England")}</option>
                    <option value="scotland">{t("Scotland")}</option>
                    <option value="wales">{t("Wales")}</option>
                  </optgroup>
                  <optgroup label={t("Canada")}>
                    <option value="canada">🇨🇦 {t("Canada (National)")}</option>
                    <option value="ontario">{t("Ontario")}</option>
                    <option value="quebec">{t("Quebec")}</option>
                    <option value="british_columbia">{t("British Columbia")}</option>
                  </optgroup>
                  <optgroup label={t("Other / Custom")}>
                    <option value="custom">✏️ {t("Write-in Custom Location...")}</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t("Monthly Rent")} ({jurisdiction.currency})
                </label>
                <input
                  type="number"
                  value={rent}
                  onChange={(e) => setRent(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  placeholder={jurisdiction.isIndia ? "e.g. 0" : "e.g. 1400"}
                />
              </div>
            </div>

            {/* Custom Location Write-in if selected */}
            {region === "custom" && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 animate-fade-in">
                <label className="block text-xs font-semibold text-slate-300">
                  {t("Enter Your City, District, or State")}
                </label>
                <input
                  type="text"
                  value={customRegion}
                  onChange={(e) => setCustomRegion(e.target.value)}
                  placeholder="e.g. Pune, Maharashtra or Austin, TX"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
            )}

            {/* Checkboxes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={hasDisability}
                  onChange={(e) => setHasDisability(e.target.checked)}
                  className="rounded text-emerald-500 focus:ring-0"
                />
                <span className="text-slate-300">{t("Receives Disability Benefits (SSI/UDID)")}</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={hasChildren}
                  onChange={(e) => setHasChildren(e.target.checked)}
                  className="rounded text-emerald-500 focus:ring-0"
                />
                <span className="text-slate-300">{t("Has Children Under 5")}</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={isHomeowner}
                  onChange={(e) => setIsHomeowner(e.target.checked)}
                  className="rounded text-emerald-500 focus:ring-0"
                />
                <span className="text-slate-300">{t("Owns Permanent Home (Pucca House)")}</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:from-emerald-400 hover:to-teal-400 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> {t("Evaluating Statutory Rules...")}
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4" /> {t("Run Deterministic Eligibility Check")}
                </>
              )}
            </button>
          </form>

          {/* Results Box */}
          {result && (
            <div
              className={`p-4 rounded-2xl border transition-all animate-fade-in ${
                isEligible === true
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : isEligible === false
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-300"
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-base mb-2">
                {isEligible === true ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span>{t("Eligible under Deterministic Statutory Rules")}</span>
                  </>
                ) : isEligible === false ? (
                  <>
                    <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    <span>{t("Not Currently Eligible for this Benefit")}</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                    <span>{t("Additional Verification Details Required")}</span>
                  </>
                )}
              </div>

              {passedCriteria.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-emerald-400 mb-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{t("Criteria Satisfied:")}</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-xs text-slate-300">
                    {passedCriteria.map((c, i) => (
                      <li key={i}>{t(c)}</li>
                    ))}
                  </ul>
                </div>
              )}

              {failingCriteria.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-rose-400 mb-1 flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{t("Statutory Blockers:")}</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-xs text-slate-300">
                    {failingCriteria.map((c, i) => (
                      <li key={i}>{t(c)}</li>
                    ))}
                  </ul>
                </div>
              )}

              {unverifiableChecks.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-amber-400 mb-1 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>{t("Unverifiable / Missing Information:")}</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-xs text-slate-300">
                    {unverifiableChecks.map((c, i) => (
                      <li key={i}>{t(c)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {t(error)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

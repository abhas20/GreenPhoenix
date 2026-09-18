import React, { useState } from "react";
import {
  X,
  UserPlus,
  ShieldCheck,
  Building2,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Home,
  Phone,
  User,
} from "lucide-react";
import { caseworkerService } from "../../services/caseworkerService";
import type { CaseDossier, CreateCaseRequest } from "../../types/caseworker";

interface CreateCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  onCaseCreated: (newCase: CaseDossier) => void;
}

const BOROUGHS = ["Bronx", "Brooklyn", "Manhattan", "Queens", "Staten Island"];
const NEED_OPTIONS = [
  "SNAP Food Assistance",
  "Cash Assistance (Safety Net)",
  "One Shot Deal (Rental Arrears)",
  "CityFHEPS Rental Supplement",
  "Emergency Family Shelter",
  "HEAP Energy Subsidy",
  "Medicaid Health Coverage",
  "SCRIE Senior Rent Exemption",
];

export const CreateCaseModal: React.FC<CreateCaseModalProps> = ({
  isOpen,
  onClose,
  orgId,
  onCaseCreated,
}) => {
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [borough, setBorough] = useState("Brooklyn");
  const [annualIncome, setAnnualIncome] = useState<number | "">(18500);
  const [monthlyRent, setMonthlyRent] = useState<number | "">(1400);
  const [hasDisability, setHasDisability] = useState<boolean>(false);
  const [selectedNeeds, setSelectedNeeds] = useState<string[]>([
    "One Shot Deal (Rental Arrears)",
    "SNAP Food Assistance",
  ]);
  const [summary, setSummary] = useState(
    "Client received an eviction notice from landlord with 14-day cure deadline. Currently caring for 2 minor dependents."
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleNeed = (need: string) => {
    if (selectedNeeds.includes(need)) {
      setSelectedNeeds(selectedNeeds.filter((n) => n !== need));
    } else {
      setSelectedNeeds([...selectedNeeds, need]);
    }
  };

  // Simulated live Presidio redaction
  const getSimulatedRedaction = () => {
    let text = summary;
    if (clientName.trim()) {
      const parts = clientName.trim().split(/\s+/);
      parts.forEach((p) => {
        if (p.length > 2) {
          const regex = new RegExp(`\\b${p}\\b`, "gi");
          text = text.replace(regex, "<PERSON_1>");
        }
      });
    }
    if (clientPhone.trim()) {
      text = text.replace(/(\+?\d[\d\s\-()]{7,}\d)/g, "<PHONE_1>");
    }
    return text;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!clientName.trim()) {
      setErrorMsg("Client real name is required.");
      return;
    }
    if (!summary.trim()) {
      setErrorMsg("Intake case summary narrative is required.");
      return;
    }

    const payload: CreateCaseRequest = {
      client_name: clientName.trim(),
      client_phone: clientPhone.trim() || undefined,
      borough,
      annual_income: Number(annualIncome) || 0,
      monthly_rent: monthlyRent !== "" ? Number(monthlyRent) : undefined,
      has_disability_benefits: hasDisability,
      primary_needs: selectedNeeds,
      summary: summary.trim(),
    };

    setIsSubmitting(true);
    try {
      const created = await caseworkerService.createCase(payload);
      onCaseCreated(created);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to intake case under current agency credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Intake New Client Dossier
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-400">AWS Cedar Org Scope:</span>
                <span className="text-[11px] font-mono font-bold text-blue-300 bg-blue-500/15 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {orgId}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scroll">
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-200">
                <strong>Intake Error:</strong> {errorMsg}
              </div>
            </div>
          )}

          {/* Client Identity (Presidio Handled) */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200 uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Client Identification (Presidio Protected)</span>
              </div>
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-mono">
                Auto-Redacted to &lt;PERSON_1&gt;
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Client Real Full Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maria Elena Gomez"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Client Contact Phone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    placeholder="e.g. +1 718-555-0192"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Household & Demographics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                NYC Borough *
              </label>
              <select
                value={borough}
                onChange={(e) => setBorough(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {BOROUGHS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Annual Household Income ($)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={annualIncome}
                  onChange={(e) =>
                    setAnnualIncome(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Monthly Rent ($)
              </label>
              <div className="relative">
                <Home className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={monthlyRent}
                  onChange={(e) =>
                    setMonthlyRent(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Disability toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
            <div>
              <span className="text-xs font-semibold text-slate-200">
                Disability / SSI Status
              </span>
              <p className="text-[11px] text-slate-400">
                Does the applicant or a dependent receive SSI/SSDI or disability benefits?
              </p>
            </div>
            <button
              type="button"
              onClick={() => setHasDisability(!hasDisability)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                hasDisability
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {hasDisability ? "Yes (Active)" : "No"}
            </button>
          </div>

          {/* Primary Needs Multi-Select */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Primary Identified Aid Needs:
            </label>
            <div className="flex flex-wrap gap-2">
              {NEED_OPTIONS.map((need) => {
                const isSelected = selectedNeeds.includes(need);
                return (
                  <button
                    key={need}
                    type="button"
                    onClick={() => toggleNeed(need)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
                      isSelected
                        ? "bg-blue-500/20 text-blue-300 border-blue-500/50 shadow-sm"
                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
                    }`}
                  >
                    {need}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Intake Narrative */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Case Narrative & Intake Assessment *
            </label>
            <textarea
              rows={3}
              required
              placeholder="Describe emergency situation, family composition, immediate eviction risk, notice dates, etc."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all custom-scroll"
            />
          </div>

          {/* Live Presidio Redaction Interactive Preview */}
          <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Live Presidio Redaction Simulation
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Storage: DynamoDB + Redis
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Before the record is written to Redis, real names and contact numbers are stripped.
              Only surrogate tokens appear in regular queries:
            </p>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 font-mono text-xs text-slate-300">
              {clientName.trim() || clientPhone.trim() ? (
                <>
                  <span className="text-emerald-400">
                    &lt;PERSON_1&gt;
                  </span>{" "}
                  {clientPhone.trim() && (
                    <span className="text-cyan-400">(&lt;PHONE_1&gt;)</span>
                  )}
                  : {getSimulatedRedaction()}
                </>
              ) : (
                <span className="text-slate-400 italic">
                  Enter applicant details above to preview real-time token redaction...
                </span>
              )}
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSubmitting ? "Creating Dossier..." : "Commit Intake Dossier"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

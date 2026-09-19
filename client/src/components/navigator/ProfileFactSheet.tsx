import React from "react";
import { UserCheck, HelpCircle } from "lucide-react";
import type { ApplicantProfile } from "../../types/chat";
import { useLanguage } from "../../context/LanguageContext";

export const ProfileFactSheet: React.FC<{ profile: ApplicantProfile }> = ({ profile }) => {
  const { t } = useLanguage();
  const hasMissing = profile.missing_critical_fields && profile.missing_critical_fields.length > 0;

  return (
    <div className="space-y-4">
      {/* Missing critical prompt banner */}
      {hasMissing && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-xs">
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <span>{t("Additional Clarification Needed for Precise Matching")}</span>
          </div>
          <p className="text-xs text-slate-300">
            {profile.clarification_question ||
              `Please tell the navigator your ${(profile.missing_critical_fields || []).join(" and ")} so we can verify exact eligibility limits.`}
          </p>
        </div>
      )}

      {/* Extracted Facts Grid */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <UserCheck className="w-4 h-4" />
            <span>{t("Extracted Household Profile")}</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            {profile.summary ? t(profile.summary) : t("In Progress")}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">{t("Location / Borough")}</div>
            <div className="font-bold text-slate-100 mt-0.5 capitalize">
              {profile.borough ? (
                t(profile.borough)
              ) : (
                <span className="text-amber-400 text-[11px] font-normal italic">{t("Needs clarification")}</span>
              )}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">{t("Annual Income")}</div>
            <div className="font-bold text-slate-100 mt-0.5">
              {profile.annual_income !== null && profile.annual_income !== undefined ? (
                `$${profile.annual_income.toLocaleString()}`
              ) : (
                <span className="text-amber-400 text-[11px] font-normal italic">{t("Needs clarification")}</span>
              )}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">{t("Household Size")}</div>
            <div className="font-bold text-slate-100 mt-0.5">
              {profile.household_size ? `${profile.household_size} ${t("members")}` : `1 (${t("Standard")})`}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">{t("Monthly Rent")}</div>
            <div className="font-bold text-slate-100 mt-0.5">
              {profile.monthly_rent ? `$${profile.monthly_rent.toLocaleString()}` : t("Not reported")}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">{t("Disability Status")}</div>
            <div className="font-bold text-slate-100 mt-0.5">
              {profile.has_disability_benefits ? (
                <span className="text-emerald-400">{t("Yes (SSI/SSDI)")}</span>
              ) : (
                t("None reported")
              )}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">{t("Language")}</div>
            <div className="font-bold text-slate-100 mt-0.5 font-mono uppercase">
              {profile.preferred_language || "EN"}
            </div>
          </div>
        </div>

        {/* Primary Needs Pills */}
        {profile.primary_needs && profile.primary_needs.length > 0 && (
          <div className="pt-2">
            <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1.5">
              {t("Identified Needs:")}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {profile.primary_needs.map((need, i) => (
                <span
                  key={i}
                  className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 capitalize"
                >
                  {t(need)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

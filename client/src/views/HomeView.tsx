import React from "react";
import { useNavigate } from "react-router-dom";
import { HeroSection } from "../components/landing/HeroSection";
import { BentoFeatures } from "../components/landing/BentoFeatures";
import { ProgramTicker } from "../components/landing/ProgramTicker";
import { RoleGateways } from "../components/landing/RoleGateways";
import { useAuth } from "../context/AuthContext";

export const HomeView: React.FC = () => {
  const navigate = useNavigate();
  const { role } = useAuth();

  // Under Cedar Policies #1 and #2, only PublicApplicant and Caseworker can search programs.
  const canSearchPrograms = role === "PublicApplicant" || role === "Caseworker";

  const handleStartCrisisFlow = () => {
    if (role === "Caseworker") {
      navigate("/caseworker");
    } else if (role === "Analyst") {
      navigate("/analyst");
    } else if (role === "Admin") {
      navigate("/admin");
    } else {
      navigate("/crisis");
    }
  };

  const handleExplorePrograms = () => {
    if (role === "Analyst") {
      navigate("/analyst");
    } else if (role === "Admin") {
      navigate("/admin");
    } else {
      navigate("/programs");
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <HeroSection
        onStartCrisisFlow={handleStartCrisisFlow}
        onExplorePrograms={handleExplorePrograms}
      />
      {canSearchPrograms && (
        <ProgramTicker
          onSelectProgram={(programId) => {
            navigate(`/programs?id=${encodeURIComponent(programId)}`);
          }}
        />
      )}
      <BentoFeatures onExplore={handleExplorePrograms} />
      <RoleGateways />
    </div>
  );
};

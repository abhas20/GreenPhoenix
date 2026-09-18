import React from "react";
import { useNavigate } from "react-router-dom";
import { HeroSection } from "../components/landing/HeroSection";
import { BentoFeatures } from "../components/landing/BentoFeatures";
import { ProgramTicker } from "../components/landing/ProgramTicker";
import { RoleGateways } from "../components/landing/RoleGateways";

export const HomeView: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col">
      <HeroSection
        onStartCrisisFlow={() => navigate("/crisis")}
        onExplorePrograms={() => navigate("/programs")}
      />
      <ProgramTicker
        onSelectProgram={(programId) => {
          navigate(`/programs?id=${encodeURIComponent(programId)}`);
        }}
      />
      <BentoFeatures onExplore={() => navigate("/programs")} />
      <RoleGateways />
    </div>
  );
};

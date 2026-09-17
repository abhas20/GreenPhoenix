import React from "react";
import { HeroSection } from "../components/landing/HeroSection";
import { BentoFeatures } from "../components/landing/BentoFeatures";
import { ProgramTicker } from "../components/landing/ProgramTicker";
import { RoleGateways } from "../components/landing/RoleGateways";

interface HomeViewProps {
  onNavigate: (view: string) => void;
  onSelectProgram?: (programId: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onNavigate, onSelectProgram }) => {
  return (
    <div className="flex-1 flex flex-col">
      <HeroSection
        onStartCrisisFlow={() => onNavigate("navigator")}
        onExplorePrograms={() => onNavigate("programs")}
      />
      <ProgramTicker
        onSelectProgram={(programId) => {
          if (onSelectProgram) onSelectProgram(programId);
          onNavigate("programs");
        }}
      />
      <BentoFeatures onExplore={() => onNavigate("programs")} />
      <RoleGateways onNavigate={onNavigate} />
    </div>
  );
};

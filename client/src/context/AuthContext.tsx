import React, { createContext, useContext, useState, useEffect } from "react";
import type { Role, UserResponse } from "../types/auth";
import { authService, type LoginPayload, type RegisterPayload } from "../services/authService";
import { api } from "../services/api";

export interface DemoPersona {
  key: string;
  label: string;
  role: Role;
  name: string;
  email: string;
  org_id?: string | null;
  description: string;
}

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    key: "applicant",
    label: "Public Citizen / Applicant",
    role: "PublicApplicant",
    name: "Maria Garcia (Citizen in Need)",
    email: "applicant@local.dev",
    description: "Crisis intake, real-time matching, document checklist, zero PII footprint",
  },
  {
    key: "cw_hra",
    label: "Caseworker — NYC HRA",
    role: "Caseworker",
    name: "Sarah Jenkins, LMSW",
    email: "sjenkins@hra.nyc.gov",
    org_id: "hra_nyc",
    description: "Manages agency dossiers, Cedar org-scoped to hra_nyc, audited PII reveal",
  },
  {
    key: "cw_cbo",
    label: "Caseworker — Queens CBO",
    role: "Caseworker",
    name: "Carlos Rivera",
    email: "crivera@queenscbo.org",
    org_id: "queens_cbo",
    description: "CBO advocate scoped to queens_cbo, isolated from HRA cases",
  },
  {
    key: "analyst",
    label: "Civil Rights / Policy Analyst",
    role: "Analyst",
    name: "Dr. Maya Patel",
    email: "mpatel@equitypolicy.org",
    description: "Monitors Disparate Impact Ratios (DIR), language equity, zero PII access",
  },
  {
    key: "admin",
    label: "System Administrator",
    role: "Admin",
    name: "Dev Operations Admin",
    email: "ops@greenphoenix.gov",
    description: "Infrastructure health, manual bias audit replay trigger, OpenSearch re-seeding",
  },
];

interface AuthContextType {
  user: UserResponse | null;
  role: Role;
  activePersonaKey: string;
  switchPersona: (personaKey: string) => Promise<void>;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [role, setRole] = useState<Role>("PublicApplicant");
  const [activePersonaKey, setActivePersonaKey] = useState<string>("applicant");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Helper to ensure demo account exists in backend & logs in
  const switchPersona = async (personaKey: string) => {
    const persona = DEMO_PERSONAS.find((p) => p.key === personaKey);
    if (!persona) return;

    setActivePersonaKey(personaKey);

    if (persona.role === "PublicApplicant") {
      authService.logout();
      setUser(null);
      setRole("PublicApplicant");
      return;
    }

    // Attempt login or register for persona
    const defaultPassword = "Password123!";
    try {
      const res = await authService.login({
        email: persona.email,
        password: defaultPassword,
      });
      setUser(res.user);
      setRole(res.user.role);
    } catch {
      // If login fails, try to auto-register demo persona
      try {
        await authService.register({
          email: persona.email,
          password: defaultPassword,
          name: persona.name,
          role: persona.role,
          org_id: persona.org_id,
        });
        // Then login
        const res = await authService.login({
          email: persona.email,
          password: defaultPassword,
        });
        setUser(res.user);
        setRole(res.user.role);
      } catch {
        // Fallback local state if backend is offline or unreachable
        const fallbackUser: UserResponse = {
          id: `demo_${persona.key}`,
          email: persona.email,
          name: persona.name,
          role: persona.role,
          org_id: persona.org_id,
          created_at: new Date().toISOString(),
        };
        setUser(fallbackUser);
        setRole(persona.role);
      }
    }
  };

  const login = async (payload: LoginPayload) => {
    const res = await authService.login(payload);
    setUser(res.user);
    setRole(res.user.role);
    const matched = DEMO_PERSONAS.find((p) => p.email === res.user.email);
    setActivePersonaKey(matched ? matched.key : "custom");
  };

  const register = async (payload: RegisterPayload) => {
    await authService.register(payload);
    await login({ email: payload.email, password: payload.password });
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setRole("PublicApplicant");
    setActivePersonaKey("applicant");
  };

  useEffect(() => {
    const token = api.getToken();
    if (token) {
      authService
        .getMe()
        .then((res) => {
          setUser(res);
          setRole(res.role);
          const matched = DEMO_PERSONAS.find((p) => p.email === res.email);
          if (matched) setActivePersonaKey(matched.key);
        })
        .catch(() => {
          logout();
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        activePersonaKey,
        switchPersona,
        login,
        register,
        logout,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

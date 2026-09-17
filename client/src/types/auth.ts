export type Role = "PublicApplicant" | "Caseworker" | "Analyst" | "Admin";

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: Role;
  org_id?: string | null;
  created_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: UserResponse;
}

export interface PrincipalProfile {
  id: string;
  role: Role;
  org_id?: string | null;
  name?: string | null;
  is_authenticated: boolean;
}

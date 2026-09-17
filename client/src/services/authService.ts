import { api } from "./api";
import type { LoginResponse, UserResponse } from "../types/auth";

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  role: string;
  org_id?: string | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const authService = {
  async register(payload: RegisterPayload): Promise<UserResponse> {
    return api.post<UserResponse>("/auth/register", payload);
  },

  async login(payload: LoginPayload): Promise<LoginResponse> {
    const res = await api.post<LoginResponse>("/auth/login", payload);
    if (res.access_token) {
      api.setToken(res.access_token);
    }
    return res;
  },

  async getMe(): Promise<UserResponse> {
    return api.get<UserResponse>("/auth/me");
  },

  logout() {
    api.clearToken();
  },
};

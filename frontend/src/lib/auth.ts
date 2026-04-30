"use client";

import { create } from "zustand";
import { api } from "./api";

interface AuthState {
  user: any | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, workspaceName: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    await api.login(email, password);
    const user = await api.getMe();
    set({ user, isAuthenticated: true });
  },

  register: async (email, password, fullName, workspaceName) => {
    await api.register(email, password, fullName, workspaceName);
    const user = await api.getMe();
    set({ user, isAuthenticated: true });
  },

  logout: () => {
    api.clearTokens();
    set({ user: null, isAuthenticated: false });
    window.location.href = "/login";
  },

  loadUser: async () => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) { set({ isLoading: false }); return; }
      const user = await api.getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },
}));

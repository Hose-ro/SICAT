import { create } from "zustand";

export const useAuthStore = create((set) => ({
  user: null,
  initialized: false,
  setUser: (user) => set({ user }),
  setInitialized: (initialized) => set({ initialized }),
  logout: () => set({ user: null }),
}));

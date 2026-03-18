import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { clearToken, saveToken } from '../lib/auth'

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        if (token) saveToken(token)
        set({ user, token })
      },
      logout: () => {
        clearToken()
        set({ user: null, token: null })
      },
    }),
    { name: 'sicat-auth' }
  )
)

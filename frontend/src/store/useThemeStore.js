import { create } from 'zustand'

const THEME_STORAGE_KEY = 'sicat-theme'

function readInitial() {
  if (typeof window === 'undefined') return false

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (stored === 'dark') return true
  if (stored === 'light') return false

  if (document.documentElement.classList.contains('dark')) return true
  if (document.body?.classList.contains('dark')) return true

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function applyTheme(isDark, { persist = true } = {}) {
  if (typeof document === 'undefined') return

  document.documentElement.classList.toggle('dark', isDark)
  document.body?.classList.toggle('dark', isDark)

  // Only persist on an explicit user choice. Persisting the initial
  // auto-detected value would freeze follow-system after first paint.
  if (persist && typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light')
  }
}

const initialDark = readInitial()
applyTheme(initialDark, { persist: false })

export const useThemeStore = create((set) => ({
  isDark: initialDark,
  setDark: (value) => {
    applyTheme(value)
    set({ isDark: value })
  },
  toggle: () =>
    set((state) => {
      const next = !state.isDark
      applyTheme(next)
      return { isDark: next }
    }),
}))

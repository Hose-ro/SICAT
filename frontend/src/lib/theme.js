export const THEME_STORAGE_KEY = 'sicat-theme'

export function getInitialDarkMode() {
  if (typeof window === 'undefined') return false

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (storedTheme === 'dark') return true
  if (storedTheme === 'light') return false

  if (document.documentElement.classList.contains('dark')) return true
  if (document.body?.classList.contains('dark')) return true

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

export function setThemeMode(isDark) {
  if (typeof document === 'undefined') return

  document.documentElement.classList.toggle('dark', isDark)
  document.body?.classList.toggle('dark', isDark)

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light')
  }
}

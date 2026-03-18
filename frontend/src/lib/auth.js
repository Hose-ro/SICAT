export const AUTH_TOKEN_KEY = 'sicat_token'
const LEGACY_AUTH_TOKEN_KEY = 'token'

export const getStoredToken = () => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  if (token) return token

  const legacyToken = localStorage.getItem(LEGACY_AUTH_TOKEN_KEY)
  if (!legacyToken) return null

  // Migrate old sessions transparently to the new key.
  localStorage.setItem(AUTH_TOKEN_KEY, legacyToken)
  localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY)
  return legacyToken
}

export const saveToken = (token) => {
  localStorage.setItem(AUTH_TOKEN_KEY, token)
  localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY)
}

export const clearToken = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY)
}

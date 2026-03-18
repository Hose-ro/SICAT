export const AUTH_TOKEN_KEY = 'sicat_token'

export const getStoredToken = () => localStorage.getItem(AUTH_TOKEN_KEY)

export const saveToken = (token) => localStorage.setItem(AUTH_TOKEN_KEY, token)

export const clearToken = () => localStorage.removeItem(AUTH_TOKEN_KEY)

import axios from 'axios'
import { useAuthStore } from '../store/authStore'
import { AUTH_TOKEN_KEY, clearToken, getStoredToken } from '../lib/auth'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'https://api.sicatapp.com/api',
})

api.interceptors.request.use((config) => {
  const token = getStoredToken() || useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isAuthRoute = err.config?.url?.includes('/auth/')
    if (err.response?.status === 401 && !isAuthRoute) {
      clearToken()
      useAuthStore.getState().logout?.()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export { AUTH_TOKEN_KEY }
export default api

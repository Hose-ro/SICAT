import axios from 'axios'
import { useAuthStore } from '../store/authStore'
import { clearToken, getStoredToken } from '../lib/auth'

const DEFAULT_API_URL = 'https://api.sicatapp.com/api'
const envApiUrl = import.meta.env.VITE_API_URL?.trim()
const apiBaseUrl = envApiUrl || DEFAULT_API_URL

const api = axios.create({
  baseURL: apiBaseUrl,
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

    if (!err.response) {
      err.response = { data: { message: `No se pudo conectar con la API (${apiBaseUrl})` } }
    }

    if (err.response?.status === 401 && !isAuthRoute) {
      clearToken()
      useAuthStore.getState().logout?.()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

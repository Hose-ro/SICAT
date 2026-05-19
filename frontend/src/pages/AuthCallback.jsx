import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { saveToken } from '../lib/auth'
import api from '../api/axios'

export default function AuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const processed = useRef(false)

  useEffect(() => {
    if (processed.current) return
    processed.current = true

    const token = searchParams.get('token')
    const error = searchParams.get('error')

    if (error || !token) {
      navigate('/login?error=google_auth_failed', { replace: true })
      return
    }

    saveToken(token)

    api
      .get('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        setAuth(res.data, token)
        navigate('/dashboard', { replace: true })
      })
      .catch(() => {
        navigate('/login?error=google_auth_failed', { replace: true })
      })
  }, [searchParams, navigate, setAuth])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f1f5f9] dark:bg-[#11151c]">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#4f7cff] border-t-transparent" />
        <p className="text-sm text-[#64748b] dark:text-[rgba(255,255,255,0.50)]">
          Iniciando sesión con Google...
        </p>
      </div>
    </div>
  )
}

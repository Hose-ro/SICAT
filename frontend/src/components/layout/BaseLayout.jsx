import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import api from '@/api/axios'
import NotificacionesBell from '@/components/shared/NotificacionesBell'

export function BaseLayout({ children }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dark, setDark] = useState(false)
  const [pwModal, setPwModal] = useState(false)
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  useEffect(() => {
    // Sync dark mode class with state
    if (dark) {
      document.body.classList.add('dark')
      document.documentElement.classList.add('dark')
    } else {
      document.body.classList.remove('dark')
      document.documentElement.classList.remove('dark')
    }
  }, [dark])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const toggleDark = () => {
    setDark(d => !d)
  }

  const navClass = ({ isActive }) =>
    `nav__item${isActive ? ' active' : ''}`

  return (
    <div>
      {/* ── Mobile overlay ── */}
      <div
        className={`sidebar-overlay${mobileOpen ? ' visible' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* ── Sidebar ── */}
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>

        {/* Header: logo + toggle */}
        <div className="sidebar__header">
          <div className="sidebar__logo">
            <div className="logo__icon">🎓</div>
            <span className="logo__text">Academia</span>
          </div>
          <button
            className="sidebar__toggle"
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expandir' : 'Colapsar'}
          >
            <div className="sidebar-bar" />
            <div className="sidebar-bar" />
            <div className="sidebar-bar" />
          </button>
        </div>

        {/* Search */}
        <div className="sidebar__search">
          <i className="ri-search-line" />
          <input type="text" placeholder="Buscar..." />
        </div>

        {/* Nav */}
        <nav className="sidebar__nav">
          <span className="nav__section">Principal</span>

          <NavLink to="/dashboard" className={navClass} data-tip="Inicio" onClick={() => setMobileOpen(false)}>
            <i className="ri-home-5-fill nav__icon" />
            <span className="nav__label">Inicio</span>
          </NavLink>

          <NavLink to="/materias" className={navClass} data-tip="Materias" onClick={() => setMobileOpen(false)}>
            <i className="ri-book-3-fill nav__icon" />
            <span className="nav__label">Materias</span>
          </NavLink>

          <NavLink to="/asistencias" className={navClass} data-tip="Asistencias" onClick={() => setMobileOpen(false)}>
            <i className="ri-calendar-check-fill nav__icon" />
            <span className="nav__label">Asistencias</span>
          </NavLink>

          <NavLink to="/tareas" className={navClass} data-tip="Tareas" onClick={() => setMobileOpen(false)}>
            <i className="ri-task-fill nav__icon" />
            <span className="nav__label">Tareas</span>
          </NavLink>

          {(user?.rol === 'ADMIN' || user?.user_metadata?.custom_claims?.rol === 'ADMIN') && (
            <>
              <span className="nav__section">Administración</span>

              <NavLink to="/carreras" className={navClass} data-tip="Carreras" onClick={() => setMobileOpen(false)}>
                <i className="ri-book-2-fill nav__icon" />
                <span className="nav__label">Carreras</span>
              </NavLink>

              <NavLink to="/usuarios" className={navClass} data-tip="Usuarios" onClick={() => setMobileOpen(false)}>
                <i className="ri-group-fill nav__icon" />
                <span className="nav__label">Usuarios</span>
              </NavLink>

              <NavLink to="/admin/horarios" className={navClass} data-tip="Horarios" onClick={() => setMobileOpen(false)}>
                <i className="ri-calendar-schedule-fill nav__icon" />
                <span className="nav__label">Horarios</span>
              </NavLink>

              <NavLink to="/admin/academias" className={navClass} data-tip="Academias" onClick={() => setMobileOpen(false)}>
                <i className="ri-building-4-fill nav__icon" />
                <span className="nav__label">Academias</span>
              </NavLink>

              <NavLink to="/admin/grupos" className={navClass} data-tip="Grupos" onClick={() => setMobileOpen(false)}>
                <i className="ri-team-fill nav__icon" />
                <span className="nav__label">Grupos</span>
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar__divider" />

        {/* Footer */}
        <div className="sidebar__footer">

          {/* Dark mode toggle */}
          <div className="dark-toggle">
            <i className={`${dark ? 'ri-sun-fill' : 'ri-moon-fill'} dark-toggle__icon`} />
            <span className="dark-toggle__label">{dark ? 'Modo claro' : 'Modo oscuro'}</span>
            <input
              id="dark-check"
              type="checkbox"
              className="mode-switch-input"
              checked={dark}
              onChange={toggleDark}
            />
            <label className="mode-switch" htmlFor="dark-check">
              <svg viewBox="0 0 212.4992 84.4688" overflow="visible">
                <path pathLength={360} fill="none" stroke="currentColor" d="M 42.2496,84.4688 C 18.913594,84.474104 -0.00530424,65.555206 0,42.2192 0.01148477,18.895066 18.925464,-0.00530377 42.2496,0 65.573736,-0.00530377 84.487715,18.895066 84.4992,42.2192 84.504504,65.555206 65.585606,84.474104 42.2496,84.4688 18.913594,84.474104 -0.00530424,65.555206 0,42.2192 0.01148477,18.895066 18.925463,-0.00188652 42.2496,0 c 64,0 64,84.4688 128,84.4688 23.32414,0.0019 42.23812,-18.895066 42.2496,-42.2192 C 212.5042,18.913594 193.58561,-0.005304 170.2496,0 146.91359,-0.005304 127.9947,18.913594 128,42.2496 c 0.0115,23.324134 18.92546,42.224504 42.2496,42.2192 23.32414,0.0053 42.23812,-18.895066 42.2496,-42.2192 C 212.5042,18.913594 193.58561,-0.005304 170.2496,0 c -64,0 -64,84.4688 -128,84.4688 z" />
              </svg>
            </label>
          </div>

          {/* User */}
          <div className="sidebar__user">
            <div className="user__avatar">
              {user?.user_metadata?.custom_claims?.nombre?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="user__info">
              <div className="user__name">{user?.user_metadata?.custom_claims?.nombre ?? user?.email ?? 'Usuario'}</div>
              <div className="user__role">{user?.user_metadata?.custom_claims?.rol ?? 'Miembro'}</div>
            </div>
            <button className="btn-logout" onClick={handleLogout} title="Cerrar sesión">
              <span className="btn-logout__sign">
                <svg viewBox="0 0 24 24">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </span>
              <span className="btn-logout__text">Salir</span>
            </button>
          </div>

          {/* Change password button */}
          <button
            className="sidebar__pw-btn"
            onClick={() => { setPwModal(true); setPwError(''); setPwSuccess(''); setPwForm({ current: '', newPw: '', confirm: '' }); }}
          >
            <i className="ri-lock-password-line" style={{ fontSize: 14 }} />
            <span className="sidebar__pw-label">Cambiar contraseña</span>
          </button>

        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="mobile-topbar">
        <button
          onClick={() => setMobileOpen(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#263C69', padding: 4 }}
        >
          <i className="ri-menu-line" />
        </button>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#263C69' }}>Academia</span>
        <NotificacionesBell />
      </div>

      {/* ── Main content ── */}
      <div className={`layout-main${collapsed ? ' collapsed' : ''}`}>
        <main style={{ padding: '24px 28px', minHeight: '100vh' }}>
          {children}
        </main>
      </div>

      {/* ── Change password modal ── */}
      {pwModal && (
        <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 pw-modal">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800">Cambiar contraseña</h3>
              <button onClick={() => setPwModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <form
              className="p-5 space-y-4"
              onSubmit={async (e) => {
                e.preventDefault()
                setPwError(''); setPwSuccess('')
                if (pwForm.newPw.length < 6) { setPwError('La nueva contraseña debe tener al menos 6 caracteres'); return }
                if (pwForm.newPw !== pwForm.confirm) { setPwError('Las contraseñas no coinciden'); return }
                setPwLoading(true)
                try {
                  await api.post('/auth/change-password', {
                    currentPassword: pwForm.current,
                    newPassword: pwForm.newPw,
                  })
                  setPwSuccess('¡Contraseña actualizada!')
                  setPwForm({ current: '', newPw: '', confirm: '' })
                  setTimeout(() => setPwModal(false), 1500)
                } catch (err) {
                  setPwError(err.response?.data?.message ?? 'Error al cambiar la contraseña')
                } finally {
                  setPwLoading(false)
                }
              }}
            >
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Contraseña actual</label>
                <input
                  type="password" required
                  value={pwForm.current}
                  onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nueva contraseña</label>
                <input
                  type="password" required minLength={6}
                  value={pwForm.newPw}
                  onChange={(e) => setPwForm({ ...pwForm, newPw: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Confirmar nueva contraseña</label>
                <input
                  type="password" required
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {pwError && <p className="text-sm text-red-500 font-medium">{pwError}</p>}
              {pwSuccess && <p className="text-sm text-green-600 font-medium">{pwSuccess}</p>}

              <button
                type="submit"
                disabled={pwLoading}
                className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50"
              >
                {pwLoading ? 'Guardando...' : 'Actualizar contraseña'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  CiBoxes,
  CiCalendar,
  CiCalendarDate,
  CiDark,
  CiHome,
  CiLock,
  CiLogout,
  CiMenuBurger,
  CiRead,
  CiSearch,
  CiShop,
  CiSun,
  CiUser,
  CiViewList,
} from 'react-icons/ci'
import {
  BarChart3,
  BellRing,
  BookOpenCheck,
  CalendarClock,
  CalendarDays,
  DoorOpen,
  GraduationCap,
  UsersRound,
  ScanLine,
  X,
} from 'lucide-react'
import { Dialog } from '@base-ui/react/dialog'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/useThemeStore'
import api from '@/api/axios'
import NotificacionesBell from '@/components/shared/NotificacionesBell'
import BrandMark from '@/components/branding/BrandMark'

export function BaseLayout({ children }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const role = user?.rol
  const displayName = user?.nombre || user?.username || user?.email || 'Usuario'
  const displayRole = role === 'JEFE_CARRERA' ? 'Jefe de carrera' : (role || 'Miembro')
  const avatarText = displayName?.[0]?.toUpperCase() || '?'

  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const dark = useThemeStore((s) => s.isDark)
  const toggleDark = useThemeStore((s) => s.toggle)
  const [pwModal, setPwModal] = useState(false)
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout')
    } finally {
      logout()
      navigate('/login')
    }
  }

  const navClass = ({ isActive }) =>
    `nav__item${isActive ? ' active' : ''}`
  const ThemeIcon = dark ? CiSun : CiDark

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
            <div className="logo__icon">
              <BrandMark className="logo__icon-image" decorative />
            </div>
            <span className="logo__text">SICAT</span>
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
          <CiSearch className="sidebar__search-icon" />
          <input type="text" placeholder="Buscar..." />
        </div>

        {/* Nav */}
        <nav className="sidebar__nav">
          <span className="nav__section">Principal</span>

          <NavLink to="/dashboard" className={navClass} data-tip="Inicio" onClick={() => setMobileOpen(false)}>
            <CiHome className="nav__icon" />
            <span className="nav__label">Inicio</span>
          </NavLink>

          {role !== 'JEFE_CARRERA' && (
            <>
              <NavLink to="/materias" className={navClass} data-tip="Materias" onClick={() => setMobileOpen(false)}>
                <CiRead className="nav__icon" />
                <span className="nav__label">Materias</span>
              </NavLink>

              <NavLink to="/asistencias" className={navClass} data-tip="Asistencias" onClick={() => setMobileOpen(false)}>
                <CiCalendar className="nav__icon" />
                <span className="nav__label">Asistencias</span>
              </NavLink>

              <NavLink to="/tareas" className={navClass} data-tip="Tareas" onClick={() => setMobileOpen(false)}>
                <CiViewList className="nav__icon" />
                <span className="nav__label">Tareas</span>
              </NavLink>

              <NavLink to="/calificaciones" className={navClass} data-tip="Calificaciones" onClick={() => setMobileOpen(false)}>
                <GraduationCap className="nav__icon" />
                <span className="nav__label">Calificaciones</span>
              </NavLink>

              {role === 'DOCENTE' && (
                <>
                  <NavLink to="/docente/horario" className={navClass} data-tip="Horario" onClick={() => setMobileOpen(false)}>
                    <CalendarClock className="nav__icon" />
                    <span className="nav__label">Horario</span>
                  </NavLink>
                  <NavLink to="/docente/horario/editar" className={navClass} data-tip="Programar clases" onClick={() => setMobileOpen(false)} end>
                    <CalendarDays className="nav__icon" />
                    <span className="nav__label">Programar clases</span>
                  </NavLink>
                </>
              )}

              {role === 'ALUMNO' && (
                <NavLink to="/alumno/horario" className={navClass} data-tip="Horario" onClick={() => setMobileOpen(false)}>
                  <CalendarClock className="nav__icon" />
                  <span className="nav__label">Horario</span>
                </NavLink>
              )}
            </>
          )}

          {role === 'JEFE_CARRERA' && (
            <>
              <span className="nav__section">Jefatura</span>
              <NavLink to="/jefe-carrera/docentes" className={navClass} data-tip="Docentes" onClick={() => setMobileOpen(false)}>
                <UsersRound className="nav__icon" />
                <span className="nav__label">Docentes</span>
              </NavLink>
              <NavLink to="/jefe-carrera/clases" className={navClass} data-tip="Clases y horarios" onClick={() => setMobileOpen(false)}>
                <CalendarClock className="nav__icon" />
                <span className="nav__label">Clases y horarios</span>
              </NavLink>
              <NavLink to="/jefe-carrera/seguimiento" className={navClass} data-tip="Seguimiento" onClick={() => setMobileOpen(false)}>
                <BookOpenCheck className="nav__icon" />
                <span className="nav__label">Seguimiento</span>
              </NavLink>
              <NavLink to="/jefe-carrera/alertas" className={navClass} data-tip="Alertas" onClick={() => setMobileOpen(false)}>
                <BellRing className="nav__icon" />
                <span className="nav__label">Alertas</span>
              </NavLink>
              <NavLink to="/jefe-carrera/reportes" className={navClass} data-tip="Reportes" onClick={() => setMobileOpen(false)}>
                <BarChart3 className="nav__icon" />
                <span className="nav__label">Reportes</span>
              </NavLink>
            </>
          )}

          {role === 'ADMIN' && (
            <>
              <span className="nav__section">Administración</span>

              <NavLink to="/carreras" className={navClass} data-tip="Carreras" onClick={() => setMobileOpen(false)}>
                <CiRead className="nav__icon" />
                <span className="nav__label">Carreras</span>
              </NavLink>

              <NavLink to="/usuarios" className={navClass} data-tip="Usuarios" onClick={() => setMobileOpen(false)}>
                <CiUser className="nav__icon" />
                <span className="nav__label">Usuarios</span>
              </NavLink>

              <NavLink to="/admin/horarios" className={navClass} data-tip="Horarios" onClick={() => setMobileOpen(false)}>
                <CiCalendarDate className="nav__icon" />
                <span className="nav__label">Horarios</span>
              </NavLink>

              <NavLink to="/admin/horarios-importados" className={navClass} data-tip="Horarios por revisar" onClick={() => setMobileOpen(false)}>
                <ScanLine className="nav__icon" />
                <span className="nav__label">Horarios por revisar</span>
              </NavLink>

              <NavLink to="/admin/academias" className={navClass} data-tip="Academias" onClick={() => setMobileOpen(false)}>
                <CiShop className="nav__icon" />
                <span className="nav__label">Academias</span>
              </NavLink>

              <NavLink to="/admin/aulas" className={navClass} data-tip="Aulas" onClick={() => setMobileOpen(false)}>
                <DoorOpen className="nav__icon" />
                <span className="nav__label">Aulas</span>
              </NavLink>

              <NavLink to="/admin/grupos" className={navClass} data-tip="Grupos" onClick={() => setMobileOpen(false)}>
                <CiBoxes className="nav__icon" />
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
            <ThemeIcon className="dark-toggle__icon" />
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
              {avatarText}
            </div>
            <div className="user__info">
              <div className="user__name">{displayName}</div>
              <div className="user__role">{displayRole}</div>
            </div>
            <button className="btn-logout" onClick={handleLogout} title="Cerrar sesión">
              <span className="btn-logout__sign">
                <CiLogout />
              </span>
              <span className="btn-logout__text">Salir</span>
            </button>
          </div>

          {/* Change password button */}
          <button
            type="button"
            className="sidebar__pw-btn"
            onClick={() => setPwModal(true)}
          >
            <CiLock className="sidebar__pw-icon" />
            <span className="sidebar__pw-label">Cambiar contraseña</span>
          </button>

        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="mobile-topbar">
        <button
          onClick={() => setMobileOpen(true)}
          type="button"
          aria-label="Abrir menú"
          className="rounded-lg border border-transparent p-2 text-[20px] text-[#263C69] transition hover:bg-white/60"
        >
          <CiMenuBurger />
        </button>
        <div className="mobile-topbar__brand">
          <BrandMark className="mobile-topbar__brand-icon" decorative />
          <span className="mobile-topbar__brand-text">SICAT</span>
        </div>
        <NotificacionesBell />
      </div>

      {/* ── Main content ── */}
      <div className={`layout-main${collapsed ? ' collapsed' : ''}`}>
        <div className="print-hidden hidden items-center justify-end px-4 pt-4 sm:px-6 lg:flex lg:px-7">
          <NotificacionesBell />
        </div>
        <main className="min-h-screen px-4 py-4 sm:px-6 sm:py-6 lg:px-7">
          {children}
        </main>
      </div>

      {/* ── Change password modal ── */}
      <Dialog.Root
        open={pwModal}
        onOpenChange={(open) => {
          setPwModal(open)
          if (open) {
            setPwError('')
            setPwSuccess('')
            setPwForm({ current: '', newPw: '', confirm: '' })
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-[199] bg-black/40 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
          <Dialog.Popup
            aria-describedby={pwError ? 'pw-modal-error' : pwSuccess ? 'pw-modal-success' : undefined}
            className="pw-modal fixed left-1/2 top-1/2 z-[200] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white shadow-xl transition-all duration-200 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
          >
            <div className="flex items-center justify-between border-b border-gray-100 p-4 sm:p-5">
              <Dialog.Title className="text-lg font-semibold text-gray-800">
                Cambiar contraseña
              </Dialog.Title>
              <Dialog.Close
                aria-label="Cerrar"
                className="-mr-1 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Dialog.Close>
            </div>
            <form
              className="max-h-[calc(100vh-9rem)] space-y-4 overflow-y-auto p-4 sm:p-5"
              onSubmit={async (e) => {
                e.preventDefault()
                setPwError(''); setPwSuccess('')
                if (pwForm.newPw.length < 8) { setPwError('La nueva contraseña debe tener al menos 8 caracteres'); return }
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
                <label htmlFor="pw-current" className="block text-xs font-medium text-gray-700 mb-1">Contraseña actual</label>
                <input
                  id="pw-current"
                  type="password" required maxLength={72} autoFocus
                  autoComplete="current-password"
                  value={pwForm.current}
                  onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="pw-new" className="block text-xs font-medium text-gray-700 mb-1">Nueva contraseña</label>
                <input
                  id="pw-new"
                  type="password" required minLength={8} maxLength={72}
                  autoComplete="new-password"
                  value={pwForm.newPw}
                  onChange={(e) => setPwForm({ ...pwForm, newPw: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="pw-confirm" className="block text-xs font-medium text-gray-700 mb-1">Confirmar nueva contraseña</label>
                <input
                  id="pw-confirm"
                  type="password" required minLength={8} maxLength={72}
                  autoComplete="new-password"
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {pwError && (
                <p id="pw-modal-error" role="alert" className="text-sm text-red-500 font-medium">
                  {pwError}
                </p>
              )}
              {pwSuccess && (
                <p id="pw-modal-success" role="status" className="text-sm text-green-600 font-medium">
                  {pwSuccess}
                </p>
              )}

              <button
                type="submit"
                disabled={pwLoading}
                className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50"
              >
                {pwLoading ? 'Guardando...' : 'Actualizar contraseña'}
              </button>
            </form>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

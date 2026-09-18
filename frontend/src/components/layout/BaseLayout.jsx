import useDesktop from '@/hooks/useDesktop'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import FeedbackDialogs from '@/components/FeedbackDialogs'
import { useState, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Boxes as CiBoxes, Calendar as CiCalendar, CalendarDays as CiCalendarDate, Moon as CiDark, House as CiHome, LockKeyhole as CiLock, LogOut as CiLogout, Menu as CiMenuBurger, BookOpen as CiRead, Search as CiSearch, School as CiShop, Sun as CiSun, UserRound as CiUser, List as CiViewList } from 'lucide-react'
import {
  BarChart3,
  BellRing,
  BookOpenCheck,
  CalendarClock,
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
import { useNotificacionesPolling } from '@/store/notificacionStore'
import BrandMark from '@/components/branding/BrandMark'

export function BaseLayout({ children }) {
  const desktop = useDesktop()
  useNotificacionesPolling()
  const passwordRef = useRef(null)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const role = user?.rol
  const displayName = user?.nombre || user?.username || user?.email || 'Usuario'
  const displayRole = role === 'JEFE_CARRERA' ? 'Jefe de carrera' : (role || 'Miembro')
  const avatarText = displayName?.[0]?.toUpperCase() || '?'

  const [menuQuery, setMenuQuery] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const dark = useThemeStore((s) => s.isDark)
  const toggleDark = useThemeStore((s) => s.toggle)
  const [pwModal, setPwModal] = useState(false)
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')
  const [pwLoading, setPwLoading] = useState(false)


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

  const sidebarContent = <>

        {/* Header: logo + toggle */}
        <div className="sidebar__header">
          <div className="sidebar__logo">
            <div className="logo__icon">
              <BrandMark className="logo__icon-image" decorative />
            </div>
            <span className="logo__text">SICAT</span>
          </div>
          <Button variant="ghost" aria-label={!desktop ? 'Cerrar menú' : collapsed ? 'Expandir menú' : 'Colapsar menú'}
            className="sidebar__toggle"
            onClick={() => desktop ? setCollapsed(c => !c) : setMobileOpen(false)}
            title={collapsed ? 'Expandir' : 'Colapsar'}
          >
            <div className="sidebar-bar" />
            <div className="sidebar-bar" />
            <div className="sidebar-bar" />
          </Button>
        </div>

        {/* Search */}
        <div className="sidebar__search">
          <CiSearch className="sidebar__search-icon" />
          <input aria-label="Buscar en el menú" type="search" placeholder="Buscar..." value={menuQuery} onChange={(event) => setMenuQuery(event.target.value)} />
        </div>

        {/* Nav */}
        <nav className="sidebar__nav">
          <span className="nav__section">Principal</span>

          <NavLink to="/dashboard" className={navClass} data-tip="Inicio" hidden={!'Inicio'.toLocaleLowerCase().includes(menuQuery.toLocaleLowerCase())} onClick={() => setMobileOpen(false)}>
            <CiHome className="nav__icon" />
            <span className="nav__label">Inicio</span>
          </NavLink>

          {role !== 'JEFE_CARRERA' && (
            <>
              <NavLink to="/materias" className={navClass} data-tip="Materias" hidden={!'Materias'.toLocaleLowerCase().includes(menuQuery.toLocaleLowerCase())} onClick={() => setMobileOpen(false)}>
                <CiRead className="nav__icon" />
                <span className="nav__label">Materias</span>
              </NavLink>

              <NavLink to="/asistencias" className={navClass} data-tip="Asistencias" hidden={!'Asistencias'.toLocaleLowerCase().includes(menuQuery.toLocaleLowerCase())} onClick={() => setMobileOpen(false)}>
                <CiCalendar className="nav__icon" />
                <span className="nav__label">Asistencias</span>
              </NavLink>

              <NavLink to="/tareas" className={navClass} data-tip="Tareas" hidden={!'Tareas'.toLocaleLowerCase().includes(menuQuery.toLocaleLowerCase())} onClick={() => setMobileOpen(false)}>
                <CiViewList className="nav__icon" />
                <span className="nav__label">Tareas</span>
              </NavLink>

              <NavLink to="/calificaciones" className={navClass} data-tip="Calificaciones" hidden={!'Calificaciones'.toLocaleLowerCase().includes(menuQuery.toLocaleLowerCase())} onClick={() => setMobileOpen(false)}>
                <GraduationCap className="nav__icon" />
                <span className="nav__label">Calificaciones</span>
              </NavLink>

              {role === 'DOCENTE' && (
                <>
                  <NavLink to="/docente/grupos" className={navClass} data-tip="Mis grupos" hidden={!'Mis grupos'.toLocaleLowerCase().includes(menuQuery.toLocaleLowerCase())} onClick={() => setMobileOpen(false)}>
                    <UsersRound className="nav__icon" />
                    <span className="nav__label">Mis grupos</span>
                  </NavLink>

                  <NavLink to="/docente/horario" className={navClass} data-tip="Horario" hidden={!'Horario'.toLocaleLowerCase().includes(menuQuery.toLocaleLowerCase())} onClick={() => setMobileOpen(false)}>
                    <CalendarClock className="nav__icon" />
                    <span className="nav__label">Horario</span>
                  </NavLink>
                </>
              )}

              {role === 'ALUMNO' && (
                <NavLink to="/alumno/horario" className={navClass} data-tip="Horario" hidden={!'Horario'.toLocaleLowerCase().includes(menuQuery.toLocaleLowerCase())} onClick={() => setMobileOpen(false)}>
                  <CalendarClock className="nav__icon" />
                  <span className="nav__label">Horario</span>
                </NavLink>
              )}
            </>
          )}

          {role === 'JEFE_CARRERA' && (
            <>
              <span className="nav__section">Jefatura</span>
              <NavLink to="/jefe-carrera/docentes" className={navClass} data-tip="Docentes" hidden={!'Docentes'.toLocaleLowerCase().includes(menuQuery.toLocaleLowerCase())} onClick={() => setMobileOpen(false)}>
                <UsersRound className="nav__icon" />
                <span className="nav__label">Docentes</span>
              </NavLink>
              <NavLink to="/jefe-carrera/clases" className={navClass} data-tip="Clases y horarios" hidden={!'Clases y horarios'.toLocaleLowerCase().includes(menuQuery.toLocaleLowerCase())} onClick={() => setMobileOpen(false)}>
                <CalendarClock className="nav__icon" />
                <span className="nav__label">Clases y horarios</span>
              </NavLink>
              <NavLink to="/jefe-carrera/seguimiento" className={navClass} data-tip="Seguimiento" hidden={!'Seguimiento'.toLocaleLowerCase().includes(menuQuery.toLocaleLowerCase())} onClick={() => setMobileOpen(false)}>
                <BookOpenCheck className="nav__icon" />
                <span className="nav__label">Seguimiento</span>
              </NavLink>
              <NavLink to="/jefe-carrera/alertas" className={navClass} data-tip="Alertas" hidden={!'Alertas'.toLocaleLowerCase().includes(menuQuery.toLocaleLowerCase())} onClick={() => setMobileOpen(false)}>
                <BellRing className="nav__icon" />
                <span className="nav__label">Alertas</span>
              </NavLink>
              <NavLink to="/jefe-carrera/reportes" className={navClass} data-tip="Reportes" hidden={!'Reportes'.toLocaleLowerCase().includes(menuQuery.toLocaleLowerCase())} onClick={() => setMobileOpen(false)}>
                <BarChart3 className="nav__icon" />
                <span className="nav__label">Reportes</span>
              </NavLink>
            </>
          )}

          {role === 'ADMIN' && (
            <>
              <span className="nav__section">Administración</span>

              <NavLink to="/carreras" className={navClass} data-tip="Carreras" hidden={!'Carreras'.toLocaleLowerCase().includes(menuQuery.toLocaleLowerCase())} onClick={() => setMobileOpen(false)}>
                <CiRead className="nav__icon" />
                <span className="nav__label">Carreras</span>
              </NavLink>

              <NavLink to="/usuarios" className={navClass} data-tip="Usuarios" hidden={!'Usuarios'.toLocaleLowerCase().includes(menuQuery.toLocaleLowerCase())} onClick={() => setMobileOpen(false)}>
                <CiUser className="nav__icon" />
                <span className="nav__label">Usuarios</span>
              </NavLink>

              <NavLink to="/admin/horarios" className={navClass} data-tip="Horarios" hidden={!'Horarios'.toLocaleLowerCase().includes(menuQuery.toLocaleLowerCase())} onClick={() => setMobileOpen(false)}>
                <CiCalendarDate className="nav__icon" />
                <span className="nav__label">Horarios</span>
              </NavLink>

              <NavLink to="/admin/calendario" className={navClass} data-tip="Calendario escolar" hidden={!'Calendario escolar'.toLocaleLowerCase().includes(menuQuery.toLocaleLowerCase())} onClick={() => setMobileOpen(false)}>
                <CiCalendar className="nav__icon" />
                <span className="nav__label">Calendario escolar</span>
              </NavLink>

              <NavLink to="/admin/horarios-importados" className={navClass} data-tip="Horarios por revisar" hidden={!'Horarios por revisar'.toLocaleLowerCase().includes(menuQuery.toLocaleLowerCase())} onClick={() => setMobileOpen(false)}>
                <ScanLine className="nav__icon" />
                <span className="nav__label">Horarios por revisar</span>
              </NavLink>

              <NavLink to="/admin/academias" className={navClass} data-tip="Academias" hidden={!'Academias'.toLocaleLowerCase().includes(menuQuery.toLocaleLowerCase())} onClick={() => setMobileOpen(false)}>
                <CiShop className="nav__icon" />
                <span className="nav__label">Academias</span>
              </NavLink>

              <NavLink to="/admin/aulas" className={navClass} data-tip="Aulas" hidden={!'Aulas'.toLocaleLowerCase().includes(menuQuery.toLocaleLowerCase())} onClick={() => setMobileOpen(false)}>
                <DoorOpen className="nav__icon" />
                <span className="nav__label">Aulas</span>
              </NavLink>

              <NavLink to="/admin/grupos" className={navClass} data-tip="Grupos" hidden={!'Grupos'.toLocaleLowerCase().includes(menuQuery.toLocaleLowerCase())} onClick={() => setMobileOpen(false)}>
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
          <Button variant="ghost" className="dark-toggle" onClick={toggleDark} aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} aria-pressed={dark}>
            <ThemeIcon className="dark-toggle__icon" aria-hidden="true" />
            <span className="dark-toggle__label">{dark ? 'Modo claro' : 'Modo oscuro'}</span>
          </Button>

          {/* User */}
          <div className="sidebar__user">
            <div className="user__avatar">
              {avatarText}
            </div>
            <div className="user__info">
              <div className="user__name">{displayName}</div>
              <div className="user__role">{displayRole}</div>
            </div>
            <Button variant="ghost" size="icon" aria-label="Cerrar sesión" className="sidebar-logout" onClick={handleLogout} title="Cerrar sesión"><LogOut aria-hidden="true" /></Button>
          </div>

          {/* Change password button */}
          <Button variant="ghost"
            type="button"
            className="sidebar__pw-btn" aria-label="Cambiar contraseña"
            onClick={() => setPwModal(true)}
          >
            <CiLock className="sidebar__pw-icon" />
            <span className="sidebar__pw-label">Cambiar contraseña</span>
          </Button>

        </div>
      </>

  return (
    <div>
      <a className="skip-link" href="#contenido-principal" onClick={() => document.getElementById('contenido-principal')?.focus()}>Saltar al contenido</a>
      {desktop ? (
        <aside aria-label="Menú principal" className={`sidebar${collapsed ? ' collapsed' : ''}`}>{sidebarContent}</aside>
      ) : (
        <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
          <Dialog.Portal>
            <Dialog.Backdrop className="sidebar-overlay" />
            <Dialog.Popup aria-modal="true" className="sidebar" aria-label="Menú principal">{sidebarContent}</Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      {/* ── Mobile top bar ── */}
      <div className="mobile-topbar">
        <Button variant="outline"
          onClick={() => setMobileOpen(true)}
          type="button"
          aria-label="Abrir menú"
          className="border border-transparent p-2 text-[20px]"
        >
          <CiMenuBurger />
        </Button>
        <div className="mobile-topbar__brand">
          <BrandMark className="mobile-topbar__brand-icon" decorative />
          <span className="mobile-topbar__brand-text">SICAT</span>
        </div>
        <NotificacionesBell />
      </div>

      <FeedbackDialogs />
      {/* ── Main content ── */}
      <div className={`layout-main${collapsed ? ' collapsed' : ''}`}>
        <div className="print-hidden hidden items-center justify-end px-4 pt-4 sm:px-6 lg:flex lg:px-7">
          <NotificacionesBell />
        </div>
        <main id="contenido-principal" tabIndex={-1} className="min-h-screen px-4 py-4 sm:px-6 sm:py-6 lg:px-7">
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
          <Dialog.Backdrop className="fixed inset-0 z-[199] bg-overlay/40 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
          <Dialog.Popup aria-modal="true"
            initialFocus={passwordRef}
            aria-describedby={pwError ? 'pw-modal-error' : pwSuccess ? 'pw-modal-success' : undefined}
            className="pw-modal fixed left-1/2 top-1/2 z-[200] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-card shadow-xl transition-[color,background-color,border-color,opacity,transform] duration-200 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
          >
            <div className="flex items-center justify-between border-b border-border p-4 sm:p-5">
              <Dialog.Title className="text-lg font-semibold text-foreground">
                Cambiar contraseña
              </Dialog.Title>
              <Dialog.Close
                aria-label="Cerrar"
                className="-mr-1 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                <label htmlFor="pw-current" className="block text-xs font-medium text-foreground mb-1">Contraseña actual</label>
                <input
                  id="pw-current"
                  ref={passwordRef} type="password" required maxLength={72}
                  autoComplete="current-password"
                  value={pwForm.current}
                  onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label htmlFor="pw-new" className="block text-xs font-medium text-foreground mb-1">Nueva contraseña</label>
                <input
                  id="pw-new"
                  type="password" required minLength={8} maxLength={72}
                  autoComplete="new-password"
                  value={pwForm.newPw}
                  onChange={(e) => setPwForm({ ...pwForm, newPw: e.target.value })}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label htmlFor="pw-confirm" className="block text-xs font-medium text-foreground mb-1">Confirmar nueva contraseña</label>
                <input
                  id="pw-confirm"
                  type="password" required minLength={8} maxLength={72}
                  autoComplete="new-password"
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              {pwError && (
                <p id="pw-modal-error" role="alert" className="text-sm text-destructive-foreground font-medium">
                  {pwError}
                </p>
              )}
              {pwSuccess && (
                <p id="pw-modal-success" role="status" className="text-sm text-success-foreground font-medium">
                  {pwSuccess}
                </p>
              )}

              <Button variant="default"
                type="submit"
                disabled={pwLoading}
                className="w-full py-2.5 font-medium disabled:opacity-50"
              >
                {pwLoading ? 'Guardando...' : 'Actualizar contraseña'}
              </Button>
            </form>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

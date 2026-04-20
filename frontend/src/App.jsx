import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { BaseLayout } from '@/components/layout/BaseLayout'
import { useAuthStore } from './store/authStore'
import { getStoredToken } from './lib/auth'
import Login from './pages/Login'
import Registro from './pages/Registro'
import Dashboard from './pages/Dashboard'
import Materias from './pages/Materias'
import MateriaDetalle from './pages/MateriaDetalle'
import Asistencias from './pages/Asistencias'
import Tareas from './pages/Tareas'
import NotificacionesHistorial from './pages/NotificacionesHistorial'
import Usuarios from './pages/Usuarios'
import Carreras from './pages/Carreras'
import HorariosPage from './pages/admin/horarios/HorariosPage'
import AcademiasPage from './pages/admin/academias/AcademiasPage'
import AcademiaDetalle from './pages/admin/academias/AcademiaDetalle'
import GruposPage from './pages/admin/grupos/GruposPage'
import GrupoDetalle from './pages/admin/grupos/GrupoDetalle'
import MateriaDetalleAlumno from './pages/alumno/MateriaDetalleAlumno'
import TareaDetalleAlumno from './pages/alumno/TareaDetalleAlumno'
import PasarLista from './pages/docente/PasarLista'
import TareaForm from './pages/docente/TareaForm'
import TareaDetalle from './pages/docente/TareaDetalle'
import PwaInstallPrompt from '@/components/PwaInstallPrompt'

function LayoutWrapper() {
  const location = useLocation()
  const token = useAuthStore((s) => s.token)
  const hasToken = token || getStoredToken()

  if (!hasToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return (
    <BaseLayout>
      <Outlet />
    </BaseLayout>
  )
}

function RoleGate({ allowedRoles }) {
  const user = useAuthStore((state) => state.user)

  if (!allowedRoles.includes(user?.rol)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" />} />
        
        {/* Rutas Públicas (sin Sidebar) */}
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        
        {/* Rutas Privadas (con Sidebar y Layout) */}
        <Route element={<LayoutWrapper />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/materias" element={<Materias />} />
          <Route path="/asistencias" element={<Asistencias />} />
          <Route path="/tareas" element={<Tareas />} />
          <Route path="/notificaciones" element={<NotificacionesHistorial />} />

          <Route element={<RoleGate allowedRoles={['DOCENTE', 'ADMIN']} />}>
            <Route path="/materias/:id" element={<MateriaDetalle />} />
            <Route path="/docente/tareas/crear" element={<TareaForm />} />
            <Route path="/docente/tareas/:id" element={<TareaDetalle />} />
          </Route>

          <Route element={<RoleGate allowedRoles={['DOCENTE']} />}>
            <Route path="/docente/pasar-lista/:sesionId" element={<PasarLista />} />
          </Route>

          <Route element={<RoleGate allowedRoles={['ALUMNO']} />}>
            <Route path="/alumno/materias/:id" element={<MateriaDetalleAlumno />} />
            <Route path="/alumno/tareas/:id" element={<TareaDetalleAlumno />} />
          </Route>

          <Route element={<RoleGate allowedRoles={['ADMIN']} />}>
            <Route path="/usuarios" element={<Usuarios />} />
            <Route path="/carreras" element={<Carreras />} />
            <Route path="/admin/horarios" element={<HorariosPage />} />
            <Route path="/admin/academias" element={<AcademiasPage />} />
            <Route path="/admin/academias/:id" element={<AcademiaDetalle />} />
            <Route path="/admin/grupos" element={<GruposPage />} />
            <Route path="/admin/grupos/:id" element={<GrupoDetalle />} />
          </Route>
        </Route>
      </Routes>
      <PwaInstallPrompt />
    </BrowserRouter>
  )
}

export default App

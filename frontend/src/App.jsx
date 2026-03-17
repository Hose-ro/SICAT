import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { BaseLayout } from '@/components/layout/BaseLayout'
import Login from './pages/Login'
import Registro from './pages/Registro'
import Dashboard from './pages/Dashboard'
import Materias from './pages/Materias'
import MateriaDetalle from './pages/MateriaDetalle'
import Asistencias from './pages/Asistencias'
import Tareas from './pages/Tareas'
import Usuarios from './pages/Usuarios'
import Carreras from './pages/Carreras'
import HorariosPage from './pages/admin/horarios/HorariosPage'
import AcademiasPage from './pages/admin/academias/AcademiasPage'
import AcademiaDetalle from './pages/admin/academias/AcademiaDetalle'
import GruposPage from './pages/admin/grupos/GruposPage'
import GrupoDetalle from './pages/admin/grupos/GrupoDetalle'
import InscripcionesAlumno from './pages/alumno/InscripcionesAlumno'
import MateriaDetalleAlumno from './pages/alumno/MateriaDetalleAlumno'
import TareaDetalleAlumno from './pages/alumno/TareaDetalleAlumno'
import SolicitudesPendientes from './pages/docente/SolicitudesPendientes'
import PasarLista from './pages/docente/PasarLista'
import TareaForm from './pages/docente/TareaForm'
import TareaDetalle from './pages/docente/TareaDetalle'

function LayoutWrapper() {
  return (
    <BaseLayout>
      <Outlet />
    </BaseLayout>
  )
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
          <Route path="/materias/:id" element={<MateriaDetalle />} />
          <Route path="/asistencias" element={<Asistencias />} />
          <Route path="/tareas" element={<Tareas />} />
          <Route path="/usuarios" element={<Usuarios />} />
          <Route path="/carreras" element={<Carreras />} />
          <Route path="/admin/horarios" element={<HorariosPage />} />
          <Route path="/admin/academias" element={<AcademiasPage />} />
          <Route path="/admin/academias/:id" element={<AcademiaDetalle />} />
          <Route path="/admin/grupos" element={<GruposPage />} />
          <Route path="/admin/grupos/:id" element={<GrupoDetalle />} />
          {/* Alumno routes */}
          <Route path="/inscripciones" element={<InscripcionesAlumno />} />
          <Route path="/alumno/materias/:id" element={<MateriaDetalleAlumno />} />
          <Route path="/alumno/tareas/:id" element={<TareaDetalleAlumno />} />
          {/* Docente routes */}
          <Route path="/docente/solicitudes" element={<SolicitudesPendientes />} />
          <Route path="/docente/pasar-lista/:sesionId" element={<PasarLista />} />
          <Route path="/docente/tareas/crear" element={<TareaForm />} />
          <Route path="/docente/tareas/:id" element={<TareaDetalle />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App

import { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import { BaseLayout } from "@/components/layout/BaseLayout";
import { useAuthStore } from "./store/authStore";
import { clearLegacyAuthStorage } from "./lib/auth";
import api from "./api/axios";
import Login from "./pages/Login";
import Registro from "./pages/Registro";
import VerificarCorreo from "./pages/VerificarCorreo";
import ReenviarVerificacion from "./pages/ReenviarVerificacion";
import RecuperarPassword from "./pages/RecuperarPassword";
import RestablecerPassword from "./pages/RestablecerPassword";
import Dashboard from "./pages/Dashboard";
import Materias from "./pages/Materias";
import MateriaDetalle from "./pages/MateriaDetalle";
import Asistencias from "./pages/Asistencias";
import Tareas from "./pages/Tareas";
import Calificaciones from "./pages/Calificaciones";
import NotificacionesHistorial from "./pages/NotificacionesHistorial";
import Usuarios from "./pages/Usuarios";
import Carreras from "./pages/Carreras";
import HorariosPage from "./pages/admin/horarios/HorariosPage";
import AcademiasPage from "./pages/admin/academias/AcademiasPage";
import AcademiaDetalle from "./pages/admin/academias/AcademiaDetalle";
import GruposPage from "./pages/admin/grupos/GruposPage";
import AulasPage from "./pages/admin/aulas/AulasPage";
import GrupoDetalle from "./pages/admin/grupos/GrupoDetalle";
import HorarioImportacionesPage from "./pages/admin/horarios/HorarioImportacionesPage";
import MateriaDetalleAlumno from "./pages/alumno/MateriaDetalleAlumno";
import TareaDetalleAlumno from "./pages/alumno/TareaDetalleAlumno";
import MiHorarioAlumno from "./pages/alumno/MiHorarioAlumno";
import PasarLista from "./pages/docente/PasarLista";
import TareaForm from "./pages/docente/TareaForm";
import TareaDetalle from "./pages/docente/TareaDetalle";
import MiHorario from "./pages/docente/MiHorario";
import JefeDashboard from "./pages/jefe-carrera/JefeDashboard";
import JefeDocentes from "./pages/jefe-carrera/JefeDocentes";
import JefeDocenteDetalle from "./pages/jefe-carrera/JefeDocenteDetalle";
import JefeClasesHorarios from "./pages/jefe-carrera/JefeClasesHorarios";
import JefeSeguimiento from "./pages/jefe-carrera/JefeSeguimiento";
import JefeAlertas from "./pages/jefe-carrera/JefeAlertas";
import JefeReportes from "./pages/jefe-carrera/JefeReportes";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import { EMAIL_AUTH_ENABLED } from "./lib/authFeatures";

function LayoutWrapper() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <BaseLayout>
      <Outlet />
    </BaseLayout>
  );
}

function SessionBootstrap({ children }) {
  const initialized = useAuthStore((state) => state.initialized);
  const setInitialized = useAuthStore((state) => state.setInitialized);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    clearLegacyAuthStorage();
    api
      .get("/auth/me")
      .then((response) => setUser(response.data))
      .catch(() => logout())
      .finally(() => setInitialized(true));
  }, [logout, setInitialized, setUser]);

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return children;
}

function RoleGate({ allowedRoles }) {
  const user = useAuthStore((state) => state.user);

  if (!allowedRoles.includes(user?.rol)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

function DashboardRoute() {
  const user = useAuthStore((state) => state.user);
  return user?.rol === "JEFE_CARRERA" ? <JefeDashboard /> : <Dashboard />;
}

function App() {
  return (
    <BrowserRouter>
      <SessionBootstrap>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" />} />

          {/* Rutas publicas (sin Sidebar) */}
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />
          <Route
            path="/verificar-correo"
            element={
              EMAIL_AUTH_ENABLED ? (
                <VerificarCorreo />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/reenviar-verificacion"
            element={
              EMAIL_AUTH_ENABLED ? (
                <ReenviarVerificacion />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/recuperar-password"
            element={
              EMAIL_AUTH_ENABLED ? (
                <RecuperarPassword />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/restablecer-password"
            element={
              EMAIL_AUTH_ENABLED ? (
                <RestablecerPassword />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          {/* Rutas privadas (con Sidebar y Layout) */}
          <Route element={<LayoutWrapper />}>
            <Route path="/dashboard" element={<DashboardRoute />} />
            <Route
              path="/notificaciones"
              element={<NotificacionesHistorial />}
            />

            <Route
              element={
                <RoleGate allowedRoles={["ADMIN", "DOCENTE", "ALUMNO"]} />
              }
            >
              <Route path="/materias" element={<Materias />} />
              <Route path="/asistencias" element={<Asistencias />} />
              <Route path="/tareas" element={<Tareas />} />
              <Route path="/calificaciones" element={<Calificaciones />} />
            </Route>

            <Route element={<RoleGate allowedRoles={["DOCENTE", "ADMIN"]} />}>
              <Route path="/materias/:id" element={<MateriaDetalle />} />
              <Route path="/docente/tareas/crear" element={<TareaForm />} />
              <Route path="/docente/tareas/:id" element={<TareaDetalle />} />
            </Route>

            <Route element={<RoleGate allowedRoles={["DOCENTE"]} />}>
              <Route
                path="/docente/pasar-lista/:sesionId"
                element={<PasarLista />}
              />
              <Route path="/docente/horario" element={<MiHorario />} />
              <Route
                path="/docente/horario/editar"
                element={<HorariosPage soloPropias />}
              />
            </Route>

            <Route element={<RoleGate allowedRoles={["ALUMNO"]} />}>
              <Route
                path="/alumno/materias/:id"
                element={<MateriaDetalleAlumno />}
              />
              <Route
                path="/alumno/tareas/:id"
                element={<TareaDetalleAlumno />}
              />
              <Route path="/alumno/horario" element={<MiHorarioAlumno />} />
            </Route>

            <Route element={<RoleGate allowedRoles={["JEFE_CARRERA"]} />}>
              <Route path="/jefe-carrera/docentes" element={<JefeDocentes />} />
              <Route
                path="/jefe-carrera/docentes/:id"
                element={<JefeDocenteDetalle />}
              />
              <Route
                path="/jefe-carrera/clases"
                element={<JefeClasesHorarios />}
              />
              <Route
                path="/jefe-carrera/seguimiento"
                element={<JefeSeguimiento />}
              />
              <Route path="/jefe-carrera/alertas" element={<JefeAlertas />} />
              <Route path="/jefe-carrera/reportes" element={<JefeReportes />} />
            </Route>

            <Route element={<RoleGate allowedRoles={["ADMIN"]} />}>
              <Route path="/usuarios" element={<Usuarios />} />
              <Route path="/carreras" element={<Carreras />} />
              <Route path="/admin/horarios" element={<HorariosPage />} />
              <Route
                path="/admin/horarios-importados"
                element={<HorarioImportacionesPage />}
              />
              <Route path="/admin/academias" element={<AcademiasPage />} />
              <Route
                path="/admin/academias/:id"
                element={<AcademiaDetalle />}
              />
              <Route path="/admin/aulas" element={<AulasPage />} />
              <Route path="/admin/grupos" element={<GruposPage />} />
              <Route path="/admin/grupos/:id" element={<GrupoDetalle />} />
            </Route>
          </Route>
        </Routes>
      </SessionBootstrap>
      <PwaInstallPrompt />
    </BrowserRouter>
  );
}

export default App;

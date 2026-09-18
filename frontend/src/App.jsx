import { lazy, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
const BaseLayout = lazy(() => import("@/components/layout/BaseLayout").then((module) => ({ default: module.BaseLayout })));
import RouteBoundary, { RouteLoading } from "@/components/RouteBoundary";
import { useAuthStore } from "./store/authStore";
import { clearLegacyAuthStorage } from "./lib/auth";
import api from "./api/axios";
const Login = lazy(() => import("./pages/Login"));
const Registro = lazy(() => import("./pages/Registro"));
const VerificarCorreo = lazy(() => import("./pages/VerificarCorreo"));
const ReenviarVerificacion = lazy(() => import("./pages/ReenviarVerificacion"));
const RecuperarPassword = lazy(() => import("./pages/RecuperarPassword"));
const RestablecerPassword = lazy(() => import("./pages/RestablecerPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Materias = lazy(() => import("./pages/Materias"));
const MateriaDetalle = lazy(() => import("./pages/MateriaDetalle"));
const Asistencias = lazy(() => import("./pages/Asistencias"));
const Tareas = lazy(() => import("./pages/Tareas"));
const Calificaciones = lazy(() => import("./pages/Calificaciones"));
const NotificacionesHistorial = lazy(() => import("./pages/NotificacionesHistorial"));
const Usuarios = lazy(() => import("./pages/Usuarios"));
const Carreras = lazy(() => import("./pages/Carreras"));
const HorariosPage = lazy(() => import("./pages/admin/horarios/HorariosPage"));
const AcademiasPage = lazy(() => import("./pages/admin/academias/AcademiasPage"));
const AcademiaDetalle = lazy(() => import("./pages/admin/academias/AcademiaDetalle"));
const GruposPage = lazy(() => import("./pages/admin/grupos/GruposPage"));
const AulasPage = lazy(() => import("./pages/admin/aulas/AulasPage"));
const GrupoDetalle = lazy(() => import("./pages/admin/grupos/GrupoDetalle"));
const HorarioImportacionesPage = lazy(() => import("./pages/admin/horarios/HorarioImportacionesPage"));
const MateriaDetalleAlumno = lazy(() => import("./pages/alumno/MateriaDetalleAlumno"));
const TareaDetalleAlumno = lazy(() => import("./pages/alumno/TareaDetalleAlumno"));
const MiHorarioAlumno = lazy(() => import("./pages/alumno/MiHorarioAlumno"));
const PasarLista = lazy(() => import("./pages/docente/PasarLista"));
const TareaForm = lazy(() => import("./pages/docente/TareaForm"));
const TareaDetalle = lazy(() => import("./pages/docente/TareaDetalle"));
const MiHorario = lazy(() => import("./pages/docente/MiHorario"));
const CalendarioEscolar = lazy(() => import("./pages/admin/CalendarioEscolar"));
const MisGrupos = lazy(() => import("./pages/docente/MisGrupos"));
const DashboardDocente = lazy(() => import("./pages/docente/DashboardDocente"));
const SolicitudesPendientes = lazy(() => import("./pages/docente/SolicitudesPendientes"));
const JefeDashboard = lazy(() => import("./pages/jefe-carrera/JefeDashboard"));
const JefeDocentes = lazy(() => import("./pages/jefe-carrera/JefeDocentes"));
const JefeDocenteDetalle = lazy(() => import("./pages/jefe-carrera/JefeDocenteDetalle"));
const JefeClasesHorarios = lazy(() => import("./pages/jefe-carrera/JefeClasesHorarios"));
const JefeSeguimiento = lazy(() => import("./pages/jefe-carrera/JefeSeguimiento"));
const JefeAlertas = lazy(() => import("./pages/jefe-carrera/JefeAlertas"));
const JefeReportes = lazy(() => import("./pages/jefe-carrera/JefeReportes"));
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
      <RouteBoundary><Outlet /></RouteBoundary>
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
        <RouteLoading />
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
  if (user?.rol === "JEFE_CARRERA") return <JefeDashboard />;
  if (user?.rol === "DOCENTE") return <DashboardDocente />;
  if (user?.rol === "ADMIN") return <Dashboard />;
  return <Navigate to="/materias" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <SessionBootstrap>
      <RouteBoundary>
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
              <Route path="/docente/grupos" element={<MisGrupos />} />
              <Route
                path="/docente/solicitudes"
                element={<SolicitudesPendientes />}
              />
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
              <Route path="/admin/calendario" element={<CalendarioEscolar />} />
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
      </RouteBoundary>
      </SessionBootstrap>
      <PwaInstallPrompt />
    </BrowserRouter>
  );
}

export default App;

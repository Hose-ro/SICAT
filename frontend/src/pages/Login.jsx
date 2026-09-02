import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import {
  Eye,
  EyeOff,
  Lock,
  MoonStar,
  SunMedium,
  UserCircle,
} from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { useThemeStore } from "../store/useThemeStore";
import api from "../api/axios";
import BrandMark from "../components/branding/BrandMark";
import { EMAIL_AUTH_ENABLED } from "../lib/authFeatures";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const dark = useThemeStore((s) => s.isDark);
  const toggleDark = useThemeStore((s) => s.toggle);
  const setUser = useAuthStore((state) => state.setUser);
  const navigate = useNavigate();
  const location = useLocation();
  const registered = location.state?.registered;
  const pendingApproval = location.state?.pendingApproval;
  const emailSent = location.state?.emailSent;
  const horarioRegistro = location.state?.horarioRegistro;
  const redirectTo = location.state?.from || "/dashboard";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { identifier, password });
      setUser(res.data.user);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message ?? "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-background transition-colors duration-300">
      {/* Decorative ambient blobs — glass territory, revisited in Ola 1 */}
      <div className="pointer-events-none absolute left-[-8rem] top-[-6rem] h-72 w-72 rounded-full bg-primary/10 blur-3xl sm:left-8 sm:top-8 sm:h-[28rem] sm:w-[28rem]" />
      <div className="pointer-events-none absolute bottom-[-7rem] right-[-5rem] h-72 w-72 rounded-full bg-primary/5 blur-3xl sm:bottom-8 sm:right-8 sm:h-96 sm:w-96" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl sm:h-[34rem] sm:w-[34rem]" />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <button
          type="button"
          onClick={toggleDark}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          aria-pressed={dark}
        >
          {dark ? (
            <SunMedium className="h-4 w-4" />
          ) : (
            <MoonStar className="h-4 w-4" />
          )}
          <span>{dark ? "Modo claro" : "Modo oscuro"}</span>
        </button>
      </div>

      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl items-center gap-10 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:px-8">
        <section className="hidden lg:flex lg:flex-col lg:justify-center">
          <div className="max-w-xl space-y-8">
            <div className="inline-flex items-center gap-4">
              <BrandMark className="h-20 w-20 shrink-0 object-contain" />
              <div>
                <h1 className="text-5xl font-bold tracking-tight text-foreground">
                  SICAT
                </h1>
                <p className="mt-1 text-base text-muted-foreground">
                  Sistema de Control de Asistencias y Tareas
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-4xl font-semibold leading-tight text-foreground">
                Bienvenido de vuelta al panel institucional.
              </h2>
            </div>
          </div>
        </section>

        <section className="w-full">
          <div className="mx-auto max-w-xl lg:max-w-none">
            <div className="mb-8 text-center lg:hidden">
              <div className="mb-4 inline-flex items-center gap-3">
                <BrandMark className="h-14 w-14 shrink-0 object-contain" />
                <div className="text-left">
                  <h1 className="text-3xl font-bold tracking-tight text-foreground">
                    SICAT
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Sistema de Control de Asistencias y Tareas
                  </p>
                </div>
              </div>
            </div>

            {/* The one intentional glass surface (see DESIGN.md / Ola 1) */}
            <div className="relative overflow-hidden rounded-[32px] border border-border bg-card/70 shadow-lg backdrop-blur-xl">
              <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-card/40 via-transparent to-transparent" />

              <div className="relative p-6 sm:p-8 lg:p-10">
                <div className="mb-8 space-y-2">
                  <h3 className="text-2xl font-semibold text-foreground">
                    Iniciar sesión
                  </h3>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label
                      htmlFor="identifier"
                      className="block text-sm font-medium text-foreground"
                    >
                      Usuario
                    </label>
                    <div className="group relative">
                      <UserCircle className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                      <input
                        id="identifier"
                        type="text"
                        autoComplete="username"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        required
                        placeholder="Número de control o usuario"
                        className="h-14 w-full rounded-2xl border border-input bg-background px-12 text-sm text-foreground outline-none transition-all duration-200 placeholder:text-muted-foreground hover:border-primary/45 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-foreground"
                    >
                      Contraseña
                    </label>
                    <div className="group relative">
                      <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        className="h-14 w-full rounded-2xl border border-input bg-background px-12 pr-12 text-sm text-foreground outline-none transition-all duration-200 placeholder:text-muted-foreground hover:border-primary/45 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                      />
                      <button
                        type="button"
                        aria-label={
                          showPassword
                            ? "Ocultar contraseña"
                            : "Mostrar contraseña"
                        }
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-primary focus:outline-none"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    {EMAIL_AUTH_ENABLED && (
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <Link
                          to="/reenviar-verificacion"
                          className="text-muted-foreground hover:text-foreground hover:underline"
                        >
                          Reenviar verificación
                        </Link>
                        <Link
                          to="/recuperar-password"
                          className="font-medium text-primary hover:underline"
                        >
                          ¿Olvidaste tu contraseña?
                        </Link>
                      </div>
                    )}
                  </div>

                  {registered && (
                    <div className="space-y-2 rounded-2xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">
                      <p>
                        {!EMAIL_AUTH_ENABLED
                          ? "Cuenta creada. Espera la aprobación administrativa."
                          : emailSent === false
                            ? "Cuenta creada, pero no pudimos enviar el correo de verificación. Solicita un nuevo enlace."
                            : pendingApproval
                              ? "Cuenta creada. Verifica tu correo y espera la aprobación administrativa."
                              : "¡Cuenta creada! Ya puedes iniciar sesión."}
                      </p>
                      {horarioRegistro?.estado === "REUTILIZADO" && (
                        <p>
                          Tu cuenta quedó vinculada con el horario existente de
                          tu grupo.
                        </p>
                      )}
                      {[
                        "PENDIENTE_PROCESAMIENTO",
                        "PENDIENTE_REVISION",
                        "ERROR",
                      ].includes(horarioRegistro?.estado) && (
                        <p>
                          Recibimos la fotografía de tu horario. La revisaremos
                          antes de publicarla.
                        </p>
                      )}
                      {EMAIL_AUTH_ENABLED && emailSent === false && (
                        <Link
                          to="/reenviar-verificacion"
                          className="inline-block font-medium underline"
                        >
                          Solicitar nuevo enlace
                        </Link>
                      )}
                    </div>
                  )}

                  {error && (
                    <div
                      role="alert"
                      className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                    >
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="group relative flex h-14 w-full items-center justify-center overflow-hidden rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_8px_24px_var(--primary-glow)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-strong focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <span className="relative z-10">
                      {loading ? "Iniciando sesión..." : "Iniciar sesión"}
                    </span>
                  </button>

                  <div className="space-y-3 pt-1 text-center">
                    <p className="text-sm text-muted-foreground">
                      ¿Eres alumno nuevo?{" "}
                      <Link
                        to="/registro"
                        className="font-medium text-primary transition-colors hover:text-primary-strong hover:underline"
                      >
                        Crea tu cuenta aquí
                      </Link>
                    </p>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

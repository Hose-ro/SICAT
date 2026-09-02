import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  BookOpen,
  Camera,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  GraduationCap,
  Hash,
  Layers3,
  Lock,
  Mail,
  MoonStar,
  Phone,
  SunMedium,
  User,
} from "lucide-react";
import api from "../api/axios";
import BrandMark from "../components/branding/BrandMark";
import { useThemeStore } from "../store/useThemeStore";
import { EMAIL_AUTH_ENABLED } from "../lib/authFeatures";

export default function Registro() {
  const navigate = useNavigate();

  const [carreras, setCarreras] = useState([]);
  const [form, setForm] = useState({
    nombre: "",
    numeroControl: "",
    email: "",
    telefono: "",
    password: "",
    confirmar: "",
    carreraId: "",
    semestre: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fotoHorario, setFotoHorario] = useState(null);
  const [fotoPreview, setFotoPreview] = useState("");
  const [horarioDisponible, setHorarioDisponible] = useState({
    loading: false,
    checked: false,
    disponible: false,
    grupo: null,
  });
  const [usarHorarioExistente, setUsarHorarioExistente] = useState(true);
  const dark = useThemeStore((s) => s.isDark);
  const toggleDark = useThemeStore((s) => s.toggle);

  useEffect(() => {
    api.get("/carreras").then((r) => setCarreras(r.data));
  }, []);

  useEffect(() => {
    if (!form.carreraId || !form.semestre) {
      setHorarioDisponible({
        loading: false,
        checked: false,
        disponible: false,
        grupo: null,
      });
      return;
    }
    let cancelled = false;
    setHorarioDisponible((current) => ({
      ...current,
      loading: true,
      checked: false,
    }));
    api
      .get("/horario-importaciones/public/disponible", {
        params: {
          carreraId: form.carreraId,
          semestre: form.semestre,
        },
      })
      .then((response) => {
        if (cancelled) return;
        setHorarioDisponible({
          loading: false,
          checked: true,
          disponible: response.data.disponible,
          grupo: response.data.grupo ?? null,
        });
        setUsarHorarioExistente(response.data.disponible);
      })
      .catch(() => {
        if (cancelled) return;
        setHorarioDisponible({
          loading: false,
          checked: true,
          disponible: false,
          grupo: null,
        });
        setUsarHorarioExistente(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.carreraId, form.semestre]);

  useEffect(() => {
    if (!fotoHorario) {
      setFotoPreview("");
      return;
    }
    const url = URL.createObjectURL(fotoHorario);
    setFotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [fotoHorario]);

  const updateField = (field) => (e) => {
    setForm((current) => ({ ...current, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmar) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (form.password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    const reutilizaraHorario =
      horarioDisponible.disponible && usarHorarioExistente;
    if (!reutilizaraHorario && !fotoHorario) {
      setError("Agrega una fotografía de tu horario para continuar");
      return;
    }

    setLoading(true);
    try {
      const data = new FormData();
      data.append("nombre", form.nombre);
      data.append("numeroControl", form.numeroControl);
      data.append("carreraId", form.carreraId);
      data.append("semestre", form.semestre);
      data.append("password", form.password);
      if (EMAIL_AUTH_ENABLED && form.email) data.append("email", form.email);
      if (form.telefono) data.append("telefono", form.telefono);
      data.append("usarHorarioExistente", String(reutilizaraHorario));
      if (!reutilizaraHorario && fotoHorario) {
        data.append("fotoHorario", fotoHorario);
      }

      const response = await api.post("/auth/register", data);
      navigate("/login", {
        state: {
          registered: true,
          pendingApproval: true,
          emailSent: response.data.emailSent,
          horarioRegistro: response.data.horario,
        },
      });
    } catch (err) {
      setError(err.response?.data?.message ?? "Error al registrarse");
    } finally {
      setLoading(false);
    }
  };

  const labelClass = "block text-sm font-medium text-foreground";
  const inputClass =
    "h-14 w-full rounded-2xl border border-input bg-background px-12 pr-4 text-sm text-foreground outline-none transition-all duration-200 placeholder:text-muted-foreground hover:border-primary/45 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";
  const iconClass =
    "pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary";
  const selectClass = `${inputClass} appearance-none`;

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-background transition-colors duration-300">
      {/* Decorative ambient blobs */}
      <div className="pointer-events-none absolute left-[-8rem] top-[-6rem] h-72 w-72 rounded-full bg-primary/10 blur-3xl sm:left-8 sm:top-8 sm:h-[28rem] sm:w-[28rem]" />
      <div className="pointer-events-none absolute bottom-[-7rem] right-[-5rem] h-72 w-72 rounded-full bg-primary/5 blur-3xl sm:bottom-8 sm:right-8 sm:h-96 sm:w-96" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl sm:h-[34rem] sm:w-[34rem]" />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <button
          type="button"
          onClick={toggleDark}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
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

      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl items-center gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)] lg:gap-14 lg:px-8">
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
              <p className="max-w-lg text-lg leading-8 text-muted-foreground">
                Regístrate como alumno para consultar tus horarios, materias,
                asistencias y tareas
              </p>
            </div>
          </div>
        </section>

        <section className="w-full">
          <div className="mx-auto max-w-3xl lg:max-w-none">
            <div className="mb-8 text-center lg:hidden">
              <div className="mb-4 inline-flex items-center gap-3">
                <BrandMark className="h-14 w-14 shrink-0 object-contain" />
                <div className="text-left">
                  <h1 className="text-3xl font-bold tracking-tight text-foreground">
                    SICAT
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Registro de alumnos
                  </p>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[32px] border border-border bg-card shadow-lg">
              <div className="relative p-6 sm:p-8 lg:p-10">
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <h1 className="text-2xl font-semibold text-foreground">
                      Crear cuenta
                    </h1>
                  </div>
                  <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                    * Campos obligatorios
                  </span>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <label htmlFor="nombre" className={labelClass}>
                        Nombre completo *
                      </label>
                      <div className="group relative">
                        <User className={iconClass} />
                        <input
                          id="nombre"
                          required
                          maxLength={120}
                          autoComplete="name"
                          value={form.nombre}
                          onChange={updateField("nombre")}
                          placeholder="Juan Pérez García"
                          className={inputClass}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="numeroControl" className={labelClass}>
                        Número de control *
                      </label>
                      <div className="group relative">
                        <Hash className={iconClass} />
                        <input
                          id="numeroControl"
                          required
                          maxLength={8}
                          pattern="\d{3}[A-Za-z]\d{4}"
                          value={form.numeroControl}
                          onChange={updateField("numeroControl")}
                          placeholder="225Q0103"
                          className={inputClass}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="semestre" className={labelClass}>
                        Semestre *
                      </label>
                      <div className="group relative">
                        <Layers3 className={iconClass} />
                        <select
                          id="semestre"
                          required
                          value={form.semestre}
                          onChange={updateField("semestre")}
                          className={selectClass}
                        >
                          <option value="">Selecciona</option>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((s) => (
                            <option key={s} value={s}>
                              {s}°
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <label htmlFor="carreraId" className={labelClass}>
                        Carrera *
                      </label>
                      <div className="group relative">
                        <BookOpen className={iconClass} />
                        <select
                          id="carreraId"
                          required
                          value={form.carreraId}
                          onChange={updateField("carreraId")}
                          className={selectClass}
                        >
                          <option value="">Selecciona una carrera</option>
                          {carreras.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nombre}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </div>

                    {EMAIL_AUTH_ENABLED && (
                      <div className="space-y-2">
                        <label htmlFor="email" className={labelClass}>
                          Correo electrónico *
                        </label>
                        <div className="group relative">
                          <Mail className={iconClass} />
                          <input
                            id="email"
                            type="email"
                            required
                            maxLength={254}
                            autoComplete="email"
                            value={form.email}
                            onChange={updateField("email")}
                            placeholder="juan@ejemplo.com"
                            className={inputClass}
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label htmlFor="telefono" className={labelClass}>
                        Teléfono
                      </label>
                      <div className="group relative">
                        <Phone className={iconClass} />
                        <input
                          id="telefono"
                          type="tel"
                          autoComplete="tel"
                          maxLength={20}
                          value={form.telefono}
                          onChange={updateField("telefono")}
                          placeholder="6441234567"
                          className={inputClass}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="password" className={labelClass}>
                        Contraseña *
                      </label>
                      <div className="group relative">
                        <Lock className={iconClass} />
                        <input
                          id="password"
                          required
                          minLength={8}
                          maxLength={72}
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          value={form.password}
                          onChange={updateField("password")}
                          placeholder="Mínimo 8 caracteres"
                          className={`${inputClass} pr-12`}
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
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="confirmar" className={labelClass}>
                        Confirmar contraseña *
                      </label>
                      <div className="group relative">
                        <Lock className={iconClass} />
                        <input
                          id="confirmar"
                          required
                          minLength={8}
                          maxLength={72}
                          type={showConfirm ? "text" : "password"}
                          autoComplete="new-password"
                          value={form.confirmar}
                          onChange={updateField("confirmar")}
                          placeholder="Repite tu contraseña"
                          className={`${inputClass} pr-12`}
                        />
                        <button
                          type="button"
                          aria-label={
                            showConfirm
                              ? "Ocultar confirmación"
                              : "Mostrar confirmación"
                          }
                          onClick={() => setShowConfirm((value) => !value)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-primary focus:outline-none"
                        >
                          {showConfirm ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <fieldset className="space-y-4 border-t border-border pt-6">
                    <legend className="px-2 text-base font-semibold text-foreground">
                      Horario académico
                    </legend>

                    {horarioDisponible.loading && (
                      <div
                        className="h-20 animate-pulse rounded-2xl bg-muted"
                        aria-label="Buscando horario del grupo"
                      />
                    )}

                    {!horarioDisponible.loading &&
                      horarioDisponible.disponible &&
                      usarHorarioExistente && (
                        <div className="flex flex-col gap-4 rounded-2xl border border-success/25 bg-success/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-start gap-3">
                            <CheckCircle2
                              className="mt-0.5 h-5 w-5 shrink-0 text-success"
                              aria-hidden="true"
                            />
                            <div>
                              <p className="font-medium text-foreground">
                                Horario encontrado para{" "}
                                {horarioDisponible.grupo?.nombre}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {horarioDisponible.grupo?.materias?.length ?? 0}{" "}
                                materias, periodo{" "}
                                {horarioDisponible.grupo?.periodo}. Se asignará
                                al confirmar tu registro.
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setUsarHorarioExistente(false)}
                            className="shrink-0 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/35 focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                          >
                            No es mi horario
                          </button>
                        </div>
                      )}

                    {(!horarioDisponible.disponible ||
                      !usarHorarioExistente) && (
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            Fotografía del horario *
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Procura que se vean las claves, docentes, días y
                            horas. Podrás corregirlo durante la revisión.
                          </p>
                        </div>
                        <label
                          htmlFor="fotoHorario"
                          className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-dashed border-input bg-background p-4 text-center transition-colors hover:border-primary/45 focus-within:ring-3 focus-within:ring-ring/40"
                        >
                          {fotoPreview ? (
                            <img
                              src={fotoPreview}
                              alt="Vista previa del horario seleccionado"
                              className="max-h-48 w-full rounded-xl object-contain"
                            />
                          ) : (
                            <Camera
                              className="h-7 w-7 text-primary"
                              aria-hidden="true"
                            />
                          )}
                          <span className="text-sm font-medium text-foreground">
                            {fotoHorario
                              ? fotoHorario.name
                              : "Tomar o seleccionar fotografía"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            JPG, PNG o WebP, máximo 8 MB
                          </span>
                          <input
                            id="fotoHorario"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            capture="environment"
                            className="sr-only"
                            onChange={(event) =>
                              setFotoHorario(event.target.files?.[0] ?? null)
                            }
                          />
                        </label>
                        {horarioDisponible.disponible &&
                          !usarHorarioExistente && (
                            <button
                              type="button"
                              onClick={() => {
                                setUsarHorarioExistente(true);
                                setFotoHorario(null);
                              }}
                              className="text-sm font-medium text-primary hover:underline focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                            >
                              Usar el horario encontrado
                            </button>
                          )}
                      </div>
                    )}
                  </fieldset>

                  <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4">
                    <div className="flex items-start gap-3">
                      <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <div className="space-y-1 text-sm">
                        <p className="text-foreground">
                          Usa tu{" "}
                          <span className="font-semibold">
                            número de control
                          </span>{" "}
                          y selecciona correctamente carrera y semestre para
                          ligar tu perfil académico.
                        </p>
                      </div>
                    </div>
                  </div>

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
                      {loading ? "Registrando..." : "Crear cuenta"}
                    </span>
                  </button>
                </form>

                <div className="mt-6 space-y-3 text-center">
                  <p className="text-sm text-muted-foreground">
                    ¿Ya tienes cuenta?{" "}
                    <Link
                      to="/login"
                      className="font-medium text-primary transition-colors hover:text-primary-strong hover:underline"
                    >
                      Inicia sesión
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

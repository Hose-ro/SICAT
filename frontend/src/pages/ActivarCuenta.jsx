import { Button } from '@/components/ui/button'
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import AuthPageShell from "../components/auth/AuthPageShell";
import { useAuthStore } from "../store/authStore";

const CAMPO =
  "h-12 w-full rounded-lg border border-input bg-background px-4 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

function mensajeError(error, fallback) {
  const message = error?.response?.data?.message;
  return Array.isArray(message) ? message.join(". ") : message || fallback;
}

/**
 * Primer acceso del alumno: la escuela ya creó su perfil y le dio un código.
 * Con su número de control y ese código elige su contraseña. También sirve
 * para recuperar la cuenta con un código nuevo.
 */
export default function ActivarCuenta() {
  const [form, setForm] = useState({
    numeroControl: "",
    codigo: "",
    password: "",
    confirmacion: "",
  });
  const [error, setError] = useState("");
  const [activada, setActivada] = useState(false);
  const [loading, setLoading] = useState(false);
  const setUser = useAuthStore((state) => state.setUser);
  const navigate = useNavigate();

  const cambiar = (campo) => (event) =>
    setForm((actual) => ({ ...actual, [campo]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirmacion) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    try {
      const numeroControl = form.numeroControl.trim().toUpperCase();
      await api.post("/auth/activar", {
        numeroControl,
        codigo: form.codigo.trim(),
        password: form.password,
      });
      // Ya con su contraseña, entra directo a su inicio.
      try {
        const res = await api.post("/auth/login", {
          identifier: numeroControl,
          password: form.password,
        });
        setUser(res.data.user);
        navigate("/dashboard", { replace: true });
      } catch {
        setActivada(true);
      }
    } catch (requestError) {
      setError(mensajeError(requestError, "No se pudo activar la cuenta"));
    } finally {
      setLoading(false);
    }
  };

  if (activada) {
    return (
      <AuthPageShell title="Cuenta activada">
        <div className="space-y-5">
          <p
            aria-live="polite"
            className="rounded-lg bg-success/10 p-4 text-sm text-success-foreground"
          >
            Tu cuenta está lista. Inicia sesión con tu número de control y la
            contraseña que elegiste.
          </p>
          <Link
            to="/login"
            className="inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            Iniciar sesión
          </Link>
        </div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      title="Activar mi cuenta"
      subtitle="Tu escuela ya creó tu perfil. Escribe tu número de control y el código de activación que te entregaron, y elige tu contraseña."
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="numero-control" className="text-sm font-medium text-foreground">
            Número de control
          </label>
          <input
            id="numero-control"
            required
            maxLength={30}
            autoComplete="username"
            autoCapitalize="characters"
            value={form.numeroControl}
            onChange={cambiar("numeroControl")}
            placeholder="225Q0103"
            className={`${CAMPO} uppercase placeholder:normal-case`}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="codigo" className="text-sm font-medium text-foreground">
            Código de activación
          </label>
          <input
            id="codigo"
            required
            minLength={8}
            maxLength={12}
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            value={form.codigo}
            onChange={cambiar("codigo")}
            placeholder="K7P2-M9QX"
            aria-describedby="codigo-ayuda"
            className={`${CAMPO} font-mono tracking-widest uppercase`}
          />
          <p id="codigo-ayuda" className="text-xs text-muted-foreground">
            Si no lo tienes o ya no funciona, pídelo en servicios escolares o a tu tutor.
          </p>
        </div>
        <div className="space-y-2">
          <label htmlFor="new-password" className="text-sm font-medium text-foreground">
            Nueva contraseña
          </label>
          <input
            id="new-password"
            type="password"
            required
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            value={form.password}
            onChange={cambiar("password")}
            aria-describedby="password-ayuda"
            className={CAMPO}
          />
          <p id="password-ayuda" className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
        </div>
        <div className="space-y-2">
          <label htmlFor="password-confirmation" className="text-sm font-medium text-foreground">
            Confirmar contraseña
          </label>
          <input
            id="password-confirmation"
            type="password"
            required
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            value={form.confirmacion}
            onChange={cambiar("confirmacion")}
            className={CAMPO}
          />
        </div>
        {error && (
          <div role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive-foreground">
            {error}
          </div>
        )}
        <Button
          variant="default"
          type="submit"
          disabled={loading}
          className="h-12 w-full px-4 text-sm font-semibold disabled:opacity-60"
        >
          {loading ? "Activando..." : "Activar mi cuenta"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          ¿Ya activaste tu cuenta?{" "}
          <Link to="/login" className="font-medium text-primary-ink hover:underline">
            Inicia sesión
          </Link>
        </p>
      </form>
    </AuthPageShell>
  );
}

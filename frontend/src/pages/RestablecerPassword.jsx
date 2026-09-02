import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import AuthPageShell from "../components/auth/AuthPageShell";

export default function RestablecerPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(
    token ? "" : "El enlace no contiene un token válido",
  );
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!token) {
      setError("El enlace no contiene un token válido");
      return;
    }
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    try {
      const response = await api.post("/auth/reset-password", {
        token,
        newPassword: password,
      });
      setMessage(response.data.message);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ??
          "No se pudo restablecer la contraseña",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell title="Nueva contraseña">
      {message ? (
        <div className="space-y-5">
          <div
            aria-live="polite"
            className="rounded-lg bg-success/10 p-4 text-sm text-success"
          >
            {message}
          </div>
          <Link
            to="/login"
            className="inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            Iniciar sesión
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="new-password"
              className="text-sm font-medium text-foreground"
            >
              Nueva contraseña
            </label>
            <input
              id="new-password"
              type="password"
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 w-full rounded-lg border border-input bg-background px-4 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="password-confirmation"
              className="text-sm font-medium text-foreground"
            >
              Confirmar contraseña
            </label>
            <input
              id="password-confirmation"
              type="password"
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="h-12 w-full rounded-lg border border-input bg-background px-4 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {error && (
            <div
              role="alert"
              className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !token}
            className="h-12 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {loading ? "Guardando..." : "Guardar contraseña"}
          </button>
        </form>
      )}
    </AuthPageShell>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import AuthPageShell from "../components/auth/AuthPageShell";

export default function ReenviarVerificacion() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const response = await api.post("/auth/request-email-verification", {
        email,
      });
      setResult(response.data);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ??
          "No se pudo procesar la solicitud",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell
      title="Reenviar verificación"
      subtitle="Ingresa el correo utilizado durante tu registro."
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="verification-email"
            className="text-sm font-medium text-foreground"
          >
            Correo electrónico
          </label>
          <input
            id="verification-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="correo@ejemplo.com"
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
        {result && (
          <div
            aria-live="polite"
            className="rounded-lg bg-success/10 p-3 text-sm text-success"
          >
            <p>{result.message}</p>
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="h-12 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {loading ? "Enviando..." : "Enviar enlace"}
        </button>
      </form>
      <Link
        to="/login"
        className="mt-5 inline-block text-sm text-primary hover:underline"
      >
        Volver al inicio de sesión
      </Link>
    </AuthPageShell>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import AuthPageShell from "../components/auth/AuthPageShell";

export default function VerificarCorreo() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState(() => ({
    loading: Boolean(token),
    error: token ? "" : "El enlace no contiene un token válido.",
    message: "",
  }));
  const processed = useRef(false);

  useEffect(() => {
    if (!token || processed.current) return;
    processed.current = true;
    api
      .post("/auth/verify-email", { token })
      .then((response) =>
        setStatus({
          loading: false,
          error: "",
          message: response.data.message,
        }),
      )
      .catch((error) =>
        setStatus({
          loading: false,
          error:
            error.response?.data?.message ?? "No se pudo verificar el correo",
          message: "",
        }),
      );
  }, [token]);

  return (
    <AuthPageShell title="Verificar correo">
      {status.loading && (
        <p className="text-sm text-muted-foreground">Validando enlace...</p>
      )}
      {status.message && (
        <div
          aria-live="polite"
          className="rounded-lg border border-success/25 bg-success/10 p-4 text-sm text-success"
        >
          {status.message}
        </div>
      )}
      {status.error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {status.error}
        </div>
      )}
      <div className="mt-6 flex gap-4 text-sm">
        <Link to="/login" className="font-medium text-primary hover:underline">
          Ir al inicio de sesión
        </Link>
        {status.error && (
          <Link
            to="/reenviar-verificacion"
            className="text-muted-foreground hover:text-foreground"
          >
            Reenviar enlace
          </Link>
        )}
      </div>
    </AuthPageShell>
  );
}

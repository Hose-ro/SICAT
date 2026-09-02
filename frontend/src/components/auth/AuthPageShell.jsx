import { Link } from "react-router-dom";
import BrandMark from "../branding/BrandMark";

export default function AuthPageShell({ title, subtitle, children }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div className="mb-7 flex items-center gap-3">
          <BrandMark className="h-12 w-12 shrink-0 object-contain" />
          <div>
            <Link to="/login" className="text-lg font-bold text-foreground">
              SICAT
            </Link>
            <p className="text-xs text-muted-foreground">
              Acceso institucional
            </p>
          </div>
        </div>
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        {subtitle && (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {subtitle}
          </p>
        )}
        <div className="mt-6">{children}</div>
      </section>
    </main>
  );
}

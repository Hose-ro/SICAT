# SICAT frontend — cierre del audit `/impeccable` (19 hallazgos)

Rama: `codex/sicat-frontend-audit`. Trabajo iniciado por Codex (fases 1–6 y parte de 7) y cerrado en esta sesión (verificación, regresiones detectadas por las pruebas y pendientes de móvil/estructura).

## 1. Tabla de hallazgos

| # | Sev. | Hallazgo | Estado | Evidencia |
|---|------|----------|--------|-----------|
| 1 | P0 | `text-warning-foreground` invisible en dark (1.47:1) | Corregido | Token `.dark --warning-foreground: oklch(0.92 0.05 75)` + `--warning-on-fill`; `dark:text-warning` parches: 0. `audit/contrast.json`: warning/10–20 dark ≥ 6.1:1 |
| 2 | P0 | 72/169 controles sin nombre accesible | Corregido | 168 controles auditados: todos con `id/htmlFor`, `aria-label` o `<label>` envolvente. `jsx-a11y` (`flatConfigs.recommended` + `label-has-associated-control` depth 3) en `eslint.config.js`; lint = 0. axe wcag2a/aa/21aa = 0 violaciones en 76 rutas×tema×ancho |
| 3 | P1 | Primario y enlaces fallan AA en light (3.65/3.60) | Corregido | `--primary: oklch(0.56 0.19 264)`, `--primary-ink` para texto. Medido renderizado: botón primario 4.68:1, primary/10–20 con `primary-ink` 5.5–6.3:1 |
| 4 | P1 | success/destructive sobre su tinte < 4.5 | Corregido | `--success 0.50`, foregrounds separados (`*-foreground` para tinte, `*-on-fill` para relleno). Medido light: success/10 ≥ 5.5, destructive/10 ≥ 6.4, fills 4.62–5.5 |
| 5 | P1 | 7 modales sin focus trap/Escape/`role=dialog` | Corregido | `Modal.jsx` sobre `@base-ui/react` Dialog (`aria-modal` explícito), 23 consumidores; `fixed inset-0` a mano: 0 (solo `sheet.jsx`, sin uso). Pruebas: foco inicial, contención (8 Tabs), Escape, retorno de foco, diálogo anidado |
| 6 | P1 | 16 `alert()/confirm()` | Corregido | `confirmAction()` + `FeedbackDialogs` + `useAsyncAction`; `no-restricted-globals` alert/confirm en ESLint. Grep: 0. Pruebas unitarias: cancelar/Escape no ejecutan; confirmar ejecuta 1 vez; doble clic bloqueado. "Finalizar clase" explica "sin captura quedarán como falta" (e2e) |
| 7 | P1 | 909 kB JS inicial, sin code splitting | Corregido (objetivo orientativo no alcanzado) | `React.lazy` por ruta + `RouteBoundary` (Suspense + error de módulo con "Volver a cargar"). Ver §3 |
| 8 | P1 | Áreas táctiles 24–32 px | Corregido | `@media (max-width:767px),(pointer:coarse)`: botones/inputs `min-height/min-width: 44px` (cajas reales, sin pseudo-áreas). e2e mide `icon-xs` ≥ 44×44 a 390 px |
| 9 | P2 | 1,679 utilidades de paleta + 209 `!important` | Corregido | Utilidades `*-slate/gray/blue/red-…`: 0. `index.css` 2,272 → 283 líneas; `!important` 209 → 2 (print, reduced-motion); reglas `.dark` compensatorias 409 → 0 |
| 10 | P2 | 32 clases sin override dark | Corregido | Mismo barrido: 0 clases de paleta fija |
| 11 | P2 | Tres vocabularios de botón | Corregido | `.btn-*` uiverse: 0; `bg-slate-900`: 0; `<Button>` 267 usos vs `<button>` 2 (rail de `ui/sidebar.jsx` sin uso, `TarjetaMateria` celda de cuadrícula) |
| 12 | P2 | 9 transiciones de layout | Corregido | `transition` en CSS solo `transform/opacity`; sidebar móvil por `translateX`; `transition-all` en JSX: 0; `prefers-reduced-motion` respetado |
| 13 | P2 | Sin `<h1>` en 49 páginas, sin skip link | Corregido | `PageHeader` emite `h1` (prop `level`); 76 rutas con exactamente 1 `h1` en `main`; `h3` huérfanos → `h2` (10 archivos); "Saltar al contenido" → `#contenido-principal` (e2e) |
| 14 | P2 | `text-*-400` a 3.3:1 en dark | Corregido | 0 usos; `muted-foreground` dark mide ≥ 5.3:1 |
| 15 | P3 | Dos librerías de iconos | Corregido | `react-icons`: 0 archivos; solo `lucide-react` |
| 16 | P3 | Orbes `blur-3xl` en Login/Registro | Corregido | 0 usos |
| 17 | P3 | `App.css` muerto | Corregido | Eliminado; sin importaciones |
| 18 | P3 | `ring-blue-500` y `focus:` vs `focus-visible:` | Corregido | `ring-blue-500`: 0; `focus:ring`: 0; `focus-visible:ring`: 307 |
| 19 | P3 | `AttendanceBadge` sin tokens | Corregido | Usa `success/warning/destructive` (+ `*-foreground`) |

## 2. Cambios de esta sesión (sobre el trabajo de Codex)

- **Capa base de CSS (causa raíz):** `button, input… { font: inherit }` y `:where(input…) { color; background }` estaban fuera de `@layer`, por lo que ganaban a *todas* las utilidades Tailwind: ningún `text-sm`/`font-medium`/`bg-*` aplicaba a botones e inputs (todo renderizaba 16 px/400). Movidas a `@layer base` (`src/index.css`).
- Foco visible donde se quitó el outline sin anillo: inputs de `Calificaciones.jsx`, toggles de contraseña en `Login.jsx`/`Registro.jsx`.
- Texto con `opacity-70/80` (contraste 4.05–4.07) en `Calificaciones`, `Tareas`, `TabHorario`, `TablaAsistenciasAlumno`.
- `HorariosPage`: `<main>` anidado → `<section aria-label>`.
- 15 regiones desplazables (tablas/cuadrículas) con `tabIndex={0} role="region" aria-label` (axe `scrollable-region-focusable`); regla `no-noninteractive-tabindex` configurada para `region`.
- Desbordamiento horizontal a 390 px en `/materias/:id` (`min-w-0` en tarjetas) y `/docente/tareas/crear` (`w-full min-w-0` en controles, input de archivo).
- **Pasar lista en móvil:** filas apiladas (nombre + control + pastillas de estado en fila), `aria-pressed` y `role=group` por alumno (`AsistenciaSesionPanel.jsx`).
- Jerarquía de encabezados: `h3` → `h2` en 10 archivos; `h4` → `h3` en modal de `Usuarios`.
- `RouteBoundary` usa `<Button>` compartido.
- Pruebas: fixtures corregidos (`grupo` en `mis-horarios-alumno`, ruta real `/horarios/validar-conflicto`), `reducedMotion` global + espera de 2 rAF antes de medir, barrido de 76 rutas (`tests/e2e/rutas.spec.js`), exportación Excel/PDF (blob del backend), importación de Excel real (`alumnos-ejemplo.xlsx`, carga diferida de `xlsx`), medición de carga inicial por rol.
- `.gitignore`: `test-results/`, `playwright-report/`.

Archivos principales del trabajo completo: `src/index.css`, `src/components/{Modal,FeedbackDialogs,RouteBoundary,PageHeader,AttendanceBadge}.jsx`, `src/lib/feedback.js`, `src/hooks/useAsyncAction.js`, `src/components/ui/button*.js(x)`, `src/App.jsx`, `src/components/layout/BaseLayout.jsx`, `eslint.config.js`, `tests/**`, `playwright.config.js`, `vitest.config.js`, `vite.audit.config.js`, `scripts/serve-audit.mjs`.

## 3. Carga inicial (build de producción, `vite build`)

| Medición | Antes (baseline) | Después |
|----------|------------------|---------|
| Chunk de entrada | `index-K2okgRfO.js` 908,947 B / 241,231 B gzip | `index-*.js` 339,272 B / 112,023 B gzip |
| CSS | 160.35 kB / 27.90 kB gzip | 102.88 kB / 17.57 kB gzip |
| JS inicial completo — ALUMNO `/alumno/horario` | 908,947 B (todo en un chunk) | 439,658 B / 148,524 B gzip (23 scripts) |
| JS inicial completo — DOCENTE `/asistencias` | 908,947 B | 491,706 B / 160,796 B gzip |
| JS inicial completo — ADMIN `/dashboard` | 908,947 B | 441,684 B / 148,159 B gzip |

- Verificado en producción que una ruta de alumno **no** descarga `Usuarios/HorariosPage/AulasPage/GrupoDetalle/AcademiaDetalle/Dashboard` (e2e). `xlsx` (429 kB) y `jspdf` (386 kB) siguen bajo `import()` dinámico.
- **Objetivo orientativo (< 350 kB) no alcanzado.** Composición del chunk de entrada por sourcemap: `react-dom` 182 kB, `axios` 49 kB, `react-router` 38 kB, `tailwind-merge` 27 kB, `react` 8 kB, app ≈ 25 kB. El piso del framework por sí solo supera 230 kB; bajar de 350 kB en la carga completa exigiría sustituir `axios` por `fetch` (contratos API/interceptores) y quitar `tailwind-merge`, fuera del alcance acordado. Los chunks compartidos `Modal` (59 kB, base-ui + tabbable) y `BaseLayout` (21 kB) se cargan en toda ruta autenticada.

## 4. Verificaciones

| Comprobación | Resultado |
|--------------|-----------|
| `npm run lint` | 0 errores / 0 avisos (baseline: 19 / 9) |
| `npm test` (vitest) | 3/3: cancelar/Escape, confirmar una vez + bloqueo, aprobaciones concurrentes |
| `npm run build` | OK, sin aviso de chunk > 500 kB |
| `npm run test:e2e` (Playwright, Chromium) | 93/93 — login (light/dark × 390/1440 + axe), modal (foco/Tab/Escape/retorno/anidado), contraste renderizado (`audit/contrast.json`: light mín 4.62:1, dark mín 6.1:1), áreas táctiles, formulario de horarios (ids únicos, días independientes, POST con `bloques`), finalizar clase (cancelar → 0 llamadas; doble clic → 1), pasar lista (contrato `{claseSesionId, registros}` con faltas implícitas), exportaciones Excel/PDF, importación de Excel real, alumno móvil (menú como diálogo, detalle, PDF), roles/URL directa/skip link, producción sin chunks admin, fallo de módulo con recuperación, **barrido de 76 rutas × tema × ancho** con axe (`audit/rutas-axe.json`): 0 violaciones, 0 overflow, 1 `h1`, 0 errores JS |
| Revisión visual | Capturas en `audit/screens/` (10 vistas × light 1366 / dark 390) y `audit/login-*.png` |

### Limitaciones
- Todo el e2e corre contra una **API simulada** (`tests/e2e/fixtures.js`) con formas tomadas del backend; no se probó con credenciales reales ni base de datos (no se conocían credenciales). Flujos no verificados contra el backend real: login con cuenta real, importación de horarios (`/admin/horarios-importados`), envío de tareas del alumno, notificaciones en vivo.
- Solo Chromium (Playwright). Sin lector de pantalla real; la navegación por teclado se verificó con Playwright (Tab/Escape/Enter) y semántica axe.
- `/impeccable audit` no se ejecutó (requiere sesión interactiva); esta tabla y los JSON de `audit/` son la comprobación equivalente, sin puntuación inventada.

## 5. Pendientes
- Decidir si se versiona `frontend/audit/` (evidencia) — hoy está sin seguimiento.
- Componentes shadcn sin uso en `src/components/ui/` (`sidebar`, `sheet`, `dropdown-menu`, `tooltip`, `breadcrumb`, `avatar`, `skeleton`, `card`, `separator`, `input`): no entran al bundle; se pueden borrar en una limpieza aparte.
- Reducir más la carga inicial exige cambiar dependencias (axios → fetch, tailwind-merge); no se hizo por riesgo de contrato.
- `backend/create-admin.js` y `backend/reset-admin-password.js` aparecen sin seguimiento y fuera del alcance frontend; no se tocaron.

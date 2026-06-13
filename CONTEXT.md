# SICAT — Remediación impeccable (9/20 → objetivo 17+/20)

## Stack
React + Tailwind + shadcn/ui + Zustand (frontend), NestJS + Prisma + PostgreSQL (backend).
Deploy: sicatapp.com (Cloudflare + Render + Neon).

## Raíz del problema (orden de ataque)
1. Theming es la causa raíz → tokens primero.
2. Glass es el idioma de diseño, no un acento → demoter, no borrar.
3. A11y es bimodal: el modal de contraseña y Login son el patrón a propagar.

## Reglas de trabajo
- Una rama por ola, un commit por bloque lógico, commits convencionales.
- Checkpoint explícito al final de cada ola: parar y reportar antes de seguir.
- NO inventar colores inline: todo color nuevo sale de un token semántico.
- Plantillas de referencia: button.jsx, card.jsx (estados); BaseLayout.jsx modal contraseña (a11y).

## Decisiones de diseño (Ola 0)
- **Creative North Star:** "The Registrar's Ledger" — precisión institucional, superficies sólidas con neutrales tintados, el azul de marca como acento raro (<10%), planas y silenciosas. Sirve directamente a la democión del glass.
- **Tema por defecto:** follow-system (`prefers-color-scheme`), luego honra el toggle del usuario.
- **El azul de marca conserva su identidad en dark** (se corrige el bug donde `--primary` se desaturaba a slate `#485265`).
- **Tokens canónicos en OKLCH**, neutrales tintados hacia el hue de marca 264. Fuente de verdad única: `frontend/src/index.css` + `DESIGN.md`.

## Realidad medida del código (vs. estimaciones del audit)
- 21 literales `#fff`/`#000`; 188 literales hex totales en `index.css`.
- 20 `backdrop-filter` (glass).
- `font-family: "Inter"` declarada 6× pero solo `@fontsource-variable/geist` está importado → Inter nunca carga.
- 0 guards `prefers-reduced-motion`.
- ~1,790 utilidades de paleta hardcodeadas en JSX (el audit decía 487; subestimado ~4×).
  Archivos más cargados: Asistencias.jsx (207), Tareas.jsx (151), docente/TareaDetalle.jsx (106), Usuarios.jsx (99).

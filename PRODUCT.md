---
name: SICAT
description: Sistema de Control de Asistencias y Tareas para una institución educativa.
register: product
---

# Product: SICAT

<!-- impeccable:product-schema 1 -->

## Platform

web

Responsive web app, installable as a PWA (`frontend/public/manifest.webmanifest`, `sw.js`). Mobile web, not native.

## Users
Four roles in an educational institution (`Rol` enum: ADMIN, JEFE_CARRERA, DOCENTE, ALUMNO):
- **Admin / coordinación**: manages carreras, materias, grupos, aulas, academias, horarios, the calendario escolar and usuarios. A power user who works in dense data tables and does frequent CRUD.
- **Jefe de carrera**: oversees one carrera. Reviews alerts (clase no iniciada, asistencia sin captura, materia sin docente/horario, unidad atrasada, alumno en riesgo), follows up on docentes, checks clases/horarios and downloads reports. *Inferred from code (`pages/jefe-carrera/`, `TipoAlertaCarrera`); not yet confirmed.*
- **Docente**: takes attendance (pasar lista), assigns and grades tareas, captures calificaciones, and reviews solicitudes (inscripciones). Works in class, often on a phone or tablet, sometimes in a hurry.
- **Alumno**: checks their attendance record, horario, inscripciones and tareas. Mostly on mobile; glances rather than reads.

## Product Purpose
A system of record for attendance and coursework. Correctness, legibility and speed of data entry matter more than spectacle. People come here to log a fact (present/absent/late, task submitted/graded) and leave. The interface should get out of the way.

## Operating Context
- **Status: prototype.** It is live at sicatapp.com (Cloudflare + Render + Neon), but the product is still being shaped; don't claim institutional adoption, user counts or results.
- Spanish-language UI throughout, using the institution's own terms: carrera, materia, grupo, unidad, retícula, academia, inscripción, pasar lista, solicitud.
- Two group modalities: **Escolarizado** (Monday to Friday) and **Mixto** (Saturdays only, with its own semester calendar). The UI always says "Mixto", never "sabatino".
- Class rosters come only from accepted inscripciones (`Inscripcion` ACEPTADA).
- The calendario escolar supports suspensions: institution-wide ones and ones for a single class.

## Capabilities and Constraints
- Attendance capture and history, tareas (create, submit, grade), calificaciones by unidad, inscripciones with an accept/reject flow, horarios (including horario imports), notifications, and downloadable reports.
- Reports and student lists show the student's sexo (HOMBRE / MUJER).
- Excel roster import (see `alumnos-ejemplo*.xlsx`).
- Stack: React 19 + Vite + Tailwind 4 + shadcn/ui + Zustand (frontend); NestJS + Prisma + PostgreSQL (backend).
- **Open:** whether SICAT serves one campus only or is meant for several institutions, which decides how swappable the branding must be.

## Brand & Tone
Calm, exact, trustworthy. Institutional but not cold. Spanish-language UI. The brand color is a clear blue used sparingly as a signal, not a wash.

## Brand Commitments
- Name: SICAT (Sistema de Control de Asistencias y Tareas).
- Institution logo asset: `frontend/src/logoTec/logotec.png` (with `logotec-master.png`). Which Tecnológico it represents is not recorded.

## Evidence on Hand
- Sample roster spreadsheets: `alumnos-ejemplo.xlsx`, `alumnos-ejemplo-completo.xlsx`.
- There are no testimonials, usage metrics or institutional endorsements. Don't invent any.

## Strategic Principles
- **Legibility over decoration.** People use this tool under time pressure (taking attendance mid-class). Text contrast and tap targets win over visual flourish.
- **One source of truth for color.** Every color comes from a semantic token. No inline hex, no ad-hoc palette utilities.
- **Status is semantic.** Attendance and task states (present / absent / late / justified, pending / graded) map to dedicated success / warning / destructive tokens, never to raw greens and reds picked per component.

## Accessibility & Inclusion
- Color is never the only signal; status always carries a text label.
- Every input has an accessible name; no `alert()`/`confirm()` for destructive actions.
- Icon-only touch targets are at least 44×44px on mobile.
- No formal WCAG conformance level has been committed to (open).

## Anti-references (what SICAT must NOT feel like)
- **Glassmorphism as the default.** Frosted blur on every panel. Glass is used on at most one intentional surface (the login card), never as the house style.
- **The "school app → blue gradient mesh" cliché.** Multi-radial-gradient backgrounds competing with content.
- **Decorative AI-slop dashboards.** Hero-metric templates, identical card grids, side-stripe accent borders, gradient text.
- **Inaccessible native dialogs.** `alert()`/`confirm()` for destructive actions; unlabeled inputs.

---
name: SICAT
description: Sistema de Control de Asistencias y Tareas para una institución educativa.
register: product
---

# Product: SICAT

## Users
Three roles in an educational institution:
- **Admin / coordinación** — manages carreras, materias, grupos, horarios, usuarios. Power user, dense data tables, frequent CRUD.
- **Docente** — takes attendance (pasar lista), assigns and grades tareas, reviews solicitudes. Used in-class, often on a phone or tablet, sometimes in a hurry.
- **Alumno** — checks their attendance record, inscripciones, and tareas. Mostly mobile, glances rather than reads.

## Product Purpose
A system of record for attendance and coursework. Correctness, legibility, and speed of data entry matter more than spectacle. People come here to log a fact (present/absent/late, task submitted/graded) and leave. The interface should get out of the way.

## Brand & Tone
Calm, exact, trustworthy. Institutional but not cold. Spanish-language UI. The brand color is a clear blue used sparingly as a signal, not a wash.

## Strategic Principles
- **Legibility over decoration.** This is a tool people use under time pressure (taking attendance mid-class). Text contrast and tap targets win over visual flourish.
- **One source of truth for color.** Every color comes from a semantic token. No inline hex, no ad-hoc palette utilities.
- **Status is semantic.** Attendance and task states (present / absent / late / justified, pending / graded) map to dedicated success / warning / destructive tokens, never raw greens and reds picked per-component.

## Anti-references (what SICAT must NOT feel like)
- **Glassmorphism-as-default.** Frosted blur on every panel. Glass is at most one intentional surface (the login card), never the idiom.
- **The "school app → blue gradient mesh" cliché.** Multi-radial-gradient backgrounds competing with content.
- **Decorative AI-slop dashboards.** Hero-metric templates, identical card grids, side-stripe accent borders, gradient text.
- **Inaccessible native dialogs.** `alert()`/`confirm()` for destructive actions; unlabeled inputs.

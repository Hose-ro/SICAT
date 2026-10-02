---
version: 1
slug: "frontend-src-pages-tareas-jsx"
primary_target: "frontend/src/pages/Tareas.jsx"
related_targets: ["frontend/src/pages/docente/TareaDetalle.jsx"]
---

# Tareas del docente

**Mode:** Operate. Desktop first; phone for presential registration in class.

**Audience and job:** a teacher with 3–5 materias of 25–40 students each. They plan tasks per unidad, publish them, grade deliveries one after another and close each unidad. What they need to see is how much is left to grade, who has not delivered and what blocks closing the unidad.

**Scope:** `/tareas` for DOCENTE/ADMIN (the unidad spine) and `/docente/tareas/:id` (the review session). The alumno module, the create/edit form and MateriaDetalle's tab stay as they are.

**Constraints:** use only existing `/tareas` endpoints, plus `POST /tareas/:id/recordatorio`. Grades go from 1 to 100 (backend DTO). No undo where the API has no inverse: undo is only offered for cerrar↔reabrir. Keep the capabilities the old screens had: reports, per-task export, zip of evidence, bulk review, presential registration and search.

**Chosen direction:** "Por unidad", picked by the user from three working prototypes on 2026-09-29.

**Memorable moment:** after the last pending delivery is graded, a check draws itself and a completion panel offers to remind the missing students or close the task.

**Open:** multi-group materias use a group selector under the tabs, a pattern not validated with real data.

## Direction contract

THESIS: the materia is a sequence of unidades and every task lives where it happens. The page refuses the category default of a dashboard with metric cards over a filtered card list; the question it answers is "what is left in this unidad".

OWN-WORLD: The Registrar's Ledger. Tinted paper surfaces with hairline borders and no shadows at rest. Geist only. Registrar Blue is used only for the one primary action ("Nueva tarea" / "Calificar y seguir"). Status uses success, warning and destructive tokens, always with a text label. Each task has a roster strip with one 6×16px cell per student, and a thin timeline rail links the unidad cards.

STORY: the teacher opens Tareas, sees in one sentence how many deliveries are waiting, picks a materia tab and reads the unidades top to bottom: finished ones collapsed, the active one open with its readiness line, future ones holding drafts. "Calificar N" opens a session with one delivery at a time. Enter saves and jumps to the next pending delivery, and the teacher returns to the unidad to close it.

FIRST VIEWPORT: the h1 "Tareas" with a one-line pending summary on the left and Reporte plus Nueva tarea on the right. Below it, materia tabs with amber pending counts, the materia name with group, modality and roster size, then the unidad spine. The active unidad card sits above the fold with its task rows (title, plazo, roster strip, one action) and the readiness footer "Antes de cerrar: …" with "Cerrar unidad".

FORM: unidad spine plus a focused review session. It was candidate 4 of 7 on my ranked list (seed key 3b0a492b); the other structures were a gradebook matrix, a roll-call list, a review inbox, a deadline calendar, a student portfolio and a state board.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

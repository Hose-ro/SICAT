-- Ponderación tareas/asistencia por materia. Antes viajaba como parámetro en
-- cada consulta y dos reportes podían calcular notas distintas.

ALTER TABLE "Materia"
  ADD COLUMN "pesoTareas" INTEGER NOT NULL DEFAULT 80,
  ADD COLUMN "pesoAsistencia" INTEGER NOT NULL DEFAULT 20;

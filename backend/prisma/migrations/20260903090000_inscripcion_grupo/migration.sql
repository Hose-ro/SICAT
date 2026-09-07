-- La inscripción guarda a qué grupo se agregó al alumno. Sin este dato, cuando
-- una misma materia se imparte a dos grupos es imposible saber a qué lista
-- pertenece un alumno inscrito a mano por su docente.

ALTER TABLE "Inscripcion" ADD COLUMN IF NOT EXISTS "grupoId" INTEGER;

ALTER TABLE "Inscripcion"
  DROP CONSTRAINT IF EXISTS "Inscripcion_grupoId_fkey";

ALTER TABLE "Inscripcion"
  ADD CONSTRAINT "Inscripcion_grupoId_fkey"
  FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Inscripcion_materiaId_grupoId_estado_idx"
  ON "Inscripcion" ("materiaId", "grupoId", "estado");

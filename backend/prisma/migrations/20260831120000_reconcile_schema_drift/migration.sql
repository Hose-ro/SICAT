-- Remove the legacy uniqueness rule that ignored the academic period.
-- The current schema keeps the period-aware constraint
-- Inscripcion_alumnoId_materiaId_periodo_key.
DROP INDEX "Inscripcion_alumnoId_materiaId_key";

-- Prisma manages @updatedAt values in application code. These database
-- defaults were left behind by the original hand-written migration.
ALTER TABLE "Asistencia" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "EntregaTarea" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Grupo" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Inscripcion"
  ALTER COLUMN "periodo" DROP DEFAULT,
  ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Tarea" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Match Prisma's implicit many-to-many relation representation.
ALTER TABLE "_GrupoMateria"
  ADD CONSTRAINT "_GrupoMateria_AB_pkey" PRIMARY KEY ("A", "B");
DROP INDEX "_GrupoMateria_AB_unique";

-- aulaId is nullable, so deleting an Aula should clear the optional relation.
ALTER TABLE "HorarioMateria"
  DROP CONSTRAINT "HorarioMateria_aulaId_fkey";
ALTER TABLE "HorarioMateria"
  ADD CONSTRAINT "HorarioMateria_aulaId_fkey"
  FOREIGN KEY ("aulaId") REFERENCES "Aula"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

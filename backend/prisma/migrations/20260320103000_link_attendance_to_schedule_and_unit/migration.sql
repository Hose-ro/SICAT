-- ================================================
-- Migration: link-attendance-to-schedule-and-unit
-- ================================================

-- Extend ClaseSesion to reference the programmed schedule, group and active unit
ALTER TABLE "ClaseSesion"
  ADD COLUMN "horarioMateriaId" INTEGER,
  ADD COLUMN "grupoId" INTEGER,
  ADD COLUMN "unidadId" INTEGER,
  ADD COLUMN "semanaClave" TEXT,
  ADD COLUMN "fueFueraDeHorario" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "notificacionEnviada" BOOLEAN NOT NULL DEFAULT false;

UPDATE "ClaseSesion"
SET "semanaClave" = TO_CHAR(DATE_TRUNC('week', "fecha"), 'YYYY-MM-DD')
WHERE "semanaClave" IS NULL;

ALTER TABLE "ClaseSesion"
  ALTER COLUMN "semanaClave" SET NOT NULL;

ALTER TABLE "ClaseSesion"
  ADD CONSTRAINT "ClaseSesion_horarioMateriaId_fkey"
    FOREIGN KEY ("horarioMateriaId") REFERENCES "HorarioMateria"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ClaseSesion_grupoId_fkey"
    FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ClaseSesion_unidadId_fkey"
    FOREIGN KEY ("unidadId") REFERENCES "Unidad"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ClaseSesion_docenteId_fecha_idx" ON "ClaseSesion"("docenteId", "fecha");
CREATE INDEX "ClaseSesion_horarioMateriaId_fecha_idx" ON "ClaseSesion"("horarioMateriaId", "fecha");
CREATE INDEX "ClaseSesion_materiaId_grupoId_fecha_idx" ON "ClaseSesion"("materiaId", "grupoId", "fecha");
CREATE INDEX "ClaseSesion_semanaClave_idx" ON "ClaseSesion"("semanaClave");

-- Extend Asistencia for historical edits and comments
ALTER TABLE "Asistencia"
  ADD COLUMN "observacion" TEXT,
  ADD COLUMN "editadaPorId" INTEGER;

ALTER TABLE "Asistencia"
  ADD CONSTRAINT "Asistencia_editadaPorId_fkey"
    FOREIGN KEY ("editadaPorId") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Asistencia_editadaPorId_idx" ON "Asistencia"("editadaPorId");

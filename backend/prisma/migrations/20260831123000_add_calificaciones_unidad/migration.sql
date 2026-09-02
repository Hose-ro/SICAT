CREATE TABLE "CalificacionUnidad" (
  "id" SERIAL NOT NULL,
  "alumnoId" INTEGER NOT NULL,
  "materiaId" INTEGER NOT NULL,
  "grupoId" INTEGER,
  "unidadId" INTEGER NOT NULL,
  "periodo" TEXT NOT NULL,
  "calificacionManual" DOUBLE PRECISION,
  "observacion" TEXT,
  "docenteId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CalificacionUnidad_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CalificacionUnidad_alumnoId_materiaId_unidadId_periodo_key"
  ON "CalificacionUnidad"("alumnoId", "materiaId", "unidadId", "periodo");

CREATE INDEX "CalificacionUnidad_materiaId_grupoId_unidadId_periodo_idx"
  ON "CalificacionUnidad"("materiaId", "grupoId", "unidadId", "periodo");

CREATE INDEX "CalificacionUnidad_docenteId_idx"
  ON "CalificacionUnidad"("docenteId");

ALTER TABLE "CalificacionUnidad"
  ADD CONSTRAINT "CalificacionUnidad_alumnoId_fkey"
  FOREIGN KEY ("alumnoId") REFERENCES "Usuario"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CalificacionUnidad"
  ADD CONSTRAINT "CalificacionUnidad_materiaId_fkey"
  FOREIGN KEY ("materiaId") REFERENCES "Materia"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CalificacionUnidad"
  ADD CONSTRAINT "CalificacionUnidad_grupoId_fkey"
  FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CalificacionUnidad"
  ADD CONSTRAINT "CalificacionUnidad_unidadId_fkey"
  FOREIGN KEY ("unidadId") REFERENCES "Unidad"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CalificacionUnidad"
  ADD CONSTRAINT "CalificacionUnidad_docenteId_fkey"
  FOREIGN KEY ("docenteId") REFERENCES "Usuario"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

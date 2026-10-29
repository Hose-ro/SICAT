-- Segunda oportunidad (TecNM) por alumno y unidad.
ALTER TABLE "CalificacionUnidad" ADD COLUMN     "calificacionSegunda" DOUBLE PRECISION,
ADD COLUMN     "segundaNoPresento" BOOLEAN NOT NULL DEFAULT false;

-- Curso cerrado: foto de la calificación final por materia, grupo y periodo.
CREATE TABLE "CierreCurso" (
    "id" SERIAL NOT NULL,
    "materiaId" INTEGER NOT NULL,
    "grupoId" INTEGER NOT NULL,
    "periodo" TEXT NOT NULL,
    "docenteId" INTEGER,
    "cerradoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concentrado" JSONB NOT NULL,

    CONSTRAINT "CierreCurso_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CierreCurso_materiaId_grupoId_periodo_key" ON "CierreCurso"("materiaId", "grupoId", "periodo");

ALTER TABLE "CierreCurso" ADD CONSTRAINT "CierreCurso_materiaId_fkey" FOREIGN KEY ("materiaId") REFERENCES "Materia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CierreCurso" ADD CONSTRAINT "CierreCurso_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

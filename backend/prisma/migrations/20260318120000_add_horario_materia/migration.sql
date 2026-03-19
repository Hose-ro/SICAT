-- CreateTable
CREATE TABLE "HorarioMateria" (
    "id" SERIAL NOT NULL,
    "materiaId" INTEGER NOT NULL,
    "docenteId" INTEGER NOT NULL,
    "aulaId" INTEGER,
    "grupoId" INTEGER,
    "dias" TEXT NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    "semestre" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HorarioMateria_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Materia" ALTER COLUMN "horaInicio" SET DEFAULT '',
ALTER COLUMN "horaFin" SET DEFAULT '',
ALTER COLUMN "dias" SET DEFAULT '';

-- CreateIndex
CREATE INDEX "HorarioMateria_materiaId_activo_idx" ON "HorarioMateria"("materiaId", "activo");
CREATE INDEX "HorarioMateria_docenteId_activo_idx" ON "HorarioMateria"("docenteId", "activo");
CREATE INDEX "HorarioMateria_aulaId_activo_idx" ON "HorarioMateria"("aulaId", "activo");
CREATE INDEX "HorarioMateria_grupoId_activo_idx" ON "HorarioMateria"("grupoId", "activo");

-- AddForeignKey
ALTER TABLE "HorarioMateria" ADD CONSTRAINT "HorarioMateria_materiaId_fkey" FOREIGN KEY ("materiaId") REFERENCES "Materia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HorarioMateria" ADD CONSTRAINT "HorarioMateria_docenteId_fkey" FOREIGN KEY ("docenteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HorarioMateria" ADD CONSTRAINT "HorarioMateria_aulaId_fkey" FOREIGN KEY ("aulaId") REFERENCES "Aula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HorarioMateria" ADD CONSTRAINT "HorarioMateria_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill complete legacy schedules into HorarioMateria.
INSERT INTO "HorarioMateria" (
    "materiaId",
    "docenteId",
    "aulaId",
    "dias",
    "horaInicio",
    "horaFin",
    "semestre",
    "activo",
    "createdAt",
    "updatedAt"
)
SELECT
    m."id",
    m."docenteId",
    m."aulaId",
    m."dias",
    m."horaInicio",
    m."horaFin",
    m."semestre",
    true,
    COALESCE(m."createdAt", CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP
FROM "Materia" m
WHERE m."docenteId" IS NOT NULL
  AND COALESCE(TRIM(m."dias"), '') <> ''
  AND COALESCE(TRIM(m."horaInicio"), '') <> ''
  AND COALESCE(TRIM(m."horaFin"), '') <> ''
  AND NOT (m."horaInicio" = '00:00' AND m."horaFin" = '00:00');

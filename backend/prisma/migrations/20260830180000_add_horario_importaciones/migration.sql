-- CreateEnum
CREATE TYPE "EstadoImportacionHorario" AS ENUM (
  'PENDIENTE_PROCESAMIENTO',
  'PENDIENTE_REVISION',
  'APROBADA',
  'RECHAZADA',
  'ERROR'
);

-- AlterEnum
ALTER TYPE "TipoNotificacion" ADD VALUE IF NOT EXISTS 'HORARIO_IMPORTADO';
ALTER TYPE "TipoNotificacion" ADD VALUE IF NOT EXISTS 'HORARIO_APROBADO';
ALTER TYPE "TipoNotificacion" ADD VALUE IF NOT EXISTS 'HORARIO_RECHAZADO';

-- CreateTable
CREATE TABLE "ImportacionHorario" (
  "id" SERIAL NOT NULL,
  "alumnoId" INTEGER NOT NULL,
  "carreraId" INTEGER NOT NULL,
  "grupoId" INTEGER,
  "revisorId" INTEGER,
  "periodo" TEXT NOT NULL,
  "semestre" INTEGER NOT NULL,
  "seccion" TEXT NOT NULL,
  "estado" "EstadoImportacionHorario" NOT NULL DEFAULT 'PENDIENTE_PROCESAMIENTO',
  "imagenRuta" TEXT,
  "imagenNombre" TEXT,
  "imagenMime" TEXT,
  "confianzaGeneral" DOUBLE PRECISION,
  "datosDetectados" JSONB,
  "errorProcesamiento" TEXT,
  "observaciones" TEXT,
  "revisadoAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ImportacionHorario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BloqueImportacionHorario" (
  "id" SERIAL NOT NULL,
  "importacionId" INTEGER NOT NULL,
  "reticulaMateriaId" INTEGER,
  "docenteId" INTEGER,
  "claveDetectada" TEXT,
  "materiaDetectada" TEXT NOT NULL,
  "docenteDetectado" TEXT,
  "aulaDetectada" TEXT,
  "dia" TEXT NOT NULL,
  "horaInicio" TEXT NOT NULL,
  "horaFin" TEXT NOT NULL,
  "confianzaMateria" DOUBLE PRECISION,
  "confianzaDocente" DOUBLE PRECISION,
  "orden" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BloqueImportacionHorario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportacionHorario_estado_createdAt_idx" ON "ImportacionHorario"("estado", "createdAt");
CREATE INDEX "ImportacionHorario_alumnoId_periodo_idx" ON "ImportacionHorario"("alumnoId", "periodo");
CREATE INDEX "ImportacionHorario_carreraId_periodo_semestre_seccion_idx" ON "ImportacionHorario"("carreraId", "periodo", "semestre", "seccion");
CREATE INDEX "BloqueImportacionHorario_importacionId_orden_idx" ON "BloqueImportacionHorario"("importacionId", "orden");
CREATE INDEX "BloqueImportacionHorario_reticulaMateriaId_idx" ON "BloqueImportacionHorario"("reticulaMateriaId");
CREATE INDEX "BloqueImportacionHorario_docenteId_idx" ON "BloqueImportacionHorario"("docenteId");

-- AddForeignKey
ALTER TABLE "ImportacionHorario" ADD CONSTRAINT "ImportacionHorario_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportacionHorario" ADD CONSTRAINT "ImportacionHorario_carreraId_fkey" FOREIGN KEY ("carreraId") REFERENCES "Carrera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportacionHorario" ADD CONSTRAINT "ImportacionHorario_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ImportacionHorario" ADD CONSTRAINT "ImportacionHorario_revisorId_fkey" FOREIGN KEY ("revisorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BloqueImportacionHorario" ADD CONSTRAINT "BloqueImportacionHorario_importacionId_fkey" FOREIGN KEY ("importacionId") REFERENCES "ImportacionHorario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BloqueImportacionHorario" ADD CONSTRAINT "BloqueImportacionHorario_reticulaMateriaId_fkey" FOREIGN KEY ("reticulaMateriaId") REFERENCES "ReticulaMateria"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BloqueImportacionHorario" ADD CONSTRAINT "BloqueImportacionHorario_docenteId_fkey" FOREIGN KEY ("docenteId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

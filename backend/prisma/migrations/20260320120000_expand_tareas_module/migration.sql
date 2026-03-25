ALTER TYPE "TipoEntrega" ADD VALUE IF NOT EXISTS 'REVISION_EN_LINEA';
ALTER TYPE "EstadoRevision" ADD VALUE IF NOT EXISTS 'ENTREGADA';
ALTER TYPE "EstadoRevision" ADD VALUE IF NOT EXISTS 'NO_ENTREGADA';

CREATE TYPE "EstadoTarea" AS ENUM ('BORRADOR', 'PUBLICADA', 'VENCIDA', 'CERRADA');
CREATE TYPE "TipoEvaluacion" AS ENUM ('DIRECTA', 'RUBRICA');
CREATE TYPE "TipoCalificacion" AS ENUM ('NUMERICA', 'FIRMA', 'REVISADO');

ALTER TABLE "Tarea"
  ADD COLUMN "grupoId" INTEGER,
  ADD COLUMN "unidadId" INTEGER,
  ADD COLUMN "tipoEvaluacion" "TipoEvaluacion" NOT NULL DEFAULT 'DIRECTA',
  ADD COLUMN "permiteReenvio" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "tieneFechaLimite" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "horaLimite" TEXT,
  ADD COLUMN "estado" "EstadoTarea" NOT NULL DEFAULT 'BORRADOR',
  ADD COLUMN "rubricJson" TEXT;

ALTER TABLE "Tarea"
  ALTER COLUMN "unidad" DROP NOT NULL,
  ALTER COLUMN "fechaPublicacion" DROP NOT NULL,
  ALTER COLUMN "fechaPublicacion" DROP DEFAULT,
  ALTER COLUMN "fechaLimite" DROP NOT NULL;

ALTER TABLE "EntregaTarea"
  ADD COLUMN "calificacionTipo" "TipoCalificacion",
  ADD COLUMN "fueTardia" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "permiteCorreccion" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "versionEntrega" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "TareaArchivo" (
  "id" SERIAL NOT NULL,
  "tareaId" INTEGER NOT NULL,
  "nombre" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "tipoArchivo" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TareaArchivo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EntregaArchivo" (
  "id" SERIAL NOT NULL,
  "entregaId" INTEGER NOT NULL,
  "nombre" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "tipoArchivo" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EntregaArchivo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Tarea_docenteId_estado_idx" ON "Tarea"("docenteId", "estado");
CREATE INDEX "Tarea_materiaId_grupoId_unidadId_idx" ON "Tarea"("materiaId", "grupoId", "unidadId");
CREATE INDEX "EntregaTarea_tareaId_estadoRevision_idx" ON "EntregaTarea"("tareaId", "estadoRevision");
CREATE INDEX "EntregaTarea_alumnoId_estadoRevision_idx" ON "EntregaTarea"("alumnoId", "estadoRevision");
CREATE INDEX "TareaArchivo_tareaId_idx" ON "TareaArchivo"("tareaId");
CREATE INDEX "EntregaArchivo_entregaId_idx" ON "EntregaArchivo"("entregaId");

UPDATE "Tarea"
SET
  "estado" = CASE WHEN "activa" THEN 'PUBLICADA'::"EstadoTarea" ELSE 'CERRADA'::"EstadoTarea" END,
  "horaLimite" = CASE WHEN "fechaLimite" IS NOT NULL THEN TO_CHAR("fechaLimite", 'HH24:MI') ELSE NULL END,
  "unidadId" = "Unidad"."id"
FROM "Unidad"
WHERE "Unidad"."materiaId" = "Tarea"."materiaId"
  AND "Unidad"."orden" = "Tarea"."unidad";

UPDATE "EntregaTarea"
SET "estadoRevision" = 'ENTREGADA'
WHERE "estadoRevision" = 'PENDIENTE';

UPDATE "EntregaTarea"
SET "calificacionTipo" = 'NUMERICA'
WHERE "calificacion" IS NOT NULL;

ALTER TABLE "Tarea"
  ADD CONSTRAINT "Tarea_grupoId_fkey"
  FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Tarea"
  ADD CONSTRAINT "Tarea_unidadId_fkey"
  FOREIGN KEY ("unidadId") REFERENCES "Unidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TareaArchivo"
  ADD CONSTRAINT "TareaArchivo_tareaId_fkey"
  FOREIGN KEY ("tareaId") REFERENCES "Tarea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EntregaArchivo"
  ADD CONSTRAINT "EntregaArchivo_entregaId_fkey"
  FOREIGN KEY ("entregaId") REFERENCES "EntregaTarea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

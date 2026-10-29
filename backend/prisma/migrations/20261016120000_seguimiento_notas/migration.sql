-- Seguimientos de jefatura con historial de notas.
ALTER TYPE "TipoAlertaCarrera" ADD VALUE IF NOT EXISTS 'CALIFICACIONES_PENDIENTES';
ALTER TYPE "TipoAlertaCarrera" ADD VALUE IF NOT EXISTS 'SEGUIMIENTO_DOCENTE';

ALTER TABLE "AlertaCarrera" ADD COLUMN "periodo" TEXT;
-- Las alertas anteriores se asignan al periodo en que se crearon.
UPDATE "AlertaCarrera"
SET "periodo" = EXTRACT(YEAR FROM "createdAt")::INT::TEXT
  || CASE WHEN EXTRACT(MONTH FROM "createdAt") <= 6 THEN '-A' ELSE '-B' END
WHERE "periodo" IS NULL;
CREATE INDEX "AlertaCarrera_carreraId_periodo_estado_idx" ON "AlertaCarrera"("carreraId", "periodo", "estado");

CREATE TABLE "SeguimientoNota" (
  "id" SERIAL NOT NULL,
  "alertaId" INTEGER NOT NULL,
  "autorId" INTEGER,
  "texto" VARCHAR(2000) NOT NULL,
  "estado" "EstadoAlertaCarrera" NOT NULL,
  "fechaRevision" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeguimientoNota_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SeguimientoNota_alertaId_fkey" FOREIGN KEY ("alertaId") REFERENCES "AlertaCarrera"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SeguimientoNota_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "SeguimientoNota_alertaId_createdAt_idx" ON "SeguimientoNota"("alertaId", "createdAt");
CREATE INDEX "SeguimientoNota_autorId_idx" ON "SeguimientoNota"("autorId");

-- La observación única de cada alerta pasa a ser la primera nota del historial.
INSERT INTO "SeguimientoNota" ("alertaId", "autorId", "texto", "estado", "fechaRevision", "createdAt")
SELECT "id", NULL, LEFT(btrim("observacion"), 2000), "estado", "fechaSeguimiento", "updatedAt"
FROM "AlertaCarrera"
WHERE "observacion" IS NOT NULL AND btrim("observacion") <> '';

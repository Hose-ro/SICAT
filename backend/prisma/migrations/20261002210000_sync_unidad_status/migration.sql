-- Corrige unidades creadas antes de que la edición de fechas sincronizara el
-- estado. Las fechas son la fuente de verdad: una unidad cerrada está
-- finalizada; una iniciada sin cierre está activa; el resto sigue pendiente.
UPDATE "Unidad"
SET "status" = CASE
  WHEN "fechaFin" IS NOT NULL THEN 'FINALIZADA'::"EstadoUnidad"
  WHEN "fechaInicio" IS NOT NULL THEN 'ACTIVA'::"EstadoUnidad"
  ELSE 'PENDIENTE'::"EstadoUnidad"
END
WHERE "status" IS DISTINCT FROM CASE
  WHEN "fechaFin" IS NOT NULL THEN 'FINALIZADA'::"EstadoUnidad"
  WHEN "fechaInicio" IS NOT NULL THEN 'ACTIVA'::"EstadoUnidad"
  ELSE 'PENDIENTE'::"EstadoUnidad"
END;

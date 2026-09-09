-- El docente puede capturar asistencias atrasadas: sesiones que se crean
-- después de que la clase ocurrió, para las fechas de su horario que quedaron
-- sin pase de lista mientras la unidad ya estaba iniciada. Se marcan para
-- distinguirlas de las sesiones que sí se abrieron en el momento de la clase.

ALTER TABLE "ClaseSesion"
  ADD COLUMN IF NOT EXISTS "registroAtrasado" BOOLEAN NOT NULL DEFAULT false;

-- Adds the reminder notification type sent to a docente 5-10 minutes before
-- one of their scheduled classes starts.
ALTER TYPE "TipoNotificacion" ADD VALUE IF NOT EXISTS 'CLASE_POR_INICIAR';

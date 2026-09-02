-- Registra la eliminación permanente de una cuenta desde el panel de administración.
ALTER TYPE "TipoEventoAuth" ADD VALUE IF NOT EXISTS 'CUENTA_ELIMINADA';

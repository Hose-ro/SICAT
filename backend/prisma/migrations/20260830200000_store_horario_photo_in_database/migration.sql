-- Las fotografías pendientes se conservan en PostgreSQL para no depender del
-- sistema de archivos efímero del servidor. Se borran al aprobar o rechazar.
ALTER TABLE "ImportacionHorario" ADD COLUMN "imagenContenido" BYTEA;

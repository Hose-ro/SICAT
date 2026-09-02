ALTER TYPE "Rol" ADD VALUE IF NOT EXISTS 'JEFE_CARRERA';

CREATE TYPE "TipoAlertaCarrera" AS ENUM (
  'CLASE_NO_INICIADA',
  'ASISTENCIA_SIN_CAPTURA',
  'MATERIA_SIN_DOCENTE',
  'MATERIA_SIN_HORARIO',
  'UNIDAD_ATRASADA',
  'ALUMNO_RIESGO'
);

CREATE TYPE "EstadoAlertaCarrera" AS ENUM (
  'NUEVA',
  'REVISADA',
  'EN_SEGUIMIENTO',
  'CERRADA'
);

CREATE TABLE "JefeCarreraAsignacion" (
  "id" SERIAL NOT NULL,
  "usuarioId" INTEGER NOT NULL,
  "carreraId" INTEGER NOT NULL,
  "activa" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JefeCarreraAsignacion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AlertaCarrera" (
  "id" SERIAL NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "tipo" "TipoAlertaCarrera" NOT NULL,
  "titulo" TEXT NOT NULL,
  "mensaje" TEXT NOT NULL,
  "referenciaId" INTEGER,
  "referenciaTipo" TEXT,
  "estado" "EstadoAlertaCarrera" NOT NULL DEFAULT 'NUEVA',
  "observacion" TEXT,
  "fechaSeguimiento" TIMESTAMP(3),
  "carreraId" INTEGER NOT NULL,
  "responsableId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AlertaCarrera_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JefeCarreraAsignacion_usuarioId_carreraId_key"
ON "JefeCarreraAsignacion"("usuarioId", "carreraId");
CREATE INDEX "JefeCarreraAsignacion_carreraId_activa_idx"
ON "JefeCarreraAsignacion"("carreraId", "activa");
CREATE UNIQUE INDEX "AlertaCarrera_fingerprint_key"
ON "AlertaCarrera"("fingerprint");
CREATE INDEX "AlertaCarrera_carreraId_estado_createdAt_idx"
ON "AlertaCarrera"("carreraId", "estado", "createdAt");
CREATE INDEX "AlertaCarrera_responsableId_idx"
ON "AlertaCarrera"("responsableId");

ALTER TABLE "JefeCarreraAsignacion"
ADD CONSTRAINT "JefeCarreraAsignacion_usuarioId_fkey"
FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JefeCarreraAsignacion"
ADD CONSTRAINT "JefeCarreraAsignacion_carreraId_fkey"
FOREIGN KEY ("carreraId") REFERENCES "Carrera"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AlertaCarrera"
ADD CONSTRAINT "AlertaCarrera_carreraId_fkey"
FOREIGN KEY ("carreraId") REFERENCES "Carrera"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AlertaCarrera"
ADD CONSTRAINT "AlertaCarrera_responsableId_fkey"
FOREIGN KEY ("responsableId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

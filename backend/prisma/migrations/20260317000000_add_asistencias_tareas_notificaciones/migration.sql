-- ================================================
-- Migration: add-asistencias-tareas-notificaciones
-- ================================================

-- Step 1: Drop tables that depend on old enums/models
DROP TABLE IF EXISTS "Entrega";
DROP TABLE IF EXISTS "Solicitud";
DROP TABLE IF EXISTS "Asistencia";
DROP TABLE IF EXISTS "Tarea";
DROP TABLE IF EXISTS "Clase";

-- Step 2: Drop old enums no longer needed
DROP TYPE IF EXISTS "EstadoClase";
DROP TYPE IF EXISTS "TipoAsistencia";
DROP TYPE IF EXISTS "EstadoEntrega";
DROP TYPE IF EXISTS "EstadoSolicitud";

-- Step 3: Replace TipoEntrega enum (ONLINE -> EN_LINEA, add FIRMA)
ALTER TYPE "TipoEntrega" RENAME TO "TipoEntrega_old";
CREATE TYPE "TipoEntrega" AS ENUM ('EN_LINEA', 'PRESENCIAL', 'FIRMA');
DROP TYPE "TipoEntrega_old";

-- Step 4: Create new enums
CREATE TYPE "EstadoInscripcion" AS ENUM ('PENDIENTE', 'ACEPTADA', 'RECHAZADA');
CREATE TYPE "EstadoAsistencia" AS ENUM ('ASISTENCIA', 'FALTA', 'RETARDO', 'JUSTIFICADA');
CREATE TYPE "EstadoRevision" AS ENUM ('PENDIENTE', 'REVISADA', 'CALIFICADA', 'INCORRECTA');
CREATE TYPE "TipoNotificacion" AS ENUM (
  'INSCRIPCION_NUEVA',
  'INSCRIPCION_ACEPTADA',
  'INSCRIPCION_RECHAZADA',
  'CLASE_INICIADA',
  'CLASE_FINALIZADA',
  'TAREA_NUEVA',
  'TAREA_REVISADA',
  'TAREA_CALIFICADA',
  'ENTREGA_RECIBIDA'
);

-- Step 5: Modify Notificacion table (tipo: TEXT -> TipoNotificacion enum)
ALTER TABLE "Notificacion" DROP COLUMN "tipo";
ALTER TABLE "Notificacion" ADD COLUMN "tipo" "TipoNotificacion" NOT NULL DEFAULT 'TAREA_NUEVA';
ALTER TABLE "Notificacion" ALTER COLUMN "tipo" DROP DEFAULT;
ALTER TABLE "Notificacion" ADD COLUMN "referenciaId" INTEGER;
ALTER TABLE "Notificacion" ADD COLUMN "referenciaTipo" TEXT;

-- Step 6: Modify Inscripcion table
ALTER TABLE "Inscripcion" DROP CONSTRAINT IF EXISTS "Inscripcion_alumnoId_materiaId_key";
ALTER TABLE "Inscripcion" ADD COLUMN "estado" "EstadoInscripcion" NOT NULL DEFAULT 'PENDIENTE';
ALTER TABLE "Inscripcion" ADD COLUMN "periodo" TEXT NOT NULL DEFAULT '2026-A';
ALTER TABLE "Inscripcion" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Inscripcion" ADD CONSTRAINT "Inscripcion_alumnoId_materiaId_periodo_key" UNIQUE ("alumnoId", "materiaId", "periodo");

-- Drop old FK on Inscripcion.alumnoId (no name on old relation, may be named generically)
ALTER TABLE "Inscripcion" DROP CONSTRAINT IF EXISTS "Inscripcion_alumnoId_fkey";
ALTER TABLE "Inscripcion" ADD CONSTRAINT "Inscripcion_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 7: Create ClaseSesion table
CREATE TABLE "ClaseSesion" (
    "id" SERIAL NOT NULL,
    "materiaId" INTEGER NOT NULL,
    "docenteId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "horaInicio" TIMESTAMP(3) NOT NULL,
    "horaFin" TIMESTAMP(3),
    "unidad" INTEGER NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaseSesion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ClaseSesion" ADD CONSTRAINT "ClaseSesion_materiaId_fkey" FOREIGN KEY ("materiaId") REFERENCES "Materia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClaseSesion" ADD CONSTRAINT "ClaseSesion_docenteId_fkey" FOREIGN KEY ("docenteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 8: Create new Asistencia table
CREATE TABLE "Asistencia" (
    "id" SERIAL NOT NULL,
    "claseSesionId" INTEGER NOT NULL,
    "alumnoId" INTEGER NOT NULL,
    "estado" "EstadoAsistencia" NOT NULL,
    "justificacion" TEXT,
    "archivoJustificacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asistencia_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Asistencia" ADD CONSTRAINT "Asistencia_claseSesionId_alumnoId_key" UNIQUE ("claseSesionId", "alumnoId");
ALTER TABLE "Asistencia" ADD CONSTRAINT "Asistencia_claseSesionId_fkey" FOREIGN KEY ("claseSesionId") REFERENCES "ClaseSesion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Asistencia" ADD CONSTRAINT "Asistencia_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 9: Create new Tarea table
CREATE TABLE "Tarea" (
    "id" SERIAL NOT NULL,
    "materiaId" INTEGER NOT NULL,
    "docenteId" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "instrucciones" TEXT NOT NULL,
    "unidad" INTEGER NOT NULL,
    "tipoEntrega" "TipoEntrega" NOT NULL,
    "fechaPublicacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaLimite" TIMESTAMP(3) NOT NULL,
    "archivosAdjuntos" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tarea_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_materiaId_fkey" FOREIGN KEY ("materiaId") REFERENCES "Materia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_docenteId_fkey" FOREIGN KEY ("docenteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 10: Create EntregaTarea table (replaces old Entrega)
CREATE TABLE "EntregaTarea" (
    "id" SERIAL NOT NULL,
    "tareaId" INTEGER NOT NULL,
    "alumnoId" INTEGER NOT NULL,
    "archivoUrl" TEXT,
    "firmaUrl" TEXT,
    "comentarioAlumno" TEXT,
    "estadoRevision" "EstadoRevision" NOT NULL DEFAULT 'PENDIENTE',
    "calificacion" DOUBLE PRECISION,
    "observacion" TEXT,
    "fechaEntrega" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaRevision" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntregaTarea_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "EntregaTarea" ADD CONSTRAINT "EntregaTarea_tareaId_alumnoId_key" UNIQUE ("tareaId", "alumnoId");
ALTER TABLE "EntregaTarea" ADD CONSTRAINT "EntregaTarea_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "Tarea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EntregaTarea" ADD CONSTRAINT "EntregaTarea_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 11: Create Grupo table
CREATE TABLE "Grupo" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "semestre" INTEGER NOT NULL,
    "seccion" TEXT NOT NULL,
    "carreraId" INTEGER NOT NULL,
    "periodo" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Grupo_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Grupo" ADD CONSTRAINT "Grupo_carreraId_fkey" FOREIGN KEY ("carreraId") REFERENCES "Carrera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Grupo" ADD CONSTRAINT "Grupo_semestre_seccion_carreraId_periodo_key" UNIQUE ("semestre", "seccion", "carreraId", "periodo");

-- Step 12: Add grupoId to Usuario
ALTER TABLE "Usuario" ADD COLUMN "grupoId" INTEGER;
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 13: Create _GrupoMateria join table
CREATE TABLE "_GrupoMateria" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);
ALTER TABLE "_GrupoMateria" ADD CONSTRAINT "_GrupoMateria_A_fkey" FOREIGN KEY ("A") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_GrupoMateria" ADD CONSTRAINT "_GrupoMateria_B_fkey" FOREIGN KEY ("B") REFERENCES "Materia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "_GrupoMateria_AB_unique" ON "_GrupoMateria"("A", "B");
CREATE INDEX "_GrupoMateria_B_index" ON "_GrupoMateria"("B");

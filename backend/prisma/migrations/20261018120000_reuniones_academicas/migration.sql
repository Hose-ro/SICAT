-- Reuniones académicas que convoca la jefatura: orden del día, convocados y acuerdos.
-- CreateEnum
CREATE TYPE "TipoReunion" AS ENUM ('ORDINARIA', 'EXTRAORDINARIA');

-- CreateEnum
CREATE TYPE "ModalidadReunion" AS ENUM ('PRESENCIAL', 'VIRTUAL');

-- CreateEnum
CREATE TYPE "EstadoReunion" AS ENUM ('PROGRAMADA', 'FINALIZADA', 'CANCELADA');

-- AlterEnum
ALTER TYPE "TipoNotificacion" ADD VALUE IF NOT EXISTS 'REUNION_ACADEMICA';

-- CreateTable
CREATE TABLE "ReunionAcademica" (
    "id" SERIAL NOT NULL,
    "carreraId" INTEGER NOT NULL,
    "creadaPorId" INTEGER,
    "titulo" VARCHAR(200) NOT NULL,
    "asunto" VARCHAR(2000),
    "tipo" "TipoReunion" NOT NULL DEFAULT 'ORDINARIA',
    "numeroActa" VARCHAR(50),
    "fecha" VARCHAR(10) NOT NULL,
    "horaInicio" VARCHAR(5) NOT NULL,
    "horaFin" VARCHAR(5),
    "modalidad" "ModalidadReunion" NOT NULL DEFAULT 'PRESENCIAL',
    "lugar" VARCHAR(255),
    "enlace" VARCHAR(255),
    "estado" "EstadoReunion" NOT NULL DEFAULT 'PROGRAMADA',
    "observaciones" VARCHAR(5000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReunionAcademica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReunionPunto" (
    "id" SERIAL NOT NULL,
    "reunionId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "descripcion" VARCHAR(1000) NOT NULL,

    CONSTRAINT "ReunionPunto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReunionConvocado" (
    "reunionId" INTEGER NOT NULL,
    "docenteId" INTEGER NOT NULL,
    "asistio" BOOLEAN,

    CONSTRAINT "ReunionConvocado_pkey" PRIMARY KEY ("reunionId","docenteId")
);

-- CreateTable
CREATE TABLE "ReunionAcuerdo" (
    "id" SERIAL NOT NULL,
    "reunionId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "descripcion" VARCHAR(2000) NOT NULL,
    "responsable" VARCHAR(150),
    "fechaLimite" VARCHAR(10),

    CONSTRAINT "ReunionAcuerdo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReunionAcademica_carreraId_fecha_idx" ON "ReunionAcademica"("carreraId", "fecha");

-- CreateIndex
CREATE INDEX "ReunionPunto_reunionId_orden_idx" ON "ReunionPunto"("reunionId", "orden");

-- CreateIndex
CREATE INDEX "ReunionConvocado_docenteId_idx" ON "ReunionConvocado"("docenteId");

-- CreateIndex
CREATE INDEX "ReunionAcuerdo_reunionId_orden_idx" ON "ReunionAcuerdo"("reunionId", "orden");

-- AddForeignKey
ALTER TABLE "ReunionAcademica" ADD CONSTRAINT "ReunionAcademica_carreraId_fkey" FOREIGN KEY ("carreraId") REFERENCES "Carrera"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReunionAcademica" ADD CONSTRAINT "ReunionAcademica_creadaPorId_fkey" FOREIGN KEY ("creadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReunionPunto" ADD CONSTRAINT "ReunionPunto_reunionId_fkey" FOREIGN KEY ("reunionId") REFERENCES "ReunionAcademica"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReunionConvocado" ADD CONSTRAINT "ReunionConvocado_reunionId_fkey" FOREIGN KEY ("reunionId") REFERENCES "ReunionAcademica"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReunionConvocado" ADD CONSTRAINT "ReunionConvocado_docenteId_fkey" FOREIGN KEY ("docenteId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReunionAcuerdo" ADD CONSTRAINT "ReunionAcuerdo_reunionId_fkey" FOREIGN KEY ("reunionId") REFERENCES "ReunionAcademica"("id") ON DELETE CASCADE ON UPDATE CASCADE;


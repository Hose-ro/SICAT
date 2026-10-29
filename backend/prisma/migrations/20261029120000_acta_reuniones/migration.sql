-- CreateEnum
CREATE TYPE "FormatoDocumentoReunion" AS ENUM ('PDF', 'DOCX');

-- AlterTable
ALTER TABLE "ClaseJustificada" ADD COLUMN     "automatica" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "avisarAlumnos" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ReunionAcademica" ADD COLUMN     "academia" VARCHAR(150),
ADD COLUMN     "apertura" VARCHAR(3000),
ADD COLUMN     "horaCierre" VARCHAR(5),
ADD COLUMN     "presidenteId" INTEGER,
ADD COLUMN     "secretarioId" INTEGER;

-- CreateTable
CREATE TABLE "ReunionSeguimiento" (
    "id" SERIAL NOT NULL,
    "reunionId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "acuerdoOrigenId" INTEGER,
    "descripcion" VARCHAR(2000) NOT NULL,
    "responsable" VARCHAR(150),
    "fechaLimite" VARCHAR(10),
    "avance" VARCHAR(500),

    CONSTRAINT "ReunionSeguimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReunionDocumento" (
    "id" SERIAL NOT NULL,
    "reunionId" INTEGER NOT NULL,
    "formato" "FormatoDocumentoReunion" NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "mime" VARCHAR(120) NOT NULL,
    "tamano" INTEGER NOT NULL,
    "contenido" BYTEA NOT NULL,
    "subidoPorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReunionDocumento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReunionSeguimiento_reunionId_orden_idx" ON "ReunionSeguimiento"("reunionId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "ReunionDocumento_reunionId_formato_key" ON "ReunionDocumento"("reunionId", "formato");

-- AddForeignKey
ALTER TABLE "ReunionAcademica" ADD CONSTRAINT "ReunionAcademica_presidenteId_fkey" FOREIGN KEY ("presidenteId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReunionAcademica" ADD CONSTRAINT "ReunionAcademica_secretarioId_fkey" FOREIGN KEY ("secretarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReunionSeguimiento" ADD CONSTRAINT "ReunionSeguimiento_reunionId_fkey" FOREIGN KEY ("reunionId") REFERENCES "ReunionAcademica"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReunionSeguimiento" ADD CONSTRAINT "ReunionSeguimiento_acuerdoOrigenId_fkey" FOREIGN KEY ("acuerdoOrigenId") REFERENCES "ReunionAcuerdo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReunionDocumento" ADD CONSTRAINT "ReunionDocumento_reunionId_fkey" FOREIGN KEY ("reunionId") REFERENCES "ReunionAcademica"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReunionDocumento" ADD CONSTRAINT "ReunionDocumento_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

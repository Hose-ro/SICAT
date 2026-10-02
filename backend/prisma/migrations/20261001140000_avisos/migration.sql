-- Avisos del docente a un grupo o a un alumno, con su notificación in-app.
-- `suspensionFecha` marca los que se generan al suspender una clase.

-- AlterEnum
ALTER TYPE "TipoNotificacion" ADD VALUE 'AVISO_DOCENTE';

-- CreateTable
CREATE TABLE "Aviso" (
    "id" SERIAL NOT NULL,
    "materiaId" INTEGER NOT NULL,
    "grupoId" INTEGER NOT NULL,
    "alumnoId" INTEGER,
    "docenteId" INTEGER NOT NULL,
    "titulo" VARCHAR(120) NOT NULL,
    "cuerpo" VARCHAR(2000) NOT NULL,
    "fijado" BOOLEAN NOT NULL DEFAULT false,
    "suspensionFecha" VARCHAR(10),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Aviso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Aviso_materiaId_grupoId_createdAt_idx" ON "Aviso"("materiaId", "grupoId", "createdAt");

-- CreateIndex
CREATE INDEX "Aviso_alumnoId_createdAt_idx" ON "Aviso"("alumnoId", "createdAt");

-- CreateIndex
CREATE INDEX "Aviso_docenteId_suspensionFecha_idx" ON "Aviso"("docenteId", "suspensionFecha");

-- AddForeignKey
ALTER TABLE "Aviso" ADD CONSTRAINT "Aviso_materiaId_fkey" FOREIGN KEY ("materiaId") REFERENCES "Materia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aviso" ADD CONSTRAINT "Aviso_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aviso" ADD CONSTRAINT "Aviso_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aviso" ADD CONSTRAINT "Aviso_docenteId_fkey" FOREIGN KEY ("docenteId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;


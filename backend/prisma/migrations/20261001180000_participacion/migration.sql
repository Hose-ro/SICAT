-- Participación por clase capturada desde pasar lista (informativa).

-- CreateTable
CREATE TABLE "Participacion" (
    "id" SERIAL NOT NULL,
    "claseSesionId" INTEGER NOT NULL,
    "alumnoId" INTEGER NOT NULL,
    "docenteId" INTEGER NOT NULL,
    "puntos" INTEGER NOT NULL DEFAULT 0,
    "nota" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Participacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Participacion_alumnoId_idx" ON "Participacion"("alumnoId");

-- CreateIndex
CREATE UNIQUE INDEX "Participacion_claseSesionId_alumnoId_key" ON "Participacion"("claseSesionId", "alumnoId");

-- AddForeignKey
ALTER TABLE "Participacion" ADD CONSTRAINT "Participacion_claseSesionId_fkey" FOREIGN KEY ("claseSesionId") REFERENCES "ClaseSesion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participacion" ADD CONSTRAINT "Participacion_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participacion" ADD CONSTRAINT "Participacion_docenteId_fkey" FOREIGN KEY ("docenteId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;


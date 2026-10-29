-- CreateTable
CREATE TABLE "ClaseJustificada" (
    "id" SERIAL NOT NULL,
    "periodoClave" TEXT NOT NULL,
    "docenteId" INTEGER NOT NULL,
    "horarioId" INTEGER NOT NULL,
    "reunionId" INTEGER NOT NULL,
    "fecha" VARCHAR(10) NOT NULL,
    "motivo" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClaseJustificada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClaseJustificada_docenteId_fecha_idx" ON "ClaseJustificada"("docenteId", "fecha");

-- CreateIndex
CREATE INDEX "ClaseJustificada_reunionId_idx" ON "ClaseJustificada"("reunionId");

-- CreateIndex
CREATE UNIQUE INDEX "ClaseJustificada_horarioId_fecha_key" ON "ClaseJustificada"("horarioId", "fecha");

-- AddForeignKey
ALTER TABLE "ClaseJustificada" ADD CONSTRAINT "ClaseJustificada_docenteId_fkey" FOREIGN KEY ("docenteId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaseJustificada" ADD CONSTRAINT "ClaseJustificada_horarioId_fkey" FOREIGN KEY ("horarioId") REFERENCES "HorarioMateria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaseJustificada" ADD CONSTRAINT "ClaseJustificada_reunionId_fkey" FOREIGN KEY ("reunionId") REFERENCES "ReunionAcademica"("id") ON DELETE CASCADE ON UPDATE CASCADE;


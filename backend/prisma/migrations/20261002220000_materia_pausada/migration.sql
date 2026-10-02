-- Materias que cada docente pausa para apartarlas de su trabajo diario.

-- CreateTable
CREATE TABLE "MateriaPausada" (
    "docenteId" INTEGER NOT NULL,
    "materiaId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MateriaPausada_pkey" PRIMARY KEY ("docenteId","materiaId")
);

-- CreateIndex
CREATE INDEX "MateriaPausada_materiaId_idx" ON "MateriaPausada"("materiaId");

-- AddForeignKey
ALTER TABLE "MateriaPausada" ADD CONSTRAINT "MateriaPausada_docenteId_fkey" FOREIGN KEY ("docenteId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MateriaPausada" ADD CONSTRAINT "MateriaPausada_materiaId_fkey" FOREIGN KEY ("materiaId") REFERENCES "Materia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

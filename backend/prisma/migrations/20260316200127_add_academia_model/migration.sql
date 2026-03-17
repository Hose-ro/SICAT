/*
  Warnings:

  - You are about to drop the column `academia` on the `Usuario` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Usuario" DROP COLUMN "academia";

-- CreateTable
CREATE TABLE "Academia" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Academia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_DocenteAcademia" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_DocenteAcademia_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_MateriaAcademia" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_MateriaAcademia_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Academia_nombre_key" ON "Academia"("nombre");

-- CreateIndex
CREATE INDEX "_DocenteAcademia_B_index" ON "_DocenteAcademia"("B");

-- CreateIndex
CREATE INDEX "_MateriaAcademia_B_index" ON "_MateriaAcademia"("B");

-- AddForeignKey
ALTER TABLE "_DocenteAcademia" ADD CONSTRAINT "_DocenteAcademia_A_fkey" FOREIGN KEY ("A") REFERENCES "Academia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DocenteAcademia" ADD CONSTRAINT "_DocenteAcademia_B_fkey" FOREIGN KEY ("B") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MateriaAcademia" ADD CONSTRAINT "_MateriaAcademia_A_fkey" FOREIGN KEY ("A") REFERENCES "Academia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MateriaAcademia" ADD CONSTRAINT "_MateriaAcademia_B_fkey" FOREIGN KEY ("B") REFERENCES "Materia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

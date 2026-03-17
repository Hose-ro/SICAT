/*
  Warnings:

  - You are about to drop the column `googleId` on the `Usuario` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Usuario_googleId_key";

-- AlterTable
ALTER TABLE "Materia" ADD COLUMN     "carreraId" INTEGER,
ADD COLUMN     "semestre" INTEGER;

-- AlterTable
ALTER TABLE "Usuario" DROP COLUMN "googleId";

-- AddForeignKey
ALTER TABLE "Materia" ADD CONSTRAINT "Materia_carreraId_fkey" FOREIGN KEY ("carreraId") REFERENCES "Carrera"("id") ON DELETE SET NULL ON UPDATE CASCADE;

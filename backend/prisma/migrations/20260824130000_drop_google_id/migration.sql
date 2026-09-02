-- DropIndex
DROP INDEX IF EXISTS "Usuario_googleId_key";

-- AlterTable
ALTER TABLE "Usuario" DROP COLUMN IF EXISTS "googleId";

-- AlterTable: add avatar to Usuario
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "avatar" TEXT;

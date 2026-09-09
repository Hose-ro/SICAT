-- AlterEnum
ALTER TYPE "TipoEventoAuth" ADD VALUE 'SESION_EXPULSADA';

-- CreateTable
CREATE TABLE "Sesion" (
    "id" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "revocadaEn" TIMESTAMP(3),

    CONSTRAINT "Sesion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sesion_usuarioId_revocadaEn_expiraEn_idx" ON "Sesion"("usuarioId", "revocadaEn", "expiraEn");

-- AddForeignKey
ALTER TABLE "Sesion" ADD CONSTRAINT "Sesion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

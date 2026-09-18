CREATE TABLE "SuspensionInstitucional" (
  "id" SERIAL NOT NULL,
  "periodoClave" TEXT NOT NULL,
  "fecha" VARCHAR(10) NOT NULL,
  "motivo" VARCHAR(500) NOT NULL,
  "creadoPorId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SuspensionInstitucional_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SuspensionInstitucional_fecha_key" ON "SuspensionInstitucional"("fecha");
CREATE INDEX "SuspensionInstitucional_periodoClave_fecha_idx" ON "SuspensionInstitucional"("periodoClave", "fecha");
ALTER TABLE "SuspensionInstitucional" ADD CONSTRAINT "SuspensionInstitucional_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

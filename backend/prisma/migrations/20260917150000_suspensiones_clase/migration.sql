CREATE TABLE "SuspensionClase" (
  "id" SERIAL NOT NULL,
  "periodoClave" TEXT NOT NULL,
  "docenteId" INTEGER NOT NULL,
  "fecha" VARCHAR(10) NOT NULL,
  "motivo" VARCHAR(500) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SuspensionClase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SuspensionClase_docenteId_fecha_key" ON "SuspensionClase"("docenteId", "fecha");
CREATE INDEX "SuspensionClase_periodoClave_fecha_idx" ON "SuspensionClase"("periodoClave", "fecha");
ALTER TABLE "SuspensionClase" ADD CONSTRAINT "SuspensionClase_docenteId_fkey" FOREIGN KEY ("docenteId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

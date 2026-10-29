-- Bitácora de clase: nota de la sesión.
ALTER TABLE "ClaseSesion" ADD COLUMN "bitacora" VARCHAR(500);

-- Temario por unidad (compartido por los grupos de la materia).
CREATE TABLE "TemaUnidad" (
    "id" SERIAL NOT NULL,
    "unidadId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "nombre" VARCHAR(300) NOT NULL,
    "semana" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TemaUnidad_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TemaUnidad_unidadId_orden_idx" ON "TemaUnidad"("unidadId", "orden");
ALTER TABLE "TemaUnidad" ADD CONSTRAINT "TemaUnidad_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "Unidad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Temas vistos en cada clase: el avance de un grupo.
CREATE TABLE "TemaVisto" (
    "claseSesionId" INTEGER NOT NULL,
    "temaId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TemaVisto_pkey" PRIMARY KEY ("claseSesionId","temaId")
);
CREATE INDEX "TemaVisto_temaId_idx" ON "TemaVisto"("temaId");
ALTER TABLE "TemaVisto" ADD CONSTRAINT "TemaVisto_claseSesionId_fkey" FOREIGN KEY ("claseSesionId") REFERENCES "ClaseSesion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TemaVisto" ADD CONSTRAINT "TemaVisto_temaId_fkey" FOREIGN KEY ("temaId") REFERENCES "TemaUnidad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

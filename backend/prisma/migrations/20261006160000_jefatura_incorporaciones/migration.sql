ALTER TABLE "Inscripcion" ADD COLUMN "aceptadaAt" TIMESTAMP(3);
CREATE TABLE "IncorporacionJefatura" (
  "id" SERIAL NOT NULL, "inscripcionId" INTEGER NOT NULL, "actorId" INTEGER NOT NULL,
  "motivo" VARCHAR(500) NOT NULL, "estadoAnterior" "EstadoInscripcion",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IncorporacionJefatura_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IncorporacionJefatura_inscripcionId_fkey" FOREIGN KEY ("inscripcionId") REFERENCES "Inscripcion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "IncorporacionJefatura_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "IncorporacionJefatura_inscripcionId_createdAt_idx" ON "IncorporacionJefatura"("inscripcionId", "createdAt");
CREATE INDEX "IncorporacionJefatura_actorId_createdAt_idx" ON "IncorporacionJefatura"("actorId", "createdAt");

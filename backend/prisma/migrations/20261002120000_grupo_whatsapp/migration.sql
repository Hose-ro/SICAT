-- Enlace de invitación del grupo de WhatsApp de cada clase (materia + grupo).

-- CreateTable
CREATE TABLE "GrupoWhatsapp" (
    "materiaId" INTEGER NOT NULL,
    "grupoId" INTEGER NOT NULL,
    "enlace" VARCHAR(200) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrupoWhatsapp_pkey" PRIMARY KEY ("materiaId","grupoId")
);

-- CreateIndex
CREATE INDEX "GrupoWhatsapp_grupoId_idx" ON "GrupoWhatsapp"("grupoId");

-- AddForeignKey
ALTER TABLE "GrupoWhatsapp" ADD CONSTRAINT "GrupoWhatsapp_materiaId_fkey" FOREIGN KEY ("materiaId") REFERENCES "Materia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrupoWhatsapp" ADD CONSTRAINT "GrupoWhatsapp_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

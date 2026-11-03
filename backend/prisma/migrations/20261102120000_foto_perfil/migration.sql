-- CreateTable: foto de perfil re-codificada, una por usuario
CREATE TABLE "FotoPerfil" (
    "usuarioId" INTEGER NOT NULL,
    "mime" VARCHAR(40) NOT NULL,
    "tamano" INTEGER NOT NULL,
    "contenido" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotoPerfil_pkey" PRIMARY KEY ("usuarioId")
);

-- AddForeignKey
ALTER TABLE "FotoPerfil" ADD CONSTRAINT "FotoPerfil_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- La columna avatar nunca se llenó desde la app; se limpia por si quedó algún
-- valor viejo que ahora se tomaría como huella de una foto inexistente.
UPDATE "Usuario" SET "avatar" = NULL WHERE "avatar" IS NOT NULL;

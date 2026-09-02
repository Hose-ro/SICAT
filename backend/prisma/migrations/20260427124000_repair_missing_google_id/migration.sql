ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "googleId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Usuario_googleId_key" ON "Usuario"("googleId");

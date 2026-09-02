CREATE TYPE "TipoTokenAuth" AS ENUM (
  'VERIFICACION_CORREO',
  'RECUPERACION_PASSWORD'
);

CREATE TYPE "TipoEventoAuth" AS ENUM (
  'REGISTRO',
  'LOGIN_EXITOSO',
  'LOGIN_FALLIDO',
  'LOGOUT',
  'CAMBIO_PASSWORD',
  'SOLICITUD_RECUPERACION',
  'PASSWORD_RESTABLECIDA',
  'CORREO_VERIFICADO',
  'CUENTA_APROBADA',
  'CUENTA_DESACTIVADA'
);

ALTER TABLE "Usuario"
  ADD COLUMN "emailVerificadoAt" TIMESTAMP(3),
  ADD COLUMN "registroAprobado" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil" TIMESTAMP(3);

UPDATE "Usuario"
SET "emailVerificadoAt" = CURRENT_TIMESTAMP
WHERE "email" IS NOT NULL;

CREATE TABLE "AuthToken" (
  "id" SERIAL NOT NULL,
  "usuarioId" INTEGER NOT NULL,
  "tipo" "TipoTokenAuth" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthAudit" (
  "id" SERIAL NOT NULL,
  "usuarioId" INTEGER,
  "tipo" "TipoEventoAuth" NOT NULL,
  "identifier" TEXT,
  "ip" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");
CREATE INDEX "AuthToken_usuarioId_tipo_usedAt_idx" ON "AuthToken"("usuarioId", "tipo", "usedAt");
CREATE INDEX "AuthToken_expiresAt_idx" ON "AuthToken"("expiresAt");
CREATE INDEX "AuthAudit_usuarioId_createdAt_idx" ON "AuthAudit"("usuarioId", "createdAt");
CREATE INDEX "AuthAudit_tipo_createdAt_idx" ON "AuthAudit"("tipo", "createdAt");

ALTER TABLE "AuthToken"
  ADD CONSTRAINT "AuthToken_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuthAudit"
  ADD CONSTRAINT "AuthAudit_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

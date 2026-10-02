-- Alumnos cargados por la escuela: activan su cuenta con un código.

-- AlterEnum
ALTER TYPE "TipoTokenAuth" ADD VALUE 'ACTIVACION_CUENTA';

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN "activadoAt" TIMESTAMP(3);

-- Ya eligieron su contraseña: quien no es alumno, quien se registró por su
-- cuenta y quien ya entró o cambió su contraseña alguna vez. Los alumnos
-- importados que nunca entraron quedan pendientes de activar.
UPDATE "Usuario" SET "activadoAt" = "createdAt"
WHERE "rol" <> 'ALUMNO'
   OR "id" IN (
     SELECT DISTINCT "usuarioId" FROM "AuthAudit"
     WHERE "usuarioId" IS NOT NULL
       AND "tipo" IN ('REGISTRO', 'LOGIN_EXITOSO', 'CAMBIO_PASSWORD', 'PASSWORD_RESTABLECIDA')
   );

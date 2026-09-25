-- El docente necesita registrar el sexo del alumno (Hombre/Mujer) para que
-- aparezca en los listados; es opcional porque el padrón existente no lo trae.

CREATE TYPE "Sexo" AS ENUM ('HOMBRE', 'MUJER');

ALTER TABLE "Usuario" ADD COLUMN "sexo" "Sexo";

-- La clave de una materia identifica a la asignatura dentro de su carrera, no en
-- todo el sistema: las claves comunes del TecNM (ACA-0907 Taller de Ética,
-- ACC-0906 Fundamentos de Investigación, ACA-0909/0910 Taller de Investigación)
-- aparecen en el plan de estudios de varias carreras. Con la restricción global
-- anterior, la primera carrera que registraba una clave impedía que el resto
-- pudiera dar de alta esa misma asignatura.

ALTER TABLE "Materia" DROP CONSTRAINT IF EXISTS "Materia_clave_key";
DROP INDEX IF EXISTS "Materia_clave_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Materia_clave_carreraId_key"
  ON "Materia" ("clave", "carreraId");

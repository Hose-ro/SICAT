-- Los alumnos que ya estaban en un grupo no tenían inscripción en las materias
-- que se le imparten, y sin ella no aparecen en la lista de asistencia, en
-- calificaciones ni en tareas. A partir de ahora la inscripción se da de alta
-- al entrar al grupo; esto pone al día lo que ya existía, para el periodo en
-- curso (misma regla que getCurrentAcademicPeriod: enero–junio = A, julio–
-- diciembre = B).
WITH periodo AS (
  SELECT to_char(NOW(), 'YYYY')
    || CASE WHEN EXTRACT(MONTH FROM NOW()) <= 6 THEN '-A' ELSE '-B' END AS clave
),
pares AS (
  SELECT "A" AS grupo_id, "B" AS materia_id FROM "_GrupoMateria"
  UNION
  SELECT "grupoId", "materiaId" FROM "HorarioMateria"
  WHERE activo AND "grupoId" IS NOT NULL
)
INSERT INTO "Inscripcion" ("alumnoId", "materiaId", "grupoId", "estado", "periodo", "createdAt", "updatedAt")
SELECT u.id, p.materia_id, g.id, 'ACEPTADA', periodo.clave, NOW(), NOW()
FROM "Usuario" u
JOIN "Grupo" g ON g.id = u."grupoId" AND g.activo
JOIN pares p ON p.grupo_id = g.id
CROSS JOIN periodo
WHERE u.rol = 'ALUMNO' AND u.activo
ON CONFLICT ("alumnoId", "materiaId", "periodo") DO UPDATE
  SET "estado" = 'ACEPTADA',
      "grupoId" = EXCLUDED."grupoId",
      "updatedAt" = NOW()
  WHERE "Inscripcion"."estado" <> 'ACEPTADA';

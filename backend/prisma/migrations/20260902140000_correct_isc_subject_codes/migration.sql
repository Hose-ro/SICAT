-- Corrige las claves conforme a la reticula ISIC-2010-224 de TecNM: Calculo
-- Diferencial es ACF-0901 y Taller de Etica es ACA-0907, consistentes con el
-- resto del tronco comun ya cargado (ACF-0902..0905, ACC-0906, ACD-0908,
-- ACA-0909 y ACA-0910). La migracion anterior las habia dejado como ACF-2301 y
-- ACH-2307.

WITH catalogo ("nombre", "clave", "semestre", "horasTeoria", "horasPractica", "creditos") AS (
  VALUES
    ('Cálculo Diferencial', 'ACF-0901', 1, 3, 2, 5),
    ('Taller de Ética', 'ACA-0907', 1, 0, 4, 4)
)
INSERT INTO "ReticulaMateria" (
  "nombre",
  "clave",
  "semestre",
  "carreraId",
  "horasTeoria",
  "horasPractica",
  "creditos",
  "activo"
)
SELECT
  catalogo."nombre",
  catalogo."clave",
  catalogo."semestre",
  carrera."id",
  catalogo."horasTeoria",
  catalogo."horasPractica",
  catalogo."creditos",
  TRUE
FROM catalogo
CROSS JOIN "Carrera" AS carrera
WHERE carrera."codigo" = '06'
ON CONFLICT ("clave", "carreraId") DO UPDATE
SET
  "nombre" = EXCLUDED."nombre",
  "semestre" = EXCLUDED."semestre",
  "horasTeoria" = EXCLUDED."horasTeoria",
  "horasPractica" = EXCLUDED."horasPractica",
  "creditos" = EXCLUDED."creditos",
  "activo" = TRUE;

-- Conserva las referencias de las importaciones de horario antes de retirar los
-- registros con las claves incorrectas.
WITH reemplazos AS (
  SELECT anterior."id" AS "anteriorId", correcta."id" AS "correctaId"
  FROM "Carrera" AS carrera
  JOIN "ReticulaMateria" AS anterior
    ON anterior."carreraId" = carrera."id"
   AND anterior."clave" IN ('ACF-2301', 'ACH-2307')
  JOIN "ReticulaMateria" AS correcta
    ON correcta."carreraId" = carrera."id"
   AND correcta."clave" = CASE anterior."clave"
     WHEN 'ACF-2301' THEN 'ACF-0901'
     WHEN 'ACH-2307' THEN 'ACA-0907'
   END
  WHERE carrera."codigo" = '06'
)
UPDATE "BloqueImportacionHorario" AS bloque
SET "reticulaMateriaId" = reemplazos."correctaId"
FROM reemplazos
WHERE bloque."reticulaMateriaId" = reemplazos."anteriorId";

DELETE FROM "ReticulaMateria" AS materia
USING "Carrera" AS carrera
WHERE materia."carreraId" = carrera."id"
  AND carrera."codigo" = '06'
  AND materia."clave" IN ('ACF-2301', 'ACH-2307');

-- Materia es el catalogo operativo que consulta el panel administrativo. Se
-- renombra en sitio para conservar grupos, unidades, horarios y asistencias.
UPDATE "Materia" AS materia
SET "clave" = 'ACF-0901', "nombre" = 'Cálculo Diferencial'
FROM "Carrera" AS carrera
WHERE materia."carreraId" = carrera."id"
  AND carrera."codigo" = '06'
  AND materia."clave" = 'ACF-2301'
  AND NOT EXISTS (
    SELECT 1 FROM "Materia" AS existente
    WHERE existente."clave" = 'ACF-0901'
      AND existente."carreraId" = materia."carreraId"
  );

UPDATE "Materia" AS materia
SET "clave" = 'ACA-0907', "nombre" = 'Taller de Ética'
FROM "Carrera" AS carrera
WHERE materia."carreraId" = carrera."id"
  AND carrera."codigo" = '06'
  AND materia."clave" = 'ACH-2307'
  AND NOT EXISTS (
    SELECT 1 FROM "Materia" AS existente
    WHERE existente."clave" = 'ACA-0907'
      AND existente."carreraId" = materia."carreraId"
  );

-- Sincroniza las secciones operativas de ISC que ya existen y crea unicamente
-- las asignaturas con horas de clase que faltan. Servicio social, residencia y
-- actividades complementarias siguen siendo requisitos de reticula, no clases.
UPDATE "Materia" AS materia
SET
  "nombre" = reticula."nombre",
  "semestre" = reticula."semestre"
FROM "ReticulaMateria" AS reticula
JOIN "Carrera" AS carrera ON carrera."id" = reticula."carreraId"
WHERE carrera."codigo" = '06'
  AND reticula."activo" = TRUE
  AND materia."carreraId" = carrera."id"
  AND materia."clave" = reticula."clave";

INSERT INTO "Materia" (
  "nombre",
  "clave",
  "descripcion",
  "horaInicio",
  "horaFin",
  "dias",
  "numUnidades",
  "docenteId",
  "aulaId",
  "carreraId",
  "semestre"
)
SELECT
  reticula."nombre",
  reticula."clave",
  NULL,
  '',
  '',
  '',
  3,
  NULL,
  NULL,
  carrera."id",
  reticula."semestre"
FROM "ReticulaMateria" AS reticula
JOIN "Carrera" AS carrera ON carrera."id" = reticula."carreraId"
WHERE carrera."codigo" = '06'
  AND reticula."activo" = TRUE
  AND (reticula."horasTeoria" > 0 OR reticula."horasPractica" > 0)
  AND NOT EXISTS (
    SELECT 1 FROM "Materia" AS existente
    WHERE existente."clave" = reticula."clave"
      AND existente."carreraId" = carrera."id"
  );

-- Las materias recien creadas necesitan sus tres unidades de evaluacion. Solo se
-- agregan a las secciones que no tienen ninguna, para no alterar las que ya
-- llevan avance registrado.
INSERT INTO "Unidad" ("nombre", "orden", "status", "materiaId")
SELECT
  'Unidad ' || serie."orden",
  serie."orden",
  'PENDIENTE'::"EstadoUnidad",
  materia."id"
FROM "Materia" AS materia
JOIN "Carrera" AS carrera ON carrera."id" = materia."carreraId"
JOIN "ReticulaMateria" AS reticula
  ON reticula."carreraId" = carrera."id"
 AND reticula."clave" = materia."clave"
CROSS JOIN generate_series(1, 3) AS serie("orden")
WHERE carrera."codigo" = '06'
  AND reticula."activo" = TRUE
  AND (reticula."horasTeoria" > 0 OR reticula."horasPractica" > 0)
  AND NOT EXISTS (
    SELECT 1 FROM "Unidad" AS existente
    WHERE existente."materiaId" = materia."id"
  );

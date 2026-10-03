-- Criterios de evaluación en un solo nivel. Antes la calificación de la unidad
-- se repartía en tareas / asistencia y las categorías sólo dividían la parte de
-- tareas (sumaban 100 entre ellas). Ahora cada criterio pesa una parte de la
-- unidad y todos suman 100, asistencia y participación incluidas. Una unidad
-- puede tener sus propios porcentajes. Los grupos sin categorías no cambian:
-- siguen con la ponderación predeterminada tareas / asistencia.

-- CreateEnum
CREATE TYPE "TipoCriterio" AS ENUM ('TAREAS', 'PRACTICAS', 'EXAMEN', 'PROYECTO', 'EXPOSICION', 'OTRO', 'ASISTENCIA', 'PARTICIPACION');

-- AlterTable
ALTER TABLE "CategoriaEvaluacion" ADD COLUMN     "tipo" "TipoCriterio" NOT NULL DEFAULT 'OTRO';

-- AlterTable
ALTER TABLE "CategoriaPesoGrupo" ADD COLUMN     "meta" INTEGER;

-- CreateTable
CREATE TABLE "CategoriaPesoUnidad" (
    "categoriaId" INTEGER NOT NULL,
    "grupoId" INTEGER NOT NULL,
    "unidadId" INTEGER NOT NULL,
    "peso" INTEGER NOT NULL,
    "meta" INTEGER,

    CONSTRAINT "CategoriaPesoUnidad_pkey" PRIMARY KEY ("categoriaId","grupoId","unidadId")
);

-- CreateIndex
CREATE INDEX "CategoriaPesoUnidad_grupoId_unidadId_idx" ON "CategoriaPesoUnidad"("grupoId", "unidadId");

-- CreateIndex
CREATE INDEX "CategoriaPesoUnidad_unidadId_idx" ON "CategoriaPesoUnidad"("unidadId");

-- CreateIndex
CREATE INDEX "Tarea_categoriaId_idx" ON "Tarea"("categoriaId");

-- AddForeignKey
ALTER TABLE "CategoriaPesoUnidad" ADD CONSTRAINT "CategoriaPesoUnidad_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaEvaluacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoriaPesoUnidad" ADD CONSTRAINT "CategoriaPesoUnidad_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoriaPesoUnidad" ADD CONSTRAINT "CategoriaPesoUnidad_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "Unidad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Datos ---------------------------------------------------------------------

-- 1) Tipo aproximado por el nombre. lower() no baja las mayúsculas acentuadas
--    con locale C, por eso se traducen ambas. "Asistencia" o "Participación"
--    escritas como categoría eran actividades en el modelo anterior: se quedan
--    como OTRO.
UPDATE "CategoriaEvaluacion" c
SET "tipo" = (CASE
    WHEN n.v ~ '^(examen|parcial)' THEN 'EXAMEN'
    WHEN n.v ~ '^(practica|laboratorio)' THEN 'PRACTICAS'
    WHEN n.v ~ '^proyecto' THEN 'PROYECTO'
    WHEN n.v ~ '^(exposicion|presentacion)' THEN 'EXPOSICION'
    WHEN n.v ~ '^(tarea|trabajo)' THEN 'TAREAS'
    ELSE 'OTRO'
  END)::"TipoCriterio"
FROM (
  SELECT "id", translate(lower(btrim("nombre")), 'ÁÉÍÓÚÜÑáéíóúüñ', 'aeiouunaeiouun') AS v
  FROM "CategoriaEvaluacion"
) n
WHERE n."id" = c."id";

-- 2) Peso relativo dentro de tareas -> parte de la unidad. Resto mayor: los
--    pesos de cada grupo suman exactamente su porcentaje de tareas (el del
--    grupo o, si no tiene, el de la materia).
WITH base AS (
  SELECT cpg."categoriaId", cpg."grupoId", c."materiaId",
         COALESCE(pg."pesoTareas", m."pesoTareas") AS pt,
         cpg."peso" * COALESCE(pg."pesoTareas", m."pesoTareas") AS esc
  FROM "CategoriaPesoGrupo" cpg
  JOIN "CategoriaEvaluacion" c ON c."id" = cpg."categoriaId"
  JOIN "Materia" m ON m."id" = c."materiaId"
  LEFT JOIN "PonderacionGrupo" pg
    ON pg."materiaId" = c."materiaId" AND pg."grupoId" = cpg."grupoId"
), r AS (
  SELECT "categoriaId", "grupoId",
         esc / 100 AS piso,
         pt - SUM(esc / 100) OVER w AS sobrante,
         ROW_NUMBER() OVER (
           PARTITION BY "materiaId", "grupoId"
           ORDER BY esc % 100 DESC, "categoriaId"
         ) AS turno
  FROM base
  WINDOW w AS (PARTITION BY "materiaId", "grupoId")
)
UPDATE "CategoriaPesoGrupo" cpg
SET "peso" = r.piso + CASE WHEN r.turno <= r.sobrante THEN 1 ELSE 0 END
FROM r
WHERE cpg."categoriaId" = r."categoriaId" AND cpg."grupoId" = r."grupoId";

-- 3) Criterio de asistencia en cada materia con algún grupo convertido al que
--    le falta peso. Si ya hay una categoría llamada "Asistencia" (actividad),
--    el nuevo criterio se llama "Asistencia a clase".
WITH totales AS (
  SELECT c."materiaId", cpg."grupoId", SUM(cpg."peso")::int AS total
  FROM "CategoriaPesoGrupo" cpg
  JOIN "CategoriaEvaluacion" c ON c."id" = cpg."categoriaId"
  GROUP BY c."materiaId", cpg."grupoId"
)
INSERT INTO "CategoriaEvaluacion" ("materiaId", "nombre", "orden", "tipo")
SELECT DISTINCT t."materiaId",
  CASE
    WHEN EXISTS (
      SELECT 1 FROM "CategoriaEvaluacion" x
      WHERE x."materiaId" = t."materiaId"
        AND translate(lower(btrim(x."nombre")), 'ÁÉÍÓÚÜÑáéíóúüñ', 'aeiouunaeiouun') = 'asistencia'
    ) THEN 'Asistencia a clase'
    ELSE 'Asistencia'
  END,
  999,
  'ASISTENCIA'::"TipoCriterio"
FROM totales t
WHERE t.total < 100
ON CONFLICT ("materiaId", "nombre") DO NOTHING;

-- 4) Peso de asistencia = 100 - lo demás (el porcentaje de asistencia que tenía
--    el grupo cuando su ponderación sumaba 100).
INSERT INTO "CategoriaPesoGrupo" ("categoriaId", "grupoId", "peso")
SELECT a."id", t."grupoId", 100 - t.total
FROM (
  SELECT c."materiaId", cpg."grupoId", SUM(cpg."peso")::int AS total
  FROM "CategoriaPesoGrupo" cpg
  JOIN "CategoriaEvaluacion" c ON c."id" = cpg."categoriaId"
  WHERE c."tipo" <> 'ASISTENCIA'
  GROUP BY c."materiaId", cpg."grupoId"
) t
JOIN LATERAL (
  SELECT "id" FROM "CategoriaEvaluacion"
  WHERE "materiaId" = t."materiaId" AND "tipo" = 'ASISTENCIA'
  ORDER BY "id"
  LIMIT 1
) a ON TRUE
WHERE t.total < 100;

-- Comprobación manual después de aplicar (no debe devolver filas):
-- SELECT c."materiaId", cpg."grupoId", SUM(cpg."peso"), MIN(cpg."peso")
-- FROM "CategoriaPesoGrupo" cpg JOIN "CategoriaEvaluacion" c ON c."id" = cpg."categoriaId"
-- GROUP BY 1, 2 HAVING SUM(cpg."peso") <> 100 OR MIN(cpg."peso") < 1;

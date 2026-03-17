-- Ensure columns on Carrera
ALTER TABLE "Carrera" ADD COLUMN IF NOT EXISTS "planEstudios" TEXT;
ALTER TABLE "Carrera" ADD COLUMN IF NOT EXISTS "codigo" TEXT;

-- Backfill codigo with suggested mapping; fallback to padded id to preserve uniqueness
UPDATE "Carrera"
SET "codigo" = CASE
  WHEN lower(nombre) LIKE 'contador%' THEN '01'
  WHEN lower(nombre) LIKE 'ingenier%energ%renov%' THEN '02'
  WHEN lower(nombre) LIKE 'ingenier%electron%' THEN '03'
  WHEN lower(nombre) LIKE 'ingenier%gestion empre%' THEN '04'
  WHEN lower(nombre) LIKE 'innovaci% agric%' THEN '05'
  WHEN lower(nombre) LIKE 'sistemas comput%' THEN '06'
  WHEN lower(nombre) LIKE 'ingenier% industrial%' THEN '07'
  WHEN lower(nombre) LIKE 'informat%' THEN '08'
  WHEN lower(nombre) LIKE 'petrol%' THEN '09'
  ELSE lpad("id"::text, 2, '0')
END
WHERE "codigo" IS NULL;

-- Asegurar unicidad: si algún codigo quedó duplicado, reasignar a LPAD(id,2,'0') para las filas extras
WITH dups AS (
  SELECT id, codigo, row_number() OVER (PARTITION BY codigo ORDER BY id) AS rn
  FROM "Carrera"
  WHERE codigo IS NOT NULL
)
UPDATE "Carrera" c
SET codigo = lpad(c.id::text, 2, '0')
WHERE c.id IN (SELECT id FROM dups WHERE rn > 1);

-- Rellenar nulos restantes con LPAD(id,2,'0')
UPDATE "Carrera" SET "codigo" = lpad("id"::text, 2, '0') WHERE "codigo" IS NULL;

ALTER TABLE "Carrera" ALTER COLUMN "codigo" SET NOT NULL;
-- Recreate unique index if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'Carrera_codigo_key'
  ) THEN
    CREATE UNIQUE INDEX "Carrera_codigo_key" ON "Carrera"("codigo");
  END IF;
END$$;

-- ReticulaMateria catalog
CREATE TABLE IF NOT EXISTS "ReticulaMateria" (
  "id" SERIAL PRIMARY KEY,
  "nombre" TEXT NOT NULL,
  "clave" TEXT NOT NULL,
  "semestre" INTEGER NOT NULL,
  "carreraId" INTEGER NOT NULL REFERENCES "Carrera"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "horasTeoria" INTEGER NOT NULL DEFAULT 0,
  "horasPractica" INTEGER NOT NULL DEFAULT 0,
  "creditos" INTEGER NOT NULL DEFAULT 0,
  "activo" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

-- Unique constraint on clave + carrera
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ReticulaMateria_clave_carreraId_key'
  ) THEN
    ALTER TABLE "ReticulaMateria" ADD CONSTRAINT "ReticulaMateria_clave_carreraId_key" UNIQUE ("clave", "carreraId");
  END IF;
END$$;

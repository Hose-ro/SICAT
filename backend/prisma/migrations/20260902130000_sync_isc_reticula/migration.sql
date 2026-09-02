-- Sincroniza de forma aditiva la reticula vigente de Ingenieria en Sistemas
-- Computacionales. Esta migracion evita ejecutar el seed de desarrollo, ya que
-- ese script elimina catalogos y datos academicos antes de volver a crearlos.

INSERT INTO "Carrera" ("nombre", "codigo", "planEstudios")
VALUES ('Ingeniería en Sistemas Computacionales', '06', 'ISIC-2010-224')
ON CONFLICT ("codigo") DO UPDATE
SET
  "nombre" = EXCLUDED."nombre",
  "planEstudios" = EXCLUDED."planEstudios";

-- Conserva las relaciones academicas de las dos materias cuyas claves fueron
-- actualizadas en la reticula vigente.
UPDATE "Materia" AS materia
SET "clave" = 'ACF-2301', "nombre" = 'Cálculo Diferencial'
FROM "Carrera" AS carrera
WHERE materia."carreraId" = carrera."id"
  AND carrera."codigo" = '06'
  AND materia."clave" = 'ACF-0901'
  AND NOT EXISTS (
    SELECT 1 FROM "Materia" AS existente WHERE existente."clave" = 'ACF-2301'
  );

UPDATE "Materia" AS materia
SET "clave" = 'ACH-2307', "nombre" = 'Taller de Ética'
FROM "Carrera" AS carrera
WHERE materia."carreraId" = carrera."id"
  AND carrera."codigo" = '06'
  AND materia."clave" = 'ACA-0907'
  AND NOT EXISTS (
    SELECT 1 FROM "Materia" AS existente WHERE existente."clave" = 'ACH-2307'
  );

WITH catalogo ("nombre", "clave", "semestre", "horasTeoria", "horasPractica", "creditos") AS (
  VALUES
    -- Semestre 1
    ('Cálculo Diferencial', 'ACF-2301', 1, 3, 2, 5),
    ('Fundamentos de Programación', 'AED-1285', 1, 2, 3, 5),
    ('Taller de Ética', 'ACH-2307', 1, 0, 4, 4),
    ('Matemáticas Discretas', 'AEF-1041', 1, 3, 2, 5),
    ('Taller de Administración', 'SCH-1024', 1, 1, 3, 4),
    ('Fundamentos de Investigación', 'ACC-0906', 1, 2, 2, 4),
    ('Actividades Complementarias', 'ISC-AC-01', 1, 0, 0, 1),

    -- Semestre 2
    ('Cálculo Integral', 'ACF-0902', 2, 3, 2, 5),
    ('Programación Orientada a Objetos', 'AED-1286', 2, 2, 3, 5),
    ('Contabilidad Financiera', 'AEC-1008', 2, 2, 2, 4),
    ('Química', 'AEC-1058', 2, 2, 2, 4),
    ('Álgebra Lineal', 'ACF-0903', 2, 3, 2, 5),
    ('Probabilidad y Estadística', 'AEF-1052', 2, 3, 2, 5),
    ('Actividades Complementarias', 'ISC-AC-02', 2, 0, 0, 1),

    -- Semestre 3
    ('Cálculo Vectorial', 'ACF-0904', 3, 3, 2, 5),
    ('Estructura de Datos', 'AED-1026', 3, 2, 3, 5),
    ('Cultura Empresarial', 'SCC-1005', 3, 2, 2, 4),
    ('Investigación de Operaciones', 'SCC-1013', 3, 2, 2, 4),
    ('Sistemas Operativos', 'AEC-1061', 3, 2, 2, 4),
    ('Física General', 'SCF-1006', 3, 3, 2, 5),
    ('Desarrollo Sustentable', 'ACD-0908', 3, 2, 3, 5),

    -- Semestre 4
    ('Ecuaciones Diferenciales', 'ACF-0905', 4, 3, 2, 5),
    ('Métodos Numéricos', 'SCC-1017', 4, 2, 2, 4),
    ('Tópicos Avanzados de Programación', 'SCD-1027', 4, 2, 3, 5),
    ('Fundamentos de Base de Datos', 'AEF-1031', 4, 3, 2, 5),
    ('Taller de Sistemas Operativos', 'SCA-1026', 4, 0, 4, 4),
    ('Principios Eléctricos y Aplicaciones Digitales', 'SCD-1018', 4, 2, 3, 5),
    ('Fundamento de Telecomunicaciones', 'AEC-1034', 4, 2, 2, 4),

    -- Semestre 5
    ('Lenguajes y Autómatas I', 'SCD-1015', 5, 2, 3, 5),
    ('Redes de Computadoras', 'SCD-1021', 5, 2, 3, 5),
    ('Taller de Base de Datos', 'SCA-1025', 5, 0, 4, 4),
    ('Simulación', 'SCD-1022', 5, 2, 3, 5),
    ('Fundamentos de Ingeniería de Software', 'SCC-1007', 5, 2, 2, 4),
    ('Arquitectura de Computadoras', 'SCD-1003', 5, 2, 3, 5),
    ('Graficación', 'SCC-1010', 5, 2, 2, 4),

    -- Semestre 6
    ('Lenguajes y Autómatas II', 'SCD-1016', 6, 2, 3, 5),
    ('Conmutación y Enrutamiento en Redes de Datos', 'SCD-1004', 6, 2, 3, 5),
    ('Administración de Base de Datos', 'SCB-1001', 6, 1, 4, 5),
    ('Taller de Investigación I', 'ACA-0909', 6, 0, 4, 4),
    ('Ingeniería de Software', 'SCD-1011', 6, 2, 3, 5),
    ('Lenguajes de Interfaz', 'SCC-1014', 6, 2, 2, 4),
    ('Seguridad en Redes', 'RSD-2401', 6, 2, 3, 5),

    -- Semestre 7
    ('Administración de Redes', 'SCA-1002', 7, 0, 4, 4),
    ('Taller de Investigación II', 'ACA-0910', 7, 0, 4, 4),
    ('Gestión de Proyectos de Software', 'SCG-1009', 7, 3, 3, 6),
    ('Sistemas Programables', 'SCC-1023', 7, 2, 2, 4),
    ('Programación Web', 'AEB-1055', 7, 1, 4, 5),
    ('Servicio Social', 'SSS-2014', 7, 0, 0, 10),

    -- Semestre 8
    ('Programación Lógica y Funcional', 'SCC-1019', 8, 2, 2, 4),
    ('Inteligencia Artificial', 'SCC-1012', 8, 2, 2, 4),
    ('Frameworks para Desarrollo Web', 'RSB-2405', 8, 1, 4, 5),
    ('Software Libre y Herramientas para Cómputo', 'RSD-2402', 8, 2, 3, 5),
    ('Programación Móvil', 'RSB-2403', 8, 1, 4, 5),
    ('Comercio Electrónico', 'RSD-2404', 8, 2, 3, 5),

    -- Requisitos finales
    ('Actividades Complementarias', 'ISC-AC-03', 9, 0, 0, 3),
    ('Residencia Profesional', 'RSC-2010', 9, 0, 0, 10)
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

-- Si las claves anteriores fueron usadas por una importacion de horario,
-- conserva esas referencias antes de retirar los registros obsoletos.
WITH reemplazos AS (
  SELECT anterior."id" AS "anteriorId", nueva."id" AS "nuevaId"
  FROM "Carrera" AS carrera
  JOIN "ReticulaMateria" AS anterior
    ON anterior."carreraId" = carrera."id"
   AND anterior."clave" IN ('ACF-0901', 'ACA-0907')
  JOIN "ReticulaMateria" AS nueva
    ON nueva."carreraId" = carrera."id"
   AND nueva."clave" = CASE anterior."clave"
     WHEN 'ACF-0901' THEN 'ACF-2301'
     WHEN 'ACA-0907' THEN 'ACH-2307'
   END
  WHERE carrera."codigo" = '06'
)
UPDATE "BloqueImportacionHorario" AS bloque
SET "reticulaMateriaId" = reemplazos."nuevaId"
FROM reemplazos
WHERE bloque."reticulaMateriaId" = reemplazos."anteriorId";

DELETE FROM "ReticulaMateria" AS materia
USING "Carrera" AS carrera
WHERE materia."carreraId" = carrera."id"
  AND carrera."codigo" = '06'
  AND materia."clave" IN ('ACF-0901', 'ACA-0907');

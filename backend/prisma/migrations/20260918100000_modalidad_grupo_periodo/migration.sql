-- Grupos escolarizados (lunes a viernes) y sabatinos (modalidad mixta). Cada
-- modalidad tiene sus propias fechas de semestre, así que el periodo escolar
-- pasa a identificarse por clave y modalidad. Lo que ya existía se conserva
-- como escolarizado.

CREATE TYPE "ModalidadGrupo" AS ENUM ('ESCOLARIZADO', 'SABATINO');

ALTER TABLE "Grupo" ADD COLUMN "modalidad" "ModalidadGrupo" NOT NULL DEFAULT 'ESCOLARIZADO';

-- La misma sección puede repetirse entre modalidades: 103-A y 103-SA.
ALTER TABLE "Grupo" DROP CONSTRAINT "Grupo_semestre_seccion_carreraId_periodo_key";
CREATE UNIQUE INDEX "Grupo_semestre_seccion_carreraId_periodo_modalidad_key" ON "Grupo"("semestre", "seccion", "carreraId", "periodo", "modalidad");

ALTER TABLE "PeriodoAcademico" ADD COLUMN "modalidad" "ModalidadGrupo" NOT NULL DEFAULT 'ESCOLARIZADO';
ALTER TABLE "PeriodoAcademico" DROP CONSTRAINT "PeriodoAcademico_pkey";
ALTER TABLE "PeriodoAcademico" ADD CONSTRAINT "PeriodoAcademico_pkey" PRIMARY KEY ("clave", "modalidad");

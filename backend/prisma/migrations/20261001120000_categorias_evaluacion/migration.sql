-- Calificación ponderada por categoría (examen, prácticas, proyecto…). El
-- catálogo es de la materia; la ponderación tareas/asistencia y el peso de
-- cada categoría los define cada grupo. Sin filas, todo sigue como antes.

-- AlterTable
ALTER TABLE "Tarea" ADD COLUMN     "categoriaId" INTEGER;

-- CreateTable
CREATE TABLE "CategoriaEvaluacion" (
    "id" SERIAL NOT NULL,
    "materiaId" INTEGER NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoriaEvaluacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoriaPesoGrupo" (
    "categoriaId" INTEGER NOT NULL,
    "grupoId" INTEGER NOT NULL,
    "peso" INTEGER NOT NULL,

    CONSTRAINT "CategoriaPesoGrupo_pkey" PRIMARY KEY ("categoriaId","grupoId")
);

-- CreateTable
CREATE TABLE "PonderacionGrupo" (
    "materiaId" INTEGER NOT NULL,
    "grupoId" INTEGER NOT NULL,
    "pesoTareas" INTEGER NOT NULL,
    "pesoAsistencia" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PonderacionGrupo_pkey" PRIMARY KEY ("materiaId","grupoId")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaEvaluacion_materiaId_nombre_key" ON "CategoriaEvaluacion"("materiaId", "nombre");

-- CreateIndex
CREATE INDEX "CategoriaPesoGrupo_grupoId_idx" ON "CategoriaPesoGrupo"("grupoId");

-- CreateIndex
CREATE INDEX "PonderacionGrupo_grupoId_idx" ON "PonderacionGrupo"("grupoId");

-- AddForeignKey
ALTER TABLE "CategoriaEvaluacion" ADD CONSTRAINT "CategoriaEvaluacion_materiaId_fkey" FOREIGN KEY ("materiaId") REFERENCES "Materia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoriaPesoGrupo" ADD CONSTRAINT "CategoriaPesoGrupo_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaEvaluacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoriaPesoGrupo" ADD CONSTRAINT "CategoriaPesoGrupo_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PonderacionGrupo" ADD CONSTRAINT "PonderacionGrupo_materiaId_fkey" FOREIGN KEY ("materiaId") REFERENCES "Materia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PonderacionGrupo" ADD CONSTRAINT "PonderacionGrupo_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaEvaluacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;


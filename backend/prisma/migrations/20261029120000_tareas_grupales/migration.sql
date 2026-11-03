ALTER TABLE "Tarea" ADD COLUMN "esGrupal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "tipoTrabajo" VARCHAR(60),
ADD COLUMN "equiposEditablesPorAlumnos" BOOLEAN NOT NULL DEFAULT true;
CREATE TABLE "EquipoTarea" ("id" SERIAL NOT NULL, "tareaId" INTEGER NOT NULL, "nombre" VARCHAR(80) NOT NULL, "creadoPorId" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "EquipoTarea_pkey" PRIMARY KEY ("id"));
CREATE TABLE "EquipoTareaMiembro" ("equipoId" INTEGER NOT NULL, "alumnoId" INTEGER NOT NULL, CONSTRAINT "EquipoTareaMiembro_pkey" PRIMARY KEY ("equipoId","alumnoId"));
ALTER TABLE "EntregaTarea" ADD COLUMN "equipoId" INTEGER;
CREATE UNIQUE INDEX "EquipoTarea_tareaId_nombre_key" ON "EquipoTarea"("tareaId","nombre");
CREATE INDEX "EquipoTarea_tareaId_idx" ON "EquipoTarea"("tareaId");
CREATE INDEX "EquipoTareaMiembro_alumnoId_idx" ON "EquipoTareaMiembro"("alumnoId");
CREATE UNIQUE INDEX "EntregaTarea_tareaId_equipoId_key" ON "EntregaTarea"("tareaId","equipoId");
ALTER TABLE "EquipoTarea" ADD CONSTRAINT "EquipoTarea_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "Tarea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EquipoTarea" ADD CONSTRAINT "EquipoTarea_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EquipoTareaMiembro" ADD CONSTRAINT "EquipoTareaMiembro_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "EquipoTarea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EquipoTareaMiembro" ADD CONSTRAINT "EquipoTareaMiembro_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EntregaTarea" ADD CONSTRAINT "EntregaTarea_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "EquipoTarea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

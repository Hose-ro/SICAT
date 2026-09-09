-- Fechas reales del periodo escolar, para acotar la captura de asistencias
-- atrasadas y mostrarlas como referencia en el panel del docente.

CREATE TABLE "PeriodoAcademico" (
    "clave" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "actualizadoPorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeriodoAcademico_pkey" PRIMARY KEY ("clave")
);

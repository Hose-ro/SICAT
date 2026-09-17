/**
 * Datos desechables para las pruebas Playwright contra la API real
 * (`frontend/tests/real`). Todo lo que crea lleva el prefijo `e2e.` / `E2E`
 * y `down` lo borra por completo, así que puede correr sobre la BD local.
 *
 *   npx ts-node --transpile-only test/e2e-fixture.ts up
 *   npx ts-node --transpile-only test/e2e-fixture.ts down
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { unlink } from 'node:fs/promises';
import { getCurrentAcademicPeriod } from '../src/common/periodo.util';
import { getUploadAbsolutePath } from '../src/tareas/tareas.storage';

export const E2E_PASSWORD = process.env.E2E_PASSWORD || 'Sicat-e2e-2026!';
export const E2E = {
  carrera: { nombre: 'E2E Carrera', codigo: 'E2E' },
  materia: { nombre: 'E2E Materia', clave: 'E2E-1' },
  docente: 'e2e.docente',
  colega: 'e2e.colega',
  ajeno: 'e2e.ajeno',
  alumno: 'E2E00001',
  alumnoPendiente: 'E2E00002',
};

const prisma = new PrismaClient();

async function down() {
  const usuarios = await prisma.usuario.findMany({
    where: {
      OR: [
        { username: { startsWith: 'e2e.' } },
        { numeroControl: { startsWith: 'E2E' } },
      ],
    },
    select: { id: true },
  });
  const ids = usuarios.map((u) => u.id);
  const materias = await prisma.materia.findMany({
    where: { clave: { startsWith: 'E2E' } },
    select: { id: true },
  });
  const materiaIds = materias.map((m) => m.id);

  const archivos = await prisma.tareaArchivo.findMany({
    where: { tarea: { materiaId: { in: materiaIds } } },
    select: { url: true },
  });
  const evidencias = await prisma.entregaArchivo.findMany({
    where: { entrega: { tarea: { materiaId: { in: materiaIds } } } },
    select: { url: true },
  });
  await Promise.all(
    [...archivos, ...evidencias].map((a) =>
      unlink(getUploadAbsolutePath(a.url.split('/').pop() ?? '')).catch(
        () => undefined,
      ),
    ),
  );

  await prisma.entregaArchivo.deleteMany({
    where: { entrega: { tarea: { materiaId: { in: materiaIds } } } },
  });
  await prisma.entregaTarea.deleteMany({
    where: { tarea: { materiaId: { in: materiaIds } } },
  });
  await prisma.tareaArchivo.deleteMany({
    where: { tarea: { materiaId: { in: materiaIds } } },
  });
  await prisma.tarea.deleteMany({ where: { materiaId: { in: materiaIds } } });
  await prisma.notificacion.deleteMany({ where: { usuarioId: { in: ids } } });
  await prisma.calificacionUnidad.deleteMany({
    where: { materiaId: { in: materiaIds } },
  });
  await prisma.asistencia.deleteMany({
    where: { claseSesion: { materiaId: { in: materiaIds } } },
  });
  await prisma.claseSesion.deleteMany({
    where: { materiaId: { in: materiaIds } },
  });
  await prisma.inscripcion.deleteMany({
    where: {
      OR: [{ alumnoId: { in: ids } }, { materiaId: { in: materiaIds } }],
    },
  });
  await prisma.horarioMateria.deleteMany({
    where: {
      OR: [{ docenteId: { in: ids } }, { materiaId: { in: materiaIds } }],
    },
  });
  await prisma.unidad.deleteMany({ where: { materiaId: { in: materiaIds } } });
  await prisma.materia.deleteMany({ where: { id: { in: materiaIds } } });
  await prisma.grupo.deleteMany({
    where: { carrera: { codigo: E2E.carrera.codigo } },
  });
  await prisma.authAudit.deleteMany({ where: { usuarioId: { in: ids } } });
  await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
  await prisma.reticulaMateria.deleteMany({
    where: { carrera: { codigo: E2E.carrera.codigo } },
  });
  await prisma.carrera.deleteMany({ where: { codigo: E2E.carrera.codigo } });
}

async function up() {
  await down();
  const periodo = getCurrentAcademicPeriod();
  const password = await bcrypt.hash(E2E_PASSWORD, 10);
  const carrera = await prisma.carrera.create({ data: E2E.carrera });
  // Sin la materia en la retícula de la carrera, los filtros de asistencias
  // no ofrecen ningún grupo para ella.
  await prisma.reticulaMateria.create({
    data: {
      nombre: E2E.materia.nombre,
      clave: E2E.materia.clave,
      semestre: 1,
      carreraId: carrera.id,
    },
  });
  const grupo = await prisma.grupo.create({
    data: {
      nombre: 'E2E-1Z',
      semestre: 1,
      seccion: 'Z',
      carreraId: carrera.id,
      periodo,
    },
  });
  const usuario = (data: {
    nombre: string;
    rol: 'DOCENTE' | 'ALUMNO';
    username?: string;
    numeroControl?: string;
    grupoId?: number;
  }) =>
    prisma.usuario.create({
      data: {
        ...data,
        password,
        carreraId: carrera.id,
        activo: true,
        registroAprobado: true,
      },
    });
  const docente = await usuario({
    nombre: 'E2E Docente',
    rol: 'DOCENTE',
    username: E2E.docente,
  });
  const colega = await usuario({
    nombre: 'E2E Colega',
    rol: 'DOCENTE',
    username: E2E.colega,
  });
  await usuario({ nombre: 'E2E Ajeno', rol: 'DOCENTE', username: E2E.ajeno });
  const alumno = await usuario({
    nombre: 'E2E Alumno',
    rol: 'ALUMNO',
    numeroControl: E2E.alumno,
    grupoId: grupo.id,
  });
  const pendiente = await usuario({
    nombre: 'E2E Alumno Pendiente',
    rol: 'ALUMNO',
    numeroControl: E2E.alumnoPendiente,
    grupoId: grupo.id,
  });

  const materia = await prisma.materia.create({
    data: {
      ...E2E.materia,
      carreraId: carrera.id,
      semestre: 1,
      docenteId: docente.id,
      grupos: { connect: { id: grupo.id } },
      unidades: { create: [{ nombre: 'Unidad 1', orden: 1 }] },
    },
  });
  await prisma.inscripcion.create({
    data: {
      alumnoId: alumno.id,
      materiaId: materia.id,
      grupoId: grupo.id,
      estado: 'ACEPTADA',
      periodo,
    },
  });
  await prisma.inscripcion.create({
    data: {
      alumnoId: pendiente.id,
      materiaId: materia.id,
      grupoId: grupo.id,
      estado: 'PENDIENTE',
      periodo,
    },
  });
  // El colega imparte la materia en el grupo sólo por horario (no es Materia.docenteId).
  await prisma.horarioMateria.create({
    data: {
      materiaId: materia.id,
      docenteId: colega.id,
      grupoId: grupo.id,
      dias: 'Lunes',
      horaInicio: '07:00',
      horaFin: '08:00',
    },
  });

  console.log(
    JSON.stringify({
      materiaId: materia.id,
      grupoId: grupo.id,
      docenteId: docente.id,
      alumnoId: alumno.id,
    }),
  );
}

const accion = process.argv[2];
(accion === 'up'
  ? up()
  : accion === 'down'
    ? down()
    : Promise.reject(new Error('Usa: up | down'))
)
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

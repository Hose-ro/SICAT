/**
 * Criterios de evaluación contra la BD local: crea sus propios datos (clave
 * CRIT-E2E) y los borra al terminar.
 *
 *   npx jest --config ./test/jest-e2e.json criterios
 */
import 'dotenv/config';
import { EstadoUnidad, TipoCriterio } from '@prisma/client';
import { PrismaService } from '../src/prisma.service';
import { CriteriosService } from '../src/calificaciones/criterios.service';
import { CalificacionesService } from '../src/calificaciones/calificaciones.service';
import { getCurrentAcademicPeriod } from '../src/common/periodo.util';

const CLAVE = 'CRIT-E2E';
const CODIGO = 'CRITE2E';

describe('Criterios de evaluación (BD local)', () => {
  const prisma = new PrismaService();
  const criterios = new CriteriosService(prisma);
  const calificaciones = new CalificacionesService(prisma);
  let admin: { id: number; rol: string };
  let materiaId: number;
  let grupoA: number;
  let grupoB: number;
  let unidades: Record<'u1' | 'u2' | 'u3', number>;
  let tareas: Record<'t1' | 't2' | 't3' | 't4', number>;

  async function limpiar() {
    const materias = await prisma.materia.findMany({
      where: { clave: { startsWith: CLAVE } },
      select: { id: true },
    });
    const ids = materias.map((materia) => materia.id);
    await prisma.entregaTarea.deleteMany({
      where: { tarea: { materiaId: { in: ids } } },
    });
    await prisma.tarea.deleteMany({ where: { materiaId: { in: ids } } });
    await prisma.categoriaEvaluacion.deleteMany({
      where: { materiaId: { in: ids } },
    });
    await prisma.ponderacionGrupo.deleteMany({
      where: { materiaId: { in: ids } },
    });
    await prisma.unidad.deleteMany({ where: { materiaId: { in: ids } } });
    await prisma.materia.deleteMany({ where: { id: { in: ids } } });
    await prisma.grupo.deleteMany({ where: { carrera: { codigo: CODIGO } } });
    await prisma.usuario.deleteMany({
      where: { username: { startsWith: 'crit.e2e.' } },
    });
    await prisma.carrera.deleteMany({ where: { codigo: CODIGO } });
  }

  beforeAll(async () => {
    await prisma.$connect();
    await limpiar();
    const periodo = getCurrentAcademicPeriod();
    const carrera = await prisma.carrera.create({
      data: { nombre: 'Criterios E2E', codigo: CODIGO },
    });
    const grupo = (seccion: string) =>
      prisma.grupo.create({
        data: {
          nombre: `CRIT-1${seccion}`,
          semestre: 1,
          seccion,
          carreraId: carrera.id,
          periodo,
        },
      });
    grupoA = (await grupo('A')).id;
    grupoB = (await grupo('B')).id;
    const docente = await prisma.usuario.create({
      data: {
        nombre: 'Crit Docente',
        rol: 'ADMIN',
        username: 'crit.e2e.docente',
        password: 'x',
        carreraId: carrera.id,
      },
    });
    admin = { id: docente.id, rol: 'ADMIN' };
    const materia = await prisma.materia.create({
      data: {
        nombre: 'Criterios E2E',
        clave: CLAVE,
        carreraId: carrera.id,
        pesoTareas: 80,
        pesoAsistencia: 20,
        grupos: { connect: [{ id: grupoA }, { id: grupoB }] },
        unidades: {
          create: [
            { nombre: 'Unidad 1', orden: 1, status: EstadoUnidad.FINALIZADA },
            { nombre: 'Unidad 2', orden: 2, status: EstadoUnidad.ACTIVA },
            { nombre: 'Unidad 3', orden: 3 },
          ],
        },
      },
      include: { unidades: { orderBy: { orden: 'asc' } } },
    });
    materiaId = materia.id;
    unidades = {
      u1: materia.unidades[0].id,
      u2: materia.unidades[1].id,
      u3: materia.unidades[2].id,
    };
    const tarea = async (grupoId: number, unidadId: number, titulo: string) =>
      (
        await prisma.tarea.create({
          data: {
            materiaId,
            grupoId,
            unidadId,
            docenteId: docente.id,
            titulo,
            instrucciones: 'x',
            tipoEntrega: 'EN_LINEA',
            estado: 'PUBLICADA',
          },
        })
      ).id;
    tareas = {
      t1: await tarea(grupoA, unidades.u1, 'T1 cerrada'),
      t2: await tarea(grupoA, unidades.u2, 'T2'),
      t3: await tarea(grupoA, unidades.u2, 'T3'),
      t4: await tarea(grupoB, unidades.u2, 'T4 de B'),
    };
  });

  afterAll(async () => {
    await limpiar();
    await prisma.$disconnect();
  });

  const categoriaDe = async (id: number) =>
    (await prisma.tarea.findUnique({ where: { id } }))?.categoriaId ?? null;
  const nombres = (lista: Array<{ nombre: string; peso: number }>) =>
    lista.map((item) => `${item.nombre} ${item.peso}`);

  it('sin criterios propios muestra la ponderación predeterminada', async () => {
    const vista = await criterios.obtener(admin, materiaId, grupoA);
    expect(vista.base.origen).toBe('PREDETERMINADA');
    expect(nombres(vista.base.criterios)).toEqual([
      'Tareas 80',
      'Asistencia 20',
    ]);
    expect(vista.unidades.map((item) => item.personalizada)).toEqual([
      false,
      false,
      false,
    ]);
  });

  it('no deja ajustar una unidad antes de tener la lista de todas', async () => {
    await expect(
      criterios.guardar(admin, {
        materiaId,
        grupoId: grupoA,
        unidadId: unidades.u3,
        criterios: [{ nombre: 'Examen', tipo: TipoCriterio.EXAMEN, peso: 100 }],
      }),
    ).rejects.toThrow('Primero guarda los criterios de todas las unidades');
  });

  it('la primera lista conserva la unidad cerrada y reasigna las tareas sin criterio', async () => {
    const vista = await criterios.guardar(admin, {
      materiaId,
      grupoId: grupoA,
      criterios: [
        { nombre: 'Examen', tipo: TipoCriterio.EXAMEN, peso: 40 },
        { nombre: 'Tareas', tipo: TipoCriterio.TAREAS, peso: 40 },
        { nombre: 'Asistencia', tipo: TipoCriterio.ASISTENCIA, peso: 20 },
      ],
    });
    expect(vista.base.origen).toBe('GRUPO');
    expect(nombres(vista.base.criterios)).toEqual([
      'Examen 40',
      'Tareas 40',
      'Asistencia 20',
    ]);
    // La unidad 1 ya estaba cerrada: guarda la ponderación con que se calificó.
    const u1 = vista.unidades.find((item) => item.unidad.id === unidades.u1);
    expect(u1?.personalizada).toBe(true);
    expect(nombres(u1?.criterios ?? [])).toEqual([
      'Tareas 80',
      'Asistencia 20',
    ]);
    expect(
      vista.unidades
        .filter((item) => item.unidad.id !== unidades.u1)
        .map((item) => item.personalizada),
    ).toEqual([false, false]);

    const tareasId = vista.base.criterios.find(
      (c) => c.nombre === 'Tareas',
    )?.id;
    expect(vista.reasignadas).toBe(2);
    expect(await categoriaDe(tareas.t1)).toBe(tareasId);
    expect(await categoriaDe(tareas.t2)).toBe(tareasId);
    expect(await categoriaDe(tareas.t3)).toBe(tareasId);
    // Las de otro grupo no se tocan.
    expect(await categoriaDe(tareas.t4)).toBeNull();
  });

  it('una unidad puede tener sus porcentajes y volver a los de todas', async () => {
    const vista = await criterios.guardar(admin, {
      materiaId,
      grupoId: grupoA,
      unidadId: unidades.u2,
      criterios: [
        { nombre: 'Proyecto', tipo: TipoCriterio.PROYECTO, peso: 60 },
        { nombre: 'Asistencia', tipo: TipoCriterio.ASISTENCIA, peso: 30 },
        {
          nombre: 'Participación',
          tipo: TipoCriterio.PARTICIPACION,
          peso: 10,
          meta: 4,
        },
      ],
    });
    const u2 = vista.unidades.find((item) => item.unidad.id === unidades.u2);
    expect(u2?.personalizada).toBe(true);
    expect(u2?.criterios).toEqual([
      expect.objectContaining({ nombre: 'Proyecto', peso: 60 }),
      expect.objectContaining({ nombre: 'Asistencia', peso: 30 }),
      expect.objectContaining({ nombre: 'Participación', peso: 10, meta: 4 }),
    ]);
    // La lista de todas las unidades no cambió.
    expect(nombres(vista.base.criterios)).toEqual([
      'Examen 40',
      'Tareas 40',
      'Asistencia 20',
    ]);

    const sinAjuste = await criterios.quitarUnidad(
      admin,
      materiaId,
      grupoA,
      unidades.u2,
    );
    expect(
      sinAjuste.unidades.find((item) => item.unidad.id === unidades.u2)
        ?.personalizada,
    ).toBe(false);
    // Proyecto y Participación ya no pesan en ningún lado: salen del catálogo.
    expect(sinAjuste.catalogo.map((item) => item.nombre).sort()).toEqual([
      'Asistencia',
      'Examen',
      'Tareas',
    ]);
  });

  it('cambiar el nombre de un criterio que usa otro grupo le da a este su copia', async () => {
    const antes = await criterios.obtener(admin, materiaId, grupoA);
    const examen = antes.base.criterios.find((c) => c.nombre === 'Examen');
    const asistencia = antes.base.criterios.find(
      (c) => c.nombre === 'Asistencia',
    );
    // 8B usa el mismo examen del catálogo.
    await criterios.guardar(admin, {
      materiaId,
      grupoId: grupoB,
      criterios: [
        {
          id: examen?.id ?? undefined,
          nombre: 'Examen',
          tipo: TipoCriterio.EXAMEN,
          peso: 70,
        },
        {
          id: asistencia?.id ?? undefined,
          nombre: 'Asistencia',
          tipo: TipoCriterio.ASISTENCIA,
          peso: 30,
        },
      ],
    });
    await prisma.tarea.update({
      where: { id: tareas.t4 },
      data: { categoriaId: examen?.id },
    });

    const vistaB = await criterios.guardar(admin, {
      materiaId,
      grupoId: grupoB,
      criterios: [
        {
          id: examen?.id ?? undefined,
          nombre: 'Examen escrito',
          tipo: TipoCriterio.EXAMEN,
          peso: 70,
        },
        {
          id: asistencia?.id ?? undefined,
          nombre: 'Asistencia',
          tipo: TipoCriterio.ASISTENCIA,
          peso: 30,
        },
      ],
    });
    const escrito = vistaB.base.criterios.find(
      (c) => c.nombre === 'Examen escrito',
    );
    expect(escrito?.id).not.toBe(examen?.id);
    expect(await categoriaDe(tareas.t4)).toBe(escrito?.id);

    // 8A sigue con su "Examen".
    const vistaA = await criterios.obtener(admin, materiaId, grupoA);
    expect(vistaA.base.criterios.find((c) => c.id === examen?.id)?.nombre).toBe(
      'Examen',
    );
  });

  it('un criterio con actividades no puede volverse participación', async () => {
    const vista = await criterios.obtener(admin, materiaId, grupoA);
    const [examen, tareasCriterio, asistencia] = vista.base.criterios;
    await expect(
      criterios.guardar(admin, {
        materiaId,
        grupoId: grupoA,
        criterios: [
          {
            id: examen.id ?? undefined,
            nombre: examen.nombre,
            tipo: examen.tipo,
            peso: 40,
          },
          {
            id: tareasCriterio.id ?? undefined,
            nombre: 'Participación',
            tipo: TipoCriterio.PARTICIPACION,
            peso: 40,
            meta: 5,
          },
          {
            id: asistencia.id ?? undefined,
            nombre: asistencia.nombre,
            tipo: asistencia.tipo,
            peso: 20,
          },
        ],
      }),
    ).rejects.toThrow('ya tiene actividades');
  });

  it('el grupo puede volver a la ponderación predeterminada', async () => {
    const antes = await criterios.obtener(admin, materiaId, grupoB);
    expect(antes.base.origen).toBe('GRUPO');
    const vista = await criterios.quitarTodos(admin, materiaId, grupoB);
    expect(vista.base.origen).toBe('PREDETERMINADA');
    expect(nombres(vista.base.criterios)).toEqual([
      'Tareas 80',
      'Asistencia 20',
    ]);
    // 8A conserva lo suyo.
    expect(
      (await criterios.obtener(admin, materiaId, grupoA)).base.origen,
    ).toBe('GRUPO');
  });

  it('el reporte califica con la lista de cada unidad', async () => {
    const vista = await criterios.obtener(admin, materiaId, grupoA);
    const tareasId = vista.base.criterios.find(
      (c) => c.nombre === 'Tareas',
    )?.id;
    expect(tareasId).toBeTruthy();
    const reporte = await calificaciones.obtenerReporteDocente(admin, {
      materiaId,
      grupoId: grupoA,
    });
    // Sin alumnos inscritos no hay filas, pero el reporte trae la lista base.
    expect(reporte.criterios).toEqual(
      expect.objectContaining({ origen: 'GRUPO' }),
    );
    expect(reporte.ponderacion).toEqual(
      expect.objectContaining({ tareas: 80, asistencia: 20, origen: 'GRUPO' }),
    );
  });
});

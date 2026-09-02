import { Logger } from '@nestjs/common';
import { EstadoImportacionHorario } from '@prisma/client';
import { HorarioImportacionesService } from './horario-importaciones.service';
import type { HorarioVisionService } from './horario-vision.service';
import type { PrismaService } from '../prisma.service';

const ALUMNO = { id: 11, carreraId: 2, semestre: 3 };
const OPCIONES = {
  periodo: '2026-B',
  seccion: 'A',
  usarHorarioExistente: false,
};

function fotoFalsa() {
  return {
    buffer: Buffer.from('foto'),
    originalname: 'horario.jpg',
    mimetype: 'image/jpeg',
  } as Express.Multer.File;
}

function lectorQueFalla() {
  const extraer = jest.fn().mockRejectedValue(new Error('sin lector'));
  return { vision: { extraer } as unknown as HorarioVisionService, extraer };
}

/**
 * Prisma mínimo para recorrer el alta y la lectura sin base de datos. Devuelve
 * los espías por separado para poder afirmar sobre ellos sin tocar el objeto ya
 * convertido a PrismaService.
 */
function prismaFalso(importacionId = 5) {
  const estados: EstadoImportacionHorario[] = [];
  const registro = {
    id: importacionId,
    carreraId: ALUMNO.carreraId,
    periodo: OPCIONES.periodo,
    semestre: ALUMNO.semestre,
    seccion: OPCIONES.seccion,
    imagenContenido: Uint8Array.from(Buffer.from('foto')),
    imagenMime: 'image/jpeg',
    imagenRuta: null,
    carrera: { nombre: 'Ingeniería en Sistemas Computacionales' },
    bloques: [],
  };
  const buscarAdmins = jest.fn().mockResolvedValue([]);
  const buscarPendientes = jest.fn().mockResolvedValue([]);
  const crear = jest.fn().mockResolvedValue(registro);
  const actualizar = jest.fn(({ data }: { data: Record<string, unknown> }) => {
    if (data.estado) estados.push(data.estado as EstadoImportacionHorario);
    return Promise.resolve(registro);
  });
  const prisma = {
    importacionHorario: {
      create: crear,
      findUnique: jest.fn().mockResolvedValue(registro),
      findMany: buscarPendientes,
      update: actualizar,
    },
    usuario: { findMany: buscarAdmins },
    notificacion: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    reticulaMateria: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(),
  };
  return {
    prisma: prisma as unknown as PrismaService,
    estados,
    buscarAdmins,
    buscarPendientes,
  };
}

/** Cede el control para que avancen las tareas encoladas en segundo plano. */
async function vaciarPendientes() {
  for (let i = 0; i < 5; i += 1)
    await new Promise((resolve) => setImmediate(resolve));
}

describe('lectura en segundo plano de horarios importados', () => {
  beforeEach(() => {
    // Los fallos del lector se registran a propósito en estas pruebas.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('responde el registro sin esperar al lector', async () => {
    const { prisma, estados } = prismaFalso();
    let liberarLector: () => void = () => undefined;
    const lectorEnCurso = new Promise<never>((_, reject) => {
      liberarLector = () => reject(new Error('lector lento'));
    });
    const extraer = jest.fn().mockReturnValue(lectorEnCurso);
    const vision = { extraer } as unknown as HorarioVisionService;
    const service = new HorarioImportacionesService(prisma, vision);

    const respuesta = await service.registrarDesdeRegistro(
      ALUMNO,
      OPCIONES,
      fotoFalsa(),
    );

    // La respuesta llega sin que la lectura haya concluido nada.
    expect(respuesta).toMatchObject({
      estado: EstadoImportacionHorario.PENDIENTE_PROCESAMIENTO,
      importacionId: 5,
    });
    expect(estados).toEqual([]);

    // El lector arranca después de responder y sigue en vuelo.
    await vaciarPendientes();
    expect(extraer).toHaveBeenCalledTimes(1);
    expect(estados).toEqual([]);

    liberarLector();
    await vaciarPendientes();
    // Al fallar en segundo plano deja constancia en la importación.
    expect(estados).toEqual([EstadoImportacionHorario.ERROR]);
  });

  it('notifica a los administradores aunque la lectura falle después', async () => {
    const { prisma, buscarAdmins } = prismaFalso();
    const service = new HorarioImportacionesService(
      prisma,
      lectorQueFalla().vision,
    );

    await service.registrarDesdeRegistro(ALUMNO, OPCIONES, fotoFalsa());
    await vaciarPendientes();

    expect(buscarAdmins).toHaveBeenCalledWith(
      expect.objectContaining({ where: { rol: 'ADMIN', activo: true } }),
    );
  });

  it('reanuda al arrancar las importaciones que quedaron a medias', async () => {
    const { prisma, buscarPendientes } = prismaFalso();
    buscarPendientes.mockResolvedValue([{ id: 5 }]);
    const { vision, extraer } = lectorQueFalla();
    const service = new HorarioImportacionesService(prisma, vision);

    await service.onModuleInit();
    await vaciarPendientes();

    expect(buscarPendientes).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { estado: EstadoImportacionHorario.PENDIENTE_PROCESAMIENTO },
      }),
    );
    expect(extraer).toHaveBeenCalledTimes(1);
  });
});

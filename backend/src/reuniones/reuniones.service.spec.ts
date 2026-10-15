import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { ReunionesService } from './reuniones.service';
import { ClasesJustificadasService } from './clases-justificadas.service';

const pad = (n: number) => String(n).padStart(2, '0');
function clave(dias: number) {
  const d = new Date(Date.now() + dias * 86400000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

describe('ReunionesService', () => {
  const asignacionCount = jest.fn();
  const usuarioFindMany = jest.fn();
  const reunionCreate = jest.fn();
  const reunionFindUnique = jest.fn();
  const reunionUpdate = jest.fn();
  const convocadoCount = jest.fn();
  const crearVarias = jest.fn();
  const choques = jest.fn();
  const prisma = {
    jefeCarreraAsignacion: { count: asignacionCount },
    usuario: { findMany: usuarioFindMany },
    reunionAcademica: {
      create: reunionCreate,
      findUnique: reunionFindUnique,
      update: reunionUpdate,
    },
    reunionConvocado: { count: convocadoCount },
  } as unknown as PrismaService;
  const service = new ReunionesService(
    prisma,
    { crearVarias } as unknown as NotificacionesService,
    { choques } as unknown as ClasesJustificadasService,
  );

  const base = {
    carreraId: 3,
    titulo: 'Reunión ordinaria de academia',
    fecha: clave(7),
    horaInicio: '12:00',
    lugar: 'Sala de juntas',
  };
  const reunion = (extra: object = {}) => ({
    id: 5,
    carreraId: 3,
    carrera: { id: 3, nombre: 'Sistemas', codigo: 'ISC' },
    creadaPor: { id: 9, nombre: 'Jefe' },
    titulo: base.titulo,
    asunto: null,
    tipo: 'ORDINARIA',
    numeroActa: null,
    fecha: base.fecha,
    horaInicio: '12:00',
    horaFin: null,
    modalidad: 'PRESENCIAL',
    lugar: 'Sala de juntas',
    enlace: null,
    estado: 'PROGRAMADA',
    observaciones: null,
    puntos: [],
    acuerdos: [],
    convocados: [
      {
        reunionId: 5,
        docenteId: 31,
        asistio: null,
        docente: { id: 31, nombre: 'Ana', email: null },
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...extra,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    asignacionCount.mockResolvedValue(1);
    usuarioFindMany.mockResolvedValue([
      { id: 31, nombre: 'Ana' },
      { id: 32, nombre: 'Beto' },
    ]);
    reunionCreate.mockImplementation(() => Promise.resolve(reunion()));
    choques.mockResolvedValue(new Map());
  });

  it('convoca a todos los docentes de la carrera y les avisa', async () => {
    await service.crear(9, base);
    const [{ data }] = reunionCreate.mock.calls[0] as [
      { data: { convocados: { create: { docenteId: number }[] } } },
    ];
    expect(data.convocados.create).toEqual([
      { docenteId: 31 },
      { docenteId: 32 },
    ]);
    expect(crearVarias).toHaveBeenCalledWith(
      [31, 32].map(
        (usuarioId) =>
          expect.objectContaining({
            usuarioId,
            tipo: 'REUNION_ACADEMICA',
            referenciaTipo: 'ReunionAcademica',
          }) as unknown,
      ),
    );
  });

  it('avisa al convocado que la reunión se cruza con su clase', async () => {
    const choque = {
      horarioId: 7,
      materia: { id: 1, nombre: 'Cálculo', clave: 'C1' },
      grupo: { id: 2, nombre: '3A' },
      horaInicio: '12:00',
      horaFin: '13:00',
      justificacion: null,
      sinClases: null,
      listaCapturada: false,
    };
    choques.mockResolvedValue(new Map([[31, [choque]]]));
    await service.crear(9, base);
    const [items] = crearVarias.mock.calls[0] as [
      { usuarioId: number; mensaje: string }[],
    ];
    expect(items.find((i) => i.usuarioId === 31)?.mensaje).toContain(
      'Se cruza con tu clase de Cálculo (3A, 12:00–13:00)',
    );
    expect(items.find((i) => i.usuarioId === 32)?.mensaje).not.toContain(
      'Se cruza',
    );
  });

  it('rechaza programar en una carrera ajena', async () => {
    asignacionCount.mockResolvedValue(0);
    await expect(service.crear(9, base)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rechaza una fecha pasada', async () => {
    await expect(
      service.crear(9, { ...base, fecha: clave(-2) }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('pide lugar en una reunión presencial', async () => {
    await expect(
      service.crear(9, { ...base, lugar: '  ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza convocar a quien no imparte en la carrera', async () => {
    await expect(
      service.crear(9, { ...base, convocados: [31, 99] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('no captura el acta antes del día de la reunión', async () => {
    reunionFindUnique.mockResolvedValue(reunion());
    await expect(
      service.guardarActa(9, 5, { finalizar: true }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('el .ics solo lo descarga un docente convocado', async () => {
    reunionFindUnique.mockResolvedValue({ ...reunion(), puntos: [] });
    convocadoCount.mockResolvedValue(0);
    await expect(
      service.ics({ id: 40, rol: 'DOCENTE' }, 5),
    ).rejects.toBeInstanceOf(ForbiddenException);
    convocadoCount.mockResolvedValue(1);
    const archivo = await service.ics({ id: 31, rol: 'DOCENTE' }, 5);
    expect(archivo.contenido).toContain('BEGIN:VEVENT');
    expect(archivo.contenido).toContain('LOCATION:Sala de juntas');
  });
});

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
  const usuarioCount = jest.fn();
  const horarioFindMany = jest.fn();
  const documentoUpsert = jest.fn();
  const documentoFindUnique = jest.fn();
  const justificarAutomatico = jest.fn();
  const crearParaVarios = jest.fn();
  const reunionCreate = jest.fn();
  const reunionFindUnique = jest.fn();
  const reunionUpdate = jest.fn();
  const convocadoCount = jest.fn();
  const crearVarias = jest.fn();
  const choques = jest.fn();
  const prisma = {
    jefeCarreraAsignacion: { count: asignacionCount },
    usuario: { findMany: usuarioFindMany, count: usuarioCount },
    horarioMateria: { findMany: horarioFindMany },
    reunionDocumento: {
      upsert: documentoUpsert,
      findUnique: documentoFindUnique,
    },
    reunionAcademica: {
      create: reunionCreate,
      findUnique: reunionFindUnique,
      update: reunionUpdate,
    },
    reunionConvocado: { count: convocadoCount },
  } as unknown as PrismaService;
  const service = new ReunionesService(
    prisma,
    { crearVarias, crearParaVarios } as unknown as NotificacionesService,
    { choques, justificarAutomatico } as unknown as ClasesJustificadasService,
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
    academia: 'Academia de Sistemas',
    apertura: null,
    horaCierre: null,
    presidenteId: null,
    secretarioId: null,
    presidente: null,
    secretario: null,
    creadaPorId: 9,
    puntos: [],
    acuerdos: [],
    seguimiento: [],
    documentos: [],
    clasesJustificadas: [],
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
    reunionFindUnique.mockImplementation(() => Promise.resolve(reunion()));
    horarioFindMany.mockResolvedValue([
      { docenteId: 31, materia: { nombre: 'Cálculo' } },
    ]);
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

  it('deja sin clase las clases que se cruzan y se lo dice al convocado', async () => {
    const choque = {
      horarioId: 7,
      materia: { id: 1, nombre: 'Cálculo', clave: 'C1' },
      grupo: { id: 2, nombre: '3A' },
      horaInicio: '12:00',
      horaFin: '13:00',
      justificacion: {
        motivo: 'Reunión de academia',
        reunionId: 5,
        creadaEn: new Date(),
        avisarAlumnos: true,
        automatica: true,
      },
      sinClases: null,
      listaCapturada: false,
    };
    choques.mockResolvedValue(new Map([[31, [choque]]]));
    await service.crear(9, base);
    expect(justificarAutomatico).toHaveBeenCalledWith(
      expect.objectContaining({ id: 5 }),
      [31, 32],
    );
    const [items] = crearVarias.mock.calls[0] as [
      { usuarioId: number; mensaje: string }[],
    ];
    expect(items.find((i) => i.usuarioId === 31)?.mensaje).toContain(
      'Tu clase de Cálculo (3A, 12:00–13:00) queda sin clase',
    );
    expect(items.find((i) => i.usuarioId === 32)?.mensaje).not.toContain(
      'sin clase',
    );
  });

  it('el detalle trae las materias que imparte cada convocado', async () => {
    const detalle = await service.detalleJefe(9, 5);
    expect(detalle.convocados[0]).toMatchObject({
      id: 31,
      materias: ['Cálculo'],
    });
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

  it('convoca a docentes de otras carreras', async () => {
    usuarioCount.mockResolvedValue(2);
    await service.crear(9, { ...base, convocados: [31, 77] });
    const [{ data }] = reunionCreate.mock.calls[0] as [
      { data: { convocados: { create: { docenteId: number }[] } } },
    ];
    expect(data.convocados.create).toEqual([
      { docenteId: 31 },
      { docenteId: 77 },
    ]);
  });

  it('rechaza convocar a quien no es un docente activo', async () => {
    usuarioCount.mockResolvedValue(1);
    await expect(
      service.crear(9, { ...base, convocados: [31, 99] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('el presidente y el secretario salen de los convocados o la jefatura', async () => {
    usuarioCount.mockResolvedValue(1);
    await expect(
      service.crear(9, { ...base, convocados: [31], secretarioId: 40 }),
    ).rejects.toThrow('El secretario(a) debe ser uno de los convocados');
    await service.crear(9, {
      ...base,
      convocados: [31],
      presidenteId: 9,
      secretarioId: 31,
    });
    const [{ data }] = reunionCreate.mock.calls[0] as [
      { data: { presidenteId: number; secretarioId: number } },
    ];
    expect(data).toMatchObject({ presidenteId: 9, secretarioId: 31 });
  });

  it('el acta se sube sólo con la reunión finalizada y en PDF o Word', async () => {
    const archivo = { originalname: 'acta.pdf', buffer: Buffer.from('%PDF-') };
    await expect(service.subirDocumento(9, 5, archivo)).rejects.toBeInstanceOf(
      ConflictException,
    );

    reunionFindUnique.mockImplementation(() =>
      Promise.resolve(reunion({ estado: 'FINALIZADA', fecha: clave(-1) })),
    );
    await expect(
      service.subirDocumento(9, 5, { ...archivo, originalname: 'acta.txt' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await service.subirDocumento(9, 5, archivo);
    expect(documentoUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reunionId_formato: { reunionId: 5, formato: 'PDF' } },
      }),
    );
    expect(crearParaVarios).toHaveBeenCalledWith(
      [31],
      expect.objectContaining({
        titulo: expect.stringContaining('Acta firmada'),
      }),
    );
  });

  it('el acta subida sólo la ve un convocado o la jefatura', async () => {
    convocadoCount.mockResolvedValue(0);
    await expect(
      service.documento({ id: 40, rol: 'DOCENTE' }, 5, 'PDF'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    convocadoCount.mockResolvedValue(1);
    documentoFindUnique.mockResolvedValue({
      nombre: 'acta.pdf',
      mime: 'application/pdf',
      contenido: new Uint8Array([37, 80]),
    });
    const archivo = await service.documento(
      { id: 31, rol: 'DOCENTE' },
      5,
      'PDF',
    );
    expect(Buffer.isBuffer(archivo.contenido)).toBe(true);
  });

  it('no captura el acta antes del día de la reunión', async () => {
    await expect(
      service.guardarActa(9, 5, { finalizar: true }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('no finaliza el acta con asistencia sin confirmar', async () => {
    reunionFindUnique.mockImplementation(() =>
      Promise.resolve(reunion({ fecha: clave(-1) })),
    );
    await expect(
      service.guardarActa(9, 5, { finalizar: true }),
    ).rejects.toThrow(
      'Confirma la asistencia de 1 convocado antes de finalizar',
    );
  });

  it('el .ics solo lo descarga un docente convocado', async () => {
    reunionFindUnique.mockImplementation(() =>
      Promise.resolve({ ...reunion(), puntos: [] }),
    );
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

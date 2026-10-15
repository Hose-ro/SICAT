import { ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { MateriasService } from './materias.service';

describe('MateriasService · jefatura de carrera', () => {
  const jefe = { id: 9, rol: 'JEFE_CARRERA' };
  const asignacionCount = jest.fn();
  const materiaCount = jest.fn();
  const materiaCreate = jest.fn();
  const materiaFindUnique = jest.fn();
  const materiaUpdate = jest.fn();
  const grupoCount = jest.fn();
  const zero = jest.fn().mockResolvedValue(0);
  const prisma = {
    jefeCarreraAsignacion: { count: asignacionCount },
    materia: {
      count: materiaCount,
      create: materiaCreate,
      findUnique: materiaFindUnique,
      findFirst: jest.fn().mockResolvedValue(null),
      update: materiaUpdate,
    },
    carrera: { findUnique: jest.fn().mockResolvedValue({ id: 3 }) },
    grupo: { count: grupoCount },
    inscripcion: { count: zero },
    calificacionUnidad: { count: zero },
    tarea: { count: zero },
    claseSesion: { count: zero },
  } as unknown as PrismaService;
  const service = new MateriasService(prisma, {
    crearParaAdmins: jest.fn(),
  } as unknown as NotificacionesService);
  const dto = {
    nombre: 'Redes',
    clave: 'scd-1021',
    numUnidades: 5,
    carreraId: 3,
    semestre: 5,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    asignacionCount.mockResolvedValue(1);
    materiaCount.mockResolvedValue(0);
    materiaCreate.mockResolvedValue({ id: 40, nombre: 'Redes' });
    jest.spyOn(service, 'findOne').mockResolvedValue({ id: 40 } as never);
  });

  it('crea la materia en su carrera, sin docente y con la clave normalizada', async () => {
    await service.create(dto, jefe, null);
    expect(asignacionCount).toHaveBeenCalledWith({
      where: { usuarioId: 9, carreraId: 3, activa: true },
    });
    const [{ data }] = materiaCreate.mock.calls[0] as [
      { data: { clave: string; docenteId: number | null; carreraId: number } },
    ];
    expect(data).toMatchObject({
      clave: 'SCD-1021',
      docenteId: null,
      carreraId: 3,
    });
  });

  it('rechaza crear en una carrera fuera de su alcance', async () => {
    asignacionCount.mockResolvedValue(0);
    await expect(service.create(dto, jefe, null)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(materiaCreate).not.toHaveBeenCalled();
  });

  it('rechaza una clave repetida en la carrera', async () => {
    materiaCount.mockResolvedValue(1);
    await expect(service.create(dto, jefe, null)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('no edita materias de otra carrera', async () => {
    materiaFindUnique.mockResolvedValue({ carreraId: 8, clave: 'X', id: 40 });
    asignacionCount.mockResolvedValue(0);
    await expect(
      service.update(40, { nombre: 'Otra' }, jefe),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(materiaUpdate).not.toHaveBeenCalled();
  });

  it('no elimina una materia que ya se imparte en un grupo', async () => {
    materiaFindUnique.mockResolvedValue({ carreraId: 3 });
    grupoCount.mockResolvedValue(1);
    await expect(service.remove(40, jefe)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

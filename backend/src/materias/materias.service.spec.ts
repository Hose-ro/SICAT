import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { MateriasService } from './materias.service';

describe('MateriasService', () => {
  const materiaFindUnique = jest.fn();
  const materiaFindFirst = jest.fn();
  const materiaUpdate = jest.fn();
  const carreraFindUnique = jest.fn();
  const prisma = {
    materia: {
      findUnique: materiaFindUnique,
      findFirst: materiaFindFirst,
      update: materiaUpdate,
    },
    carrera: { findUnique: carreraFindUnique },
  } as unknown as PrismaService;
  const notificaciones = {
    crearParaAdmins: jest.fn(),
  } as unknown as NotificacionesService;
  const service = new MateriasService(prisma, notificaciones);

  const materia = {
    id: 7,
    nombre: 'Cálculo Diferencial',
    clave: 'ACF-2301',
    descripcion: null,
    carreraId: 1,
    semestre: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    materiaFindUnique.mockResolvedValue(materia);
    materiaFindFirst.mockResolvedValue(null);
    materiaUpdate.mockResolvedValue({ ...materia, clave: 'ACF-0901' });
    carreraFindUnique.mockResolvedValue({ id: 1 });
  });

  it('normaliza y actualiza los datos generales de una materia', async () => {
    await service.update(7, {
      nombre: '  Cálculo Diferencial  ',
      clave: ' acf-0901 ',
      descripcion: '  Materia base  ',
      carreraId: 1,
      semestre: 1,
    });

    expect(materiaUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        nombre: 'Cálculo Diferencial',
        clave: 'ACF-0901',
        descripcion: 'Materia base',
        carreraId: 1,
        semestre: 1,
      },
    });
  });

  it('busca la clave duplicada solo dentro de la carrera destino', async () => {
    await service.update(7, { clave: 'ACF-0901', carreraId: 3 });

    expect(materiaFindFirst).toHaveBeenCalledWith({
      where: { clave: 'ACF-0901', carreraId: 3 },
      select: { id: true },
    });
  });

  it('rechaza una clave asignada a otra materia de la misma carrera', async () => {
    materiaFindFirst.mockResolvedValue({ id: 22 });

    await expect(
      service.update(7, { clave: 'SCC-1019' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(materiaUpdate).not.toHaveBeenCalled();
  });

  it('rechaza una carrera inexistente', async () => {
    carreraFindUnique.mockResolvedValue(null);

    await expect(service.update(7, { carreraId: 999 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(materiaUpdate).not.toHaveBeenCalled();
  });
});

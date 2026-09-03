import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { HorariosService } from './horarios.service';

describe('HorariosService', () => {
  const materiaFindUnique = jest.fn();
  const usuarioFindUnique = jest.fn();
  const grupoFindUnique = jest.fn();
  const reticulaFindFirst = jest.fn();
  const horarioFindMany = jest.fn();
  const horarioFindFirst = jest.fn();
  const horarioCount = jest.fn();

  const prisma = {
    materia: { findUnique: materiaFindUnique },
    usuario: { findUnique: usuarioFindUnique },
    grupo: { findUnique: grupoFindUnique },
    reticulaMateria: { findFirst: reticulaFindFirst },
    horarioMateria: {
      findMany: horarioFindMany,
      findFirst: horarioFindFirst,
      count: horarioCount,
    },
  } as unknown as PrismaService;

  const service = new HorariosService(prisma);

  const dto = {
    materiaId: 1,
    docenteId: 7,
    grupoId: 3,
    bloques: [{ dia: 'Lunes', horaInicio: '07:00', horaFin: '09:00' }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    materiaFindUnique.mockResolvedValue({
      id: 1,
      nombre: 'Cálculo Diferencial',
      clave: 'ACF-0901',
      semestre: 1,
      carreraId: 5,
      academias: [],
    });
    usuarioFindUnique.mockResolvedValue({
      id: 7,
      nombre: 'Ana Ruiz',
      rol: 'DOCENTE',
      activo: true,
      academias: [{ id: 2, nombre: 'Sistemas' }],
    });
    grupoFindUnique.mockResolvedValue({
      id: 3,
      nombre: '103A',
      semestre: 1,
      activo: true,
    });
    reticulaFindFirst.mockResolvedValue(null);
    horarioFindMany.mockResolvedValue([]);
    horarioFindFirst.mockResolvedValue(null);
    horarioCount.mockResolvedValue(0);
  });

  const ocupante = (docente: string) => ({
    id: 44,
    materia: { nombre: 'Cálculo Diferencial' },
    grupo: { nombre: '103A' },
    docente: { nombre: docente },
    dias: 'Lunes',
    horaInicio: '07:00',
    horaFin: '09:00',
  });

  it('rechaza la materia cuando otro docente ya la imparte en ese grupo', async () => {
    horarioFindFirst.mockResolvedValue(ocupante('Luis Pérez'));

    const resultado = await service.validarConflicto(dto as never);

    expect(resultado.ok).toBe(false);
    expect(resultado.message).toContain('Luis Pérez');
    expect(resultado.conflicts[0].tipo).toBe('materia-grupo');
    expect(horarioFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          materiaId: 1,
          grupoId: 3,
          activo: true,
          docenteId: { not: 7 },
        }) as Record<string, unknown>,
      }),
    );
  });

  it('permite la misma materia en otro grupo', async () => {
    // La búsqueda de titularidad filtra por grupo: en 103B no hay ocupante.
    horarioFindFirst.mockResolvedValue(null);
    grupoFindUnique.mockResolvedValue({
      id: 9,
      nombre: '103B',
      semestre: 1,
      activo: true,
    });

    const resultado = await service.validarConflicto({
      ...dto,
      grupoId: 9,
    } as never);

    expect(resultado.ok).toBe(true);
  });

  it('no reclama titularidad cuando la clase no tiene grupo', async () => {
    const resultado = await service.validarConflicto({
      materiaId: 1,
      docenteId: 7,
      bloques: dto.bloques,
    } as never);

    expect(resultado.ok).toBe(true);
    expect(horarioFindFirst).not.toHaveBeenCalled();
  });

  it('rechaza una materia de un semestre distinto al del grupo', async () => {
    grupoFindUnique.mockResolvedValue({
      id: 3,
      nombre: '503A',
      semestre: 5,
      activo: true,
    });

    await expect(service.validarConflicto(dto as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('consulta la retícula cuando la materia no tiene semestre propio', async () => {
    materiaFindUnique.mockResolvedValue({
      id: 1,
      nombre: 'Cálculo Diferencial',
      clave: 'ACF-0901',
      semestre: null,
      carreraId: 5,
      academias: [],
    });
    reticulaFindFirst.mockResolvedValue({ semestre: 5 });

    await expect(service.validarConflicto(dto as never)).rejects.toThrow(
      /5° semestre/,
    );
  });

  it('deja pasar la clase cuando no hay semestre con qué comparar', async () => {
    materiaFindUnique.mockResolvedValue({
      id: 1,
      nombre: 'Materia suelta',
      clave: 'XXX-0001',
      semestre: null,
      carreraId: null,
      academias: [],
    });

    const resultado = await service.validarConflicto(dto as never);

    expect(resultado.ok).toBe(true);
  });

  it('impide que un docente borre la clase de otro', async () => {
    horarioFindMany.mockResolvedValue([{ id: 10, materiaId: 1 }]);
    horarioCount.mockResolvedValue(1);

    await expect(
      service.eliminarClase([10], { id: 7, rol: 'DOCENTE' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('programa siempre a nombre del docente en sesión', async () => {
    await service.validarConflicto({ ...dto, docenteId: 99 } as never, {
      id: 7,
      rol: 'DOCENTE',
    });

    expect(usuarioFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 7 } }),
    );
  });
});

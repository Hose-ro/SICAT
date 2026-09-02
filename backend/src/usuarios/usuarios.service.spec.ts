import { ConflictException } from '@nestjs/common';
import { Prisma, Rol, TipoEventoAuth } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { UsuariosService } from './usuarios.service';

describe('UsuariosService', () => {
  const usuarioFindUnique = jest.fn();
  const usuarioFindMany = jest.fn();
  const transaction = jest.fn();
  const prisma = {
    usuario: {
      findUnique: usuarioFindUnique,
      findMany: usuarioFindMany,
    },
    $transaction: transaction,
  } as unknown as PrismaService;
  const emailAuthEnabled = jest.fn().mockReturnValue('true');
  const config = { get: emailAuthEnabled } as unknown as ConfigService;
  const service = new UsuariosService(prisma, config);

  beforeEach(() => {
    jest.clearAllMocks();
    emailAuthEnabled.mockReturnValue('true');
  });

  it('sólo permite campos de perfil en una actualización propia', async () => {
    const tx = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue({ email: 'ana@example.com' }),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 20, nombre: 'Ana López' }),
      },
    };
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    );

    await service.updateOwnProfile(20, {
      nombre: '  Ana   López ',
      rol: Rol.ADMIN,
      password: 'inyectada',
    } as never);

    expect(tx.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          nombre: 'Ana López',
          email: undefined,
          emailVerificadoAt: undefined,
          telefono: undefined,
          tokenVersion: undefined,
        },
      }),
    );
    const updateCall = tx.usuario.update.mock.calls[0] as unknown as [
      { data: Record<string, unknown> },
    ];
    expect(updateCall[0].data).not.toHaveProperty('rol');
    expect(updateCall[0].data).not.toHaveProperty('password');
  });

  it('invalida enlaces pendientes cuando el usuario cambia su correo', async () => {
    const tx = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue({ email: 'ana@example.com' }),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({
          id: 20,
          email: 'nuevo@example.com',
          emailVerificadoAt: null,
        }),
      },
      authToken: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    );

    await service.updateOwnProfile(20, { email: 'NUEVO@example.com' });

    expect(tx.authToken.updateMany).toHaveBeenCalledWith({
      where: { usuarioId: 20, usedAt: null },
      data: { usedAt: expect.any(Date) as Date },
    });
    expect(tx.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'nuevo@example.com',
          emailVerificadoAt: null,
          tokenVersion: { increment: 1 },
        }) as Record<string, unknown>,
      }),
    );
  });

  it('desactiva sin seleccionar ni devolver el hash de contraseña', async () => {
    const tx = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue({
          id: 20,
          rol: Rol.ALUMNO,
          activo: true,
        }),
        update: jest.fn().mockResolvedValue({
          id: 20,
          nombre: 'Ana López',
          rol: Rol.ALUMNO,
          activo: false,
        }),
      },
      authAudit: { create: jest.fn().mockResolvedValue({ id: 1 }) },
    };
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    );

    const result = await service.remove(20, 1);

    expect(tx.usuario.update).toHaveBeenCalledWith({
      where: { id: 20 },
      data: { activo: false, tokenVersion: { increment: 1 } },
      select: { id: true, nombre: true, rol: true, activo: true },
    });
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(result).not.toHaveProperty('password');
  });

  it('impide desactivar al último administrador activo', async () => {
    const tx = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue({
          id: 20,
          rol: Rol.ADMIN,
          activo: true,
        }),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
      },
      authAudit: { create: jest.fn() },
    };
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    );

    await expect(service.remove(20, 20)).rejects.toThrow(
      'Debe permanecer al menos un administrador activo',
    );

    expect(tx.usuario.count).toHaveBeenCalledWith({
      where: {
        rol: Rol.ADMIN,
        activo: true,
        id: { not: 20 },
      },
    });
    expect(tx.usuario.update).not.toHaveBeenCalled();
    expect(tx.authAudit.create).not.toHaveBeenCalled();
  });

  it('permite desactivar un administrador si queda otro activo', async () => {
    const tx = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue({
          id: 20,
          rol: Rol.ADMIN,
          activo: true,
        }),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue({
          id: 20,
          nombre: 'Admin secundario',
          rol: Rol.ADMIN,
          activo: false,
        }),
      },
      authAudit: { create: jest.fn().mockResolvedValue({ id: 1 }) },
    };
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    );

    await expect(service.remove(20, 1)).resolves.toEqual(
      expect.objectContaining({ activo: false }),
    );

    expect(tx.usuario.update).toHaveBeenCalledTimes(1);
    expect(tx.authAudit.create).toHaveBeenCalledWith({
      data: {
        usuarioId: 20,
        tipo: TipoEventoAuth.CUENTA_DESACTIVADA,
        metadata: { adminUserId: 1 },
      },
    });
  });

  it('convierte un conflicto concurrente entre administradores en una respuesta clara', async () => {
    transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('serialization conflict', {
        code: 'P2034',
        clientVersion: 'test',
      }),
    );

    await expect(service.remove(20, 1)).rejects.toThrow(
      'El estado de los administradores cambió; actualiza la lista e intenta nuevamente',
    );
  });

  it('lista usuarios con una selección explícita que excluye credenciales', async () => {
    usuarioFindMany.mockResolvedValue([]);

    await service.findAll();

    const findManyCall = usuarioFindMany.mock.calls[0] as unknown as [
      { select: Record<string, unknown> },
    ];
    expect(findManyCall[0].select).not.toHaveProperty('password');
    expect(findManyCall[0].select).not.toHaveProperty('tokenVersion');
    expect(findManyCall[0].select).not.toHaveProperty('failedLoginAttempts');
    expect(findManyCall[0].select).not.toHaveProperty('lockedUntil');
    // El panel filtra por carrera y grupo con estos identificadores planos.
    expect(findManyCall[0].select).toMatchObject({
      carreraId: true,
      grupoId: true,
    });
  });

  it('ignora campos internos incluso en una actualización administrativa', async () => {
    usuarioFindUnique.mockResolvedValue({
      id: 20,
      nombre: 'Ana López',
      email: 'ana@example.com',
      rol: Rol.ALUMNO,
      activo: true,
    });
    const tx = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue({
          id: 20,
          nombre: 'Ana López',
          email: 'ana@example.com',
          rol: Rol.ALUMNO,
          activo: true,
        }),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({
          id: 20,
          nombre: 'Ana López',
          rol: Rol.ALUMNO,
          activo: true,
        }),
      },
      authAudit: { create: jest.fn() },
    };
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    );

    const result = await service.updateByAdmin(
      20,
      {
        nombre: '  Ana   López ',
        tokenVersion: 999,
        registroAprobado: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      } as never,
      1,
    );

    const updateCall = tx.usuario.update.mock.calls[0] as unknown as [
      { data: Record<string, unknown>; select: Record<string, unknown> },
    ];
    expect(updateCall[0].data).not.toHaveProperty('registroAprobado');
    expect(updateCall[0].data).not.toHaveProperty('failedLoginAttempts');
    expect(updateCall[0].data).not.toHaveProperty('lockedUntil');
    expect(updateCall[0].data.tokenVersion).toBeUndefined();
    expect(updateCall[0].select).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('password');
  });

  it('revoca sesiones y exige verificar un correo cambiado por administración', async () => {
    usuarioFindUnique.mockResolvedValue({
      id: 20,
      nombre: 'Ana López',
      email: 'ana@example.com',
      rol: Rol.ALUMNO,
      activo: true,
    });
    const tx = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue({
          id: 20,
          nombre: 'Ana López',
          email: 'ana@example.com',
          rol: Rol.ALUMNO,
          activo: true,
        }),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({
          id: 20,
          email: 'nuevo@example.com',
          emailVerificadoAt: null,
        }),
      },
      authToken: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      authAudit: { create: jest.fn() },
    };
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    );

    await service.updateByAdmin(20, { email: 'NUEVO@example.com' }, 1);

    expect(tx.authToken.updateMany).toHaveBeenCalledWith({
      where: { usuarioId: 20, usedAt: null },
      data: { usedAt: expect.any(Date) as Date },
    });
    expect(tx.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'nuevo@example.com',
          emailVerificadoAt: null,
          tokenVersion: { increment: 1 },
        }) as Record<string, unknown>,
      }),
    );
  });

  it.each([
    ['desactivarlo', { activo: false }],
    ['cambiarle el rol', { rol: Rol.DOCENTE }],
  ])(
    'impide %s cuando es el último administrador activo',
    async (_action, dto) => {
      const tx = {
        usuario: {
          findUnique: jest.fn().mockResolvedValue({
            id: 20,
            email: 'admin@example.com',
            rol: Rol.ADMIN,
            activo: true,
          }),
          count: jest.fn().mockResolvedValue(0),
          update: jest.fn(),
        },
        authAudit: { create: jest.fn() },
      };
      transaction.mockImplementation(
        (callback: (client: typeof tx) => unknown) =>
          Promise.resolve(callback(tx)),
      );

      await expect(service.updateByAdmin(20, dto, 20)).rejects.toThrow(
        'Debe permanecer al menos un administrador activo',
      );

      expect(tx.usuario.update).not.toHaveBeenCalled();
      expect(tx.authAudit.create).not.toHaveBeenCalled();
      expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    },
  );

  it('impide aprobar una cuenta sin correo verificado', async () => {
    const tx = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue({
          id: 20,
          rol: Rol.ALUMNO,
          activo: true,
          email: 'ana@example.com',
          emailVerificadoAt: null,
          registroAprobado: false,
        }),
        updateMany: jest.fn(),
      },
    };
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    );

    await expect(service.approveRegistration(20, 1)).rejects.toThrow(
      'El alumno debe verificar su correo antes de ser aprobado',
    );
    expect(tx.usuario.updateMany).not.toHaveBeenCalled();
  });

  it('aprueba atómicamente sólo si la cuenta sigue activa y verificada', async () => {
    const verifiedAt = new Date();
    const tx = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue({
          id: 20,
          rol: Rol.ALUMNO,
          activo: true,
          email: 'ana@example.com',
          emailVerificadoAt: verifiedAt,
          registroAprobado: false,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 20,
          nombre: 'Ana López',
          email: 'ana@example.com',
          registroAprobado: true,
        }),
      },
      authAudit: { create: jest.fn().mockResolvedValue({ id: 1 }) },
    };
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    );

    const result = await service.approveRegistration(20, 1);

    expect(tx.usuario.updateMany).toHaveBeenCalledWith({
      where: {
        id: 20,
        rol: Rol.ALUMNO,
        activo: true,
        registroAprobado: false,
        emailVerificadoAt: { not: null },
      },
      data: {
        registroAprobado: true,
        tokenVersion: { increment: 1 },
      },
    });
    expect(tx.authAudit.create).toHaveBeenCalledWith({
      data: {
        usuarioId: 20,
        tipo: TipoEventoAuth.CUENTA_APROBADA,
        metadata: { adminUserId: 1, grupoAsignadoId: null },
      },
    });
    expect(result.registroAprobado).toBe(true);
  });

  it('aprueba por número de control sin correo cuando el correo está desactivado', async () => {
    emailAuthEnabled.mockReturnValue('false');
    const tx = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue({
          id: 20,
          rol: Rol.ALUMNO,
          activo: true,
          email: null,
          emailVerificadoAt: null,
          registroAprobado: false,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 20,
          nombre: 'Ana López',
          email: null,
          registroAprobado: true,
        }),
      },
      authAudit: { create: jest.fn().mockResolvedValue({ id: 1 }) },
    };
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    );

    await expect(service.approveRegistration(20, 1)).resolves.toEqual(
      expect.objectContaining({ registroAprobado: true }),
    );
    expect(tx.usuario.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 20,
          rol: Rol.ALUMNO,
          activo: true,
          registroAprobado: false,
        },
      }),
    );
  });

  const txAprobacion = (grupos: { id: number; nombre: string }[]) => ({
    usuario: {
      findUnique: jest.fn().mockResolvedValue({
        id: 20,
        rol: Rol.ALUMNO,
        activo: true,
        email: null,
        emailVerificadoAt: null,
        registroAprobado: false,
        carreraId: 3,
        semestre: 1,
        grupoId: null,
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({ id: 20 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 20,
        nombre: 'Ana López',
        email: null,
        registroAprobado: true,
      }),
    },
    grupo: { findMany: jest.fn().mockResolvedValue(grupos) },
    authAudit: { create: jest.fn().mockResolvedValue({ id: 1 }) },
  });

  it('asigna el grupo de su carrera y semestre al aprobar', async () => {
    emailAuthEnabled.mockReturnValue('false');
    const tx = txAprobacion([{ id: 8, nombre: '103A' }]);
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    );

    await expect(service.approveRegistration(20, 1)).resolves.toEqual(
      expect.objectContaining({ grupo: { id: 8, nombre: '103A' } }),
    );
    expect(tx.grupo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { carreraId: 3, semestre: 1, activo: true },
      }),
    );
    expect(tx.usuario.update).toHaveBeenCalledWith({
      where: { id: 20 },
      data: { grupoId: 8 },
    });
    expect(tx.authAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: { adminUserId: 1, grupoAsignadoId: 8 },
        }) as Record<string, unknown>,
      }),
    );
  });

  it('deja la asignación al administrador cuando hay varias secciones', async () => {
    emailAuthEnabled.mockReturnValue('false');
    const tx = txAprobacion([
      { id: 8, nombre: '103A' },
      { id: 9, nombre: '103B' },
    ]);
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    );

    await expect(service.approveRegistration(20, 1)).resolves.toEqual(
      expect.objectContaining({ grupo: null }),
    );
    expect(tx.usuario.update).not.toHaveBeenCalled();
  });

  const contador = (count: number) => jest.fn().mockResolvedValue({ count });

  const txEliminacion = () => ({
    usuario: {
      findUnique: jest.fn().mockResolvedValue({
        id: 20,
        nombre: 'Ana López',
        email: 'ana@example.com',
        numeroControl: null,
        username: null,
        rol: Rol.ALUMNO,
        activo: true,
      }),
      count: jest.fn().mockResolvedValue(2),
      delete: jest
        .fn()
        .mockResolvedValue({ id: 20, nombre: 'Ana López', rol: Rol.ALUMNO }),
    },
    asistencia: { deleteMany: contador(4), updateMany: contador(1) },
    entregaTarea: { deleteMany: contador(2) },
    tarea: { deleteMany: contador(1) },
    claseSesion: { deleteMany: contador(3) },
    horarioMateria: { deleteMany: contador(1) },
    inscripcion: { deleteMany: contador(5) },
    calificacionUnidad: { deleteMany: contador(6) },
    importacionHorario: { deleteMany: contador(1) },
    notificacion: { deleteMany: contador(7) },
    materia: { updateMany: contador(2) },
    alertaCarrera: { updateMany: contador(0) },
    authAudit: { create: jest.fn().mockResolvedValue({ id: 1 }) },
  });

  it('elimina la cuenta junto con todo su historial académico', async () => {
    const tx = txEliminacion();
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    );

    const resultado = await service.removePermanently(20, 1);

    expect(tx.asistencia.deleteMany).toHaveBeenCalledWith({
      where: { alumnoId: 20 },
    });
    expect(tx.asistencia.deleteMany).toHaveBeenCalledWith({
      where: { claseSesion: { docenteId: 20 } },
    });
    expect(tx.entregaTarea.deleteMany).toHaveBeenCalledWith({
      where: { tarea: { docenteId: 20 } },
    });
    expect(tx.tarea.deleteMany).toHaveBeenCalledWith({
      where: { docenteId: 20 },
    });
    expect(tx.horarioMateria.deleteMany).toHaveBeenCalledWith({
      where: { docenteId: 20 },
    });
    // Las materias no se borran: sólo se quedan sin docente.
    expect(tx.materia.updateMany).toHaveBeenCalledWith({
      where: { docenteId: 20 },
      data: { docenteId: null },
    });
    expect(tx.usuario.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 20 } }),
    );
    expect(resultado).toEqual(
      expect.objectContaining({
        id: 20,
        historial: expect.objectContaining({
          asistencias: 8,
          entregas: 4,
          inscripciones: 5,
          calificaciones: 6,
        }) as Record<string, number>,
      }),
    );
  });

  it('deja constancia de lo eliminado en la bitácora', async () => {
    const tx = txEliminacion();
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    );

    await service.removePermanently(20, 1);

    expect(tx.authAudit.create).toHaveBeenCalledWith({
      data: {
        tipo: TipoEventoAuth.CUENTA_ELIMINADA,
        identifier: 'ana@example.com',
        metadata: expect.objectContaining({
          adminUserId: 1,
          usuarioEliminadoId: 20,
          nombre: 'Ana López',
          rol: Rol.ALUMNO,
        }) as Record<string, unknown>,
      },
    });
  });

  it('no permite que un administrador se elimine a sí mismo', async () => {
    await expect(service.removePermanently(1, 1)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it('traduce una llave foránea pendiente en un conflicto explicado', async () => {
    transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('FK', {
        code: 'P2003',
        clientVersion: '6.19.3',
      }),
    );

    await expect(service.removePermanently(20, 1)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

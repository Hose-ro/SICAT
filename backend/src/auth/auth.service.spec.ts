import { JwtService } from '@nestjs/jwt';
import { Rol, TipoEventoAuth, TipoTokenAuth } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { AuthMailService } from './auth-mail.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const usuarioFindMany = jest.fn();
  const usuarioFindUnique = jest.fn();
  const usuarioUpdate = jest.fn();
  const authTokenFindUnique = jest.fn();
  const authTokenUpdateMany = jest.fn();
  const authTokenCreate = jest.fn();
  const authAuditCreate = jest.fn();
  const transaction = jest.fn();
  const prisma = {
    usuario: {
      findMany: usuarioFindMany,
      findUnique: usuarioFindUnique,
      update: usuarioUpdate,
    },
    authToken: {
      findUnique: authTokenFindUnique,
      updateMany: authTokenUpdateMany,
      create: authTokenCreate,
    },
    authAudit: { create: authAuditCreate },
    $transaction: transaction,
  } as unknown as PrismaService;

  const sign = jest.fn();
  const jwt = { sign } as unknown as JwtService;
  const createUser = jest.fn();
  const usuarios = { create: createUser } as unknown as UsuariosService;
  const assertAvailableForPublicRegistration = jest.fn();
  const isEmailEnabled = jest.fn().mockReturnValue(true);
  const sendVerification = jest.fn();
  const mail = {
    assertAvailableForPublicRegistration,
    isEmailEnabled,
    sendVerification,
  } as unknown as AuthMailService;

  const service = new AuthService(prisma, jwt, usuarios, mail);

  beforeEach(() => {
    jest.clearAllMocks();
    isEmailEnabled.mockReturnValue(true);
    authTokenUpdateMany.mockResolvedValue({ count: 0 });
    authTokenCreate.mockResolvedValue({ id: 1 });
    authAuditCreate.mockResolvedValue({ id: 1 });
    transaction.mockImplementation(async (input: unknown) => {
      if (Array.isArray(input)) return Promise.all(input);
      throw new Error('Transacción callback no configurada para esta prueba');
    });
  });

  it('fuerza ALUMNO y estado pendiente en el registro público', async () => {
    createUser.mockResolvedValue({
      id: 20,
      nombre: 'Ana López',
      email: 'ana@example.com',
      numeroControl: '225Q0325',
    });
    sendVerification.mockResolvedValue({
      sent: false,
      developmentUrl: 'http://localhost:5173/verificar-correo?token=test',
    });

    const result = await service.register({
      nombre: 'Ana López',
      email: 'ana@example.com',
      numeroControl: '225Q0325',
      password: 'password-seguro',
      carreraId: 2,
      semestre: 4,
    });

    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({ rol: Rol.ALUMNO }),
      { publicRegistration: true },
    );
    expect(sendVerification).toHaveBeenCalledWith(
      'ana@example.com',
      'Ana López',
      expect.any(String),
    );
    const tokenCreateCall = authTokenCreate.mock.calls[0] as unknown as [
      { data: { targetHash: string } },
    ];
    expect(tokenCreateCall[0].data.targetHash).toBe(
      createHash('sha256').update('ana@example.com').digest('hex'),
    );
    expect(result.developmentVerificationUrl).toContain('/verificar-correo');
  });

  it('registra por número de control sin correo cuando el correo está desactivado', async () => {
    isEmailEnabled.mockReturnValue(false);
    createUser.mockResolvedValue({
      id: 21,
      nombre: 'Luis Pérez',
      email: null,
      numeroControl: '225Q0326',
    });

    const result = await service.register({
      nombre: 'Luis Pérez',
      numeroControl: '225Q0326',
      password: 'password-seguro',
      carreraId: 2,
      semestre: 4,
    });

    expect(assertAvailableForPublicRegistration).not.toHaveBeenCalled();
    expect(authTokenCreate).not.toHaveBeenCalled();
    expect(sendVerification).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        message: 'Registro recibido. Espera la aprobación administrativa.',
        emailSent: false,
      }),
    );
  });

  it('verifica el correo sólo cuando el token pertenece a la identidad vigente', async () => {
    const targetHash = createHash('sha256')
      .update('ana@example.com')
      .digest('hex');
    authTokenFindUnique.mockResolvedValue({
      id: 5,
      usuarioId: 20,
      tipo: TipoTokenAuth.VERIFICACION_CORREO,
      targetHash,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    const tx = {
      authToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      usuario: {
        findUnique: jest.fn().mockResolvedValue({
          email: 'ANA@example.com',
          activo: true,
        }),
        update: jest.fn().mockResolvedValue({ id: 20 }),
      },
      authAudit: { create: jest.fn().mockResolvedValue({ id: 1 }) },
    };
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    );

    await expect(service.verifyEmail('token-válido')).resolves.toEqual({
      message:
        'Correo verificado. Tu cuenta queda pendiente de aprobación administrativa.',
    });
    expect(tx.usuario.update).toHaveBeenCalledWith({
      where: { id: 20 },
      data: {
        emailVerificadoAt: expect.any(Date) as Date,
        tokenVersion: { increment: 1 },
      },
    });
  });

  it('consume y rechaza un token enviado a un correo anterior', async () => {
    authTokenFindUnique.mockResolvedValue({
      id: 5,
      usuarioId: 20,
      tipo: TipoTokenAuth.VERIFICACION_CORREO,
      targetHash: createHash('sha256')
        .update('anterior@example.com')
        .digest('hex'),
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    const tx = {
      authToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      usuario: {
        findUnique: jest.fn().mockResolvedValue({
          email: 'nuevo@example.com',
          activo: true,
        }),
        update: jest.fn(),
      },
      authAudit: { create: jest.fn() },
    };
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    );

    await expect(service.verifyEmail('token-anterior')).rejects.toThrow(
      'El enlace es inválido o ya expiró',
    );
    expect(tx.authToken.updateMany).toHaveBeenCalled();
    expect(tx.usuario.update).not.toHaveBeenCalled();
    expect(tx.authAudit.create).not.toHaveBeenCalled();
  });

  it('firma un JWT mínimo y nunca devuelve el hash de contraseña', async () => {
    const password = 'password-seguro';
    const passwordHash = await bcrypt.hash(password, 4);
    usuarioFindMany.mockResolvedValue([
      {
        id: 20,
        nombre: 'Ana López',
        email: 'ana@example.com',
        numeroControl: '225Q0325',
        username: null,
        password: passwordHash,
        rol: Rol.ALUMNO,
        activo: true,
        registroAprobado: true,
        emailVerificadoAt: new Date(),
        lockedUntil: null,
        tokenVersion: 7,
      },
    ]);
    usuarioUpdate.mockResolvedValue({});
    sign.mockReturnValue('signed-token');

    const result = await service.login({ identifier: '225Q0325', password });

    expect(sign).toHaveBeenCalledWith({ sub: 20, ver: 7 });
    expect(result.user).not.toHaveProperty('password');
    expect(result).toEqual(
      expect.objectContaining({ accessToken: 'signed-token' }),
    );
  });

  it('permite iniciar sesión por número de control sin verificar correo cuando el correo está desactivado', async () => {
    const password = 'password-seguro';
    isEmailEnabled.mockReturnValue(false);
    usuarioFindMany.mockResolvedValue([
      {
        id: 20,
        nombre: 'Ana López',
        email: 'ana@example.com',
        numeroControl: '225Q0325',
        username: null,
        password: await bcrypt.hash(password, 4),
        rol: Rol.ALUMNO,
        activo: true,
        registroAprobado: true,
        emailVerificadoAt: null,
        lockedUntil: null,
        tokenVersion: 0,
      },
    ]);
    usuarioUpdate.mockResolvedValue({});
    sign.mockReturnValue('signed-token');

    await expect(
      service.login({ identifier: '225Q0325', password }),
    ).resolves.toEqual(
      expect.objectContaining({ accessToken: 'signed-token' }),
    );
    expect(usuarioFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            {
              numeroControl: {
                equals: '225Q0325',
                mode: 'insensitive',
              },
            },
            {
              username: { equals: '225Q0325', mode: 'insensitive' },
            },
          ],
        },
      }),
    );
  });

  it('bloquea la cuenta al alcanzar cinco intentos fallidos', async () => {
    const passwordHash = await bcrypt.hash('password-correcto', 4);
    usuarioFindMany.mockResolvedValue([
      {
        id: 20,
        password: passwordHash,
        activo: true,
        email: null,
        emailVerificadoAt: null,
        registroAprobado: true,
        lockedUntil: null,
      },
    ]);
    usuarioUpdate
      .mockResolvedValueOnce({ failedLoginAttempts: 5 })
      .mockResolvedValueOnce({});

    await expect(
      service.login({ identifier: '225Q0325', password: 'incorrecta' }),
    ).rejects.toThrow('Credenciales inválidas');

    const lockCall = usuarioUpdate.mock.calls[1] as unknown as [
      { data: { lockedUntil: Date } },
    ];
    expect(lockCall[0].data.lockedUntil).toBeInstanceOf(Date);
  });

  it('cambiar contraseña incrementa la versión y revoca tokens de recuperación', async () => {
    const currentPassword = 'password-anterior';
    usuarioFindUnique.mockResolvedValue({
      id: 20,
      password: await bcrypt.hash(currentPassword, 4),
    });
    const tx = {
      usuario: {
        update: jest.fn().mockResolvedValue({
          id: 20,
          nombre: 'Ana López',
          email: 'ana@example.com',
          numeroControl: '225Q0325',
          username: null,
          rol: Rol.ALUMNO,
          tokenVersion: 8,
        }),
      },
      authToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      authAudit: { create: jest.fn().mockResolvedValue({ id: 1 }) },
    };
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    );
    sign.mockReturnValue('fresh-token');

    const result = await service.changePassword(
      20,
      currentPassword,
      'password-nuevo',
    );

    const updateCall = tx.usuario.update.mock.calls[0] as unknown as [
      { data: { tokenVersion: { increment: number } } },
    ];
    expect(updateCall[0].data.tokenVersion).toEqual({ increment: 1 });

    const revokeCall = tx.authToken.updateMany.mock.calls[0] as unknown as [
      {
        where: {
          usuarioId: number;
          tipo: TipoTokenAuth;
          usedAt: null;
        };
        data: { usedAt: Date };
      },
    ];
    expect(revokeCall[0].where).toEqual({
      usuarioId: 20,
      tipo: TipoTokenAuth.RECUPERACION_PASSWORD,
      usedAt: null,
    });
    expect(revokeCall[0].data.usedAt).toBeInstanceOf(Date);

    const auditCall = tx.authAudit.create.mock.calls[0] as unknown as [
      { data: { tipo: TipoEventoAuth } },
    ];
    expect(auditCall[0].data.tipo).toBe(TipoEventoAuth.CAMBIO_PASSWORD);
    expect(result.accessToken).toBe('fresh-token');
  });

  it('cerrar sesión incrementa la versión y registra el evento', async () => {
    const tx = {
      usuario: { update: jest.fn().mockResolvedValue({ id: 20 }) },
      authAudit: { create: jest.fn().mockResolvedValue({ id: 1 }) },
    };
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    );

    await service.logout(20, {
      ip: '127.0.0.1',
      userAgent: 'jest',
    });

    expect(tx.usuario.update).toHaveBeenCalledWith({
      where: { id: 20 },
      data: { tokenVersion: { increment: 1 } },
    });
    expect(tx.authAudit.create).toHaveBeenCalledWith({
      data: {
        usuarioId: 20,
        tipo: TipoEventoAuth.LOGOUT,
        ip: '127.0.0.1',
        userAgent: 'jest',
      },
    });
  });
});

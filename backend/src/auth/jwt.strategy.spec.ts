import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Rol } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const findUnique = jest.fn();
  const prisma = {
    usuario: { findUnique },
  } as unknown as PrismaService;
  const config = {
    get: jest.fn().mockReturnValue('false'),
    getOrThrow: jest.fn().mockReturnValue('test-secret-with-at-least-24-chars'),
  } as unknown as ConfigService;
  const strategy = new JwtStrategy(config, prisma);

  const activeUser = {
    id: 12,
    nombre: 'Ana López',
    email: 'ana@example.com',
    numeroControl: '225Q0325',
    username: null,
    rol: Rol.ALUMNO,
    activo: true,
    registroAprobado: true,
    emailVerificadoAt: new Date(),
    tokenVersion: 3,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('devuelve la identidad vigente obtenida de la base de datos', async () => {
    findUnique.mockResolvedValue(activeUser);

    await expect(strategy.validate({ sub: 12, ver: 3 })).resolves.toEqual({
      id: 12,
      nombre: 'Ana López',
      email: 'ana@example.com',
      numeroControl: '225Q0325',
      username: null,
      rol: Rol.ALUMNO,
      tokenVersion: 3,
    });
  });

  it.each([
    ['sesión revocada', { ...activeUser, tokenVersion: 4 }],
    ['cuenta inactiva', { ...activeUser, activo: false }],
    ['registro pendiente', { ...activeUser, registroAprobado: false }],
  ])('rechaza una %s', async (_case, user) => {
    findUnique.mockResolvedValue(user);

    await expect(strategy.validate({ sub: 12, ver: 3 })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('permite correo no verificado cuando las funciones de correo están desactivadas', async () => {
    findUnique.mockResolvedValue({ ...activeUser, emailVerificadoAt: null });

    await expect(strategy.validate({ sub: 12, ver: 3 })).resolves.toEqual(
      expect.objectContaining({ id: 12 }),
    );
  });

  it('exige correo verificado cuando las funciones de correo están habilitadas', async () => {
    const emailConfig = {
      get: jest.fn().mockReturnValue('true'),
      getOrThrow: jest
        .fn()
        .mockReturnValue('test-secret-with-at-least-24-chars'),
    } as unknown as ConfigService;
    const emailStrategy = new JwtStrategy(emailConfig, prisma);
    findUnique.mockResolvedValue({ ...activeUser, emailVerificadoAt: null });

    await expect(
      emailStrategy.validate({ sub: 12, ver: 3 }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza la sesión cuando el usuario ya no existe', async () => {
    findUnique.mockResolvedValue(null);

    await expect(strategy.validate({ sub: 12, ver: 3 })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it.each([
    {},
    { sub: '12', ver: 3 },
    { sub: 0, ver: 3 },
    { sub: 12, ver: -1 },
    { sub: 12, ver: 1.5 },
  ])('rechaza un payload JWT malformado: %p', async (payload) => {
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(findUnique).not.toHaveBeenCalled();
  });
});

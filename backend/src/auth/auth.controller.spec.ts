import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AUTH_COOKIE_NAME } from './auth-cookie';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from './auth.types';

describe('AuthController sessions', () => {
  const login = jest.fn();
  const logout = jest.fn();
  const changePassword = jest.fn();
  const auth = {
    login,
    logout,
    changePassword,
  } as unknown as AuthService;
  const config = {
    get: jest.fn((key: string) =>
      key === 'NODE_ENV' ? 'development' : undefined,
    ),
  } as unknown as ConfigService;
  const controller = new AuthController(auth, config);
  const cookie = jest.fn();
  const clearCookie = jest.fn();
  const response = { cookie, clearCookie } as unknown as Response;
  const request = {
    ip: '127.0.0.1',
    get: jest.fn().mockReturnValue('jest'),
  } as unknown as Request;
  const authenticatedRequest = {
    ...request,
    user: {
      id: 20,
      nombre: 'Ana López',
      email: 'ana@example.com',
      numeroControl: '225Q0325',
      username: null,
      rol: 'ALUMNO',
      tokenVersion: 3,
    },
  } as unknown as AuthenticatedRequest;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('entrega la sesión en cookie HttpOnly sin exponer el JWT en el cuerpo', async () => {
    const user = { id: 20, nombre: 'Ana López', rol: 'ALUMNO' };
    login.mockResolvedValue({ accessToken: 'jwt-secreto', user });

    const result = await controller.login(
      { identifier: '225Q0325', password: 'password-seguro' },
      request,
      response,
    );

    expect(cookie).toHaveBeenCalledWith(AUTH_COOKIE_NAME, 'jwt-secreto', {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/api',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    expect(result).toEqual({ user });
    expect(result).not.toHaveProperty('accessToken');
  });

  it('reemplaza la cookie después de cambiar la contraseña', async () => {
    changePassword.mockResolvedValue({
      message: 'Contraseña actualizada correctamente',
      accessToken: 'jwt-renovado',
    });

    const result = await controller.changePassword(
      authenticatedRequest,
      {
        currentPassword: 'password-anterior',
        newPassword: 'password-nuevo',
      },
      response,
    );

    expect(cookie).toHaveBeenCalledWith(
      AUTH_COOKIE_NAME,
      'jwt-renovado',
      expect.objectContaining({ httpOnly: true }),
    );
    expect(result).toEqual({ message: 'Contraseña actualizada correctamente' });
  });

  it('limpia la cookie aunque falle la revocación en el servidor', async () => {
    logout.mockRejectedValue(new Error('database unavailable'));

    await expect(
      controller.logout(authenticatedRequest, response),
    ).rejects.toThrow('database unavailable');
    expect(clearCookie).toHaveBeenCalledWith(AUTH_COOKIE_NAME, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/api',
    });
  });
});

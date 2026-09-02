import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const createContext = (rol: string) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user: { rol } }),
      }),
    }) as unknown as ExecutionContext;

  it('permite al docente acceder a una ruta de docentes', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['DOCENTE']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext('DOCENTE'))).toBe(true);
  });

  it('devuelve un mensaje localizado cuando el rol no está autorizado', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['DOCENTE']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(createContext('ALUMNO'))).toThrow(
      new ForbiddenException('No tienes permisos para realizar esta acción'),
    );
  });
});

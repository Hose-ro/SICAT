import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AUTH_COOKIE_NAME } from './auth-cookie';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const clearCookie = jest.fn();
  const context = {
    switchToHttp: () => ({
      getResponse: () => ({ clearCookie }),
    }),
  } as unknown as ExecutionContext;
  const config = {
    get: jest.fn((key: string) =>
      key === 'NODE_ENV' ? 'development' : undefined,
    ),
  } as unknown as ConfigService;
  const guard = new JwtAuthGuard(config);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('elimina la cookie cuando la sesión es inválida', () => {
    expect(() =>
      guard.handleRequest(undefined, null, undefined, context),
    ).toThrow(UnauthorizedException);

    expect(clearCookie).toHaveBeenCalledWith(AUTH_COOKIE_NAME, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/api',
    });
  });

  it('conserva la cookie cuando la sesión sigue vigente', () => {
    const user = { id: 12 };

    expect(guard.handleRequest(undefined, user, undefined, context)).toBe(user);
    expect(clearCookie).not.toHaveBeenCalled();
  });
});

import { ConfigService } from '@nestjs/config';
import {
  AUTH_COOKIE_NAME,
  getAuthCookieClearOptions,
  getAuthCookieOptions,
} from './auth-cookie';

describe('auth cookie', () => {
  const configFor = (environment: string) =>
    ({
      get: jest.fn((key: string) =>
        key === 'NODE_ENV' ? environment : undefined,
      ),
    }) as unknown as ConfigService;

  it('usa una cookie HttpOnly, SameSite estricta y limitada a la API', () => {
    expect(AUTH_COOKIE_NAME).toBe('sicat_access_token');
    expect(getAuthCookieOptions(configFor('development'))).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/api',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  });

  it('exige HTTPS en producción y limpia la misma ruta', () => {
    const config = configFor('production');

    expect(getAuthCookieOptions(config).secure).toBe(true);
    expect(getAuthCookieClearOptions(config)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/api',
    });
  });
});

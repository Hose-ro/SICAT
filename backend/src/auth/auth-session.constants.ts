export const AUTH_COOKIE_NAME = 'sicat_access_token';
export const AUTH_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
/** Dispositivos con sesión activa permitidos por usuario; el login expulsa
 *  la sesión más antigua para no rebasar este límite. */
export const MAX_SESIONES_CONCURRENTES = 2;
export const AUTH_JWT_ISSUER = 'sicat-api';
export const AUTH_JWT_AUDIENCE = 'sicat-web';
export const AUTH_JWT_ALGORITHM = 'HS256' as const;

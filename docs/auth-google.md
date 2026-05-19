# Autenticación con Google en SICAT

## Qué hace

Permite a los usuarios iniciar sesión en SICAT usando su cuenta de Google mediante OAuth 2.0 / OpenID Connect, además del login normal con email y contraseña.

## Datos que se consumen de Google

- `id` → guardado como `googleId` en la tabla `Usuario`
- `displayName` → guardado como `nombre`
- `emails[0].value` → guardado como `email`
- `photos[0].value` → guardado como `avatar` (URL de la foto de perfil)

No se solicitan permisos de Gmail, Drive, Calendar ni ninguna otra API de Google. Solo se usan los scopes `email` y `profile`.

## Datos guardados en la tabla `Usuario`

| Campo      | Origen                  | Notas                              |
|------------|-------------------------|------------------------------------|
| `googleId` | `profile.id`            | Único por cuenta de Google         |
| `avatar`   | `profile.photos[0].url` | URL de la imagen de perfil         |
| `nombre`   | `profile.displayName`   | Solo al crear usuario              |
| `email`    | `profile.emails[0]`     | Se usa para vincular cuenta existente |
| `rol`      | Asignado por sistema    | Siempre `ALUMNO` para cuentas nuevas |

## Configurar variables de entorno

En `backend/.env` agregar:

```env
GOOGLE_CLIENT_ID=tu_client_id_aqui
GOOGLE_CLIENT_SECRET=tu_client_secret_aqui
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
```

En producción:

```env
GOOGLE_CLIENT_ID=tu_client_id_aqui
GOOGLE_CLIENT_SECRET=tu_client_secret_aqui
GOOGLE_CALLBACK_URL=https://api.sicatapp.com/api/auth/google/callback
```

## Configurar Google Cloud Console

1. Ir a [https://console.cloud.google.com](https://console.cloud.google.com)
2. Crear un proyecto o seleccionar el existente
3. Ir a **APIs y servicios → Credenciales**
4. Crear credenciales → **ID de cliente de OAuth 2.0**
5. Tipo de aplicación: **Aplicación web**
6. Agregar URI de redireccionamiento autorizados:
   - Local: `http://localhost:3000/api/auth/google/callback`
   - Producción: `https://api.sicatapp.com/api/auth/google/callback`
7. Copiar el **Client ID** y **Client Secret** al `.env`

Scopes mínimos necesarios (se configuran automáticamente con `scope: ['email', 'profile']`):
- `openid`
- `profile`
- `email`

## Flujo de autenticación

```
Usuario → click "Continuar con Google"
  → GET /api/auth/google (backend redirige a Google)
  → Usuario acepta en Google
  → GET /api/auth/google/callback (Google redirige al backend)
  → Backend busca usuario por googleId o email
    → Si no existe: crea usuario con rol ALUMNO
    → Si existe: actualiza googleId y avatar
  → Backend genera JWT
  → Redirige a frontend: /auth/callback?token=<jwt>
  → Frontend guarda token y redirige a /dashboard
```

## Cómo probar localmente

1. Configurar las variables de entorno (ver arriba)
2. Reiniciar el backend: `npm run start:dev`
3. Abrir `http://localhost:5173/login`
4. Hacer clic en **Continuar con Google**
5. Seleccionar una cuenta de Google
6. Verificar que el usuario aparezca en la tabla `Usuario` con `googleId` y `avatar`

## Errores comunes

### `redirect_uri_mismatch`
La URI de callback configurada en Google Cloud no coincide exactamente con `GOOGLE_CALLBACK_URL` en `.env`. Verificar que sean idénticas, incluyendo protocolo, puerto y ruta.

### `invalid_client`
`GOOGLE_CLIENT_ID` o `GOOGLE_CLIENT_SECRET` son incorrectos. Verificar que se copiaron sin espacios desde Google Cloud Console.

### El servidor no reinicia los cambios de `.env`
Las variables de entorno se leen al iniciar. Después de modificar `.env` hay que reiniciar el proceso de NestJS.

### El usuario nuevo recibe rol `ALUMNO`
Es el comportamiento esperado por seguridad. Un administrador debe cambiar el rol manualmente si el usuario debe tener acceso de `DOCENTE` o `ADMIN`.

### `Error: Cannot read properties of undefined (reading 'value')`
Google no devolvió email o foto. Asegurarse de que los scopes `email` y `profile` están activos y que la cuenta de Google tiene email verificado.

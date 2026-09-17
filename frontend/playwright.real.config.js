import { defineConfig } from '@playwright/test'

/**
 * Pruebas contra la API real: backend NestJS + PostgreSQL local, sin mocks.
 * Complementa `playwright.config.js` (API simulada) para detectar
 * incompatibilidades reales entre frontend, permisos y base de datos.
 *
 *   npm run test:e2e:real
 *
 * Requiere `backend/.env` con DATABASE_URL apuntando a una BD de desarrollo:
 * el fixture crea y borra usuarios `e2e.*`, una carrera `E2E` y su materia.
 */
export const API = 'http://127.0.0.1:3001'
export const WEB = 'http://127.0.0.1:4177'

export default defineConfig({
  testDir: 'tests/real',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  globalSetup: './tests/real/global-setup.js',
  globalTeardown: './tests/real/global-teardown.js',
  use: { baseURL: WEB, serviceWorkers: 'block', trace: 'retain-on-failure', reducedMotion: 'reduce' },
  reporter: [['list']],
  webServer: [
    {
      command: 'npm --prefix ../backend run -s e2e:serve',
      url: `${API}/api`,
      reuseExistingServer: false,
      timeout: 60000,
      env: { PORT: '3001', FRONTEND_URL: WEB, NODE_ENV: 'development', THROTTLE_DISABLED: '1' },
    },
    {
      command: 'npx vite --config vite.audit.config.js --port 4177 --strictPort',
      url: WEB,
      reuseExistingServer: false,
      env: { VITE_API_URL: `${API}/api` },
    },
  ],
})

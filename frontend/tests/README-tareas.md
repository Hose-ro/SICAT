# Comprobaciones del módulo de tareas

Desde `frontend`:

```sh
node --test tests/tareas.test.mjs
npm run build
```

La prueba de interfaz requiere Playwright disponible y el servidor de Vite en `http://127.0.0.1:5173`:

```sh
node tests/tareas.browser.cjs
```

Si Playwright está instalado fuera del proyecto, `PLAYWRIGHT_MODULE` permite indicar su ruta. `BROWSER_CHANNEL` permite usar un navegador instalado, por ejemplo `msedge`. Sin esta variable se usa Chromium de Playwright.

La prueba intercepta las solicitudes a `/api/` con datos simulados de docente y alumno. Comprueba búsqueda sin acentos, conservación del estado al editar, conservación y validación de calificaciones, rúbrica al 100%, creación de borradores, archivos del docente, validación de entregas, selección acumulativa de archivos, borrado de comentarios, vista móvil y reintento tras error. Las capturas se guardan en una carpeta temporal indicada al terminar.

Esta comprobación valida la interfaz y el contenido de las solicitudes. No sustituye una prueba de integración con NestJS, PostgreSQL y almacenamiento de archivos reales. No se modificó el contrato del API ni se agregaron migraciones.

Las rúbricas nuevas usan criterios y porcentajes; la calificación final sigue siendo registrada manualmente por el docente. Los formatos de rúbrica anteriores se conservan al editar y solo se reemplazan mediante la acción explícita del formulario.

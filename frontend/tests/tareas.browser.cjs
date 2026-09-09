const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const artifacts = mkdtempSync(join(tmpdir(), 'sicat-tareas-'));
let browser;
(async () => {
 browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || undefined, headless: true});
 const context = await browser.newContext({ viewport: {width: 1440, height: 1000} });
 const page = await context.newPage();
 page.setDefaultTimeout(10000); page.setDefaultNavigationTimeout(10000);
 const errors = [];
 page.on('pageerror', error => errors.push(error.message));
 let role = 'DOCENTE', fail = false;
 const writes = [];
 const materia = {id: 1, nombre: 'Programación', grupos: [{id: 1, nombre: '5A'}], unidades: [{id: 1, nombre: 'Unidad 1', status: 'ACTIVA'}]};
 let task = {id: 21, titulo: 'Investigación de algoritmos', instrucciones: 'Explica tu solución.\nAdjunta tu evidencia.', materiaId: 1, grupoId: 1, unidadId: 1, materia, grupo: materia.grupos[0], unidadRef: materia.unidades[0], tipoEntrega: 'REVISION_EN_LINEA', tipoEvaluacion: 'DIRECTA', estado: 'PUBLICADA', tieneFechaLimite: false, permiteReenvio: true, archivos: [{id: 1, nombre: 'Guía.pdf', url: '/uploads/tareas/guia.pdf'}], porcentajeEntrega: 50, entregadas: 1, totalAlumnos: 2, noEntregadas: 1, calificadas: 1, pendientesRevision: 1, entregasTardias: 0, promedio: 85};
 let delivery = {id: 31, alumno: {id: 2, nombre: 'Alumno de prueba', numeroControl: 'TEST001'}, estadoRevision: 'CALIFICADA', calificacion: 85, calificacionTipo: 'NUMERICA', observacion: 'Buen trabajo', comentarioAlumno: 'Mi respuesta original', archivos: [], fechaEntrega: '2026-09-08T12:00:00Z', versionEntrega: 1};
 await context.route(/^https?:\/\/[^/]+\/api\//, async route => {
   const req = route.request(); const url = new URL(req.url()); const path = url.pathname.replace(/^.*\/api/, '');
   let data = [];
   if (req.method() === 'OPTIONS') return route.fulfill({status: 204, headers: {'access-control-allow-origin': req.headers().origin || '*', 'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'access-control-allow-headers': 'content-type'}});
   if (req.method() !== 'GET') { writes.push({path, body: req.postData()}); data = task; }
   if (path === '/auth/me') data = {id: 1, nombre: 'Cuenta de prueba', rol: role, email: 'prueba@example.test'};
   else if (path.startsWith('/materias')) data = [materia];
   else if (path === '/tareas/docente') {
     if (fail) return route.fulfill({status: 500, json: {message: 'Error de prueba al cargar tareas'}});
     data = {items: [task, {...task, id: 22, titulo: 'Borrador de práctica', estado: 'BORRADOR', pendientesRevision: 0}], stats: {tareasActivas: 1, pendientesRevision: 1, vencidas: 0, entregasTardias: 0}};
   }
   else if (path === '/tareas/21/entregas') data = {tarea: task, entregas: [delivery], stats: {pendientes: 1, calificadas: 1}};
   else if (path === '/tareas/21') data = {...task, miEntrega: role === 'ALUMNO' ? delivery : undefined, estadoAlumno: 'CALIFICADA', puedeEditarEntrega: true};
   else if (path === '/tareas/mis-tareas') data = [{tarea: task, miEntrega: delivery, estadoAlumno: 'CALIFICADA', puedeEditarEntrega: true}];
   else if (path.includes('notificacion')) data = {items: [], notificaciones: [], total: 0, noLeidas: 0};
   return route.fulfill({json: data, headers: {'access-control-allow-origin': req.headers().origin || '*', 'access-control-allow-credentials': 'true'}});
 });
 await page.goto('http://127.0.0.1:5173/tareas');


 await page.getByRole('heading', {name: 'Lista de tareas', exact: true}).waitFor();
 await page.getByRole('heading', {name: task.titulo, exact: true}).waitFor();
 await page.getByRole('searchbox', {name: 'Buscar tareas'}).fill('investigacion');
 assert.equal(await page.locator('article').count(), 1);
 await page.screenshot({path: join(artifacts, 'desktop.png'), fullPage: true});
 await page.getByRole('link', {name: 'Editar', exact: true}).click();
 await page.getByLabel('Título *', {exact:true}).waitFor();
 assert.equal(await page.getByRole('button', {name: 'Guardar y publicar', exact: true}).count(), 0);
 await page.getByRole('button', {name: 'Guardar cambios', exact: true}).click();
 await page.waitForURL('**/docente/tareas/21');
 assert.ok(writes.at(-1).body.includes('PUBLICADA'));
 await page.getByRole('spinbutton', {name:'Calificación', exact:true}).waitFor();
 await page.getByRole('textbox', {name:'Observación docente'}).fill('Revisé la explicación');
 assert.equal(await page.getByRole('spinbutton', {name:'Calificación', exact:true}).inputValue(), '85');
 await page.getByRole('spinbutton', {name:'Calificación', exact:true}).fill('');
 await page.getByRole('button', {name:'Calificar', exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Ingresa una calificación entre 0 y 100'}).waitFor();
 await page.getByRole('spinbutton', {name:'Calificación', exact:true}).fill('92');
 await page.getByRole('button', {name:'Calificar', exact:true}).click();
 await page.getByRole('status').filter({hasText:'Los cambios se guardaron correctamente'}).waitFor();
 assert.ok(writes.at(-1).body.includes('92'));
 await page.goto('http://127.0.0.1:5173/docente/tareas/crear');
 await page.getByLabel('Título *', {exact:true}).fill('Nueva tarea');
 await page.getByLabel('Instrucciones *', {exact:true}).fill('Resuelve el ejercicio.');
 await page.locator('select[name=materiaId]').selectOption('1');
 await page.locator('select[name=grupoId]').selectOption('1');
 await page.getByRole('checkbox', {name:/Usar fecha límite/}).uncheck();
 await page.locator('select[name=tipoEvaluacion]').selectOption('RUBRICA');
 await page.getByRole('button', {name:'Agregar criterio', exact:true}).click();
 await page.getByLabel('Criterio 1', {exact:true}).fill('Claridad');
 await page.getByLabel('Porcentaje', {exact:true}).fill('50');
 await page.getByRole('button', {name:'Guardar borrador', exact:true}).click();
 await page.getByRole('alert').filter({hasText:'sumen 100%'}).waitFor();
 await page.getByLabel('Porcentaje', {exact:true}).fill('100');
 await page.getByRole('button', {name:'Guardar borrador', exact:true}).click();
 await page.waitForURL('**/docente/tareas/21');
 assert.ok(writes.at(-1).body.includes('BORRADOR'));
 role = 'ALUMNO';
 await page.goto('http://127.0.0.1:5173/alumno/tareas/21');
 await page.getByRole('heading', {name:'Material de apoyo del docente'}).waitFor();
 await page.getByLabel('Comentario al docente').fill('');
 await page.getByRole('button', {name:'Actualizar entrega', exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Escribe un comentario o adjunta un archivo'}).waitFor();
 const upload = page.locator('input[type=file]');
 await upload.setInputFiles({name:'evidencia.pdf', mimeType:'application/pdf', buffer:Buffer.from('%PDF-test')});
 await upload.setInputFiles({name:'firma.png', mimeType:'image/png', buffer:Buffer.from('test')});
 assert.equal(await page.getByRole('button', {name:/Quitar (evidencia.pdf|firma.png)/}).count(),2);
 await page.getByRole('button', {name:'Quitar firma.png', exact:true}).click();
 await page.getByRole('button', {name:'Actualizar entrega', exact:true}).click();
 await page.getByRole('status').filter({hasText:'Tu entrega se guardó correctamente'}).waitFor();
 assert.ok(writes.at(-1).body.includes('name="comentario"\r\n\r\n\r\n'));
 await page.setViewportSize({width:390, height:844});
 await page.goto('http://127.0.0.1:5173/tareas');


 await page.getByRole('heading', {name:'Tus tareas', exact:true}).waitFor();
 await page.screenshot({path:join(artifacts, 'mobile.png'), fullPage:true});
 assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'Mobile overflow');
 await page.evaluate(async () => { const { useThemeStore } = await import('/src/store/useThemeStore.js'); useThemeStore.getState().setDark(false); });
 await page.evaluate(() => window.scrollTo(0, 0));
 await page.waitForTimeout(300);
 await page.screenshot({path:join(artifacts, 'light.png'), fullPage:true});
 role = 'DOCENTE'; fail = true;
 await page.goto('http://127.0.0.1:5173/tareas');


 await page.getByRole('button', {name:'Volver a intentar', exact:true}).waitFor();
 fail = false;
 await page.getByRole('button', {name:'Volver a intentar', exact:true}).click();
 await page.getByRole('heading', {name:task.titulo, exact:true}).waitFor();
 assert.deepEqual(errors, []);
 console.log('PASS: search accents, edit publication state, grade preservation/validation, rubric total, draft creation, teacher attachments, empty delivery, additive files/removal, clearing comments, mobile overflow, dark theme, error retry; no page errors. Mock API only.');
 console.log('Screenshots:', artifacts);
 await browser.close();
})().catch(async error => { console.error(error); await browser?.close(); process.exitCode = 1; });

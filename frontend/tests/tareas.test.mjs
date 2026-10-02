import test from 'node:test'
import assert from 'node:assert/strict'
import { searchTasks, mergeTaskFiles, deliveryHelp, taskFileUrl, estadoDocente, conteoTarea, conteoEntregas, plazoTarea, parseRubrica, notaValida } from '../src/lib/tareas.js'

test('buscar ignora acentos y espacios, incluye materia y conserva la lista original', () => {
  const tasks = [{ id: 1, titulo: 'Investigación', materia: { nombre: 'Álgebra' } }, { id: 2, titulo: 'Ensayo' }]
  assert.deepEqual(searchTasks(tasks, ' investigacion ').map((task) => task.id), [1])
  assert.deepEqual(searchTasks(tasks, 'algebra').map((task) => task.id), [1])
  assert.deepEqual(tasks.map((task) => task.id), [1, 2])
})

test('ordenar fechas deja al final las tareas sin límite, tanto para alumno como docente', () => {
  const tasks = [
    { id: 1, titulo: 'Sin límite', tieneFechaLimite: false },
    { id: 2, titulo: 'Después', tieneFechaLimite: true, fechaLimite: '2026-10-15T12:00:00Z' },
    { id: 3, titulo: 'Primera', tieneFechaLimite: true, fechaLimite: '2026-10-01T12:00:00Z' },
  ]
  assert.deepEqual(searchTasks(tasks, '').map((task) => task.id), [3, 2, 1])
  assert.deepEqual(searchTasks(tasks.map((tarea) => ({ tarea })), '').map((item) => item.tarea.id), [3, 2, 1])
})

test('seleccionar más archivos conserva los anteriores y evita duplicados', () => {
  const first = { name: 'informe.PDF', size: 100, lastModified: 1 }
  const second = { name: 'foto.png', size: 200, lastModified: 2 }
  assert.deepEqual(mergeTaskFiles([first], [first, second]), [first, second])
})

test('rechaza formatos, tamaños y cantidades que el servidor no acepta', () => {
  assert.throws(() => mergeTaskFiles([], [{ name: 'script.exe', size: 1 }]), /Formato no permitido/)
  assert.throws(() => mergeTaskFiles([], [{ name: 'firma.pdf', size: 1 }], true), /Usa imágenes/)
  assert.throws(() => mergeTaskFiles([], [{ name: 'grande.pdf', size: 15 * 1024 * 1024 + 1 }]), /15 MB/)
  assert.throws(() => mergeTaskFiles([], Array.from({ length: 13 }, (_, i) => ({ name: `${i}.pdf`, size: 1 }))), /12 archivos/)
})

test('explica la entrega presencial, cerrada y tardía sin prometer edición', () => {
  assert.match(deliveryHelp({ tipoEntrega: 'PRESENCIAL' }, null, true), /docente registra/)
  assert.match(deliveryHelp({ estado: 'CERRADA' }, null, false), /no recibe entregas/)
  assert.match(deliveryHelp({ estado: 'VENCIDA' }, null, true), /entrega tardía/)
})

test('los archivos de tareas se piden a la API protegida, nunca a la raíz pública', () => {
  assert.equal(taskFileUrl('/uploads/tareas/a.pdf', 'http://localhost:3000/api'), 'http://localhost:3000/api/uploads/tareas/a.pdf')
  assert.equal(taskFileUrl('/uploads/tareas/a.pdf', 'https://api.sicatapp.com/api/'), 'https://api.sicatapp.com/api/uploads/tareas/a.pdf')
  assert.equal(taskFileUrl('https://cdn.example.com/x.pdf', 'http://localhost:3000/api'), 'https://cdn.example.com/x.pdf')
  assert.equal(taskFileUrl(null, 'http://localhost:3000/api'), '#')
})

test('el docente ve «por calificar» en entregas pendientes y distingue quién no ha entregado', () => {
  assert.equal(estadoDocente({ estadoRevision: 'PENDIENTE', esSintetica: false }), 'ENTREGADA')
  assert.equal(estadoDocente({ estadoRevision: 'ENTREGADA', esSintetica: false }), 'ENTREGADA')
  assert.equal(estadoDocente({ estadoRevision: 'PENDIENTE', esSintetica: true }), 'PENDIENTE')
  assert.equal(estadoDocente({ estadoRevision: 'NO_ENTREGADA', esSintetica: true }), 'NO_ENTREGADA')
  assert.equal(estadoDocente({ estadoRevision: 'INCORRECTA', esSintetica: false }), 'INCORRECTA')
})

test('los conteos del listado funcionan aunque el API aún no envíe revisadas ni devueltas', () => {
  const antiguo = conteoTarea({ totalAlumnos: 28, entregadas: 24, pendientesRevision: 9, calificadas: 12 })
  assert.deepEqual([antiguo.revisadas, antiguo.devueltas, antiguo.sinEntregar], [3, 0, 4])
  const nuevo = conteoTarea({ totalAlumnos: 28, entregadas: 24, pendientesRevision: 9, calificadas: 12, revisadas: 2, devueltas: 1 })
  assert.deepEqual([nuevo.revisadas, nuevo.devueltas], [2, 1])
})

test('los conteos de la sesión salen de las filas de entregas', () => {
  const r = conteoEntregas([
    { esSintetica: false, estadoRevision: 'CALIFICADA', calificacion: 90 },
    { esSintetica: false, estadoRevision: 'CALIFICADA', calificacion: 81 },
    { esSintetica: false, estadoRevision: 'ENTREGADA', fueTardia: true },
    { esSintetica: true, estadoRevision: 'NO_ENTREGADA' },
  ])
  assert.deepEqual([r.calificadas, r.porCalificar, r.sinEntregar, r.tardias, r.promedio], [2, 1, 1, 1, 85.5])
})

test('el plazo se dice en relación con hoy', () => {
  const ahora = new Date(2026, 8, 29, 10, 30)
  const con = (fecha) => plazoTarea({ tieneFechaLimite: true, fechaLimite: fecha }, ahora).relativo
  assert.equal(con(new Date(2026, 8, 28, 23, 59)), 'Venció ayer')
  assert.equal(con(new Date(2026, 8, 29, 8, 0)), 'Venció hoy')
  assert.equal(con(new Date(2026, 8, 29, 14, 0)), 'Hoy')
  assert.equal(con(new Date(2026, 9, 2, 23, 59)), 'En 3 días')
  assert.equal(con(new Date(2026, 8, 25, 23, 59)), 'Venció hace 4 días')
  assert.equal(plazoTarea({ tieneFechaLimite: false }, ahora).relativo, 'Sin fecha límite')
})

test('solo se usa la rúbrica de criterios y porcentajes; los formatos anteriores caen en calificación directa', () => {
  assert.deepEqual(parseRubrica('[{"criterio":"Claridad","peso":60},{"criterio":"Formato","peso":"40"}]'), [{ criterio: 'Claridad', peso: 60 }, { criterio: 'Formato', peso: 40 }])
  assert.equal(parseRubrica('{"niveles":[]}'), null)
  assert.equal(parseRubrica('no es json'), null)
  assert.equal(parseRubrica(''), null)
})

test('las notas siguen el rango que acepta el API (1 a 100)', () => {
  assert.equal(notaValida('1'), true)
  assert.equal(notaValida('100'), true)
  assert.equal(notaValida('0'), false)
  assert.equal(notaValida('101'), false)
  assert.equal(notaValida(''), false)
  assert.equal(notaValida('0', 30, 0), true)
})


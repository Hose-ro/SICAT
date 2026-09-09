import test from 'node:test'
import assert from 'node:assert/strict'
import { searchTasks, mergeTaskFiles, deliveryHelp } from '../src/lib/tareas.js'

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

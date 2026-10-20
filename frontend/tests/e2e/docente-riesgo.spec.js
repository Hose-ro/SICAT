import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockApi } from './fixtures'

const riesgo = (evaluados, enRiesgo, reprobando, motivos) => ({ evaluados, enRiesgo, reprobando, motivos })
const clase = (id, nombre, grupo, r) => ({
  id, nombre, clave: `C-${id}`, grupo, alumnos: r?.evaluados ?? 0, unidadActiva: null, porcentajeAsistencia: 90,
  entregasSinCalificar: 0, alumnosEnRiesgo: r?.enRiesgo ?? 0, riesgo: r,
})
const panel = {
  claseActual: null, proximaClase: null, clasesHoy: [], proximasSuspensiones: [],
  resumen: { materias: 3, clasesHoy: 0, listasPendientes: 0 },
  pendientes: { alumnosEnRiesgo: 3, entregasSinCalificar: 0, solicitudes: 0 },
  materias: [
    clase(1, 'Matemáticas', { id: 1, nombre: '101A' }, riesgo(3, 1, 0, { calificacion: 1, asistencia: 0, entregas: 0 })),
    clase(2, 'Física', { id: 2, nombre: '102B' }, riesgo(3, 2, 1, { calificacion: 1, asistencia: 1, entregas: 1 })),
    clase(3, 'Química', { id: 3, nombre: '103C' }, riesgo(4, 0, 0, { calificacion: 0, asistencia: 0, entregas: 0 })),
  ],
}
const unidades = [
  { id: 21, nombre: 'Unidad 1', orden: 1, status: 'FINALIZADA' },
  { id: 22, nombre: 'Unidad 2', orden: 2, status: 'ACTIVA' },
  { id: 23, nombre: 'Unidad 3', orden: 3, status: 'PENDIENTE' },
]
const desempeno = (unidad) => ({
  materia: { id: 2, nombre: 'Física' }, grupo: { id: 2, nombre: '102B' }, unidad, unidades,
  criterios: [], origenCriterios: 'PREDETERMINADA', umbrales: { aprobatoria: 70, sinRiesgo: 80 },
  resumen: { total: 0, aprobados: 0, enRiesgo: 0, reprobados: 0, sinCalificar: 0 }, actividadesSinCriterio: 0, alumnos: [],
})
const fila = (alumno, unidad, calificacionFinal, motivos = [], extra = {}) => ({
  alumno, unidad, calificacionFinal, calificacionManual: null, motivos,
  asistencia: { registradas: 6, asistencias: 5, faltas: 1, retardos: 0, justificadas: 0 },
  tareas: { total: 3, entregadas: 3, vencidas: 3, vencidasSinEntregar: 0 },
  ...extra,
})
const ana = { id: 1, nombre: 'Ana Prueba', numeroControl: '2201', sexo: 'MUJER' }
const beto = { id: 2, nombre: 'Beto Prueba', numeroControl: '2202', sexo: 'HOMBRE' }
const reporte = {
  unidades,
  rows: [
    fila(ana, unidades[0], 62, ['CALIFICACION_BAJA']),
    fila(ana, unidades[1], 74, ['CALIFICACION_LIMITE', 'ENTREGAS'], { tareas: { total: 3, entregadas: 1, vencidas: 3, vencidasSinEntregar: 2 } }),
    fila(ana, unidades[2], null),
    fila(beto, unidades[0], 90),
    fila(beto, unidades[1], 88),
    fila(beto, unidades[2], null),
  ],
}

async function preparar(page) {
  await mockApi(page, 'DOCENTE')
  await page.route('**/api/dashboard/docente', (route) => route.fulfill({ json: panel }))
  await page.route('**/api/calificaciones/desempeno**', (route) => {
    const unidadId = Number(new URL(route.request().url()).searchParams.get('unidadId'))
    return route.fulfill({ json: desempeno(unidades.find((u) => u.id === unidadId) ?? unidades[1]) })
  })
  await page.route('**/api/calificaciones/docente**', (route) => route.fulfill({ json: reporte }))
}

test('inicio: riesgo por clase abre la clase y el mapa muestra todas las unidades', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await preparar(page)
  await page.goto('/dashboard')

  const comparativo = page.getByRole('region', { name: 'Riesgo por clase' })
  await expect(comparativo).toBeVisible()
  // La clase con más riesgo va primero; la que no tiene se nombra aparte.
  const primera = comparativo.getByRole('button').first()
  await expect(primera).toHaveAccessibleName(/^Física, 102B: 67 % en riesgo, 2 de 3 alumnos, 1 reprobando/)
  await expect(comparativo.getByText('Clases sin alumnos en riesgo')).toBeVisible()
  await page.screenshot({ path: 'audit/docente-riesgo-clases.png', fullPage: true })
  const axe = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 120)}`)).toEqual([])

  await primera.click()
  const seccion = page.getByRole('region', { name: 'Desempeño por unidad' })
  await expect(seccion.getByRole('combobox', { name: 'Clase' })).toHaveValue('2:2')

  await seccion.getByRole('radio', { name: 'Todas las unidades' }).click()
  const mapa = seccion.getByRole('table', { name: /Física · 102B: estado de cada alumno en cada unidad/ })
  await expect(mapa).toBeVisible()
  // La unidad por iniciar no aparece; Ana va primero y su unidad 2 explica las entregas.
  await expect(mapa.getByRole('columnheader')).toHaveCount(3)
  await expect(mapa.getByRole('rowheader').first()).toContainText('2 unidades con señales')
  const celda = mapa.getByRole('button', { name: /^Ana Prueba, Unidad 2, en curso: en riesgo, promedio 74.*2 de 3 tareas vencidas sin entregar/ })
  await expect(celda).toBeVisible()
  await celda.hover()
  await expect(page.getByText('1 de 3 vencidas')).toBeVisible()
  await page.screenshot({ path: 'audit/docente-riesgo-unidades.png', fullPage: true })
  const axeMapa = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(axeMapa.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 120)}`)).toEqual([])

  // Elegir una celda abre esa unidad en la vista por unidad.
  await mapa.getByRole('button', { name: /^Ana Prueba, Unidad 1/ }).click()
  await expect(seccion.getByRole('radio', { name: 'Por unidad' })).toHaveAttribute('aria-checked', 'true')
  await expect(seccion.getByRole('radio', { name: /^U1/ })).toHaveAttribute('aria-checked', 'true')
})

test('alumnos en riesgo: criterio completo, motivos por unidad y aviso de desempeño', async ({ page }) => {
  await mockApi(page, 'DOCENTE')
  await page.route('**/api/dashboard/docente/riesgo**', (route) => route.fulfill({ json: {
    criterio: { minRegistros: 3, porcentaje: 30, aprobatoria: 70, sinRiesgo: 80, minTareas: 2, porcentajeEntregas: 30 },
    clasesSinDatos: [{ materia: { id: 9, nombre: 'Química' }, grupo: { id: 3, nombre: '103C' } }],
    alumnos: [{
      alumno: { id: 1, nombre: 'Ana Prueba López', numeroControl: '2201' },
      materia: { id: 2, nombre: 'Física' }, grupo: { id: 2, nombre: '102B' },
      motivos: ['CALIFICACION_BAJA', 'ENTREGAS'],
      unidades: [{ id: 21, nombre: 'Unidad 1', motivos: ['CALIFICACION_BAJA'], calificacion: 62 }, { id: 22, nombre: 'Unidad 2', motivos: ['ENTREGAS'], calificacion: 85 }],
      calificacion: 73.5, registros: 6, faltas: 1, retardos: 0, porcentajeAusencias: 17,
      tendencia: ['ASISTENCIA', 'FALTA'], tareasVencidas: 5, tareasSinEntregar: 2, ultimoAviso: null,
    }],
  } }))
  let enviado
  await page.route('**/api/avisos', (route) => {
    enviado = route.request().postDataJSON()
    return route.fulfill({ json: { id: 10, titulo: enviado.titulo, createdAt: '2026-10-20T15:00:00Z', destinatarios: 1 } })
  })

  await page.goto('/docente/riesgo')
  await expect(page.getByText(/Con alguna unidad en riesgo: calificación menor a 80/)).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: 'No se pudo calcular Química · 103C' })).toBeVisible()
  await expect(page.getByText('Promedio menor a 70 · 2 de 5 tareas vencidas sin entregar')).toBeVisible()
  await expect(page.getByText('Unidad 1: 62 · Unidad 2: 85')).toBeVisible()
  const axe = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(axe.violations.map((v) => v.id)).toEqual([])

  await page.getByRole('button', { name: 'Enviar aviso' }).click()
  await expect(page.getByLabel('Mensaje')).toHaveValue('Ana, tu promedio en la materia va en 73.5. Además, tienes 2 tareas vencidas sin entregar. Búscame para ver cómo ponerte al corriente.')
  await page.getByRole('dialog').getByRole('button', { name: 'Enviar aviso' }).click()
  await expect(page.getByText('Le avisaste a Ana Prueba López.')).toBeVisible()
  expect(enviado).toMatchObject({ materiaId: 2, grupoId: 2, alumnoId: 1, titulo: 'Tu desempeño en Física' })
})

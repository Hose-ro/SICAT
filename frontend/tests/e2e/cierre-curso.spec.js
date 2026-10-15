import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockApi } from './fixtures'

const unidades = [
  { id: 11, nombre: 'Unidad 1', orden: 1, status: 'FINALIZADA' },
  { id: 12, nombre: 'Unidad 2', orden: 2, status: 'FINALIZADA' },
]
const alumnos = [
  { id: 1, nombre: 'Ana López', numeroControl: '22500', sexo: 'MUJER' },
  { id: 2, nombre: 'Luis Pérez', numeroControl: '22501', sexo: 'HOMBRE' },
  { id: 3, nombre: 'Marta Ruiz', numeroControl: '22502', sexo: 'MUJER' },
]

/** Respuesta de GET /calificaciones/cierre con el mismo cálculo que el backend. */
function cierre({ segunda = null, noPresento = false, cerrado = false } = {}) {
  const celda = (unidadId, primera, s = null, np = false) => {
    if (primera >= 70) return { unidadId, primera, segunda: null, noPresento: false, estado: 'ALCANZADA', calificacion: primera, oportunidad: 1 }
    if (s != null) return { unidadId, primera, segunda: s, noPresento: false, estado: s >= 70 ? 'ALCANZADA_SEGUNDA' : 'NO_ALCANZADA', calificacion: s, oportunidad: 2 }
    if (np) return { unidadId, primera, segunda: null, noPresento: true, estado: 'NO_ALCANZADA', calificacion: null, oportunidad: 2 }
    return { unidadId, primera, segunda: null, noPresento: false, estado: 'PENDIENTE_SEGUNDA', calificacion: primera, oportunidad: 1 }
  }
  const filas = [
    { alumno: alumnos[0], unidades: [celda(11, 90), celda(12, 80)], estado: 'ACREDITADO', final: 85, nivel: 'NOTABLE' },
    { alumno: alumnos[1], unidades: [celda(11, 60, segunda, noPresento), celda(12, 75)] },
    { alumno: alumnos[2], unidades: [celda(11, 40, null, true), celda(12, 95)], estado: 'NO_ACREDITADO', final: null, nivel: 'INSUFICIENTE' },
  ]
  const luis = filas[1]
  Object.assign(luis, luis.unidades[0].estado === 'PENDIENTE_SEGUNDA'
    ? { estado: 'PENDIENTE', final: null, nivel: null }
    : luis.unidades[0].estado === 'NO_ALCANZADA'
      ? { estado: 'NO_ACREDITADO', final: null, nivel: 'INSUFICIENTE' }
      : { estado: 'ACREDITADO', final: Math.round((luis.unidades[0].calificacion + 75) / 2), nivel: 'SUFICIENTE' })
  const pendientes = filas.filter((fila) => fila.estado === 'PENDIENTE').length
  return {
    materia: { id: 1, nombre: 'Matemáticas', clave: 'MAT-1', docente: { nombre: 'Docente de prueba' } },
    grupo: { id: 1, nombre: '101A' },
    periodo: '2026-B',
    aprobatoria: 70,
    unidades,
    alumnos: filas,
    resumen: {
      total: 3,
      acreditados: filas.filter((fila) => fila.estado === 'ACREDITADO').length,
      noAcreditados: filas.filter((fila) => fila.estado === 'NO_ACREDITADO').length,
      pendientes,
      promedio: 85,
    },
    porUnidad: [],
    cierre: cerrado ? { cerradoEn: '2026-12-10T18:00:00.000Z', docente: 'Docente de prueba', foto: { docente: 'Docente de prueba', unidades, alumnos: filas }, cambios: [] } : null,
    puedeCerrar: !cerrado && !pendientes,
    bloqueos: !cerrado && pendientes ? ['1 alumno tiene segunda oportunidad sin capturar.'] : [],
  }
}

async function abrir(page) {
  const llamadas = []
  let estado = cierre()
  await mockApi(page, 'DOCENTE')
  await page.route('**/api/calificaciones/cierre**', async (route) => {
    const req = route.request()
    const ruta = new URL(req.url()).pathname
    llamadas.push({ metodo: req.method(), ruta, cuerpo: req.postDataJSON?.() ?? null })
    if (ruta.endsWith('/exportar')) {
      return route.fulfill({ status: 200, contentType: 'application/pdf', body: Buffer.from('%PDF') })
    }
    if (req.method() === 'PATCH') {
      const [captura] = req.postDataJSON().capturas
      estado = cierre({ segunda: captura.calificacion, noPresento: captura.noPresento })
    } else if (req.method() === 'POST') {
      estado = cierre({ segunda: 72, cerrado: true })
    } else if (req.method() === 'DELETE') {
      estado = cierre({ segunda: 72 })
    }
    return route.fulfill({ json: estado })
  })
  await page.goto('/calificaciones/cierre?materia=1&grupo=1')
  await expect(page.getByRole('heading', { level: 1, name: 'Cierre de curso' })).toBeVisible()
  return llamadas
}

test('la segunda oportunidad desbloquea el cierre y el curso se cierra y reabre', async ({ page }) => {
  const llamadas = await abrir(page)
  await expect(page.getByText('Matemáticas · 101A · Periodo 2026-B')).toBeVisible()
  await expect(page.getByText('1 alumno tiene segunda oportunidad sin capturar.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cerrar curso' })).toBeDisabled()

  const campo = page.getByLabel('Segunda oportunidad de Luis Pérez en Unidad 1')
  await campo.fill('120')
  await expect(page.getByText('Entre 0 y 100')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Guardar', exact: true })).toBeDisabled()
  await campo.fill('72')
  await expect(page.getByText('Alcanzada', { exact: false }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Guardaste 1 calificación de segunda oportunidad.')).toBeVisible()
  expect(llamadas.find((item) => item.metodo === 'PATCH').cuerpo).toEqual({
    materiaId: 1, grupoId: 1, capturas: [{ alumnoId: 2, unidadId: 11, noPresento: false, calificacion: 72 }],
  })

  const tabla = page.getByRole('region', { name: 'Concentrado de calificaciones' })
  await expect(tabla.getByRole('row', { name: /Luis Pérez/ })).toContainText('72')
  await expect(tabla.getByRole('row', { name: /Marta Ruiz/ })).toContainText('NA')

  await page.getByRole('button', { name: 'Cerrar curso' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Cerrar Matemáticas · 101A' })
  await expect(dialogo).toContainText('2 acreditados y 1 no acreditado')
  await dialogo.getByRole('button', { name: 'Cerrar curso' }).click()
  await expect(page.getByRole('heading', { name: 'Curso cerrado' })).toBeVisible()
  await expect(page.getByLabel('Segunda oportunidad de Luis Pérez en Unidad 1')).toBeDisabled()

  await page.getByRole('button', { name: 'Reabrir curso' }).click()
  await page.getByRole('dialog', { name: 'Reabrir el curso' }).getByRole('button', { name: 'Reabrir' }).click()
  await expect(page.getByRole('heading', { name: 'Curso abierto' })).toBeVisible()
  expect(llamadas.map((item) => item.metodo)).toEqual(expect.arrayContaining(['POST', 'DELETE']))
})

test('"No se presentó" deja la unidad no alcanzada y se manda sin calificación', async ({ page }) => {
  const llamadas = await abrir(page)
  await page.getByRole('checkbox', { name: 'No se presentó' }).first().check()
  await expect(page.getByLabel('Segunda oportunidad de Luis Pérez en Unidad 1')).toBeDisabled()
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Guardaste 1 calificación')).toBeVisible()
  expect(llamadas.find((item) => item.metodo === 'PATCH').cuerpo.capturas[0]).toMatchObject({ noPresento: true, calificacion: null })
})

test('descarga el concentrado preliminar', async ({ page }) => {
  await abrir(page)
  const descarga = page.waitForEvent('download')
  await page.getByRole('button', { name: 'PDF' }).click()
  expect((await descarga).suggestedFilename()).toBe('concentrado-mat-1-101a-preliminar.pdf')
})

test('se llega desde la materia con su grupo', async ({ page }) => {
  await abrir(page)
  await page.route('**/api/materias/1', (route) => route.fulfill({ json: {
    id: 1, nombre: 'Matemáticas', clave: 'MAT-1', grupos: [{ id: 1, nombre: '101A' }], unidades: [], inscripciones: [], docente: { id: 2, nombre: 'D' },
  } }))
  await page.route('**/api/tareas/materia/1', (route) => route.fulfill({ json: [] }))
  await page.route('**/api/avisos**', (route) => route.fulfill({ json: [] }))
  await page.goto('/materias/1?grupo=1')
  await expect(page.getByRole('link', { name: 'Cierre de curso' })).toHaveAttribute('href', '/calificaciones/cierre?materia=1&grupo=1')
})

for (const width of [390, 1280]) {
  test(`cabe en ${width} px y no tiene errores de accesibilidad`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await abrir(page)
    await expect(page.getByText('Luis Pérez').first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    await page.screenshot({ path: `audit/docente/cierre-curso-${width}.png`, fullPage: true })
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([])
  })
}

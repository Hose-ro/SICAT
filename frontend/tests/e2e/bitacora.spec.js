import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockApi, materia } from './fixtures'

const unidades = (enEstaClase = []) => [
  {
    id: 1,
    nombre: 'Unidad 1',
    temas: [
      { id: 101, nombre: 'Modelo OSI', semana: 1, enEstaClase: enEstaClase.includes(101), vistoAntes: '2026-09-03T14:00:00.000Z' },
      { id: 102, nombre: 'Arquitectura TCP/IP', semana: 2, enEstaClase: enEstaClase.includes(102), vistoAntes: null },
      { id: 103, nombre: 'Subredes', semana: 3, enEstaClase: enEstaClase.includes(103), vistoAntes: null },
    ],
  },
  { id: 2, nombre: 'Unidad 2', temas: [{ id: 201, nombre: 'Enrutamiento', semana: 6, enEstaClase: false, vistoAntes: null }] },
]

async function conBitacora(page, { activa = true, temas = unidades(), nota = null } = {}) {
  const llamadas = []
  await page.route('**/api/temario/sesion/10', async (route) => {
    const req = route.request()
    if (req.method() === 'PUT') llamadas.push(req.postDataJSON())
    const ultima = llamadas.at(-1)
    return route.fulfill({ json: {
      sesion: { id: 10, fecha: '2026-10-15T15:00:00.000Z', unidadId: 1, activa, nota: ultima?.nota ?? nota },
      materia: { id: 1, nombre: 'Matemáticas', clave: 'MAT-1' },
      unidades: ultima ? unidades(ultima.temaIds) : temas,
    } })
  })
  return llamadas
}

test('al finalizar la clase se marcan los temas vistos y la nota, y luego se cierra', async ({ page }) => {
  const requests = await mockApi(page, 'DOCENTE')
  const bitacora = await conBitacora(page)
  await page.goto('/dashboard')
  await page.goto('/docente/pasar-lista/10')
  await page.getByRole('button', { name: 'Marcar todos presentes' }).click()
  await page.getByRole('button', { name: 'Guardar asistencia' }).click()
  await page.getByRole('region', { name: /^Lista de / }).getByRole('button', { name: 'Finalizar clase' }).click()

  const dialogo = page.getByRole('dialog', { name: 'Finalizar clase' })
  await expect(dialogo).toContainText('Ya se vio el 3 sep')
  // La unidad de la clase va abierta; las demás, a un clic.
  await expect(dialogo.getByText('Enrutamiento')).toHaveCount(0)
  await dialogo.getByRole('button', { name: 'Ver temas de otras unidades' }).click()
  await expect(dialogo.getByText('Enrutamiento')).toBeVisible()

  // Cancelar no cierra la clase.
  await dialogo.getByRole('button', { name: 'Cancelar' }).click()
  expect(requests.filter((r) => r.path === '/clases/10/finalizar')).toHaveLength(0)

  await page.getByRole('region', { name: /^Lista de / }).getByRole('button', { name: 'Finalizar clase' }).click()
  await dialogo.getByRole('checkbox', { name: /Arquitectura TCP\/IP/ }).check()
  await dialogo.getByRole('checkbox', { name: /Subredes/ }).check()
  await dialogo.getByLabel('Nota de la clase (opcional)').fill('Quedó pendiente el ejercicio 3')
  await dialogo.getByRole('button', { name: 'Finalizar clase' }).click()

  await expect.poll(() => requests.filter((r) => r.path === '/clases/10/finalizar').length).toBe(1)
  expect(bitacora).toEqual([{ temaIds: [102, 103], nota: 'Quedó pendiente el ejercicio 3' }])
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('sin temario se puede finalizar con una nota y se ofrece cargarlo', async ({ page }) => {
  const requests = await mockApi(page, 'DOCENTE')
  const bitacora = await conBitacora(page, { temas: [{ id: 1, nombre: 'Unidad 1', temas: [] }] })
  await page.goto('/docente/pasar-lista/10')
  await page.getByRole('button', { name: 'Marcar todos presentes' }).click()
  await page.getByRole('button', { name: 'Guardar asistencia' }).click()
  await page.getByRole('region', { name: /^Lista de / }).getByRole('button', { name: 'Finalizar clase' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Finalizar clase' })
  await expect(dialogo.getByRole('link', { name: 'Cárgalo en la materia' })).toHaveAttribute('href', '/materias/1')
  await dialogo.getByRole('button', { name: 'Finalizar clase' }).click()
  await expect.poll(() => requests.filter((r) => r.path === '/clases/10/finalizar').length).toBe(1)
  expect(bitacora).toEqual([{ temaIds: [], nota: '' }])
})

test('en una clase pasada se ve y se corrige lo que se vio', async ({ page }) => {
  await mockApi(page, 'DOCENTE')
  const bitacora = await conBitacora(page, { activa: false, temas: unidades([101]), nota: 'Repaso' })
  await page.goto('/docente/pasar-lista/10')
  const resumen = page.getByRole('region', { name: 'Qué se vio en esta clase' })
  await expect(resumen).toContainText('Modelo OSI')
  await expect(resumen).toContainText('Repaso')
  await resumen.getByRole('button', { name: 'Editar' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Qué se vio en esta clase' })
  await expect(dialogo.getByRole('checkbox', { name: /Modelo OSI/ })).toBeChecked()
  await dialogo.getByRole('checkbox', { name: /Subredes/ }).check()
  await dialogo.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Guardaste lo que se vio en la clase.')).toBeVisible()
  expect(bitacora).toEqual([{ temaIds: [101, 103], nota: 'Repaso' }])
  await expect(resumen).toContainText('Modelo OSI · Subredes')
})

function temario({ conGrupo = true } = {}) {
  const temas = [
    { id: 101, orden: 1, nombre: 'Modelo OSI', semana: 1, vistoEn: conGrupo ? '2026-09-01T15:00:00.000Z' : null, estado: conGrupo ? 'VISTO' : 'PENDIENTE' },
    { id: 102, orden: 2, nombre: 'Arquitectura TCP/IP', semana: 2, vistoEn: null, estado: conGrupo ? 'ATRASADO' : 'PENDIENTE' },
    { id: 103, orden: 3, nombre: 'Subredes', semana: 9, vistoEn: null, estado: 'PENDIENTE' },
  ]
  const avance = conGrupo ? { total: 3, vistos: 1, porcentaje: 33, planeadosALaFecha: 2, atrasados: 1 } : null
  return {
    materia: { id: 1, nombre: 'Matemáticas', clave: 'MAT-1', docente: 'Docente' },
    grupo: conGrupo ? { id: 1, nombre: '101A', modalidad: 'ESCOLARIZADO' } : null,
    periodo: conGrupo ? { clave: '2026-B', semanaActual: 7, semanas: 16 } : null,
    unidades: [
      { id: 1, nombre: 'Unidad 1', orden: 1, status: 'ACTIVA', temas, avance },
      { id: 2, nombre: 'Unidad 2', orden: 2, status: 'PENDIENTE', temas: [], avance: conGrupo ? { total: 0, vistos: 0, porcentaje: 0, planeadosALaFecha: 0, atrasados: 0 } : null },
    ],
    avance,
  }
}

async function materiaConTemario(page) {
  await mockApi(page, 'DOCENTE')
  const guardados = []
  await page.route('**/api/materias/1', (route) => route.fulfill({ json: {
    ...materia, grupos: [{ id: 1, nombre: '101A' }], docente: { id: 2, nombre: 'Docente' }, inscripciones: [], unidades: [],
  } }))
  await page.route('**/api/tareas/materia/1', (route) => route.fulfill({ json: [] }))
  await page.route('**/api/avisos**', (route) => route.fulfill({ json: [] }))
  await page.route('**/api/temario?**', (route) => route.fulfill({ json: temario({ conGrupo: new URL(route.request().url()).searchParams.has('grupoId') }) }))
  await page.route('**/api/temario/unidad/**', (route) => {
    guardados.push({ unidad: route.request().url().split('/').pop(), ...route.request().postDataJSON() })
    return route.fulfill({ json: temario({ conGrupo: false }) })
  })
  return guardados
}

test('la materia muestra el avance del grupo y deja editar el temario pegando del programa', async ({ page }) => {
  const guardados = await materiaConTemario(page)
  await page.goto('/materias/1?grupo=1')
  const card = page.getByRole('region', { name: 'Temario y avance' })
  await expect(card).toContainText('101A: 1 de 3 temas vistos (33 %)')
  await expect(card).toContainText('semana 7 de 16')
  await expect(card).toContainText('1 atrasado')
  await expect(card.getByText('Atrasado · semana 2')).toBeVisible()
  await expect(card.getByRole('meter', { name: 'Avance de Unidad 1: 1 de 3 temas' })).toBeVisible()

  await card.getByRole('button', { name: 'Agregar temas' }).click()
  await card.getByRole('button', { name: 'Pegar lista' }).click()
  await card.getByLabel('Pega los temas, uno por renglón').fill('Enrutamiento estático\t6\nEnrutamiento dinámico')
  await card.getByRole('button', { name: 'Agregar a la lista' }).click()
  await expect(card.getByLabel('Tema 1', { exact: true })).toHaveValue('Enrutamiento estático')
  await expect(card.getByLabel('Semana planeada del tema 1')).toHaveValue('6')
  await card.getByLabel('Semana planeada del tema 2').fill('40')
  await expect(card.getByRole('button', { name: 'Guardar temario' })).toBeDisabled()
  await card.getByLabel('Semana planeada del tema 2').fill('7')
  await card.getByRole('button', { name: 'Guardar temario' }).click()
  await expect(page.getByText('Guardaste el temario de Unidad 2.')).toBeVisible()
  expect(guardados).toEqual([{ unidad: '2', temas: [{ nombre: 'Enrutamiento estático', semana: 6 }, { nombre: 'Enrutamiento dinámico', semana: 7 }] }])
})

test('quitar un tema ya visto pide confirmación', async ({ page }) => {
  const guardados = await materiaConTemario(page)
  await page.goto('/materias/1?grupo=1')
  const card = page.getByRole('region', { name: 'Temario y avance' })
  await card.getByRole('button', { name: 'Editar temas' }).click()
  await card.getByRole('button', { name: 'Quitar el tema 1' }).click()
  await card.getByRole('button', { name: 'Guardar temario' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Quitar temas ya vistos' })
  await expect(dialogo).toContainText('Modelo OSI ya se marcó en clase')
  await dialogo.getByRole('button', { name: 'Cancelar' }).click()
  expect(guardados).toHaveLength(0)
})

for (const width of [390, 1280]) {
  test(`el temario cabe en ${width} px y es accesible`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await materiaConTemario(page)
    await page.goto('/materias/1?grupo=1')
    const card = page.getByRole('region', { name: 'Temario y avance' })
    await expect(card).toContainText('1 de 3 temas vistos')
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    await card.screenshot({ path: `audit/docente/temario-${width}.png` })
    const axe = await new AxeBuilder({ page }).include('#temario-titulo').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(axe.violations.map((v) => v.id)).toEqual([])
  })
}

import { test, expect } from '@playwright/test'
import { USERS, api, login } from './helpers.js'

const clave = (fecha) => `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
const desdeHoy = (dias) => {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + dias)
  return fecha
}
// El mixto arrancó el sábado de hace dos semanas; el fin (sábado 16) se propone solo.
const sabadoDeHaceDosSemanas = () => {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() - ((fecha.getDay() + 1) % 7) - 7)
  return fecha
}
const INICIO = sabadoDeHaceDosSemanas()
const FIN = new Date(INICIO)
FIN.setDate(FIN.getDate() + 15 * 7)
const GRUPO = 'E2E-1SZ'

// Las fechas del periodo son de la BD de desarrollo (no las crea el fixture):
// se guardan al inicio y se restauran al final para no pisar las reales.
let mixtoOriginal = null

test.describe.serial('grupo mixto con su propio periodo', () => {
  test('el admin crea el grupo indicando que es mixto', async ({ page }) => {
    await login(page, USERS.admin)
    const actual = (await (await api(page).get('/periodos/actual')).json()).mixto
    mixtoOriginal = actual.configurado ? { fechaInicio: actual.fechaInicio, fechaFin: actual.fechaFin } : null

    await page.goto('/admin/grupos')
    await page.getByRole('button', { name: '+ Crear grupo' }).click()

    const dialogo = page.getByRole('dialog')
    // La casilla es sólo para lectores de pantalla: se elige tocando la tarjeta.
    await dialogo.getByText('Mixto', { exact: true }).click()
    await expect(dialogo.getByRole('radio', { name: /Mixto/ })).toBeChecked()
    await expect(dialogo.getByText('propio calendario')).toBeVisible()
    await dialogo.getByLabel('Nombre del grupo *').fill(GRUPO)
    await dialogo.getByLabel('Carrera *').selectOption({ label: 'E2E Carrera (E2E)' })
    await dialogo.getByLabel('Semestre *').selectOption('1')
    await dialogo.getByRole('button', { name: 'Continuar' }).click()
    await expect(dialogo.getByText(/Modalidad:.*Mixto \(sólo sábados\)/)).toBeVisible()
    await dialogo.getByRole('button', { name: 'Confirmar' }).click()

    await expect(page).toHaveURL(/\/admin\/grupos\/\d+$/)
    const encabezado = page.getByRole('heading', { name: GRUPO })
    await expect(encabezado).toBeVisible()
    await expect(encabezado.locator('..').getByText('Mixto', { exact: true })).toBeVisible()

    // Comparte la sección Z con el escolarizado E2E-1Z: la unicidad es por modalidad.
    const res = await api(page).get('/grupos?modalidad=MIXTO')
    const grupo = (await res.json()).find((item) => item.nombre === GRUPO)
    expect(grupo).toMatchObject({ modalidad: 'MIXTO', seccion: 'Z', semestre: 1 })
  })

  test('el admin cambia un grupo escolarizado a mixto desde su detalle', async ({ page }) => {
    await login(page, USERS.admin)
    const carreras = await (await api(page).get('/carreras')).json()
    const carrera = carreras.find((item) => item.codigo === 'E2E')
    const { clave: periodo } = await (await api(page).get('/periodos/actual')).json()
    const creado = await api(page).post('/grupos', {
      data: { nombre: 'E2E-1B', semestre: 1, carreraId: carrera.id, periodo },
    })
    expect(creado.ok(), await creado.text()).toBeTruthy()
    const grupo = await creado.json()
    expect(grupo.modalidad).toBe('ESCOLARIZADO')

    await page.goto(`/admin/grupos/${grupo.id}`)
    await page.getByRole('button', { name: 'Editar', exact: true }).click()
    const dialogo = page.getByRole('dialog')
    await expect(dialogo.getByRole('radio', { name: /Escolarizado/ })).toBeChecked()
    await dialogo.getByText('Mixto', { exact: true }).click()
    await expect(dialogo.getByText(/se regirán por el calendario mixto/)).toBeVisible()
    await dialogo.getByRole('button', { name: 'Guardar cambios' }).click()

    await expect(dialogo).toBeHidden()
    const encabezado = page.getByRole('heading', { name: 'E2E-1B' })
    await expect(encabezado.locator('..').getByText('Mixto', { exact: true })).toBeVisible()
    const detalle = await (await api(page).get(`/grupos/${grupo.id}`)).json()
    expect(detalle).toMatchObject({ modalidad: 'MIXTO', seccion: 'B' })

    // E2E-1Z no puede pasar a mixto: la sección Z mixta ya es de E2E-1SZ.
    const catalogo = await (await api(page).get('/grupos')).json()
    const escolarizadoZ = catalogo.find((item) => item.nombre === 'E2E-1Z')
    const conflicto = await api(page).patch(`/grupos/${escolarizadoZ.id}`, { data: { modalidad: 'MIXTO' } })
    expect(conflicto.status()).toBe(409)
    expect((await conflicto.json()).message).toContain(GRUPO)
  })

  test('el docente con clase en sábado captura el calendario mixto aparte', async ({ page }) => {
    await login(page, USERS.docente)
    // Sin grupos mixtos sólo aparece el periodo escolarizado.
    await expect(page.getByText(/^Semestre del /)).toBeVisible()
    await expect(page.getByText(/Semestre mixto/)).toHaveCount(0)

    // Docente mixto: su grupo escolarizado de siempre más el mixto nuevo.
    // Con eso le tocan los dos calendarios.
    await page.goto('/docente/grupos')
    await page.getByRole('button', { name: 'Agregar grupo' }).click()
    const dialogo = page.getByRole('dialog')
    for (const nombre of ['E2E-1Z', GRUPO]) {
      await dialogo.getByLabel('Buscar por nombre, carrera o periodo').fill(nombre)
      const fila = dialogo.getByRole('listitem').filter({ hasText: new RegExp(`^${nombre}`) })
      if (nombre === GRUPO) await expect(fila).toContainText('Mixto')
      await fila.getByRole('button', { name: 'Agregar' }).click()
      await expect(fila.getByRole('button', { name: 'Ya es tuyo' })).toBeVisible()
    }

    await page.goto('/docente/horario')
    const mixto = page.getByRole('article', { name: 'Periodo mixto' })
    await expect(mixto).toContainText('sábados')
    await expect(page.getByRole('article', { name: 'Periodo escolarizado' })).toBeVisible()
    await mixto.getByRole('button', { name: /fechas$/ }).click()
    await mixto.getByLabel('Inicio del semestre mixto').fill(clave(INICIO))
    // El fin se propone al sábado 16 sin tocarlo.
    await expect(mixto.getByLabel('Fin del semestre mixto')).toHaveValue(clave(FIN))
    await mixto.getByRole('button', { name: 'Guardar fechas' }).click()

    await expect(page.getByRole('status')).toHaveText('Fechas del periodo mixto actualizadas.')
    await expect(mixto).toContainText(/Van \d+ de \d+ sábados de clase/)
    const res = await api(page).get('/periodos/actual')
    const periodos = await res.json()
    expect(periodos.mixto).toMatchObject({ configurado: true, aplica: true, fechaInicio: clave(INICIO), fechaFin: clave(FIN) })
    expect(periodos.mixto.sabados).toMatchObject({ requeridos: 16, total: 16 })
    expect(periodos.mixto.sabados.transcurridos).toBeGreaterThan(0)
    expect(periodos.escolarizado.aplica).toBe(true)
    expect(periodos.escolarizado.fechaInicio).not.toBe(clave(INICIO))

    // Menos de 16 sábados o un inicio entre semana se rechazan.
    const corto = await api(page).put('/periodos/actual', {
      data: { modalidad: 'MIXTO', fechaInicio: clave(INICIO), fechaFin: clave(desdeHoy(60)) },
    })
    expect(corto.status()).toBe(400)
    expect((await corto.json()).message).toContain('sábados')
    const lunes = new Date(INICIO)
    lunes.setDate(lunes.getDate() + 2)
    const entreSemana = await api(page).put('/periodos/actual', {
      data: { modalidad: 'MIXTO', fechaInicio: clave(lunes), fechaFin: clave(FIN) },
    })
    expect(entreSemana.status()).toBe(400)

    // En Inicio se ven los dos calendarios.
    await page.goto('/')
    await expect(page.getByText(/Semestre escolarizado del/)).toBeVisible()
    await expect(page.getByText(/Semestre mixto del/)).toBeVisible()
  })

  test('un docente sin grupos mixtos no puede fijar ese calendario', async ({ page }) => {
    await login(page, USERS.ajeno)
    await expect(page.getByText(/^Semestre del /)).toBeVisible()
    const res = await api(page).put('/periodos/actual', {
      data: { modalidad: 'MIXTO', fechaInicio: clave(INICIO), fechaFin: clave(FIN) },
    })
    expect(res.status()).toBe(403)
  })

  test('el admin deja el calendario mixto como estaba', async ({ page }) => {
    test.skip(!mixtoOriginal, 'no había fechas mixtas capturadas antes de la prueba')
    await login(page, USERS.admin)
    const res = await api(page).put('/periodos/actual', { data: { modalidad: 'MIXTO', ...mixtoOriginal } })
    expect(res.ok(), await res.text()).toBeTruthy()
    expect((await res.json()).mixto).toMatchObject(mixtoOriginal)
  })
})

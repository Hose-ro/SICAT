import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockApi } from './fixtures'

const nombres = ['Ana López', 'Bruno Díaz', 'Carla Méndez', 'Daniel Ruiz', 'Elena Torres', 'Fernando Gil', 'Gabriela Soto', 'Héctor Vega', 'Irene Campos', 'Jorge Navarro', 'Karla Ríos', 'Luis Pérez', 'María Fernanda Castillo Herrera', 'Néstor Silva', 'Olga Ramos', 'Pablo Ortega', 'Quetzalli Cruz', 'Ramón Flores', 'Sofía Aguilar', 'Tomás Reyes', 'Úrsula Mora', 'Víctor Salas', 'Ximena Luna', 'Yahir Rojas', 'Zaira Peña', 'Alan Medina', 'Brenda Cano', 'César Ibarra']
const lista = (n = nombres.length) => ({
  sesion: { id: 10, activa: true, materia: { id: 1, nombre: 'Programación Orientada a Objetos', clave: 'AED-1286' }, grupo: { id: 1, nombre: '5A' }, aula: { nombre: 'Lab. Cómputo 2' }, fecha: '2026-10-07T15:00:00.000Z', horaInicio: '2026-10-07T15:00:00.000Z', unidad: { id: 1, nombre: 'Unidad 2' } },
  alumnos: nombres.slice(0, n).map((nombre, i) => ({ alumnoId: 100 + i, nombre, numeroControl: `22${5000 + i}`, sexo: i % 2 ? 'HOMBRE' : 'MUJER', estado: null, participacion: 0 })),
})

async function abrir(page, { n, sesion } = {}) {
  const requests = await mockApi(page, 'DOCENTE')
  await page.route('**/api/asistencias/sesion/10', (route) => (sesion ? sesion(route) : route.fulfill({ json: lista(n) })))
  await page.goto('/docente/pasar-lista/10')
  return requests
}

const estado = (page, alumno, etiqueta) => page.getByRole('group', { name: `Estado de ${alumno}` }).getByRole('button', { name: etiqueta, exact: true })

test('la lista marcada sobrevive a una recarga y se puede descartar', async ({ page }) => {
  await abrir(page, { n: 3 })
  await estado(page, 'Bruno Díaz', 'Retardo').click()
  await expect(page.getByText('Cambios sin guardar', { exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByText(/Recuperamos marcas que no se habían guardado/)).toBeVisible()
  await expect(estado(page, 'Bruno Díaz', 'Retardo')).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: 'Descartar', exact: true }).click()
  await page.getByRole('dialog', { name: 'Descartar lo recuperado' }).getByRole('button', { name: 'Descartar' }).click()
  await expect(estado(page, 'Bruno Díaz', 'Retardo')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByText(/Recuperamos marcas/)).toHaveCount(0)
})

test('tocar el estado marcado lo quita y "los demás presentes" respeta lo marcado', async ({ page }) => {
  await abrir(page, { n: 3 })
  await estado(page, 'Ana López', 'Falta').click()
  await page.getByRole('button', { name: 'Marcar a los demás presentes' }).click()
  await expect(estado(page, 'Ana López', 'Falta')).toHaveAttribute('aria-pressed', 'true')
  await expect(estado(page, 'Carla Méndez', 'Asistencia')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Todos marcados')).toBeVisible()

  await estado(page, 'Carla Méndez', 'Asistencia').click()
  await expect(estado(page, 'Carla Méndez', 'Asistencia')).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: '1 sin marcar' }).click()
  await expect(page.getByRole('group', { name: /^Estado de / })).toHaveCount(1)
})

test('salir con cambios sin guardar pide confirmación', async ({ page }) => {
  await abrir(page, { n: 3 })
  await estado(page, 'Ana López', 'Asistencia').click()
  await page.getByRole('link', { name: 'Tareas' }).click()
  const dialogo = page.getByRole('dialog', { name: 'La lista no se ha guardado' })
  await expect(dialogo).toBeVisible()
  await dialogo.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page).toHaveURL(/pasar-lista\/10$/)

  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await expect(dialogo).toBeVisible()
})

test('si falla la carga se puede reintentar', async ({ page }) => {
  // StrictMode pide la lista dos veces: falla hasta que la red "regresa".
  let sinRed = true
  await abrir(page, { n: 2, sesion: (route) => (sinRed ? route.abort('internetdisconnected') : route.fulfill({ json: lista(2) })) })
  await expect(page.getByRole('alert')).toContainText('Revisa tu conexión')
  sinRed = false
  await page.getByRole('button', { name: 'Reintentar' }).click()
  await expect(page.getByText('Ana López')).toBeVisible()
})

test('sin señal la lista queda en cola y se envía sola al volver la conexión', async ({ page }) => {
  await abrir(page, { n: 2 })
  let sinRed = true
  const enviados = []
  await page.route('**/api/asistencias/pasar-lista', (route) => {
    if (sinRed) return route.abort('internetdisconnected')
    enviados.push(route.request().postDataJSON())
    return route.fulfill({ json: { asistencias: 2, retardos: 0, faltas: 0, justificados: 0 } })
  })
  await page.getByRole('button', { name: 'Marcar todos presentes' }).click()
  await page.getByRole('button', { name: 'Guardar asistencia' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Sin conexión: la lista se enviará sola' })).toBeVisible()

  // En cola ya no hay nada que perder: salir no pide confirmación y al volver sigue esperando.
  await page.reload()
  await expect(page.getByText('Esperando señal para enviar')).toBeVisible()
  await expect(page.getByText(/Recuperamos marcas/)).toHaveCount(0)
  await page.getByRole('link', { name: 'Tareas' }).first().click()
  await expect(page).toHaveURL(/\/tareas$/)

  sinRed = false
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(page.getByText('Se envió la lista de Programación Orientada a Objetos que quedó pendiente.')).toBeVisible()
  expect(enviados).toEqual([{ claseSesionId: 10, registros: [{ alumnoId: 100, estado: 'ASISTENCIA' }, { alumnoId: 101, estado: 'ASISTENCIA' }] }])
  expect(await page.evaluate(() => localStorage.getItem('sicat:pase-lista-cola'))).toBeNull()
})

test('con teclado se marca sin tocar nada: el alumno resaltado avanza solo', async ({ page }) => {
  await abrir(page, { n: 3 })
  const fila = (nombre) => page.getByRole('listitem').filter({ hasText: nombre })
  // Recién abierta, sin foco en la lista: el primero sin marcar está resaltado.
  await expect(fila('Ana López')).toHaveAttribute('aria-current', 'true')
  await page.keyboard.press('a')
  await page.keyboard.press('F')
  await expect(estado(page, 'Ana López', 'Asistencia')).toHaveAttribute('aria-pressed', 'true')
  await expect(estado(page, 'Bruno Díaz', 'Falta')).toHaveAttribute('aria-pressed', 'true')
  await expect(fila('Carla Méndez')).toHaveAttribute('aria-current', 'true')

  // ↑ regresa sin foco en un control; corregir a Bruno lo deja en Retardo.
  await page.keyboard.press('ArrowUp')
  await expect(fila('Bruno Díaz')).toHaveAttribute('aria-current', 'true')
  await page.keyboard.press('r')
  await expect(estado(page, 'Bruno Díaz', 'Retardo')).toHaveAttribute('aria-pressed', 'true')

  // Un clic (aunque el navegador no enfoque el botón, como Safari) elige al alumno.
  await page.getByText('Ana López').click()
  await estado(page, 'Ana López', 'Justificado').click()
  await expect(fila('Ana López')).toHaveAttribute('aria-current', 'true')
  await page.keyboard.press('j')
  await expect(estado(page, 'Ana López', 'Justificado')).toHaveAttribute('aria-pressed', 'true')
})

test('con el foco en la lista, las teclas llevan el foco al siguiente alumno', async ({ page }) => {
  await abrir(page, { n: 3 })
  await estado(page, 'Ana López', 'Asistencia').focus()
  await page.keyboard.press('f')
  await expect(estado(page, 'Ana López', 'Falta')).toHaveAttribute('aria-pressed', 'true')
  await expect(estado(page, 'Bruno Díaz', 'Falta')).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(estado(page, 'Carla Méndez', 'Falta')).toBeFocused()
})

test('los atajos no se disparan al escribir, con un diálogo abierto ni desactivados', async ({ page }) => {
  await abrir(page)
  await page.getByRole('searchbox', { name: /Buscar alumno/ }).fill('far')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('group', { name: /^Estado de / }).getByRole('button', { pressed: true })).toHaveCount(0)
  await page.getByRole('searchbox', { name: /Buscar alumno/ }).fill('')

  await page.getByRole('button', { name: 'Guardar asistencia' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('a')
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click()
  await expect(estado(page, 'Ana López', 'Asistencia')).toHaveAttribute('aria-pressed', 'false')

  await page.getByRole('button', { name: 'Desactivar atajos' }).click()
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('a')
  await expect(estado(page, 'Ana López', 'Asistencia')).toHaveAttribute('aria-pressed', 'false')
  // La preferencia se recuerda en este navegador.
  await page.reload()
  await expect(page.getByRole('button', { name: 'Activar atajos' })).toBeVisible()
})

test('guardar con alumnos sin marcar pide confirmar las faltas', async ({ page }) => {
  const requests = await abrir(page, { n: 3 })
  await estado(page, 'Ana López', 'Asistencia').click()
  await page.getByRole('button', { name: 'Guardar asistencia' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Quedan 2 alumnos sin marcar' })
  await expect(dialogo).toContainText('Bruno Díaz, Carla Méndez se guardarán con falta.')
  await dialogo.getByRole('button', { name: 'Cancelar' }).click()
  expect(requests.filter((r) => r.path === '/asistencias/pasar-lista')).toHaveLength(0)

  await page.getByRole('button', { name: 'Guardar asistencia' }).click()
  await dialogo.getByRole('button', { name: 'Guardar con faltas' }).click()
  await expect(page.getByRole('status').filter({ hasText: /^Lista guardada a las/ })).toBeVisible()
  expect(requests.find((r) => r.path === '/asistencias/pasar-lista').data.registros.map((r) => r.estado)).toEqual(['ASISTENCIA', 'FALTA', 'FALTA'])
  await expect(page.getByText(/Recuperamos marcas/)).toHaveCount(0)
})

for (const [width, tema] of [[360, 'light'], [390, 'light'], [390, 'dark'], [1440, 'light']]) {
  test(`28 alumnos caben y se guardan sin recorrer la página (${width}, ${tema})`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 768 ? 800 : 900 })
    await page.emulateMedia({ colorScheme: tema })
    await abrir(page)
    await expect(page.getByText('César Ibarra')).toBeVisible()
    const medidas = await page.evaluate(() => {
      const filas = [...document.querySelectorAll('main li')].map((li) => li.getBoundingClientRect().height).sort((a, b) => a - b)
      const segmentos = [...document.querySelectorAll('[role=group][aria-label^="Estado de"] button')]
      const desborda = segmentos.some((b) => b.scrollWidth > b.clientWidth + 1)
      // Mediana: un nombre largo puede ocupar dos renglones y está bien.
      return { altoFila: filas[Math.floor(filas.length / 2)], altura: document.documentElement.scrollHeight, pagina: document.documentElement.scrollWidth > innerWidth, desborda }
    })
    expect(medidas.pagina).toBe(false)
    expect(medidas.desborda).toBe(false)
    expect(medidas.altoFila).toBeLessThan(width < 768 ? 125 : 70)
    // La barra para guardar se ve sin bajar hasta el final.
    await expect(page.getByRole('button', { name: 'Guardar asistencia' })).toBeInViewport()
    await page.screenshot({ path: `audit/docente/pasar-lista-despues-${width}-${tema}.png`, fullPage: false })
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(axe.violations.map((v) => v.id)).toEqual([])
  })
}

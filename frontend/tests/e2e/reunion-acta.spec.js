import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockApi } from './fixtures'
import { mockJefatura, reunionesIniciales } from './jefatura-fixture'

const axe = async (page) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 120)).join(' | ')}`)
}
const sinDesborde = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
// PDF mínimo válido para el visor.
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF')

test.describe('acta de reunión de academia', () => {
  test('la jefatura invita a otra carrera, define la mesa y ve el acta con su formato', async ({ page }) => {
    await mockApi(page, 'JEFE_CARRERA')
    const requests = await mockJefatura(page)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/jefe-carrera/reuniones')

    await page.getByRole('button', { name: 'Programar reunión' }).first().click()
    const form = page.getByRole('dialog', { name: 'Programar reunión' })
    await form.getByLabel('Título').fill('Revisión de retícula')
    await form.getByLabel('Fecha').fill(new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10))
    await form.getByLabel('Hora de inicio').fill('13:00')
    await form.getByLabel('Lugar').fill('Sala audiovisual')
    await form.getByLabel('Academia').fill('Academia de Sistemas')
    await form.getByLabel('Invitar a docentes de otras carreras').fill('Rosa')
    await form.getByRole('button', { name: 'Invitar' }).click()
    await expect(form.getByText('Invitados (1)')).toBeVisible()
    await expect(form.getByText(/8 de 8 \+ 1 invitado/)).toBeVisible()
    await form.getByLabel('Presidente(a)').selectOption({ label: 'Persona de prueba (jefatura)' })
    await form.getByLabel('Secretario(a)').selectOption({ label: 'Rosa Externa' })
    await form.getByRole('button', { name: 'Redactar con los datos' }).click()
    await expect(form.getByLabel('Apertura del acta (opcional)')).toHaveValue(/Sala audiovisual del Instituto Tecnológico Superior de Cosamaloapan, siendo las 13:00 horas/)
    expect(await axe(page)).toEqual([])
    await page.screenshot({ path: 'audit/jefatura-reunion-acta-form-1440.png' })
    await form.getByRole('button', { name: 'Programar y avisar' }).click()
    await expect(form).toBeHidden()

    const post = requests.find((r) => r.method === 'POST' && r.path === '/reuniones')
    expect(post.body).toMatchObject({ academia: 'Academia de Sistemas', presidenteId: 1, secretarioId: 70 })
    expect(post.body.convocados).toContain(70)

    const tarjeta = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Reunión ordinaria de academia' }) })
    await tarjeta.getByRole('button', { name: 'Ver acta' }).click()
    const visor = page.getByRole('dialog', { name: /Acta: Reunión ordinaria de academia/ })
    const acta = visor.getByRole('article')
    await expect(acta.getByText('INSTITUTO TECNOLÓGICO SUPERIOR DE COSAMALOAPAN', { exact: true })).toBeVisible()
    await expect(acta.getByText('Acta Ordinaria No. _____')).toBeVisible()
    for (const titulo of ['ORDEN DEL DÍA', 'SEGUIMIENTO DE ACUERDOS ANTERIORES', 'ACUERDOS DE REUNIÓN', 'CONSTANCIA DE APROBACIÓN', 'OBSERVACIONES']) {
      await expect(acta.getByRole('heading', { name: titulo })).toBeVisible()
    }
    await expect(acta.getByRole('cell', { name: 'Avance programático por materia' })).toBeVisible()
    await expect(acta.getByRole('cell', { name: 'Laura Méndez' })).toBeVisible()
    expect(await axe(page)).toEqual([])
    await page.screenshot({ path: 'audit/jefatura-reunion-acta-visor-1440.png' })

    const pdf = page.waitForEvent('download')
    await visor.getByRole('button', { name: 'Descargar PDF' }).click()
    expect((await pdf).suggestedFilename()).toMatch(/^Acta Reunión ordinaria de academia \d{4}-\d{2}-\d{2}\.pdf$/)
    const word = page.waitForEvent('download')
    await visor.getByRole('button', { name: 'Descargar Word' }).click()
    const docx = await word
    expect(docx.suggestedFilename()).toMatch(/\.docx$/)
    await docx.saveAs(test.info().outputPath('acta.docx'))

    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.waitForTimeout(200)
    expect(await sinDesborde(page)).toBe(true)
    await page.screenshot({ path: 'audit/jefatura-reunion-acta-visor-390-dark.png' })
  })

  test('la jefatura captura el seguimiento, finaliza y sube el acta firmada', async ({ page }) => {
    await mockApi(page, 'JEFE_CARRERA')
    const reunionHoy = (rs) => rs.map((r) => (r.id === 1 ? { ...r, fecha: new Date().toISOString().slice(0, 10) } : r))
    const requests = await mockJefatura(page, { ajustarReuniones: reunionHoy })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/jefe-carrera/reuniones')

    const tarjeta = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Reunión ordinaria de academia' }) })
    await tarjeta.getByRole('button', { name: 'Capturar acta' }).first().click()
    const dialogo = page.getByRole('dialog', { name: /Acta: Reunión ordinaria de academia/ })
    await expect(dialogo.getByText(/Acuerdos de la reunión del .* \(Reunión de inicio de semestre\)/)).toBeVisible()
    await dialogo.getByRole('button', { name: 'Traer 1 acuerdo' }).click()
    await expect(dialogo.getByLabel('Acuerdo anterior 1', { exact: true })).toHaveValue('Entregar planeación didáctica')
    await dialogo.getByLabel('Avance').fill('Cumplido')
    await dialogo.getByRole('button', { name: /Marcar a los 5 pendientes como presentes/ }).click()
    await dialogo.getByLabel('Hora de cierre').fill('13:40')
    await dialogo.getByLabel('Acuerdo 1', { exact: true }).fill('Actualizar instrumentaciones')
    await expect(dialogo.getByText('Al finalizar la reunión podrás subir aquí el acta firmada en PDF o Word.')).toBeVisible()
    await dialogo.getByRole('button', { name: 'Finalizar reunión' }).click()

    await expect(dialogo.getByText(/Reunión finalizada\. Los convocados ya pueden ver el acta/)).toBeVisible()
    const put = requests.find((r) => r.method === 'PUT' && r.path === '/reuniones/1/acta')
    expect(put.body).toMatchObject({ finalizar: true, horaCierre: '13:40', seguimiento: [{ acuerdoOrigenId: 1, descripcion: 'Entregar planeación didáctica', avance: 'Cumplido' }] })

    await dialogo.getByLabel(/Elegir PDF o Word/).setInputFiles({ name: 'acta-firmada.pdf', mimeType: 'application/pdf', buffer: PDF })
    await expect(dialogo.getByText('Acta subida. Se avisó a los convocados.')).toBeVisible()
    await expect(dialogo.getByText('acta-firmada.pdf')).toBeVisible()
    expect(requests.some((r) => r.method === 'POST' && r.path === '/reuniones/1/documento')).toBe(true)
    expect(await axe(page)).toEqual([])
    await page.screenshot({ path: 'audit/jefatura-reunion-acta-firmada-1440.png' })

    await dialogo.getByRole('button', { name: 'Cerrar', exact: true }).click()
    await page.getByRole('button', { name: /^Historial/ }).click()
    await expect(tarjeta.getByText('Acta firmada: PDF')).toBeVisible()
  })

  test('el docente ve el acta firmada sin descargarla y decide el aviso a sus alumnos', async ({ page }) => {
    await mockApi(page, 'DOCENTE')
    const [, pasada] = reunionesIniciales()
    const [proxima] = reunionesIniciales()
    const choque = {
      horarioId: 36, materia: { id: 36, nombre: 'Programación Móvil', clave: 'M36' }, grupo: { id: 1, nombre: '806A' }, horaInicio: '12:00', horaFin: '13:00',
      justificacion: { motivo: 'Reunión de academia: Reunión ordinaria de academia (12:00–13:30)', reunionId: 1, creadaEn: new Date().toISOString(), avisarAlumnos: true, automatica: true },
      sinClases: null, listaCapturada: false,
    }
    let choques = [choque]
    let patch
    const firmada = { ...pasada, documentos: [{ formato: 'PDF', nombre: 'acta-firmada.pdf', mime: 'application/pdf', tamano: 120000, createdAt: '2026-08-28T10:00:00.000Z' }] }
    await page.route('**/api/reuniones/mias', (route) => route.fulfill({ json: [
      { ...proxima, convocados: undefined, totalConvocados: 5, miAsistencia: null, choques },
      { ...firmada, convocados: undefined, totalConvocados: 3, miAsistencia: true, choques: [] },
    ] }))
    await page.route('**/api/reuniones/2', (route) => route.fulfill({ json: { ...firmada, clasesJustificadas: undefined, miAsistencia: true } }))
    await page.route('**/api/reuniones/2/documento/PDF**', (route) => route.fulfill({ status: 200, contentType: 'application/pdf', body: PDF }))
    await page.route('**/api/reuniones/1/justificaciones/36', async (route) => {
      patch = route.request().postDataJSON()
      choques = [{ ...choque, justificacion: { ...choque.justificacion, avisarAlumnos: patch.avisarAlumnos } }]
      return route.fulfill({ json: choques })
    })
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/docente/reuniones')

    await expect(page.getByText('Una de tus clases queda sin clase por la reunión')).toBeVisible()
    await expect(page.getByText('Sin clase por la reunión', { exact: true })).toBeVisible()
    await page.getByRole('checkbox', { name: 'Avisar a mis alumnos' }).uncheck()
    expect(patch).toEqual({ avisarAlumnos: false })
    await expect(page.getByRole('checkbox', { name: 'Avisar a mis alumnos' })).not.toBeChecked()
    await page.screenshot({ path: 'audit/docente/reunion-sin-clase-1280-light.png', fullPage: true })

    await page.getByRole('button', { name: 'Ver acta firmada' }).click()
    const visor = page.getByRole('dialog', { name: /Acta: Reunión de inicio de semestre/ })
    await expect(visor.getByRole('button', { name: 'Acta firmada · PDF' })).toHaveAttribute('aria-pressed', 'true')
    await expect(visor.locator('iframe[title="Acta firmada: acta-firmada.pdf"]')).toBeVisible()
    await expect(visor.getByRole('button', { name: 'Descargar PDF' })).toBeVisible()
    await expect(visor.getByRole('button', { name: 'Descargar Word' })).toHaveCount(0)
    await visor.getByRole('button', { name: 'Acta del sistema' }).click()
    await expect(visor.getByRole('article').getByText('Academia de Sistemas', { exact: true })).toBeVisible()
    await expect(visor.getByRole('article').getByText(/siendo las 11:30 horas del mismo día/)).toBeVisible()
    expect(await axe(page)).toEqual([])
    await page.screenshot({ path: 'audit/docente/reunion-acta-visor-1280-light.png' })
  })
})

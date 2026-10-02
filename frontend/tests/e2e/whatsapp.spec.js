import { test, expect } from '@playwright/test'
import { mockApi, materia, grupo } from './fixtures'

test.use({ timezoneId: 'America/Mexico_City' })

const ENLACE = 'https://chat.whatsapp.com/AbCdEfGhIj1234567890xY'

const tarea = {
  id: 9, materiaId: 1, grupoId: 1, docenteId: 2, estado: 'PUBLICADA',
  titulo: 'Práctica de subredes', instrucciones: 'Resuelve los 5 ejercicios del cuaderno.\n\nEntrega en PDF con tu nombre y número de control.',
  tipoEntrega: 'EN_LINEA', tipoEvaluacion: 'RUBRICA', permiteReenvio: true, tieneFechaLimite: true,
  fechaPublicacion: '2026-10-02T15:00:00Z', fechaLimite: '2026-10-07T05:59:00Z',
  rubricJson: JSON.stringify([{ criterio: 'Cálculos correctos', peso: 70 }, { criterio: 'Presentación', peso: 30 }]),
  materia: { id: 1, nombre: materia.nombre, clave: materia.clave }, grupo: { id: 1, nombre: grupo.nombre },
  unidadRef: { id: 1, nombre: 'Direccionamiento', orden: 2 }, archivos: [{ id: 1, nombre: 'tabla.xlsx', url: 'uploads/tareas/tabla.xlsx' }],
}

async function mockWhatsapp(page, guardado = null) {
  let enlace = guardado
  const puts = []
  await page.route('**/api/avisos/whatsapp**', async (route) => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON()
      puts.push(body)
      enlace = body.enlace ? body.enlace.split('?')[0] : null // como normalizarEnlaceWhatsapp
    }
    return route.fulfill({ json: { enlace } })
  })
  // Que el «abrir el grupo» no salga a internet.
  await page.context().route('https://chat.whatsapp.com/**', (route) => route.fulfill({ body: 'grupo' }))
  await page.context().route('https://wa.me/**', (route) => route.fulfill({ body: 'wa.me' }))
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  return puts
}

test('el docente guarda el grupo de WhatsApp y le manda un aviso', async ({ page }) => {
  await mockApi(page, 'DOCENTE')
  const puts = await mockWhatsapp(page)
  await page.route('**/api/materias/1', (route) => route.fulfill({ json: { ...materia, grupos: [grupo], unidades: [] } }))
  await page.route('**/api/tareas/materia/1', (route) => route.fulfill({ json: [] }))
  await page.route('**/api/avisos?**', (route) => route.fulfill({ json: [{
    id: 1, titulo: 'Traigan calculadora', cuerpo: 'Para el examen del jueves', fijado: false, alumnoId: null,
    createdAt: '2026-10-01T15:00:00Z', docente: { id: 2, nombre: 'Docente de prueba' },
  }] }))

  await page.goto('/materias/1')
  await page.getByRole('button', { name: 'Compartir Traigan calculadora por WhatsApp' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Compartir aviso por WhatsApp' })
  await expect(dialogo.getByRole('textbox', { name: 'Mensaje' })).toHaveValue(/\*Traigan calculadora\*\nPara el examen del jueves/)

  await dialogo.getByLabel('Enlace de invitación del grupo').fill(`${ENLACE}?mode=ac_t`)
  await dialogo.getByRole('button', { name: 'Guardar' }).click()
  await expect(dialogo.getByText('chat.whatsapp.com/AbCdEfGhIj1234567890xY')).toBeVisible()
  expect(puts).toEqual([{ materiaId: 1, grupoId: 1, enlace: `${ENLACE}?mode=ac_t` }])
  await page.screenshot({ path: 'audit/whatsapp-aviso.png' })

  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    dialogo.getByRole('button', { name: 'Copiar mensaje y abrir el grupo' }).click(),
  ])
  expect(popup.url()).toBe(ENLACE)
  await expect(page.getByText('Se copió el mensaje. Pégalo en el grupo.')).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('📢 *Aviso* · Matemáticas (101A)')
})

test('la tarea se comparte con su documento en PDF o Word', async ({ page }) => {
  await mockApi(page, 'DOCENTE')
  await mockWhatsapp(page, ENLACE)
  await page.route('**/api/tareas/9', (route) => route.fulfill({ json: tarea }))
  await page.route('**/api/tareas/9/entregas**', (route) => route.fulfill({ json: { tarea, entregas: [] } }))

  await page.goto('/docente/tareas/9')
  await page.getByRole('button', { name: 'Más acciones de la tarea' }).click()
  await page.getByRole('menuitem', { name: 'Compartir por WhatsApp' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Compartir tarea por WhatsApp' })
  await expect(dialogo.getByText(/Tarea - Práctica de subredes - 101A\.pdf/)).toBeVisible()
  await expect(dialogo.getByRole('textbox', { name: 'Mensaje' })).toHaveValue(/Entrega: martes 6 de octubre, 23:59/)
  await page.screenshot({ path: 'audit/whatsapp-tarea.png' })

  const [pdf] = await Promise.all([
    page.waitForEvent('download'),
    dialogo.getByRole('button', { name: 'Descargar, copiar y abrir el grupo' }).click(),
  ])
  expect(pdf.suggestedFilename()).toBe('Tarea - Práctica de subredes - 101A.pdf')
  await pdf.saveAs(test.info().outputPath('tarea.pdf'))
  await expect(page.getByText(/Se descargó «Tarea - Práctica de subredes - 101A\.pdf»/)).toBeVisible()

  await page.getByRole('button', { name: 'Más acciones de la tarea' }).click()
  await page.getByRole('menuitem', { name: 'Recordatorio por WhatsApp' }).click()
  const recordatorio = page.getByRole('dialog', { name: 'Recordatorio por WhatsApp' })
  await expect(recordatorio.getByRole('checkbox', { name: 'Adjuntar documento con las instrucciones' })).not.toBeChecked()
  await recordatorio.getByRole('checkbox', { name: 'Adjuntar documento con las instrucciones' }).check()
  await recordatorio.getByRole('radio', { name: 'Word' }).click()
  await expect(recordatorio.getByText(/101A\.docx/)).toBeVisible()
  await expect(recordatorio.getByRole('textbox', { name: 'Mensaje' })).toHaveValue(/⏰ \*Recordatorio\*/)
  const [docx] = await Promise.all([
    page.waitForEvent('download'),
    recordatorio.getByRole('button', { name: 'Descargar, copiar y abrir el grupo' }).click(),
  ])
  expect(docx.suggestedFilename()).toBe('Tarea - Práctica de subredes - 101A.docx')
  await docx.saveAs(test.info().outputPath('tarea.docx'))
})

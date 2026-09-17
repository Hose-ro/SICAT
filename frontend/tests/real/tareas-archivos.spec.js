import { test, expect } from '@playwright/test'
import { API } from '../../playwright.real.config.js'
import { USERS, api, login, materiaE2E } from './helpers.js'

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n168\n%%EOF\n')

let tarea
let archivoUrl

test.describe.serial('tareas: permisos y archivos con la API real', () => {
  test('el docente publica una tarea con adjunto', async ({ page }) => {
    await login(page, USERS.docente)
    const materia = await materiaE2E(page)
    const res = await api(page).post('/tareas', {
      multipart: {
        materiaId: String(materia.id), grupoId: String(materia.grupos[0].id),
        titulo: 'E2E Tarea con guía', instrucciones: 'Lee la guía adjunta.',
        tipoEntrega: 'REVISION_EN_LINEA', estado: 'PUBLICADA', tieneFechaLimite: 'false',
        archivos: { name: 'guia.pdf', mimeType: 'application/pdf', buffer: PDF },
      },
    })
    expect(res.status(), await res.text()).toBe(201)
    tarea = await res.json()
    archivoUrl = tarea.archivos[0].url
    expect(archivoUrl).toMatch(/^\/uploads\/tareas\//)

    await page.goto(`/docente/tareas/${tarea.id}`)
    await expect(page.getByRole('heading', { name: 'E2E Tarea con guía' })).toBeVisible()
  })

  test('el adjunto no es público ni se sirve como estático', async ({ request }) => {
    expect((await request.get(`${API}${archivoUrl}`)).status()).toBe(404)
    expect((await request.get(`${API}/api${archivoUrl}`)).status()).toBe(401)
  })

  test('el alumno inscrito ve la tarea y descarga el adjunto desde la interfaz', async ({ page }) => {
    await login(page, USERS.alumno)
    await page.goto('/tareas')
    const tarjeta = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'E2E Tarea con guía' }) })
    await tarjeta.getByRole('link', { name: /Entregar tarea|Consultar tarea/ }).click()
    await expect(page).toHaveURL(new RegExp(`/alumno/tareas/${tarea.id}`))
    const enlace = page.getByRole('link', { name: /guia\.pdf/ }).first()
    await expect(enlace).toBeVisible()
    const href = await enlace.getAttribute('href')
    expect(href).toBe(`${API}/api${archivoUrl}`)
    const descarga = await page.request.get(href)
    expect(descarga.status()).toBe(200)
    expect(descarga.headers()['content-type']).toContain('application/pdf')
  })

  test('el colega que imparte la materia por horario también puede verla', async ({ page }) => {
    await login(page, USERS.colega)
    await page.goto('/tareas')
    await expect(page.getByText('E2E Tarea con guía').first()).toBeVisible()
    await page.goto(`/docente/tareas/${tarea.id}`)
    await expect(page.getByRole('heading', { name: 'E2E Tarea con guía' })).toBeVisible()
    expect((await page.request.get(`${API}/api${archivoUrl}`)).status()).toBe(200)
  })

  test('un docente ajeno recibe 403 y la interfaz lo muestra sin romperse', async ({ page }) => {
    await login(page, USERS.ajeno)
    await page.goto('/tareas')
    await expect(page.getByText('E2E Tarea con guía')).toHaveCount(0)
    await page.goto(`/docente/tareas/${tarea.id}`)
    await expect(page.getByRole('alert')).toBeVisible()
    expect((await page.request.get(`${API}/api${archivoUrl}`)).status()).toBe(403)
  })
})

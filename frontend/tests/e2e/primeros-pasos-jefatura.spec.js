import { test, expect } from '@playwright/test'
import { mockApi } from './fixtures'
import { mockJefatura } from './jefatura-fixture'

const carreraVacia = (r) => ({
  ...r,
  ofertas: [], grupos: [], docentes: [], reticula: [], riesgos: [], pendientes: [],
  indicadores: { listasPendientes: 0, calificacionesPendientes: 0, entregasPendientes: 0, alumnosRiesgo: 0 },
  catalogo: { ofertas: [], docentes: [], grupos: [] },
})

test.beforeEach(async ({ page }) => {
  await mockApi(page, 'JEFE_CARRERA')
})

test('jefatura nueva: bienvenida una vez y sólo "Empieza por aquí" en Inicio', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await mockJefatura(page, { ajustarResumen: carreraVacia, ajustarReuniones: () => [] })
  await page.goto('/dashboard')

  const bienvenida = page.getByRole('dialog', { name: 'Cómo funciona SICAT' })
  await expect(bienvenida).toContainText('Bienvenido a SICAT')
  await bienvenida.getByRole('button', { name: 'Siguiente' }).click()
  await expect(bienvenida).toContainText('Primero, prepara tu carrera')
  await bienvenida.getByRole('button', { name: 'Siguiente' }).click()
  await bienvenida.getByRole('button', { name: 'Siguiente' }).click()
  await bienvenida.getByRole('button', { name: 'Empezar' }).click()
  await expect(bienvenida).toBeHidden()

  const guia = page.getByRole('region', { name: 'Empieza por aquí' })
  await expect(guia).toContainText('0 de 4 pasos listos')
  await expect(guia.locator('[aria-current="step"]')).toContainText('Revisa la retícula de tu carrera')
  // Nada de "todo al día" con la carrera vacía.
  await expect(page.getByText('Listas al día')).toHaveCount(0)
  await expect(page.getByText('Oferta completa')).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole('region', { name: 'Empieza por aquí' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Cómo funciona SICAT' })).toHaveCount(0)

  await page.getByRole('link', { name: 'Agregar materia' }).click()
  await expect(page).toHaveURL(/\/jefe-carrera\/materias\?/)
  await expect(page).not.toHaveURL(/nueva=1/)
  await expect(page.getByRole('dialog', { name: 'Agregar materia' })).toBeVisible()
})

test('carrera a medias: la guía señala la oferta y abre el formulario de reunión', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await mockJefatura(page, { ajustarReuniones: () => [] })
  await page.goto('/dashboard')

  await expect(page.getByRole('dialog', { name: 'Cómo funciona SICAT' })).toHaveCount(0)
  const guia = page.getByRole('region', { name: 'Termina de preparar tu carrera' })
  await expect(guia).toContainText('1 de 4 pasos listos')
  await expect(guia.locator('[aria-current="step"]')).toContainText('sin docente o sin horario')
  // El resto de Inicio sigue ahí.
  await expect(page.getByRole('heading', { name: 'Clases de hoy' })).toBeVisible()

  await guia.getByRole('link', { name: 'Programar reunión' }).click()
  await expect(page).toHaveURL(/\/jefe-carrera\/reuniones/)
  await expect(page.getByRole('dialog', { name: 'Programar reunión' })).toBeVisible()
})

test('carrera en marcha: sin bienvenida ni guía', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.addInitScript(() => localStorage.setItem('sicat.jefatura.revision.1.1', JSON.stringify({ oferta: true, docentes: true })))
  await mockJefatura(page)
  await page.goto('/dashboard')

  await expect(page.getByRole('heading', { name: 'Clases de hoy' })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('#primeros-pasos')).toHaveCount(0)
  await expect(page.getByText('Tu carrera está lista')).toHaveCount(0)
})

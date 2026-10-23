import { test, expect } from '@playwright/test'
import { mockApi } from './fixtures'

const panel = (configuracion, materias = []) => ({
  clasesHoy: [], claseActual: null, proximaClase: null, proximasSuspensiones: [],
  resumen: { materias: materias.length, clasesHoy: 0, listasPendientes: 0 },
  pendientes: { entregasSinCalificar: 0, alumnosEnRiesgo: 0, solicitudes: 0 },
  materias,
  configuracion,
})

test('el docente nuevo ve la bienvenida una vez y sabe por dónde empezar', async ({ page }) => {
  await mockApi(page, 'DOCENTE')
  await page.route('**/api/dashboard/docente', (route) => route.fulfill({ json: panel({ grupos: [], clasesProgramadas: 0 }) }))
  await page.route('**/api/grupos/mis-grupos', (route) => route.fulfill({ json: [] }))
  await page.route('**/api/grupos/catalogo**', (route) => route.fulfill({ json: [] }))

  await page.goto('/dashboard')
  const bienvenida = page.getByRole('dialog', { name: 'Cómo funciona SICAT' })
  await expect(bienvenida).toContainText('Bienvenido a SICAT')
  await bienvenida.getByRole('button', { name: 'Siguiente' }).click()
  await expect(bienvenida).toContainText('Primero, prepara tu curso')
  await bienvenida.getByRole('button', { name: 'Siguiente' }).click()
  await bienvenida.getByRole('button', { name: 'Siguiente' }).click()
  await bienvenida.getByRole('button', { name: 'Empezar' }).click()
  await expect(bienvenida).toBeHidden()

  // Inicio vacío: sólo la guía, sin tarjetas de "no tienes nada".
  const guia = page.getByRole('region', { name: 'Empieza por aquí' })
  await expect(guia).toContainText('0 de 4 pasos listos')
  await expect(page.getByText('Todavía no impartes materias')).toHaveCount(0)
  await expect(guia.locator('[aria-current="step"]')).toContainText('Agrega tu grupo')

  await page.reload()
  await expect(page.getByRole('region', { name: 'Empieza por aquí' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Cómo funciona SICAT' })).toHaveCount(0)

  await page.getByRole('link', { name: 'Agregar grupo' }).click()
  await expect(page).toHaveURL(/\/docente\/grupos$/)
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('con el grupo agregado, el siguiente paso abre la importación de la lista', async ({ page }) => {
  await mockApi(page, 'DOCENTE')
  await page.addInitScript(() => localStorage.setItem('sicat.docente.bienvenida.2', 'vista'))
  const grupo = { id: 7, nombre: '8A', semestre: 8, carrera: { nombre: 'Sistemas' }, materias: [], horarios: [], docentes: [{ id: 2 }], _count: { alumnos: 0, materias: 0 } }
  await page.route('**/api/dashboard/docente', (route) => route.fulfill({ json: panel({ grupos: [{ id: 7, nombre: '8A', alumnos: 0 }], clasesProgramadas: 0 }) }))
  await page.route('**/api/grupos/mis-grupos', (route) => route.fulfill({ json: [grupo] }))
  await page.route('**/api/grupos/mis-grupos/7/alumnos-disponibles**', (route) => route.fulfill({ json: [] }))

  await page.goto('/dashboard')
  await expect(page.getByRole('dialog', { name: 'Cómo funciona SICAT' })).toHaveCount(0)
  const guia = page.getByRole('region', { name: 'Termina de preparar tu curso' })
  await expect(guia).toContainText('1 de 4 pasos listos')
  await expect(guia.locator('[aria-current="step"]')).toContainText('Sin alumnos: 8A')

  await guia.getByRole('link', { name: 'Cargar lista' }).click()
  await expect(page).toHaveURL(/\/docente\/grupos$/)
  const modal = page.getByRole('dialog', { name: 'Agregar alumnos a 8A' })
  await expect(modal.getByRole('button', { name: 'Importar', exact: true })).toBeVisible()
})

test('al docente que ya trabaja no se le muestra ni la bienvenida ni la guía', async ({ page }) => {
  await mockApi(page, 'DOCENTE')
  const redes = { id: 1, nombre: 'Redes', clave: 'RED', grupo: { id: 7, nombre: '8A' }, alumnos: 30, unidadActiva: null, porcentajeAsistencia: 91, entregasSinCalificar: 0, alumnosEnRiesgo: 0 }
  await page.route('**/api/dashboard/docente', (route) => route.fulfill({ json: panel({ grupos: [{ id: 7, nombre: '8A', alumnos: 30 }], clasesProgramadas: 3 }, [redes]) }))

  await page.goto('/dashboard')
  await expect(page.getByRole('link', { name: /Redes · 8A/ })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('#primeros-pasos')).toHaveCount(0)
  await expect(page.getByText('Tu curso está listo')).toHaveCount(0)
})

import { test, expect } from '@playwright/test'
import { USERS, api, login, materiaE2E } from './helpers.js'

test.describe.configure({ mode: 'serial' })

// Los criterios quedan en el grupo del fixture: se quitan al final para que
// las demás pruebas (p. ej. publicar una tarea sin tipo) no dependan de éstas.
test.afterAll(async ({ browser }) => {
  const page = await browser.newPage()
  await login(page, USERS.docente)
  const materia = await materiaE2E(page)
  const res = await api(page).delete(`/calificaciones/criterios?materiaId=${materia.id}&grupoId=${materia.grupos[0].id}`)
  expect(res.ok()).toBeTruthy()
  expect((await res.json()).base.origen).toBe('PREDETERMINADA')
  await page.close()
})

test('el docente arma los criterios del grupo y el alumno los ve en su calificación', async ({ page, browser }) => {
  await login(page, USERS.docente)
  const materia = await materiaE2E(page)
  const grupo = materia.grupos[0]
  await page.goto(`/calificaciones?materia=${materia.id}&grupo=${grupo.id}`)
  await expect(page.getByText(/Predeterminada: Tareas 80 % · Asistencia 20 %/)).toBeVisible()

  await page.getByRole('button', { name: 'Editar criterios' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Criterios de evaluación' })
  await dialogo.getByLabel('Porcentaje de Tareas').fill('60')
  await dialogo.getByRole('button', { name: 'Agregar criterio' }).click()
  await page.getByRole('menuitem', { name: 'Examen' }).click()
  await expect(dialogo.getByLabel('Porcentaje de Examen')).toHaveValue('20')
  await expect(dialogo.getByText('Suma 100 %')).toBeVisible()
  await dialogo.getByRole('button', { name: 'Guardar criterios' }).click()
  await expect(dialogo.getByRole('status')).toContainText(`Criterios de ${grupo.nombre} guardados`)
  await page.keyboard.press('Escape')

  await page.reload()
  await expect(page.getByText('Tareas 60 % · Examen 20 % · Asistencia 20 %')).toBeVisible()

  const alumno = await browser.newPage()
  await login(alumno, USERS.alumno)
  const res = await api(alumno).get('/calificaciones/alumno')
  expect(res.ok()).toBeTruthy()
  const reporte = (await res.json()).reportes.find((r) => r.materia?.clave === 'E2E-1')
  expect(reporte?.criterios?.origen).toBe('GRUPO')
  expect(reporte.criterios.criterios.map((c) => [c.nombre, c.peso])).toEqual([['Tareas', 60], ['Examen', 20], ['Asistencia', 20]])
  await alumno.close()
})

test('un examen en clase se califica en lista y mueve el semáforo de la unidad', async ({ page }) => {
  await login(page, USERS.docente)
  const materia = await materiaE2E(page)
  const grupo = materia.grupos[0]
  const unidad = materia.unidades[0]
  const criterios = await (await api(page).get(`/calificaciones/criterios?materiaId=${materia.id}&grupoId=${grupo.id}`)).json()
  const examen = criterios.base.criterios.find((c) => c.tipo === 'EXAMEN')
  expect(examen, 'el examen viene de la prueba anterior').toBeTruthy()

  // Sin tipo no se publica: no contaría en la calificación.
  const sinTipo = await api(page).post('/tareas', { multipart: {
    materiaId: String(materia.id), grupoId: String(grupo.id), unidadId: String(unidad.id),
    titulo: 'Examen sin tipo', instrucciones: 'Temas 1.1 a 1.3', tipoEntrega: 'PRESENCIAL',
    tieneFechaLimite: 'false', estado: 'PUBLICADA',
  } })
  expect(sinTipo.status()).toBe(400)

  const creada = await api(page).post('/tareas', { multipart: {
    materiaId: String(materia.id), grupoId: String(grupo.id), unidadId: String(unidad.id),
    titulo: 'Examen parcial E2E', instrucciones: 'Temas 1.1 a 1.3', tipoEntrega: 'PRESENCIAL',
    tieneFechaLimite: 'false', estado: 'PUBLICADA', categoriaId: String(examen.id),
  } })
  expect(creada.ok()).toBeTruthy()
  const tarea = await creada.json()

  const alumnos = (await (await api(page).get(`/tareas/${tarea.id}/entregas`)).json()).entregas.map((e) => e.alumno)
  const captura = await api(page).put(`/tareas/${tarea.id}/calificaciones`, {
    data: { calificaciones: [{ alumnoId: alumnos[0].id, calificacion: 65 }] },
  })
  expect(captura.ok()).toBeTruthy()
  expect((await captura.json()).actualizadas).toBe(1)

  const desempenoDe = async () => {
    const vista = await (await api(page).get(`/calificaciones/desempeno?materiaId=${materia.id}&grupoId=${grupo.id}&unidadId=${unidad.id}`)).json()
    return vista.alumnos.find((item) => item.alumno.id === alumnos[0].id)
  }
  const antes = await desempenoDe()
  expect(antes.criterios.find((c) => c.clave === `c${examen.id}`)).toMatchObject({ valor: 65, calificadas: 1, total: 1 })
  expect(typeof antes.calificacion).toBe('number')

  // "No presentó" cuenta como 0 y baja la calificación de la unidad.
  await api(page).put(`/tareas/${tarea.id}/calificaciones`, {
    data: { calificaciones: [{ alumnoId: alumnos[0].id, noPresento: true }] },
  })
  const despues = await desempenoDe()
  expect(despues.criterios.find((c) => c.clave === `c${examen.id}`)).toMatchObject({ valor: 0, calificadas: 1 })
  expect(despues.calificacion).toBeLessThan(antes.calificacion)
  expect(despues.desempeno).toBe('REPROBADO')
})

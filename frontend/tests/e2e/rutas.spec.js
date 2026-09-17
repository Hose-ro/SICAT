import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { writeFile } from 'node:fs/promises'
import { mockApi } from './fixtures'

const rutas = {
 ADMIN: ['/dashboard','/materias','/materias/1','/asistencias','/tareas','/calificaciones','/usuarios','/carreras','/admin/horarios','/admin/horarios-importados','/admin/academias','/admin/academias/1','/admin/aulas','/admin/grupos','/admin/grupos/1','/notificaciones'],
 DOCENTE: ['/dashboard','/asistencias','/tareas','/calificaciones','/docente/grupos','/docente/horario','/docente/solicitudes','/docente/horario/editar','/docente/tareas/crear'],
 ALUMNO: ['/materias','/asistencias','/tareas','/calificaciones','/alumno/horario','/alumno/materias/1','/notificaciones'],
 JEFE_CARRERA: ['/dashboard','/jefe-carrera/docentes','/jefe-carrera/clases','/jefe-carrera/seguimiento','/jefe-carrera/alertas','/jefe-carrera/reportes'],
}
const settle=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
const report=[]
test.afterAll(async()=>{ await writeFile('audit/rutas-axe.json',JSON.stringify(report,null,2)) })

for (const [rol, paths] of Object.entries(rutas)) for (const path of paths) for (const [theme,width] of [['light',1280],['dark',390]]) {
 test(`${rol} ${path} ${theme}@${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ colorScheme: theme }); await mockApi(page, rol)
  const errors=[]; page.on('pageerror', e => errors.push(String(e)))
  await page.goto(path); await expect(page).toHaveURL(new RegExp(path.replace(/\//g,'\\/')+'$'))
  await expect(page.getByRole('status',{name:/cargando/i})).toHaveCount(0); await page.locator('main').waitFor(); await page.waitForTimeout(300); await settle(page)
  const r = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()
  const violations = r.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ html: n.html.slice(0,200), summary: n.failureSummary })) }))
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  const h1 = await page.locator('main h1').count()
  report.push({ rol, path, theme, width, violations, overflow, h1, errors })
  expect(errors).toEqual([]); expect(overflow, 'sin scroll horizontal').toBe(false); expect(h1, 'un h1 en main').toBe(1); expect(violations).toEqual([])
 })
}

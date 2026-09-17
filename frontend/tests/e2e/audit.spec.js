import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { writeFile, readFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { mockApi } from './fixtures'
// Even at 0.01ms, `transition-property: all` leaves in-flight values for one frame.
const settle=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
async function axe(page){
 await settle(page)
 const r=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()
 expect(r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({html:n.html,summary:n.failureSummary}))}))).toEqual([])
}
for(const theme of ['light','dark'])for(const width of [390,1440])test(`login ${theme} ${width}`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.emulateMedia({colorScheme:theme});await mockApi(page,null)
 await page.goto('/login');await expect(page.getByRole('button',{name:'Iniciar sesión',exact:true})).toBeVisible();await axe(page)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.screenshot({path:`audit/login-${theme}-${width}.png`,fullPage:true})
 await page.getByLabel('Usuario',{exact:true}).fill('225Q0103');await page.getByLabel('Contraseña',{exact:true}).fill('Prueba123!')
 await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await expect(page).toHaveURL(/\/materias$/)
})
test('modal: foco, Escape, retorno y confirmación anidada',async({page})=>{
 await mockApi(page);await page.goto('/tests/fixture.html');const trigger=page.getByRole('button',{name:'Abrir formulario'})
 await trigger.click();const modal=page.getByRole('dialog',{name:'Formulario de prueba'});await expect(modal).toBeVisible()
 for(let i=0;i<8;i++){await page.keyboard.press('Tab');await expect.poll(()=>modal.evaluate(el=>el.contains(document.activeElement))).toBe(true)}
 await page.getByRole('button',{name:'Cerrar clase anidada'}).click();const dialog=page.getByRole('dialog',{name:'Finalizar clase'})
 await expect(dialog.getByRole('button',{name:'Cancelar'})).toBeFocused();await page.keyboard.press('Escape');await expect(dialog).toBeHidden();await expect(modal).toBeVisible()
 await expect(page.getByLabel('Acciones realizadas')).toHaveText('0');await page.keyboard.press('Escape');await expect(modal).toBeHidden();await expect(trigger).toBeFocused()
})
test('contraste renderizado y áreas táctiles',async({page})=>{
 await mockApi(page);await page.setViewportSize({width:390,height:844});await page.goto('/tests/fixture.html');const measurements=[]
 for(const theme of ['light','dark']){
  if(theme==='dark'){await page.getByRole('button',{name:'Cambiar tema'}).click();await settle(page)}
  const values=await page.locator('[data-sample]').evaluateAll(elements=>{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d',{willReadFrequently:true})
   const rgba=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return Array.from(ctx.getImageData(0,0,1,1).data).map((n,i)=>i===3?n/255:n)}
   const over=(a,b)=>[0,1,2].map(i=>a[i]*a[3]+b[i]*(1-a[3])).concat(1)
   const bg=el=>el?over(rgba(getComputedStyle(el).backgroundColor),bg(el.parentElement)):[255,255,255,1]
   const lum=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0)
   return elements.map(el=>{const b=bg(el),f=over(rgba(getComputedStyle(el).color),b),l=[lum(f),lum(b)].sort((a,b)=>b-a);return{sample:el.dataset.sample,foreground:f.slice(0,3),background:b.slice(0,3),ratio:(l[0]+.05)/(l[1]+.05)}})
  });measurements.push({theme,values});expect(values.filter(v=>v.ratio<4.5)).toEqual([])
 }
 const box=await page.getByRole('button',{name:'Icono de muestra'}).boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44)
 await writeFile('audit/contrast.json',JSON.stringify(measurements,null,2))
})
test('horarios: etiquetas únicas, días independientes y guardado',async({page})=>{
 const requests=await mockApi(page,'ADMIN');await page.goto('/tests/fixture.html')
 await page.getByLabel('Grupo',{exact:true}).selectOption('1');await page.getByLabel('Materia',{exact:true}).selectOption('1');await page.getByRole('button',{name:'Martes',exact:true}).click()
 await page.getByLabel('Hora de inicio',{exact:true}).nth(1).fill('10:00');await page.getByLabel('Hora de fin',{exact:true}).nth(1).fill('11:00')
 const ids=await page.locator('input[id],select[id],textarea[id]').evaluateAll(es=>es.map(e=>e.id));expect(new Set(ids).size).toBe(ids.length)
 await expect(page.getByRole('button',{name:'Crear clase',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Crear clase',exact:true}).click()
 await expect.poll(()=>requests.filter(r=>r.method==='POST'&&r.path==='/horarios').length).toBe(1)
 expect(requests.find(r=>r.method==='POST'&&r.path==='/horarios').data).toMatchObject({materiaId:1,docenteId:2,grupoId:1,bloques:[{dia:'Lunes',horaInicio:'08:00',horaFin:'09:00'},{dia:'Martes',horaInicio:'10:00',horaFin:'11:00'}]});await axe(page)
})
test('finalizar clase: cancelar o confirmar una vez',async({page})=>{
 const requests=await mockApi(page,'DOCENTE');await page.goto('/asistencias');const trigger=page.getByRole('button',{name:'Finalizar clase',exact:true}).first();await trigger.click()
 const dialog=page.getByRole('dialog',{name:'Finalizar clase'});await expect(dialog).toContainText('sin captura quedarán como falta')
 await dialog.getByRole('button',{name:'Cancelar'}).click();expect(requests.filter(r=>r.path==='/clases/10/finalizar')).toHaveLength(0)
 await trigger.click();await dialog.getByRole('button',{name:'Finalizar clase',exact:true}).dblclick();await expect.poll(()=>requests.filter(r=>r.path==='/clases/10/finalizar').length).toBe(1)
 await expect(page.getByText('La clase se cerró. Puedes descargar el reporte del día.').first()).toBeVisible();await axe(page)
})
test('exportaciones: el reporte filtrado descarga Excel y PDF del backend',async({page})=>{
 const requests=await mockApi(page,'DOCENTE');await page.goto('/asistencias');await page.getByRole('combobox',{name:'Materia',exact:true}).last().selectOption('1')
 const excel=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar Excel',exact:true}).last().click();expect((await excel).suggestedFilename()).toBe('asistencias-1.xlsx')
 const pdf=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar PDF',exact:true}).last().click();expect((await pdf).suggestedFilename()).toBe('asistencias-1.pdf')
 expect(requests.filter(r=>r.path==='/asistencias/exportar/1').length).toBe(2)
})
test('importación: leer un Excel real carga el módulo xlsx bajo demanda',async({page})=>{
 await mockApi(page,'ADMIN');const scripts=[];page.on('response',r=>{if(r.request().resourceType()==='script')scripts.push(new URL(r.url()).pathname)})
 await page.goto('/materias/1');await page.getByRole('button',{name:/Agregar alumnos/}).click();const dialog=page.getByRole('dialog',{name:'Agregar alumnos a la materia'});await expect(dialog).toBeVisible()
 await dialog.getByRole('button',{name:'Importar lista (Excel)'}).click();expect(scripts.some(s=>/xlsx/.test(s))).toBe(false)
 await dialog.getByLabel('Archivo de alumnos (Excel o CSV)').setInputFiles('../alumnos-ejemplo.xlsx')
 await expect(dialog.getByText(/Revisa la lista antes de importar \(\d+ alumnos?\)/)).toBeVisible();expect(scripts.some(s=>/xlsx/.test(s))).toBe(true);await axe(page)
})
test('notificaciones: campana accesible, navegación y sondeo único',async({page})=>{
 await page.clock.install();const requests=await mockApi(page);await page.goto('/materias');await expect(page.getByRole('button',{name:'Notificaciones, 1 sin leer'})).toBeVisible()
 const conteo=()=>requests.filter(r=>r.path==='/notificaciones/no-leidas').length;const inicial=conteo();expect(inicial).toBe(1)
 await page.clock.runFor(61000);await expect.poll(()=>conteo()-inicial).toBe(2)
 const bell=page.getByRole('button',{name:'Notificaciones, 1 sin leer'});await bell.focus();await page.keyboard.press('Enter')
 const popup=page.getByRole('dialog',{name:'Notificaciones'});await expect(popup).toBeVisible();await expect(popup.getByRole('link',{name:'Ver historial'})).toBeVisible()
 await expect(popup.getByRole('listitem')).toHaveCount(3);await expect(popup.getByText('Sin leer.')).toHaveCount(1);await axe(page)
 await page.keyboard.press('Escape');await expect(popup).toBeHidden();await expect(bell).toBeFocused()
 await bell.click();await popup.getByRole('button',{name:/Tu horario fue aprobado/}).click()
 await expect(page).toHaveURL(/\/alumno\/horario$/);await expect.poll(()=>requests.filter(r=>r.method==='PATCH'&&r.path==='/notificaciones/1/leer').length).toBe(1)
 await expect(page.getByRole('button',{name:'Notificaciones',exact:true})).toBeVisible()
})
test('notificaciones: historial con filtro, marcar y eliminar sin controles anidados',async({page})=>{
 const requests=await mockApi(page);await page.goto('/notificaciones');const lista=page.getByRole('list',{name:'Notificaciones'})
 await expect(lista.getByRole('listitem')).toHaveCount(3);await axe(page)
 const noLeidas=page.getByRole('button',{name:/No leídas/});await expect(noLeidas).toHaveAttribute('aria-pressed','false');await noLeidas.click();await expect(noLeidas).toHaveAttribute('aria-pressed','true')
 await expect(lista.getByRole('listitem')).toHaveCount(1);await lista.getByRole('button',{name:'Marcar leída: Tu horario fue aprobado'}).click()
 await expect.poll(()=>requests.filter(r=>r.method==='PATCH'&&r.path==='/notificaciones/1/leer').length).toBe(1)
 await page.getByRole('button',{name:'Todas',exact:true}).click();await lista.getByRole('button',{name:'Eliminar: Solicitud de inscripción rechazada'}).click()
 await expect.poll(()=>requests.filter(r=>r.method==='DELETE'&&r.path==='/notificaciones/3').length).toBe(1);await expect(page.getByRole('navigation',{name:/Paginación/})).toHaveCount(0)
})
test('pasar lista conserva el contrato y las faltas implícitas',async({page})=>{
 const requests=await mockApi(page,'DOCENTE');await page.goto('/docente/pasar-lista/10');await expect(page.getByText('Ana Prueba')).toBeVisible()
 await page.getByRole('button',{name:'Asistencia',exact:true}).first().click();await page.getByRole('button',{name:/Guardar asistencia/}).click()
 await expect.poll(()=>requests.filter(r=>r.path==='/asistencias/pasar-lista').length).toBe(1)
 expect(requests.find(r=>r.path==='/asistencias/pasar-lista').data).toEqual({claseSesionId:10,registros:[{alumnoId:1,estado:'ASISTENCIA'},{alumnoId:3,estado:'FALTA'}]});await axe(page)
})
test('alumno: menú móvil, horario, detalle y PDF',async({page})=>{
 await mockApi(page);await page.setViewportSize({width:390,height:844});await page.goto('/alumno/horario');await page.getByRole('button',{name:'Abrir menú'}).click();await expect(page.getByRole('dialog',{name:'Menú principal'})).toBeVisible()
 await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Abrir menú'})).toBeFocused();await page.getByRole('button',{name:/Matemáticas/}).first().click()
 await expect(page.getByRole('dialog',{name:'Matemáticas'})).toBeVisible();await axe(page);await page.keyboard.press('Escape')
 const download=page.waitForEvent('download');await page.getByRole('button',{name:/PDF/}).click();expect((await download).suggestedFilename()).toMatch(/\.pdf$/)
 await page.screenshot({path:'audit/alumno-mobile.png',fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})
test('roles: URL directa, salto al contenido y protección de rutas',async({page})=>{
 await mockApi(page);await page.goto('/usuarios');await expect(page).toHaveURL(/\/materias$/);await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Saltar al contenido'})).toBeFocused()
 await page.keyboard.press('Enter');await expect(page.locator('#contenido-principal')).toBeFocused();await page.getByRole('link',{name:'Horario',exact:true}).click();await expect(page).toHaveURL(/\/alumno\/horario$/)
})
for(const [rol,path,ready] of [['ALUMNO','/alumno/horario',p=>p.getByRole('button',{name:/Matemáticas/}).first()],['DOCENTE','/asistencias',p=>p.getByRole('button',{name:'Finalizar clase',exact:true}).first()],['ADMIN','/dashboard',p=>p.getByRole('heading',{level:1})]])
test(`producción: carga inicial completa de ${rol} ${path}`,async({page})=>{
 await mockApi(page,rol);const scripts=new Set();page.on('response',r=>{if(r.request().resourceType()==='script')scripts.add(new URL(r.url()).pathname)})
 await page.goto('http://127.0.0.1:4176'+path);await expect(ready(page)).toBeVisible()
 const files=[];for(const name of scripts){const bytes=await readFile('dist'+name);files.push({name,bytes:bytes.length,gzip:gzipSync(bytes).length})}
 if(rol!=='ADMIN')expect(files.filter(f=>/\/(Usuarios|HorariosPage|AulasPage|GrupoDetalle|AcademiaDetalle|Dashboard)-/.test(f.name))).toEqual([])
 await writeFile(`audit/initial-${rol.toLowerCase()}.json`,JSON.stringify({rol,path,files,bytes:files.reduce((s,f)=>s+f.bytes,0),gzip:files.reduce((s,f)=>s+f.gzip,0)},null,2))
})
test('fallo de módulo ofrece recuperación',async({page})=>{
 await mockApi(page);await page.route('**/assets/MiHorarioAlumno-*.js',r=>r.abort('failed'));await page.goto('http://127.0.0.1:4176/alumno/horario')
 await expect(page.getByRole('heading',{name:'No se pudo abrir esta vista'})).toBeVisible();await expect(page.getByRole('button',{name:'Volver a cargar'})).toBeVisible()
})

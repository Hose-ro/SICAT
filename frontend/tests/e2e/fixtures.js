export const docente={id:2,nombre:'Docente de prueba',rol:'DOCENTE',activo:true}
export const materia={id:1,nombre:'Matemáticas',clave:'MAT-1',semestre:1,numUnidades:3,unidades:[],_count:{inscripciones:2},carrera:{id:1,nombre:'Sistemas',codigo:'ISC'}}
export const grupo={id:1,nombre:'101A',semestre:1,periodo:'2026-B',carrera:materia.carrera}
export const notificaciones=[
 {id:1,tipo:'HORARIO_APROBADO',titulo:'Tu horario fue aprobado',mensaje:'Ya puedes consultarlo en Mi horario y descargarlo en PDF.',leida:false,referenciaTipo:'ImportacionHorario',referenciaId:7,createdAt:new Date(Date.now()-5*60000).toISOString()},
 {id:2,tipo:'TAREA_NUEVA',titulo:'Nueva tarea en Matemáticas: Práctica 3 de derivadas con aplicaciones',mensaje:'Fecha límite el viernes a las 23:59. Revisa la rúbrica antes de entregar para no perder puntos por formato.',leida:true,referenciaTipo:'Tarea',referenciaId:1,createdAt:new Date(Date.now()-3*3600000).toISOString()},
 {id:3,tipo:'SOLICITUD_RECHAZADA',titulo:'Solicitud de inscripción rechazada',mensaje:'El grupo ya está lleno.',leida:true,referenciaTipo:'Solicitud',referenciaId:9,createdAt:new Date(Date.now()-9*86400000).toISOString()},
]
export const horario={id:1,materiaId:1,docenteId:2,grupoId:1,materia,docente,grupo,aula:{id:1,nombre:'Aula 1'},dias:'Lunes,Martes',horaInicio:'08:00',horaFin:'09:00'}
export async function mockApi(page,role='ALUMNO') {
 const requests=[];let finalized=false
 await page.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url()); if (!url.pathname.startsWith('/api/')) return route.continue()
  const p=url.pathname.replace(/^\/api/,'');let payload
  try{payload=req.postDataJSON()}catch{payload=req.postData()}
  requests.push({path:p,method:req.method(),data:payload})
  const user=role?{id:role==='DOCENTE'?2:1,nombre:'Persona de prueba',rol:role,activo:true}:null
  let data=[],status=200
  if(p==='/auth/me'){data=user||{message:'No autenticado'};if(!user)status=401}
  else if(p==='/auth/login'){role='ALUMNO';data={user:{...docente,rol:'ALUMNO'}}}
  else if(p==='/notificaciones/no-leidas')data=1
  else if(p==='/notificaciones'){const items=url.searchParams.get('soloNoLeidas')==='true'?notificaciones.filter(n=>!n.leida):notificaciones;data={items,total:items.length}}
  else if(p.startsWith('/notificaciones/')&&(req.method()==='PATCH'||req.method()==='DELETE'))data={ok:true}
  else if(p==='/periodos/actual')data={fechaInicio:'2026-08-31',fechaFin:'2026-12-18',configurado:true}
  else if(p.includes('mis-horarios')||p==='/horarios/docente/2')data={alumno:user,docente,grupo,horarios:[horario],clases:[]}
  else if(p==='/horarios/validar-conflicto')data={ok:true,message:'Horario disponible',conflicts:[]}
  else if(p.startsWith('/horarios')&&req.method()==='POST')data={...horario}
  else if(p==='/materias'||p.includes('mis-materias')||p==='/materias/para-grupo/1')data=[materia]
  else if(p==='/carreras')data=[materia.carrera]
  else if(p==='/usuarios')data=[docente]
  else if(p==='/aulas')data=[{id:1,nombre:'Aula 1'}]
  else if(p==='/grupos/catalogo'||p==='/grupos')data=[grupo]
  else if(p==='/clases/docente/panel'){
   const clase={...horario,horarioId:1,estado:finalized?'FINALIZADA':'EN_CURSO',sesion:{id:10,activa:!finalized},unidadActiva:{id:1,nombre:'Unidad 1'}}
   data={clasesHoy:[clase],claseActual:clase}
  }else if(p==='/clases/10/finalizar'){finalized=true;data={ok:true}}
  else if(p.startsWith('/asistencias/exportar/')){return route.fulfill({status:200,contentType:url.searchParams.get('formato')==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',body:Buffer.from('PK')})}
  else if(p==='/asistencias/filtros-disponibles')data={materias:[materia],grupos:[grupo],unidades:[],fechasClase:[],mesesClase:[]}
  else if(p==='/asistencias/historial')data={items:[],estadisticas:null}
  else if(p==='/asistencias/sesion/10')data={sesion:{id:10,activa:true,materia,grupo,aula:horario.aula,fecha:'2026-09-10',horaInicio:'2026-09-10T08:00:00',unidad:{id:1,nombre:'Unidad 1'}},alumnos:[{alumnoId:1,nombre:'Ana Prueba',numeroControl:'225Q0103',estado:null},{alumnoId:3,nombre:'Luis Prueba',numeroControl:'225Q0104',estado:null}]}
  else if(p==='/asistencias/pasar-lista')data={asistencias:1,retardos:0,faltas:1,justificados:0}
  else if(p==='/asistencias/mis-asistencias/1')data=[{id:1,estado:'FALTA',unidad:1,claseSesion:{fecha:'2026-09-10',horaInicio:'08:00'},fecha:'2026-09-10'}]
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)})
 })
 return requests
}

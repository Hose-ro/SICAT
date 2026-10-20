// API simulada de jefatura: una carrera con grupos Escolarizado y Mixto,
// pendientes de registro, un conflicto de aula y una suspensión.
const pad = (n) => String(n).padStart(2, '0')
const clave = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const DIAS = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO']

export const carrera = { id: 1, nombre: 'Ingeniería en Sistemas Computacionales', codigo: 'ISC' }
const persona = (id, nombre, extra = {}) => ({ id, nombre, email: `${nombre.split(' ')[0].toLowerCase()}@sicat.test`, telefono: id % 3 ? '4421234567' : null, numeroControl: null, semestre: null, grupoId: null, ...extra })
export const docentes = [
  persona(37, 'Laura Méndez'), persona(38, 'Carlos Ruiz'), persona(39, 'Ana Torres'), persona(40, 'Sofía Herrera'),
  persona(41, 'Miguel Santos'), persona(42, 'Daniela Vega'), persona(43, 'Héctor Díaz'), persona(44, 'Patricia León'),
]
const g = (id, nombre, semestre, modalidad = 'ESCOLARIZADO', alumnosBase = 28) => ({ id, nombre, semestre, modalidad, periodo: '2026-B', carreraId: 1, alumnosBase })
export const grupos = [g(8, '1A', 1, 'ESCOLARIZADO', 32), g(9, '3A', 3, 'ESCOLARIZADO', 29), g(10, '5A', 5, 'ESCOLARIZADO', 27), g(11, '7A', 7, 'ESCOLARIZADO', 25), g(12, '9A', 9, 'ESCOLARIZADO', 22), g(13, '1M', 1, 'MIXTO', 18)]
const aulas = { a101: { id: 1, nombre: 'A-101' }, lab1: { id: 2, nombre: 'Lab 1' }, a203: { id: 3, nombre: 'A-203' }, lab3: { id: 4, nombre: 'Lab 3' }, lab4: { id: 5, nombre: 'Lab 4' }, a301: { id: 6, nombre: 'A-301' }, lab5: { id: 7, nombre: 'Lab 5' }, a102: { id: 8, nombre: 'A-102' } }
const ESC = 'LUNES,MARTES,MIERCOLES,JUEVES,VIERNES'
// [materiaId, nombre, clave, grupoId, docenteId, inicio, fin, aula, dias]
const bloques = [
  [411, 'Cálculo diferencial', 'ACF-0901', 8, 37, '07:00', '09:00', aulas.a101, ESC],
  [412, 'Fundamentos de programación', 'SCD-1008', 8, 38, '10:00', '12:00', aulas.lab1, ESC],
  [413, 'Matemáticas discretas', 'SCF-1014', 8, 39, '13:00', '15:00', aulas.a102, ESC],
  [414, 'Programación orientada a objetos', 'SCD-1020', 9, 38, '08:00', '10:00', aulas.lab1, ESC],
  [415, 'Cálculo vectorial', 'ACF-0904', 9, 37, '11:00', '13:00', aulas.a203, ESC],
  [416, 'Bases de datos', 'AEF-1031', 10, 40, '07:00', '09:00', aulas.lab3, ESC],
  [417, 'Sistemas operativos', 'AEC-1061', 10, 41, '10:00', '12:00', aulas.a301, ESC],
  [418, 'Redes de computadoras', 'SCD-1021', 11, 43, '08:00', '10:00', aulas.lab4, ESC],
  [419, 'Programación web', 'AEB-1055', 11, 42, '11:00', '13:00', aulas.lab1, ESC],
  [420, 'Inteligencia artificial', 'SCC-1012', 12, 44, '07:00', '09:00', aulas.lab5, ESC],
  [421, 'Taller de investigación II', 'ACA-0910', 12, 37, '13:00', '15:00', aulas.a102, ESC],
  [422, 'Cálculo diferencial', 'ACF-0901', 13, 37, '08:00', '12:00', aulas.a101, 'SABADO'],
  [423, 'Química', 'AEC-1058', 13, 41, '12:00', '14:00', aulas.a203, 'SABADO'],
]
const materiaInfo = new Map()
bloques.forEach(([id, nombre, cl, grupoId]) => {
  const semestre = grupos.find((x) => x.id === grupoId).semestre
  if (!materiaInfo.has(`${cl}`)) materiaInfo.set(`${cl}`, { id, nombre, clave: cl, semestre })
})
const horarios = bloques.map(([materiaId, nombre, cl, grupoId, docenteId, horaInicio, horaFin, aula, dias], i) => ({
  id: 100 + i, materiaId: cl === 'ACF-0901' ? 411 : materiaId, grupoId, docenteId, horaInicio, horaFin, dias, aula,
  materia: { id: cl === 'ACF-0901' ? 411 : materiaId, nombre, clave: cl }, docente: docentes.find((d) => d.id === docenteId), grupo: grupos.find((x) => x.id === grupoId),
}))
const unidades = (materiaId) => [1, 2, 3].map((orden) => ({
  id: materiaId * 10 + orden, nombre: `Unidad ${orden}`, orden,
  status: orden === 1 ? 'FINALIZADA' : orden === 2 ? 'ACTIVA' : 'PENDIENTE',
  fechaInicio: orden === 2 ? '2026-09-01T00:00:00.000Z' : null, fechaFin: orden === 2 ? (materiaId === 415 ? '2026-09-25T00:00:00.000Z' : '2026-10-20T00:00:00.000Z') : null,
}))
const resumenOferta = (materiaId, grupoId) => ({
  alumnos: grupos.find((x) => x.id === grupoId).alumnosBase + (materiaId === 419 ? 1 : 0),
  alumnosRiesgo: materiaId === 411 && grupoId === 8 ? 2 : materiaId === 414 ? 1 : 0,
  calificacionesPendientes: materiaId === 414 ? 12 : materiaId === 421 ? 3 : 0,
  entregasPendientes: materiaId === 412 ? 5 : 0, sinEntrega: materiaId === 412 ? 9 : 2,
})
export const ofertas = [...new Map(horarios.map((h) => [`${h.materiaId}:${h.grupoId}`, h])).values()].map((h) => ({
  id: `${h.materiaId}:${h.grupoId}`, materia: { ...materiaInfo.get(h.materia.clave), id: h.materiaId }, grupo: h.grupo,
  docentes: [h.docente], horarios: horarios.filter((x) => x.materiaId === h.materiaId && x.grupoId === h.grupoId), unidades: unidades(h.materiaId), resumen: resumenOferta(h.materiaId, h.grupoId),
}))
// Una oferta sin horario ni docente para la revisión de Materias.
ofertas.push({ id: '424:12', materia: { id: 424, nombre: 'Gestión de proyectos de software', clave: 'SCG-1009', semestre: 9 }, grupo: grupos[4], docentes: [], horarios: [], unidades: unidades(424), resumen: { alumnos: 0, alumnosRiesgo: 0, calificacionesPendientes: 0, entregasPendientes: 0, sinEntrega: 0 } })
// Taller de investigación II (9A) ya se cerró: la jefatura ve el resultado del concentrado.
ofertas.find((o) => o.id === '421:12').cierre = { cerradoEn: '2026-10-09T18:00:00.000Z', docente: 'Laura Méndez', total: 3, acreditados: 2, noAcreditados: 1, pendientes: 0, promedio: 84, alumnos: [{ id: 1200, estado: 'ACREDITADO', final: 88 }, { id: 1201, estado: 'ACREDITADO', final: 80 }, { id: 1202, estado: 'NO_ACREDITADO', final: null }] }

const hoy = clave(new Date())
function estadoPara(h, fecha) {
  const ahora = new Date()
  const [hi, mi] = h.horaInicio.split(':').map(Number)
  const [hf, mf] = h.horaFin.split(':').map(Number)
  const inicio = parse(fecha); inicio.setHours(hi, mi)
  const fin = parse(fecha); fin.setHours(hf, mf)
  if (h.id === 111 && fecha === hoy) return { estado: 'SUSPENDIDA', motivo: 'Junta de academia' }
  if (inicio > ahora) return { estado: 'PROGRAMADA' }
  if (fin > ahora) return { estado: 'REGISTRO_EN_CURSO' }
  if (h.id === 100 && fecha >= clave(new Date(Date.now() - 3 * 86400000))) return { estado: 'SIN_CAPTURA' }
  if (h.id === 103 && fecha >= clave(new Date(Date.now() - 2 * 86400000))) return { estado: 'CAPTURA_PARCIAL' }
  if (h.id === 108 && parse(fecha).getDay() === 3) return { estado: 'REGISTRO_TARDIO' }
  return { estado: 'LISTA_COMPLETA' }
}
export function clasesEntre(desde, hasta, { docenteId, grupoId } = {}) {
  const out = []
  for (let d = parse(desde); clave(d) <= hasta; d.setDate(d.getDate() + 1)) {
    const fecha = clave(d)
    if (fecha < '2026-08-29') continue
    for (const h of horarios) {
      if (!h.dias.split(',').includes(DIAS[d.getDay()])) continue
      if (docenteId && h.docenteId !== Number(docenteId)) continue
      if (grupoId && h.grupoId !== Number(grupoId)) continue
      const { estado, motivo } = estadoPara(h, fecha)
      const alumnos = h.grupo.alumnosBase
      const registros = estado === 'CAPTURA_PARCIAL' ? alumnos - 6 : ['LISTA_COMPLETA', 'REGISTRO_TARDIO'].includes(estado) ? alumnos : estado === 'REGISTRO_EN_CURSO' ? 10 : 0
      out.push({
        id: `${h.id}:${fecha}`, horarioId: h.id, fecha, horaInicio: h.horaInicio, horaFin: h.horaFin, grupo: h.grupo, docente: h.docente, materia: h.materia, aula: h.aula,
        estado, elegible: !['PROGRAMADA', 'REGISTRO_EN_CURSO', 'SUSPENDIDA'].includes(estado), calendarioConfigurado: true, alumnos, registros,
        sesionId: registros ? 5000 + h.id : null, capturadaEn: registros ? `${fecha}T${h.horaInicio}:05` : null,
        unidad: registros ? { id: h.materiaId * 10 + 2, nombre: 'Unidad 2', orden: 2 } : null, suspensionMotivo: motivo ?? null,
        // Lab 1: Programación web (7A, 11–13) cruza con Fundamentos (1A, 10–12).
        conflictos: (h.id === 101 || h.id === 108) ? ['Aula'] : [],
      })
    }
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.horaInicio.localeCompare(b.horaInicio))
}

// Igual que coberturaSemanal del backend: clases elegibles por lunes, docente y modalidad.
function coberturaDe(clases, inicio, fin) {
  const lunesDe = (c) => { const d = parse(c); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return clave(d) }
  const semanas = []
  for (let l = parse(lunesDe(inicio)); clave(l) <= fin; l.setDate(l.getDate() + 7)) semanas.push(clave(l))
  const filas = new Map()
  for (const c of clases) {
    const suspendida = c.estado === 'SUSPENDIDA'
    if (!c.elegible && !suspendida) continue
    const lunes = lunesDe(c.fecha)
    const k = `${lunes}|${c.docente.id}|${c.grupo.modalidad}`
    const f = filas.get(k) ?? { lunes, docenteId: c.docente.id, modalidad: c.grupo.modalidad, esperadas: 0, completas: 0, tardias: 0, parciales: 0, sinCaptura: 0, suspendidas: 0 }
    if (suspendida) f.suspendidas++
    else {
      f.esperadas++
      if (['LISTA_COMPLETA', 'REGISTRO_TARDIO'].includes(c.estado)) f.completas++
      if (c.estado === 'REGISTRO_TARDIO') f.tardias++
      if (c.estado === 'CAPTURA_PARCIAL') f.parciales++
      if (c.estado === 'SIN_CAPTURA') f.sinCaptura++
    }
    filas.set(k, f)
  }
  return { semanas, filas: [...filas.values()] }
}

const nombres = ['Ana Prueba', 'Bruno Castillo', 'Carla Núñez', 'Diego Ramos', 'Elena Ortiz']
function filasReporte(materiaId, grupoId) {
  const oferta = ofertas.find((o) => o.materia.id === materiaId && o.grupo.id === grupoId)
  const base = nombres.map((nombre, i) => ({ id: grupoId * 100 + i, nombre, numeroControl: `22${grupoId}0${i}`, sexo: i % 2 ? 'HOMBRE' : 'MUJER', email: i === 4 ? null : `alumno${i}@sicat.test`, telefono: i < 2 ? '4429876543' : null, semestre: grupos.find((x) => x.id === grupoId).semestre }))
  if (materiaId === 419) base.push({ id: 999, nombre: 'Zoe Incorporada', numeroControl: '21Q999', sexo: 'MUJER', email: 'zoe@sicat.test', telefono: null, semestre: 9 })
  return base.flatMap((alumno, i) => oferta.unidades.map((u) => {
    const riesgo = materiaId === 411 && grupoId === 8 && i < 2
    // Ana también debe tareas vencidas en Fundamentos: solo el motivo de entregas.
    const debeTareas = materiaId === 412 && grupoId === 8 && i === 0 && u.status === 'ACTIVA'
    const nota = u.status === 'PENDIENTE' ? null : riesgo ? 64 + i * 8 : 82 + i * 3 + u.orden
    const asistencia = { totalSesiones: 10, registradas: 10, asistencias: riesgo ? 6 : 9, faltas: riesgo ? 3 : 1, retardos: riesgo ? 1 : 0, justificadas: 0, sinRegistro: 0, porcentaje: riesgo ? 60 : 90 }
    return {
      alumno, materia: oferta.materia, grupo: oferta.grupo, unidad: u,
      calificacionFinal: u.status === 'FINALIZADA' && materiaId === 414 && i === 0 ? null : nota,
      calificacionManual: u.status === 'FINALIZADA' ? nota : null, calificacionCalculada: nota,
      motivos: riesgo && u.status === 'ACTIVA' ? (nota < 70 ? ['CALIFICACION_BAJA', 'ASISTENCIA'] : ['CALIFICACION_LIMITE', 'ASISTENCIA']) : debeTareas ? ['ENTREGAS'] : [],
      asistencia, tareas: { total: 4, entregadas: debeTareas ? 1 : 3, calificadas: 2, pendientesRevision: 1, sinEntregar: debeTareas ? 3 : 1, vencidas: u.status === 'PENDIENTE' ? 0 : 3, vencidasSinEntregar: debeTareas ? 2 : 0 },
      observacionManual: i === 1 && u.orden === 1 ? 'Entregó el proyecto fuera de tiempo; se acordó recuperación.' : null,
    }
  }))
}

export const riesgos = [0, 1].map((i) => ({
  id: 800 + i, nombre: nombres[i], numeroControl: `2280${i}`, sexo: i ? 'HOMBRE' : 'MUJER', email: null, telefono: null,
  causas: [
    { materia: { id: 411, nombre: 'Cálculo diferencial', clave: 'ACF-0901' }, grupo: grupos[0], unidad: unidades(411)[1], motivos: i ? ['CALIFICACION_LIMITE', 'ASISTENCIA'] : ['CALIFICACION_BAJA', 'ASISTENCIA'], calificacion: 64 + i * 8, asistencia: { porcentaje: 60 } },
    ...(i ? [] : [{ materia: { id: 412, nombre: 'Fundamentos de programación', clave: 'SCD-1008' }, grupo: grupos[0], unidad: unidades(412)[1], motivos: ['ENTREGAS'], calificacion: 85, asistencia: { porcentaje: 90 } }]),
  ],
}))

// Conteos del comparativo de Grupos: alumnos únicos con datos y por motivo.
function riesgoGrupo(id) {
  const evaluados = id === 13 ? 0 : 5 + (id === 11 ? 1 : 0)
  const motivos = id === 8 ? { reprobando: 1, calificacion: 2, asistencia: 2, entregas: 1 } : id === 9 ? { reprobando: 0, calificacion: 1, asistencia: 0, entregas: 0 } : { reprobando: 0, calificacion: 0, asistencia: 0, entregas: 0 }
  return { alumnosEvaluados: evaluados, riesgoPorMotivo: motivos }
}

function resumen() {
  const desde = '2026-08-29'
  const ayer = clave(new Date(Date.now() - 86400000))
  const clases = clasesEntre(desde, hoy)
  const pendientes = clases.filter((c) => c.elegible && ['SIN_CAPTURA', 'CAPTURA_PARCIAL'].includes(c.estado))
  return {
    periodo: '2026-B', generadoEn: new Date().toISOString(), intervalo: { desde, hasta: hoy },
    coberturaSemanal: coberturaDe(clases, desde, hoy),
    calendarios: [
      { modalidad: 'ESCOLARIZADO', configurado: true, inicio: '2026-08-31T06:00:00.000Z', fin: '2026-12-18T06:00:00.000Z' },
      { modalidad: 'MIXTO', configurado: true, inicio: '2026-08-29T06:00:00.000Z', fin: '2026-12-12T06:00:00.000Z' },
    ],
    ofertas, grupos: grupos.map((x) => ({ ...x, ofertas: ofertas.filter((o) => o.grupo.id === x.id).map((o) => o.id), alumnosRiesgo: x.id === 8 ? 2 : x.id === 9 ? 1 : 0, ...riesgoGrupo(x.id) })),
    docentes: docentes.map((d) => {
      const propias = clases.filter((c) => c.docente.id === d.id && c.elegible)
      const completas = propias.filter((c) => ['LISTA_COMPLETA', 'REGISTRO_TARDIO'].includes(c.estado))
      return {
        ...d, pertenencia: 'Imparte en esta carrera', ofertas: ofertas.filter((o) => o.docentes.some((x) => x.id === d.id)).map((o) => o.id),
        horasSemanales: horarios.filter((h) => h.docenteId === d.id).reduce((n, h) => n + (parseInt(h.horaFin) - parseInt(h.horaInicio)) * h.dias.split(',').length, 0),
        listasPendientes: propias.filter((c) => ['SIN_CAPTURA', 'CAPTURA_PARCIAL'].includes(c.estado)).length,
        clasesEsperadas: propias.length, listasCompletas: completas.length, registrosTardios: propias.filter((c) => c.estado === 'REGISTRO_TARDIO').length,
        ultimaCaptura: d.id === 44 ? null : `${ayer}T08:05:00`, intervalo: { desde, hasta: hoy },
        cobertura: propias.length ? Math.round((completas.length / propias.length) * 100) : null,
        calificacionesPendientes: d.id === 38 ? 12 : d.id === 37 ? 3 : 0, entregasPendientes: d.id === 38 ? 5 : 0, responsabilidadCompartida: false,
      }
    }),
    riesgos, pendientes,
    reticula: [
      ...[...materiaInfo.values()].map((m) => ({ ...m, numUnidades: 3, ofertas: ofertas.filter((o) => o.materia.id === m.id).map((o) => o.id) })),
      { id: 424, clave: 'SCG-1009', nombre: 'Gestión de proyectos de software', semestre: 9, numUnidades: 3, ofertas: ['424:12'] },
      { id: 430, clave: 'SCC-1005', nombre: 'Cultura empresarial', semestre: 5, numUnidades: 3, ofertas: [] },
      { id: 431, clave: 'ACA-0907', nombre: 'Taller de ética', semestre: 2, numUnidades: 3, ofertas: [] },
    ],
    indicadores: { listasPendientes: pendientes.length, calificacionesPendientes: 15, entregasPendientes: 5, alumnosRiesgo: 2 },
    // Catálogo activo (Docentes y Grupos): cada grupo con el periodo en que se consulta.
    catalogo: {
      ofertas: ofertas.map((o) => ({ id: o.id, materia: o.materia, grupo: { ...o.grupo, periodoConsulta: '2026-B' }, docentes: o.docentes, tieneHorario: o.horarios.length > 0 })),
      docentes: docentes.map((d) => ({ ...d, ofertas: ofertas.filter((o) => o.docentes.some((x) => x.id === d.id)).map((o) => o.id) })),
      grupos: grupos.map((x) => ({ ...x, periodoConsulta: '2026-B', ofertas: ofertas.filter((o) => o.grupo.id === x.id).map((o) => o.id) })),
    },
  }
}

// Reuniones de academia: una próxima y una pasada ya finalizada con su acta.
const diasDesdeHoy = (n) => clave(new Date(Date.now() + n * 86400000))
const convocado = (d, asistio = null) => ({ id: d.id, nombre: d.nombre, email: d.email, asistio })
export function reunionesIniciales() {
  return [
    {
      id: 1, carrera, creadaPor: { id: 1, nombre: 'Persona de prueba' }, titulo: 'Reunión ordinaria de academia', asunto: 'Revisión del avance programático del primer parcial.',
      tipo: 'ORDINARIA', numeroActa: null, fecha: diasDesdeHoy(6), horaInicio: '12:00', horaFin: '13:30', modalidad: 'PRESENCIAL', lugar: 'Sala de juntas, edificio K', enlace: null,
      estado: 'PROGRAMADA', observaciones: null, puntos: [{ id: 1, orden: 1, descripcion: 'Pase de lista' }, { id: 2, orden: 2, descripcion: 'Avance programático por materia' }], acuerdos: [],
      convocados: docentes.slice(0, 5).map((d) => convocado(d)), asistencia: { convocados: 5, asistieron: 0, registrada: false },
    },
    {
      id: 2, carrera, creadaPor: { id: 1, nombre: 'Persona de prueba' }, titulo: 'Reunión de inicio de semestre', asunto: null,
      tipo: 'ORDINARIA', numeroActa: 'ISC-01/2026', fecha: '2026-08-27', horaInicio: '10:00', horaFin: null, modalidad: 'VIRTUAL', lugar: null, enlace: 'https://meet.google.com/abc-defg-hij',
      estado: 'FINALIZADA', observaciones: 'Sin observaciones.', puntos: [{ id: 3, orden: 1, descripcion: 'Asignación de materias' }],
      acuerdos: [{ id: 1, orden: 1, descripcion: 'Entregar planeación didáctica', responsable: 'Todos los docentes', fechaLimite: '2026-09-04' }],
      convocados: docentes.slice(0, 3).map((d, i) => convocado(d, i !== 2)), asistencia: { convocados: 3, asistieron: 2, registrada: true },
    },
  ]
}

const informe = (q) => ({
  generadoEn: '2026-10-14T22:55:00.000Z', carrera, periodo: '2026-B',
  intervalo: { desde: q.desde, hasta: q.hasta }, limites: { inicio: '2026-08-24', fin: '2026-12-12' },
  totales: { clasesEsperadas: 106, listasCompletas: 100, listasPendientes: 6, cobertura: 94, alumnosRiesgo: 2, calificacionesPendientes: 15, seguimientos: 1 },
  docentes: [
    { id: 38, nombre: 'Carlos Ruiz', horasSemanales: 20, esperadas: 30, completas: 27, parciales: 3, sinCaptura: 0, tardias: 1, cobertura: 90 },
    { id: 37, nombre: 'Laura Méndez', horasSemanales: 34, esperadas: 40, completas: 37, parciales: 0, sinCaptura: 3, tardias: 0, cobertura: 93 },
  ],
  listasPendientes: [{ fecha: '2026-10-12', horaInicio: '07:00', horaFin: '09:00', materia: 'Cálculo diferencial', grupo: '1A', docente: 'Laura Méndez', estado: 'SIN_CAPTURA', registros: 0, alumnos: 32 }],
  avance: [{ materia: 'Cálculo vectorial', clave: 'ACF-0904', grupo: '3A', modalidad: 'ESCOLARIZADO', docentes: ['Laura Méndez'], unidades: [{ orden: 1, nombre: 'Unidad 1', status: 'FINALIZADA' }, { orden: 2, nombre: 'Unidad 2', status: 'ACTIVA' }], calificacionesPendientes: 0, entregasPendientes: 0 }],
  riesgos: [{ id: 800, nombre: 'Ana Prueba', numeroControl: '221100', sexo: 'MUJER', materias: ['Cálculo diferencial'], grupos: ['1A'], motivos: ['Calificación reprobatoria'] }],
  seguimientos: [{ fecha: '2026-10-13T16:00:00.000Z', caso: 'Seguimiento con Laura Méndez', detalle: '', tipo: 'SEGUIMIENTO_DOCENTE', estado: 'EN_SEGUIMIENTO', autor: 'Persona de prueba', texto: 'Acordamos capturar las listas pendientes el viernes.' }],
})

export async function mockJefatura(page, { seguimientos = [], ajustarResumen = (r) => r, ajustarReuniones = (r) => r, reportesFallan = false } = {}) {
  const requests = []
  const guardados = [...seguimientos]
  const reuniones = ajustarReuniones(reunionesIniciales())
  await page.route('**/api/jefe-carrera/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname.replace(/^\/api\/jefe-carrera/, '')
    const q = Object.fromEntries(url.searchParams)
    requests.push({ path: p, method: req.method(), query: q, body: req.postDataJSON?.() })
    let data = []
    let status = 200
    if (p === '/reuniones/docentes') data = docentes.map(({ id, nombre, email }) => ({ id, nombre, email }))
    else if (p === '/reuniones' && req.method() === 'GET') data = reuniones
    else if (p === '/reuniones' && req.method() === 'POST') {
      const body = req.postDataJSON()
      data = { ...body, id: 99, carrera, creadaPor: null, estado: 'PROGRAMADA', observaciones: null, puntos: body.puntos.map((descripcion, i) => ({ id: 900 + i, orden: i + 1, descripcion })), acuerdos: [], convocados: docentes.filter((d) => body.convocados.includes(d.id)).map((d) => convocado(d)), asistencia: { convocados: body.convocados.length, asistieron: 0, registrada: false } }
      reuniones.unshift(data)
    } else if (/^\/reuniones\/\d+\/acta$/.test(p)) {
      const body = req.postDataJSON()
      const r = reuniones.find((x) => x.id === Number(p.split('/')[2]))
      Object.assign(r, { estado: body.finalizar ? 'FINALIZADA' : r.estado, observaciones: body.observaciones, acuerdos: body.acuerdos.map((a, i) => ({ id: 500 + i, orden: i + 1, ...a })) })
      r.convocados = r.convocados.map((c) => ({ ...c, asistio: body.asistencia.find((a) => a.docenteId === c.id)?.asistio ?? c.asistio }))
      data = r
    } else if (p === '/contexto') data = { carreras: [carrera], periodoActual: '2026-B', periodos: ['2026-B', '2026-A'] }
    else if (p === '/supervision') data = ajustarResumen(resumen())
    else if (p === '/calendario') data = clasesEntre(q.desde, q.hasta, q)
    else if (reportesFallan && /^\/ofertas\//.test(p)) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Error interno al calcular el reporte' }) })
      return
    } else if (/^\/ofertas\/\d+\/grupos\/\d+$/.test(p)) {
      const [, m, gr] = p.match(/ofertas\/(\d+)\/grupos\/(\d+)/)
      const oferta = ofertas.find((o) => o.materia.id === Number(m) && o.grupo.id === Number(gr))
      data = { materia: oferta.materia, unidades: oferta.unidades.map(({ id, nombre, orden, status }) => ({ id, nombre, orden, status })), rows: filasReporte(Number(m), Number(gr)), periodo: '2026-B', grupo: oferta.grupo }
    } else if (/^\/grupos\/\d+\/expediente$/.test(p)) {
      const id = Number(p.split('/')[2])
      const grupo = grupos.find((x) => x.id === id)
      const propias = ofertas.filter((o) => o.grupo.id === id)
      data = { periodo: '2026-B', grupo, alumnos: nombres.map((nombre, i) => ({
        id: id * 100 + i, nombre, numeroControl: `22${id}0${i}`, sexo: i % 2 ? 'HOMBRE' : 'MUJER', email: i === 4 ? null : `alumno${i}@sicat.test`, telefono: i < 2 ? '4429876543' : null,
        semestre: grupo.semestre, grupoId: id, grupo: { id, nombre: grupo.nombre }, origen: 'BASE',
        inscripciones: propias.map((o, k) => ({ id: id * 1000 + i * 10 + k, materia: o.materia, grupo: { id, nombre: grupo.nombre } })),
      })).concat(id === 11 ? [{ id: 999, nombre: 'Zoe Incorporada', numeroControl: '21Q999', sexo: 'MUJER', email: 'zoe@sicat.test', telefono: null, semestre: 9, grupoId: 12, grupo: { id: 12, nombre: '9A' }, origen: 'INCORPORADO', inscripciones: [{ id: 77, materia: ofertas.find((o) => o.id === '419:11').materia, grupo: { id: 11, nombre: '7A' } }, { id: 78, materia: ofertas.find((o) => o.id === '420:12').materia, grupo: { id: 12, nombre: '9A' } }] }] : []) }
    } else if (p === '/alumnos/buscar') {
      data = [
        { id: 1201, nombre: 'Bruno Castillo', numeroControl: '22121', semestre: 9, grupoId: 12, grupo: { id: 12, nombre: '9A' }, email: null, telefono: null, inscripcionMateria: null },
        { id: 1202, nombre: 'Bruno Alcántara', numeroControl: '22122', semestre: 3, grupoId: 9, grupo: { id: 9, nombre: '3A' }, email: null, telefono: null, inscripcionMateria: { estado: 'PENDIENTE', grupoId: null } },
        { id: 1203, nombre: 'Bruna Estrada', numeroControl: '22123', semestre: 7, grupoId: 11, grupo: { id: 11, nombre: '7A' }, email: null, telefono: null, inscripcionMateria: { estado: 'ACEPTADA', grupoId: 11 } },
      ].filter((a) => a.nombre.toLowerCase().includes((q.q ?? '').toLowerCase()))
    } else if (p === '/incorporaciones' && req.method() === 'POST') {
      data = { inscripcion: { id: 1 }, mensaje: 'Alumno incorporado. Su grupo de origen se conserva.' }
    } else if (p.startsWith('/sesiones/')) {
      data = {
        sesion: { id: 1, fecha: '2026-10-13', activa: false, horaInicio: '07:04', horaFin: '08:58', horaInicioProgramada: '07:00', horaFinProgramada: '09:00', materia: { id: 411, nombre: 'Cálculo diferencial', clave: 'ACF-0901' }, grupo: { id: 8, nombre: '1A' }, docente: { id: 37, nombre: 'Laura Méndez' }, aula: { id: 1, nombre: 'A-101' }, unidad: { id: 1, nombre: 'Unidad 2', orden: 2 } },
        resumen: { asistencias: 1, faltas: 1, retardos: 0, justificadas: 0, total: 2 },
        asistencias: [
          { id: 1, alumnoId: 800, nombre: 'Ana Prueba', numeroControl: '221100', sexo: 'MUJER', estado: 'ASISTENCIA', observacion: null },
          { id: 2, alumnoId: 801, nombre: 'Bruno Castillo', numeroControl: '221101', sexo: 'HOMBRE', estado: 'FALTA', observacion: null },
        ],
      }
    } else if (p === '/seguimientos' && req.method() === 'POST') {
      const b = req.postDataJSON()
      const previo = b.alertaId ? guardados.find((x) => x.id === b.alertaId) : null
      const referencia = previo?.referencia ?? Object.fromEntries(Object.entries(b).filter(([k]) => ['tipo', 'horarioId', 'fecha', 'alumnoId', 'materiaId', 'grupoId', 'docenteId'].includes(k)))
      const docente = docentes.find((d) => d.id === referencia.docenteId)
      const nota = { id: Date.now(), texto: b.texto, estado: b.estado, fechaRevision: b.fechaRevision ?? null, autor: 'Persona de prueba', creadoEn: new Date().toISOString() }
      data = previo
        ? { ...previo, estado: b.estado, abierto: b.estado !== 'CERRADA', fechaRevision: b.fechaRevision ?? null, notas: [...previo.notas, nota] }
        : { id: guardados.length + 1, tipo: referencia.tipo, titulo: docente ? `Seguimiento con ${docente.nombre}` : 'Lista sin captura · Cálculo diferencial · 1A', mensaje: 'Acuerdos y revisiones con el docente', estado: b.estado, abierto: b.estado !== 'CERRADA', fechaRevision: b.fechaRevision ?? null, responsable: docente ? { id: docente.id, nombre: docente.nombre } : null, referencia, creadoEn: nota.creadoEn, actualizadoEn: nota.creadoEn, notas: [nota] }
      const i = guardados.findIndex((x) => x.id === data.id)
      if (i >= 0) guardados[i] = data; else guardados.push(data)
    } else if (p === '/seguimientos') {
      data = guardados
    } else if (p === '/informe') {
      data = informe(q)
    } else if (p === '/informe/exportar') {
      await route.fulfill({ status: 200, contentType: q.formato === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', headers: { 'content-disposition': `attachment; filename="SICAT_ISC_2026-B_${q.desde}_${q.hasta}.${q.formato === 'pdf' ? 'pdf' : 'xlsx'}"` }, body: 'archivo' })
      return
    } else { data = []; status = 200 }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
  })
  return requests
}

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

const nombres = ['Ana Prueba', 'Bruno Castillo', 'Carla Núñez', 'Diego Ramos', 'Elena Ortiz']
function filasReporte(materiaId, grupoId) {
  const oferta = ofertas.find((o) => o.materia.id === materiaId && o.grupo.id === grupoId)
  const base = nombres.map((nombre, i) => ({ id: grupoId * 100 + i, nombre, numeroControl: `22${grupoId}0${i}`, sexo: i % 2 ? 'HOMBRE' : 'MUJER', email: i === 4 ? null : `alumno${i}@sicat.test`, telefono: i < 2 ? '4429876543' : null, semestre: grupos.find((x) => x.id === grupoId).semestre }))
  if (materiaId === 419) base.push({ id: 999, nombre: 'Zoe Incorporada', numeroControl: '21Q999', sexo: 'MUJER', email: 'zoe@sicat.test', telefono: null, semestre: 9 })
  return base.flatMap((alumno, i) => oferta.unidades.map((u) => {
    const riesgo = materiaId === 411 && grupoId === 8 && i < 2
    const nota = u.status === 'PENDIENTE' ? null : riesgo ? 64 + i * 8 : 82 + i * 3 + u.orden
    const asistencia = { totalSesiones: 10, registradas: 10, asistencias: riesgo ? 6 : 9, faltas: riesgo ? 3 : 1, retardos: riesgo ? 1 : 0, justificadas: 0, sinRegistro: 0, porcentaje: riesgo ? 60 : 90 }
    return {
      alumno, materia: oferta.materia, grupo: oferta.grupo, unidad: u,
      calificacionFinal: u.status === 'FINALIZADA' && materiaId === 414 && i === 0 ? null : nota,
      calificacionManual: u.status === 'FINALIZADA' ? nota : null, calificacionCalculada: nota,
      motivos: riesgo && u.status === 'ACTIVA' ? (nota < 70 ? ['CALIFICACION_BAJA', 'ASISTENCIA'] : ['CALIFICACION_LIMITE', 'ASISTENCIA']) : [],
      asistencia, tareas: { total: 4, entregadas: 3, calificadas: 2, pendientesRevision: 1, sinEntregar: 1 },
      observacionManual: i === 1 && u.orden === 1 ? 'Entregó el proyecto fuera de tiempo; se acordó recuperación.' : null,
    }
  }))
}

export const riesgos = [0, 1].map((i) => ({
  id: 800 + i, nombre: nombres[i], numeroControl: `2280${i}`, email: null, telefono: null,
  causas: [{ materia: { id: 411, nombre: 'Cálculo diferencial', clave: 'ACF-0901' }, grupo: grupos[0], unidad: unidades(411)[1], motivos: i ? ['CALIFICACION_LIMITE', 'ASISTENCIA'] : ['CALIFICACION_BAJA', 'ASISTENCIA'], calificacion: 64 + i * 8, asistencia: { porcentaje: 60 } }],
}))

function resumen() {
  const desde = '2026-08-29'
  const ayer = clave(new Date(Date.now() - 86400000))
  const clases = clasesEntre(desde, hoy)
  const pendientes = clases.filter((c) => c.elegible && ['SIN_CAPTURA', 'CAPTURA_PARCIAL'].includes(c.estado))
  return {
    periodo: '2026-B', generadoEn: new Date().toISOString(), intervalo: { desde, hasta: hoy },
    calendarios: [
      { modalidad: 'ESCOLARIZADO', configurado: true, inicio: '2026-08-31T06:00:00.000Z', fin: '2026-12-18T06:00:00.000Z' },
      { modalidad: 'MIXTO', configurado: true, inicio: '2026-08-29T06:00:00.000Z', fin: '2026-12-12T06:00:00.000Z' },
    ],
    ofertas, grupos: grupos.map((x) => ({ ...x, ofertas: ofertas.filter((o) => o.grupo.id === x.id).map((o) => o.id), alumnosRiesgo: x.id === 8 ? 2 : x.id === 9 ? 1 : 0 })),
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
  }
}

export async function mockJefatura(page) {
  const requests = []
  await page.route('**/api/jefe-carrera/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname.replace(/^\/api\/jefe-carrera/, '')
    const q = Object.fromEntries(url.searchParams)
    requests.push({ path: p, method: req.method(), query: q, body: req.postDataJSON?.() })
    let data = []
    let status = 200
    if (p === '/contexto') data = { carreras: [carrera], periodoActual: '2026-B', periodos: ['2026-B', '2026-A'] }
    else if (p === '/supervision') data = resumen()
    else if (p === '/calendario') data = clasesEntre(q.desde, q.hasta, q)
    else if (/^\/ofertas\/\d+\/grupos\/\d+$/.test(p)) {
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
      data = { id: 1, materia: { nombre: 'Cálculo diferencial' }, grupo: { nombre: '1A' }, docente: { nombre: 'Laura Méndez' }, asistencias: [] }
    } else { data = []; status = 200 }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
  })
  return requests
}

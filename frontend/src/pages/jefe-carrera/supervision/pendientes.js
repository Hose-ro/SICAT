import { senalUnidad } from './estados'
import { claveCaso } from './useSeguimientos'

/**
 * Tipos de pendiente académico. Los tres primeros coinciden con un tipo de
 * observación (mismo valor en la URL y en el backend); los demás no tienen un
 * caso propio y se documentan, si hace falta, como observación con el docente.
 */
export const TIPOS_PENDIENTE = {
  ASISTENCIA_SIN_CAPTURA: { label: 'Listas sin captura completa', corto: 'Listas', caso: true },
  CALIFICACIONES_PENDIENTES: { label: 'Calificaciones pendientes', corto: 'Calificaciones', caso: true },
  ALUMNO_RIESGO: { label: 'Alumnos en riesgo', corto: 'Alumnos en riesgo', caso: true },
  ENTREGAS: { label: 'Entregas sin revisar', corto: 'Entregas', caso: false },
  UNIDAD: { label: 'Unidades por revisar', corto: 'Unidades', caso: false },
  ASIGNACION: { label: 'Materias sin docente u horario', corto: 'Asignaciones', caso: false },
}

const ORDEN_TIPOS = Object.keys(TIPOS_PENDIENTE)
const porNombre = (a, b) => (a ?? '').localeCompare(b ?? '', 'es')
const unicos = (lista) => [...new Map(lista.filter(Boolean).map((x) => [x.id, x])).values()].sort((a, b) => porNombre(a.nombre, b.nombre))

/**
 * Pendientes académicos detectados en el resumen del periodo. No se guardan:
 * existen mientras su causa aparezca en el resumen, tenga o no observación.
 * Cada uno lleva su clave estable (la misma de la observación cuando hay caso).
 */
export function pendientesAcademicos(resumen) {
  const items = []
  const docentesDeOferta = new Map(resumen.ofertas.map((o) => [`${o.materia.id}:${o.grupo.id}`, o.docentes]))

  resumen.pendientes.forEach((c) => {
    const caso = { tipo: 'ASISTENCIA_SIN_CAPTURA', horarioId: c.horarioId, fecha: c.fecha }
    items.push({
      key: claveCaso(caso), tipo: caso.tipo, caso,
      fecha: c.fecha, hora: c.horaInicio,
      materia: c.materia, grupos: [c.grupo], docentes: c.docente ? [c.docente] : [],
      clase: c,
    })
  })

  resumen.ofertas.forEach((o) => {
    if (o.resumen.calificacionesPendientes > 0) {
      const caso = { tipo: 'CALIFICACIONES_PENDIENTES', materiaId: o.materia.id, grupoId: o.grupo.id }
      items.push({ key: claveCaso(caso), tipo: caso.tipo, caso, materia: o.materia, grupos: [o.grupo], docentes: o.docentes, oferta: o, cantidad: o.resumen.calificacionesPendientes })
    }
    if (o.resumen.entregasPendientes > 0) {
      items.push({ key: `E:${o.materia.id}:${o.grupo.id}`, tipo: 'ENTREGAS', materia: o.materia, grupos: [o.grupo], docentes: o.docentes, oferta: o, cantidad: o.resumen.entregasPendientes })
    }
    if (!o.docentes.length || !o.horarios.length) {
      items.push({ key: `G:${o.materia.id}:${o.grupo.id}`, tipo: 'ASIGNACION', materia: o.materia, grupos: [o.grupo], docentes: o.docentes, oferta: o, faltaDocente: !o.docentes.length, faltaHorario: !o.horarios.length })
    }
  })

  // Las unidades son de la materia y se comparten entre sus grupos: un pendiente por unidad.
  const unidades = new Map()
  resumen.ofertas.forEach((o) => o.unidades.forEach((u) => {
    const senal = senalUnidad(u)
    if (!senal) return
    const previo = unidades.get(u.id) ?? { key: `U:${u.id}`, tipo: 'UNIDAD', unidad: u, senal, materia: o.materia, ofertas: [] }
    previo.ofertas.push(o)
    unidades.set(u.id, previo)
  }))
  unidades.forEach((p) => items.push({ ...p, grupos: unicos(p.ofertas.map((o) => o.grupo)), docentes: unicos(p.ofertas.flatMap((o) => o.docentes)), oferta: p.ofertas.length === 1 ? p.ofertas[0] : null }))

  resumen.riesgos.forEach((a) => {
    const caso = { tipo: 'ALUMNO_RIESGO', alumnoId: a.id }
    items.push({
      key: claveCaso(caso), tipo: caso.tipo, caso, alumno: a,
      grupos: unicos(a.causas.map((c) => c.grupo)),
      materias: [...new Set(a.causas.map((c) => c.materia.nombre))],
      motivos: [...new Set(a.causas.flatMap((c) => c.motivos))],
      docentes: unicos(a.causas.flatMap((c) => docentesDeOferta.get(`${c.materia.id}:${c.grupo.id}`) ?? [])),
    })
  })

  return items.sort(compararPendientes)
}

/**
 * Orden determinista, sin puntuar gravedad: tipo, después lo más antiguo
 * (solo las listas tienen fecha) y al final nombres para desempatar.
 */
export function compararPendientes(a, b) {
  return ORDEN_TIPOS.indexOf(a.tipo) - ORDEN_TIPOS.indexOf(b.tipo)
    || (a.fecha ?? '').localeCompare(b.fecha ?? '')
    || (a.hora ?? '').localeCompare(b.hora ?? '')
    || porNombre(a.materia?.nombre ?? a.alumno?.nombre, b.materia?.nombre ?? b.alumno?.nombre)
    || porNombre(a.grupos[0]?.nombre, b.grupos[0]?.nombre)
    || a.key.localeCompare(b.key)
}

/** Filtra por tipo, docente y grupo; un pendiente sin docente se encuentra con «sin-docente». */
export function filtrarPendientes(items, { tipo = '', docente = '', grupo = '' } = {}) {
  return items.filter((p) =>
    (!tipo || p.tipo === tipo)
    && (!docente || (docente === 'sin-docente' ? !p.docentes.length : p.docentes.some((d) => String(d.id) === docente)))
    && (!grupo || p.grupos.some((g) => String(g.id) === grupo)))
}

/** Modalidades con grupos en el periodo cuyo calendario escolar no está configurado. */
export function calendariosFaltantes(resumen) {
  const modalidades = new Set(resumen.grupos.map((g) => g.modalidad ?? 'ESCOLARIZADO'))
  return resumen.calendarios.filter((c) => !c.configurado && modalidades.has(c.modalidad))
}

/** Cantidad por tipo, para nombrar cada conjunto sin sumar unidades distintas. */
export function conteoPorTipo(items) {
  const conteo = Object.fromEntries(ORDEN_TIPOS.map((t) => [t, 0]))
  items.forEach((p) => { conteo[p.tipo] += 1 })
  return conteo
}

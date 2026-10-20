import { hoyClave, parseClave, sumarDias } from '../supervision/formato'

/** Meta institucional de cobertura de captura, en porcentaje. */
export const META = 90

const mesCorto = (fecha) => fecha.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')
const porcentaje = (completas, esperadas) => (esperadas ? Math.round((completas / esperadas) * 100) : null)

/** Semanas del periodo con su etiqueta; la que contiene hoy está «en curso». */
export function semanasDe(cobertura, hoy = hoyClave()) {
  return (cobertura?.semanas ?? []).map((lunes) => {
    const a = parseClave(lunes)
    const b = parseClave(sumarDias(lunes, 5))
    return {
      lunes,
      etiqueta: `${a.getDate()} ${mesCorto(a)}`,
      rango: a.getMonth() === b.getMonth() ? `${a.getDate()} – ${b.getDate()} ${mesCorto(b)}` : `${a.getDate()} ${mesCorto(a)} – ${b.getDate()} ${mesCorto(b)}`,
      enCurso: lunes <= hoy && hoy <= sumarDias(lunes, 6),
    }
  })
}

const vacia = () => ({ esperadas: 0, completas: 0, tardias: 0, parciales: 0, sinCaptura: 0, suspendidas: 0 })
function sumar(a, f) {
  return {
    esperadas: a.esperadas + f.esperadas,
    completas: a.completas + f.completas,
    tardias: a.tardias + f.tardias,
    parciales: a.parciales + f.parciales,
    sinCaptura: a.sinCaptura + f.sinCaptura,
    suspendidas: a.suspendidas + f.suspendidas,
  }
}
const conCobertura = (t) => ({ ...t, sinCompleta: t.parciales + t.sinCaptura, cobertura: porcentaje(t.completas, t.esperadas) })

/** Totales de la carrera por semana, para una modalidad ('' = todas). */
export function serieSemanal(cobertura, modalidad = '', hoy) {
  const filas = (cobertura?.filas ?? []).filter((f) => !modalidad || f.modalidad === modalidad)
  return semanasDe(cobertura, hoy).map((s) => ({
    ...s,
    ...conCobertura(filas.filter((f) => f.lunes === s.lunes).reduce(sumar, vacia())),
  }))
}

/** Modalidades con clases en el periodo: el filtro solo se ofrece si hay más de una. */
export const modalidadesCon = (cobertura) => [...new Set((cobertura?.filas ?? []).map((f) => f.modalidad))].sort()

/**
 * Una fila por docente con su cobertura de cada semana y la acumulada. Las
 * cifras salen de las mismas clases que los indicadores de Docentes.
 */
export function coberturaPorDocente(cobertura, hoy) {
  const semanas = semanasDe(cobertura, hoy)
  const porDocente = new Map()
  for (const f of cobertura?.filas ?? []) {
    const d = porDocente.get(f.docenteId) ?? { modalidades: new Set(), semanas: new Map() }
    d.modalidades.add(f.modalidad)
    d.semanas.set(f.lunes, sumar(d.semanas.get(f.lunes) ?? vacia(), f))
    porDocente.set(f.docenteId, d)
  }
  return new Map([...porDocente].map(([id, d]) => {
    const celdas = semanas.map((s) => conCobertura(d.semanas.get(s.lunes) ?? vacia()))
    return [id, {
      modalidades: [...d.modalidades].sort(),
      semanas: celdas,
      acumulado: conCobertura(celdas.reduce(sumar, vacia())),
    }]
  }))
}

/** Semanas cerradas seguidas debajo de la meta, contadas desde la más reciente. */
export function rachaDebajo(celdas, semanas) {
  let n = 0
  for (let i = celdas.length - 1; i >= 0; i--) {
    if (semanas[i]?.enCurso || celdas[i].cobertura == null) continue
    if (celdas[i].cobertura >= META) break
    n++
  }
  return n
}

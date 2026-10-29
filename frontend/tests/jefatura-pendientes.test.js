import { describe, expect, it } from 'vitest'
import { conteoPorTipo, filtrarPendientes, pendientesAcademicos } from '@/pages/jefe-carrera/supervision/pendientes'
import { leerOrigen, origenActual } from '@/pages/jefe-carrera/supervision/origen'
import { claveCaso } from '@/pages/jefe-carrera/supervision/useSeguimientos'

const laura = { id: 37, nombre: 'Laura Méndez' }
const carlos = { id: 38, nombre: 'Carlos Ruiz' }
const g1A = { id: 8, nombre: '1A', semestre: 1, modalidad: 'ESCOLARIZADO' }
const g3A = { id: 9, nombre: '3A', semestre: 3, modalidad: 'ESCOLARIZADO' }
const calculo = { id: 411, nombre: 'Cálculo diferencial' }
const poo = { id: 414, nombre: 'Programación orientada a objetos' }
const unidad = (id, extra = {}) => ({ id, nombre: `Unidad ${id % 10}`, status: 'FINALIZADA', ...extra })
const oferta = (materia, grupo, docentes, resumen = {}, extra = {}) => ({
  id: `${materia.id}:${grupo.id}`, materia, grupo, docentes, horarios: [{ id: 1 }], unidades: [unidad(materia.id * 10 + 1)],
  resumen: { calificacionesPendientes: 0, entregasPendientes: 0, ...resumen }, ...extra,
})

function resumenBase() {
  return {
    grupos: [g1A, g3A],
    calendarios: [],
    ofertas: [
      oferta(calculo, g1A, [laura]),
      oferta(poo, g3A, [carlos], { calificacionesPendientes: 12, entregasPendientes: 5 }),
      oferta({ id: 424, nombre: 'Gestión de proyectos' }, g3A, [], {}, { horarios: [] }),
    ],
    pendientes: [
      { id: '100:2026-10-20', horarioId: 100, fecha: '2026-10-20', horaInicio: '07:00', estado: 'SIN_CAPTURA', materia: calculo, grupo: g1A, docente: laura },
      { id: '100:2026-10-14', horarioId: 100, fecha: '2026-10-14', horaInicio: '07:00', estado: 'CAPTURA_PARCIAL', registros: 3, alumnos: 32, materia: calculo, grupo: g1A, docente: laura },
    ],
    riesgos: [{ id: 800, nombre: 'Ana Prueba', causas: [{ grupo: g1A, materia: calculo, motivos: ['ASISTENCIA'] }] }],
  }
}

describe('pendientes académicos de la bandeja', () => {
  it('usa la misma clave que la observación del caso', () => {
    const items = pendientesAcademicos(resumenBase())
    const lista = items.find((p) => p.tipo === 'ASISTENCIA_SIN_CAPTURA')
    expect(lista.key).toBe(claveCaso({ tipo: 'ASISTENCIA_SIN_CAPTURA', horarioId: 100, fecha: '2026-10-14' }))
    expect(items.find((p) => p.tipo === 'CALIFICACIONES_PENDIENTES').key).toBe('C:414:9')
    expect(items.find((p) => p.tipo === 'ALUMNO_RIESGO').key).toBe('R:800')
  })

  it('ordena por tipo y antigüedad sin inventar gravedad', () => {
    const tipos = pendientesAcademicos(resumenBase()).map((p) => `${p.tipo}${p.fecha ? `:${p.fecha}` : ''}`)
    expect(tipos).toEqual([
      'ASISTENCIA_SIN_CAPTURA:2026-10-14',
      'ASISTENCIA_SIN_CAPTURA:2026-10-20',
      'CALIFICACIONES_PENDIENTES',
      'ALUMNO_RIESGO',
      'ENTREGAS',
      'ASIGNACION',
    ])
  })

  it('el alumno en riesgo se filtra por el docente de la materia que lo origina', () => {
    const items = pendientesAcademicos(resumenBase())
    const deLaura = filtrarPendientes(items, { docente: '37' })
    expect(deLaura.map((p) => p.tipo)).toEqual(['ASISTENCIA_SIN_CAPTURA', 'ASISTENCIA_SIN_CAPTURA', 'ALUMNO_RIESGO'])
    expect(filtrarPendientes(items, { docente: 'sin-docente' }).map((p) => p.tipo)).toEqual(['ASIGNACION'])
    expect(filtrarPendientes(items, { grupo: '9', tipo: 'CALIFICACIONES_PENDIENTES' })).toHaveLength(1)
  })

  it('cuenta por tipo sin sumar unidades distintas', () => {
    const conteo = conteoPorTipo(pendientesAcademicos(resumenBase()))
    expect(conteo).toMatchObject({ ASISTENCIA_SIN_CAPTURA: 2, CALIFICACIONES_PENDIENTES: 1, ALUMNO_RIESGO: 1, ENTREGAS: 1, UNIDAD: 0, ASIGNACION: 1 })
  })

  it('una unidad compartida por dos grupos es un solo pendiente con ambos grupos', () => {
    const r = resumenBase()
    const vencida = unidad(4112, { status: 'ACTIVA', fechaFin: '2020-01-10T00:00:00.000Z' })
    r.ofertas = [
      oferta(calculo, g1A, [laura], {}, { unidades: [vencida] }),
      oferta(calculo, { id: 13, nombre: '1M', modalidad: 'MIXTO' }, [laura], {}, { unidades: [vencida] }),
    ]
    const unidades = pendientesAcademicos(r).filter((p) => p.tipo === 'UNIDAD')
    expect(unidades).toHaveLength(1)
    expect(unidades[0].grupos.map((g) => g.nombre)).toEqual(['1A', '1M'])
    expect(unidades[0].oferta).toBeNull()
  })

  it('sin causas en el resumen no hay pendientes, aunque existan observaciones', () => {
    expect(pendientesAcademicos({ grupos: [], calendarios: [], ofertas: [], pendientes: [], riesgos: [] })).toEqual([])
  })
})

describe('origen de un recorrido transversal', () => {
  const j = { carreraId: '1', periodo: '2026-B' }

  it('acepta rutas internas conocidas con la misma carrera y periodo', () => {
    expect(leerOrigen('/jefe-carrera/seguimientos?carrera=1&periodo=2026-B&tipo=CALIFICACIONES_PENDIENTES', j))
      .toEqual({ to: '/jefe-carrera/seguimientos?carrera=1&periodo=2026-B&tipo=CALIFICACIONES_PENDIENTES', label: 'Volver a Pendientes y seguimiento' })
    expect(leerOrigen('/jefe-carrera/docentes/37?carrera=1&periodo=2026-B', j).label).toBe('Volver al docente')
  })

  it('rechaza URLs externas, rutas desconocidas u otra carrera o periodo', () => {
    expect(leerOrigen('https://evil.test/?carrera=1&periodo=2026-B', j)).toBeNull()
    expect(leerOrigen('//evil.test/jefe-carrera/grupos?carrera=1&periodo=2026-B', j)).toBeNull()
    expect(leerOrigen('/admin/usuarios?carrera=1&periodo=2026-B', j)).toBeNull()
    expect(leerOrigen('/jefe-carrera/grupos?carrera=2&periodo=2026-B', j)).toBeNull()
    expect(leerOrigen('/jefe-carrera/grupos?carrera=1&periodo=2026-A', j)).toBeNull()
    expect(leerOrigen(null, j)).toBeNull()
  })

  it('conserva el origen encadenado salvo que crezca demasiado', () => {
    expect(origenActual('/jefe-carrera/materias/411', '?carrera=1&periodo=2026-B&desde=%2Fdashboard')).toBe('/jefe-carrera/materias/411?carrera=1&periodo=2026-B&desde=%2Fdashboard')
    const largo = origenActual('/jefe-carrera/materias/411', `?carrera=1&periodo=2026-B&desde=${'x'.repeat(1300)}`)
    expect(largo).toBe('/jefe-carrera/materias/411?carrera=1&periodo=2026-B')
  })
})

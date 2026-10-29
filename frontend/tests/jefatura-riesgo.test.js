import { describe, expect, it } from 'vitest'
import { celdaRiesgo, comparativoGrupos, matrizRiesgo, matrizUnidades, motivosCelda, textoMotivosGrupo } from '@/components/graficas/riesgo'

const fila = (alumnoId, unidad, extra = {}) => ({
  alumno: { id: alumnoId, nombre: `Alumno ${alumnoId}` },
  unidad: { nombre: `Unidad ${unidad}` },
  calificacionFinal: 85,
  motivos: [],
  asistencia: { registradas: 10, asistencias: 9, faltas: 1, retardos: 0, justificadas: 0 },
  tareas: { total: 4, entregadas: 4, vencidas: 3, vencidasSinEntregar: 0 },
  ...extra,
})

describe('celda de riesgo alumno × materia', () => {
  it('toma la peor unidad: reprobar gana a estar en riesgo', () => {
    const c = celdaRiesgo([
      fila(1, 1, { calificacionFinal: 62, motivos: ['CALIFICACION_BAJA'] }),
      fila(1, 2, { motivos: ['ENTREGAS'], tareas: { total: 4, entregadas: 2, vencidas: 3, vencidasSinEntregar: 2 } }),
    ])
    expect(c.estado).toBe('REPROBADO')
    expect(c.motivos).toEqual(['CALIFICACION_BAJA', 'ENTREGAS'])
    expect(c.unidades.map((u) => u.nombre)).toEqual(['Unidad 1', 'Unidad 2'])
    // Entregas sobre lo vencido: 4 de 6.
    expect(c.tareas.porcentaje).toBe(67)
  })

  it('sin motivos es aprobado si hay calificación y sin calificar si no', () => {
    expect(celdaRiesgo([fila(1, 1)]).estado).toBe('APROBADO')
    expect(celdaRiesgo([fila(1, 1, { calificacionFinal: null })]).estado).toBe('SIN_CALIFICAR')
    expect(celdaRiesgo([fila(1, 1, { calificacionFinal: null, motivos: ['ASISTENCIA'] })]).estado).toBe('EN_RIESGO')
  })

  it('distingue no inscrito, cargando y error; un error nunca se lee como sin señales', () => {
    expect(celdaRiesgo([]).estado).toBe('NO_INSCRITO')
    expect(celdaRiesgo([], { cargando: true }).estado).toBe('CARGANDO')
    expect(celdaRiesgo([], { error: 'falló' }).estado).toBe('NO_DISPONIBLE')
  })
})

describe('matriz del grupo', () => {
  const ofertas = [{ id: '1:8', materia: { id: 1, nombre: 'Cálculo' } }, { id: '2:8', materia: { id: 2, nombre: 'Programación' } }]
  const alumnos = [{ id: 1, nombre: 'Beto' }, { id: 2, nombre: 'Ana' }, { id: 3, nombre: 'Carla' }]
  const reportes = {
    '1:8': { data: { rows: [fila(1, 1, { motivos: ['ASISTENCIA'] }), fila(2, 1, { calificacionFinal: 60, motivos: ['CALIFICACION_BAJA'] }), fila(3, 1)] } },
    '2:8': { data: { rows: [fila(1, 1, { motivos: ['ENTREGAS'] }), fila(2, 1)] } },
  }

  it('ordena por materias reprobadas, luego en riesgo, y cuenta riesgo por materia', () => {
    const m = matrizRiesgo(alumnos, ofertas, reportes, 8)
    expect(m.filas.map((f) => f.alumno.nombre)).toEqual(['Ana', 'Beto', 'Carla'])
    expect(m.filas[1].enRiesgo).toBe(2)
    expect(m.columnas.map((c) => c.enRiesgo)).toEqual([2, 1])
    // Carla no está inscrita en Programación.
    expect(m.filas[2].celdas[1].estado).toBe('NO_INSCRITO')
  })

  it('una materia que falló queda no disponible para todos', () => {
    const m = matrizRiesgo(alumnos, ofertas, { ...reportes, '2:8': { error: 'falló' } }, 8)
    expect(m.filas.every((f) => f.celdas[1].estado === 'NO_DISPONIBLE')).toBe(true)
  })
})

describe('comparativo de grupos', () => {
  it('ordena por porcentaje y separa a quien ya reprueba', () => {
    const filas = comparativoGrupos([
      { id: 1, nombre: '1A', alumnosEvaluados: 20, alumnosRiesgo: 4, riesgoPorMotivo: { reprobando: 2, calificacion: 3, asistencia: 2, entregas: 1 } },
      { id: 2, nombre: '3A', alumnosEvaluados: 10, alumnosRiesgo: 5, riesgoPorMotivo: { reprobando: 0, calificacion: 0, asistencia: 5, entregas: 0 } },
      { id: 3, nombre: '5A', alumnosEvaluados: 0, alumnosRiesgo: 0 },
    ])
    expect(filas.map((g) => [g.nombre, g.porcentaje, g.reprobando])).toEqual([['3A', 50, 0], ['1A', 20, 10]])
    expect(textoMotivosGrupo(filas[1].motivos)).toBe('Calificación 3, asistencia 2, entregas 1')
  })

  it('sin conteos del servidor no se dibuja', () => {
    expect(comparativoGrupos([{ id: 1, nombre: '1A', alumnosRiesgo: 2 }])).toBeNull()
  })
})

describe('mapa alumno × unidad del docente', () => {
  const u = (id, orden, status) => ({ id, nombre: `Unidad ${orden}`, orden, status })
  const unidades = [u(1, 1, 'FINALIZADA'), u(2, 2, 'ACTIVA'), u(3, 3, 'PENDIENTE')]
  const reporte = {
    unidades,
    rows: [
      fila(1, 1, { unidad: unidades[0], calificacionFinal: 90 }),
      fila(1, 2, { unidad: unidades[1], calificacionFinal: 72, motivos: ['ENTREGAS'] }),
      fila(2, 1, { unidad: unidades[0], calificacionFinal: 60, motivos: ['CALIFICACION_BAJA'] }),
      fila(2, 2, { unidad: unidades[1], calificacionFinal: null, motivos: ['ASISTENCIA'] }),
    ],
  }

  it('deja fuera las unidades por iniciar y ordena por unidades en riesgo', () => {
    const m = matrizUnidades(reporte)
    expect(m.columnas.map((c) => [c.id, c.enRiesgo])).toEqual([[1, 1], [2, 2]])
    expect(m.filas.map((f) => f.alumno.id)).toEqual([2, 1])
    expect(m.filas[0].celdas.map((c) => c.estado)).toEqual(['REPROBADO', 'EN_RIESGO'])
    expect(m.filas[1].celdas.map((c) => c.estado)).toEqual(['APROBADO', 'EN_RIESGO'])
  })

  it('explica los motivos con sus cifras', () => {
    const c = celdaRiesgo([fila(1, 1, { motivos: ['ASISTENCIA', 'ENTREGAS'], asistencia: { registradas: 10, asistencias: 6, faltas: 3, retardos: 1, justificadas: 0 }, tareas: { total: 4, entregadas: 2, vencidas: 4, vencidasSinEntregar: 2 } })])
    expect(motivosCelda(c)).toEqual(['40 % de faltas y retardos', '2 de 4 tareas vencidas sin entregar'])
  })
})

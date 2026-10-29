import { describe, expect, it } from 'vitest'
import { coberturaPorDocente, modalidadesCon, rachaDebajo, semanasDe, serieSemanal } from '@/pages/jefe-carrera/graficas/cobertura'

const fila = (lunes, docenteId, modalidad, esperadas, completas, extra = {}) => ({
  lunes, docenteId, modalidad, esperadas, completas, tardias: 0, parciales: 0, sinCaptura: esperadas - completas, suspendidas: 0, ...extra,
})
const cobertura = {
  semanas: ['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19'],
  filas: [
    fila('2026-09-28', 1, 'ESCOLARIZADO', 10, 10),
    fila('2026-10-05', 1, 'ESCOLARIZADO', 10, 8),
    fila('2026-10-12', 1, 'ESCOLARIZADO', 10, 6, { tardias: 1 }),
    fila('2026-10-19', 1, 'ESCOLARIZADO', 2, 2),
    fila('2026-10-05', 2, 'MIXTO', 2, 2),
    fila('2026-10-12', 2, 'MIXTO', 2, 1, { suspendidas: 1 }),
  ],
}
const HOY = '2026-10-20'

describe('cobertura semanal de jefatura', () => {
  it('rotula las semanas y marca la que está en curso', () => {
    const s = semanasDe(cobertura, HOY)
    expect(s.map((x) => x.etiqueta)).toEqual(['28 sep', '5 oct', '12 oct', '19 oct'])
    expect(s[0].rango).toBe('28 sep – 3 oct')
    expect(s.map((x) => x.enCurso)).toEqual([false, false, false, true])
  })

  it('suma por semana y filtra por modalidad', () => {
    expect(serieSemanal(cobertura, '', HOY).map((x) => x.cobertura)).toEqual([100, 83, 58, 100])
    expect(serieSemanal(cobertura, 'MIXTO', HOY).map((x) => x.cobertura)).toEqual([null, 100, 50, null])
    expect(serieSemanal(cobertura, '', HOY)[2]).toMatchObject({ sinCompleta: 5, suspendidas: 1, tardias: 1 })
    expect(modalidadesCon(cobertura)).toEqual(['ESCOLARIZADO', 'MIXTO'])
  })

  it('arma la fila de cada docente con su acumulado y su racha debajo de la meta', () => {
    const porDocente = coberturaPorDocente(cobertura, HOY)
    const d = porDocente.get(1)
    expect(d.semanas.map((x) => x.cobertura)).toEqual([100, 80, 60, 100])
    expect(d.acumulado).toMatchObject({ esperadas: 32, completas: 26, cobertura: 81 })
    // La semana en curso no corta ni alarga la racha.
    expect(rachaDebajo(d.semanas, semanasDe(cobertura, HOY))).toBe(2)
    expect(porDocente.get(2).semanas[0].cobertura).toBeNull()
  })

  it('sin datos del servidor no rompe', () => {
    expect(serieSemanal(undefined)).toEqual([])
    expect(coberturaPorDocente(undefined).size).toBe(0)
  })
})

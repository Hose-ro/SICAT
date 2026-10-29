import { describe, expect, it } from 'vitest'
import { claveInstitucional, senalUnidad } from '@/pages/jefe-carrera/supervision/estados'

const unidad = (extra) => ({ id: 1, status: 'ACTIVA', fechaInicio: '2026-10-01T00:00:00.000Z', ...extra })

describe('senalUnidad: plazos por día civil del instituto', () => {
  it('la hora UTC del día siguiente sigue siendo el día anterior en México', () => {
    expect(claveInstitucional(new Date('2026-10-20T05:30:00Z'))).toBe('2026-10-19')
  })

  it('no marca vencida una unidad antes de su día de cierre', () => {
    const u = unidad({ fechaFin: '2026-10-20T00:00:00.000Z' })
    expect(senalUnidad(u, new Date('2026-10-20T05:30:00Z'))).toBeNull()
  })

  it('el propio día de cierre todavía está a tiempo', () => {
    const u = unidad({ fechaFin: '2026-10-20T00:00:00.000Z' })
    expect(senalUnidad(u, new Date('2026-10-20T18:00:00Z'))).toBeNull()
    expect(senalUnidad(u, new Date('2026-10-21T05:59:00Z'))).toBeNull()
  })

  it('vence cuando el día de cierre terminó en México', () => {
    const u = unidad({ fechaFin: '2026-10-20T00:00:00.000Z' })
    expect(senalUnidad(u, new Date('2026-10-21T06:01:00Z'))).toMatch(/Cierre previsto el 20 oct/)
  })

  it('cuenta los días abiertos por fecha civil', () => {
    const u = unidad({ fechaInicio: '2026-09-01T00:00:00.000Z' })
    expect(senalUnidad(u, new Date('2026-09-29T12:00:00Z'))).toBeNull()
    expect(senalUnidad(u, new Date('2026-09-30T12:00:00Z'))).toBe('Abierta hace 29 días; revisar avance')
  })

  it('una unidad cerrada no da señal', () => {
    expect(senalUnidad(unidad({ status: 'FINALIZADA', fechaFin: '2026-01-01T00:00:00.000Z' }))).toBeNull()
  })
})

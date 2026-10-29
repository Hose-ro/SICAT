import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TendenciaCobertura from '@/pages/jefe-carrera/graficas/TendenciaCobertura'

const j = { to: (path, extra = {}) => `${path}?${new URLSearchParams(Object.entries(extra).filter(([, v]) => v != null))}` }
const fila = (lunes, modalidad, esperadas, completas, extra = {}) => ({ lunes, modalidad, docenteId: 1, esperadas, completas, parciales: 0, sinCaptura: esperadas - completas, tardias: 0, suspendidas: 0, ...extra })
const cobertura = {
  semanas: ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'],
  filas: [
    fila('2026-10-12', 'ESCOLARIZADO', 10, 8, { parciales: 1, sinCaptura: 1, tardias: 2, suspendidas: 3 }),
    fila('2026-10-12', 'MIXTO', 2, 1),
    fila('2026-10-19', 'ESCOLARIZADO', 2, 0),
    fila('2026-10-26', 'ESCOLARIZADO', 1, 1),
  ],
}
const vista = (datos = cobertura) => <MemoryRouter><TendenciaCobertura j={j} resumen={{ coberturaSemanal: datos }} /></MemoryRouter>

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-28T18:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('lectura del registro de asistencias', () => {
  it('distingue la última semana cerrada, la semana en curso, el cero y la ausencia de clases', () => {
    render(vista())
    expect(screen.getByText(/Última semana cerrada/).textContent).toContain('0 de 2 listas completas (0 %)')
    expect(screen.getByRole('radio', { name: /5 – 10 oct.*sin clases concluidas/ }).checked).toBe(false)
    expect(screen.getByRole('radio', { name: /19 – 24 oct.*0 %/ }).checked).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: /26 – 31 oct, en curso/ }))
    expect(within(screen.getByRole('status')).getByText('En curso · resultado provisional')).toBeTruthy()
    // Cambiar la selección no convierte el resultado provisional en conclusión cerrada.
    expect(screen.getByText(/Última semana cerrada/).textContent).toContain('0 de 2')
    fireEvent.click(screen.getByRole('radio', { name: /5 – 10 oct.*sin clases concluidas/ }))
    expect(within(screen.getByRole('status')).getByText('Sin clases evaluables')).toBeTruthy()
  })

  it('filtra modalidades, conserva cantidades y ofrece tabla sin perder tardías ni suspendidas', () => {
    render(vista())
    fireEvent.click(screen.getByRole('button', { name: 'Mixto', exact: true }))
    expect(screen.getByText(/Última semana cerrada/).textContent).toContain('1 de 2 listas completas (50 %)')
    fireEvent.click(screen.getByRole('button', { name: 'Todas', exact: true }))
    fireEvent.click(screen.getByRole('radio', { name: /12 – 17 oct.*9 de 12.*75 %/ }))
    const detalle = screen.getByRole('status')
    expect(within(detalle).getByText('9 de 12')).toBeTruthy()
    expect(within(detalle).getByText('2 sin captura · 1 parcial')).toBeTruthy()
    expect(within(detalle).getByRole('link', { name: 'Ver clases de esta semana' }).getAttribute('href')).toContain('fecha=2026-10-12')
    fireEvent.click(screen.getByLabelText('Ver como tabla'))
    const tabla = screen.getByRole('table', { name: 'Registro de asistencias por semana' })
    const filaOctubre = within(tabla).getByRole('row', { name: /12 – 17 oct/ })
    expect(within(filaOctubre).getAllByRole('cell').map((c) => c.textContent)).toEqual(['12', '9', '3', '2', '3', '75 %'])
  })

  it('recupera una selección válida si cambia la carrera o desaparece una modalidad', () => {
    const { rerender } = render(vista())
    fireEvent.click(screen.getByRole('button', { name: 'Mixto', exact: true }))
    fireEvent.click(screen.getByRole('radio', { name: /26 – 31 oct/ }))
    act(() => rerender(vista({ semanas: ['2026-10-12'], filas: [fila('2026-10-12', 'ESCOLARIZADO', 10, 8)] })))
    expect(screen.getByRole('radio', { name: /8 de 10.*80 %/ }).checked).toBe(true)
    expect(within(screen.getByRole('status')).getByText('8 de 10')).toBeTruthy()
  })

  it('mantiene disponibles los filtros en una modalidad sin clases evaluables', () => {
    render(vista({ semanas: ['2026-10-12'], filas: [fila('2026-10-12', 'ESCOLARIZADO', 2, 2), fila('2026-10-12', 'MIXTO', 0, 0)] }))
    fireEvent.click(screen.getByRole('button', { name: 'Mixto', exact: true }))
    expect(screen.getByText(/Todavía no hay clases concluidas/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Todas', exact: true }))
    expect(screen.getByRole('radio', { name: /2 de 2.*100 %/ })).toBeTruthy()
  })

  it('no renderiza una gráfica sin agregado del servidor', () => {
    const { container } = render(<MemoryRouter><TendenciaCobertura j={j} resumen={{}} /></MemoryRouter>)
    expect(container.textContent).toBe('')
  })
})

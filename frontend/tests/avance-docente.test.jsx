import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AvanceDocente from '@/pages/jefe-carrera/components/AvanceDocente'
import './setup'

const j = { toDesde: (path, params) => `${path}?${new URLSearchParams(params)}` }
const unidades = [1, 2, 3, 4, 5].map((n) => ({ id: n, orden: n, nombre: `Unidad ${n}`, status: n < 3 ? 'FINALIZADA' : n === 3 ? 'ACTIVA' : 'PENDIENTE', fechaInicio: null, fechaFin: null }))
const oferta = (id, nombre, extra = {}) => ({ id, materia: { id: 411, nombre: 'Matemáticas Discretas' }, grupo: { id, nombre }, docentes: [{ id: 37 }], unidades, resumen: { calificacionesPendientes: 5, entregasPendientes: 0, sinEntrega: 16 }, ...extra })
const ofertas = [oferta(8, '103A'), oferta(9, '103-SA', { resumen: { calificacionesPendientes: 0, entregasPendientes: 0, sinEntrega: 16 } })]
const vista = (datos = ofertas) => <MemoryRouter><AvanceDocente ofertas={datos} j={j} /></MemoryRouter>
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-29T18:00:00Z')) })
afterEach(() => vi.useRealTimers())

describe('avance de materias del docente', () => {
  it('abre inicialmente una materia y permite contraer y expandir cada grupo de forma independiente', () => {
    render(vista())
    const primera = screen.getByRole('region', { name: 'Matemáticas Discretas, grupo 103A' })
    const segunda = screen.getByRole('region', { name: 'Matemáticas Discretas, grupo 103-SA' })
    const contraer = within(primera).getByRole('button', { name: 'Contraer Matemáticas Discretas, grupo 103A' })
    const expandir = within(segunda).getByRole('button', { name: 'Expandir Matemáticas Discretas, grupo 103-SA' })
    expect(contraer.getAttribute('aria-expanded')).toBe('true')
    expect(expandir.getAttribute('aria-expanded')).toBe('false')
    expect(within(primera).getAllByRole('button', { name: /^Unidad/ })).toHaveLength(5)
    expect(within(segunda).queryAllByRole('button', { name: /^Unidad/ })).toHaveLength(0)
    fireEvent.click(contraer)
    expect(document.getElementById(contraer.getAttribute('aria-controls')).hidden).toBe(true)
    expect(primera.querySelector('.avance-resumen-pendientes').textContent).toBe('5 calificaciones por capturar')
    fireEvent.click(expandir)
    expect(within(segunda).getAllByRole('button', { name: /^Unidad/ })).toHaveLength(5)
  })
  it('selecciona la unidad activa y conserva la selección al contraer; se recupera si desaparece', () => {
    const { rerender } = render(vista([ofertas[0]]))
    expect(screen.getByRole('status').textContent).toContain('Unidad 3 · En curso · Sin plazo definido')
    fireEvent.click(screen.getByRole('button', { name: 'Unidad 4, Pendiente' }))
    expect(screen.getByRole('status').textContent).toContain('Unidad 4 · Pendiente')
    fireEvent.click(screen.getByRole('button', { name: /^Contraer/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Expandir/ }))
    expect(screen.getByRole('button', { name: 'Unidad 4, Pendiente' }).getAttribute('aria-pressed')).toBe('true')
    rerender(vista([{ ...ofertas[0], unidades: unidades.slice(0, 3) }]))
    expect(screen.getByRole('status').textContent).toContain('Unidad 3 · En curso')
  })
  it('distingue las actividades sin entrega del alumnado de los pendientes del docente', () => {
    render(vista([ofertas[1]]))
    expect(screen.getByText('Sin pendientes del docente')).toBeTruthy()
    expect(screen.getByText('Entregas del alumnado')).toBeTruthy()
    expect(screen.getByText('actividades sin entrega', { exact: false }).textContent).toContain('16')
    expect(screen.queryByRole('link', { name: 'Revisar pendientes' })).toBeNull()
    expect(screen.queryByText('Avance y pendientes por materia y grupo.')).toBeNull()
  })
  it('conserva advertencias de unidades vencidas, fechas y vínculos al grupo correcto', () => {
    const vencida = { ...unidades[2], fechaFin: '2026-10-20T00:00:00Z' }
    render(vista([{ ...ofertas[0], unidades: [vencida] }]))
    expect(screen.getByRole('status').textContent).toContain('Cierre 20 oct')
    expect(screen.getByRole('status').textContent).toContain('Cierre previsto el 20 oct sin registrar')
    expect(screen.getByRole('button', { name: /Unidad 3, En curso, Cierre previsto/ })).toBeTruthy()
    const link = screen.getByRole('link', { name: 'Revisar pendientes' })
    expect(link.getAttribute('href')).toBe('/jefe-carrera/materias/411?oferta=8&tab=unidades')
  })
  it('dirige las entregas pendientes al resumen de la materia, sin inventar unidades', () => {
    render(vista([oferta(8, '103A', { unidades: [], resumen: { calificacionesPendientes: 0, entregasPendientes: 3, sinEntrega: 16 } })]))
    expect(screen.getByText('Sin unidades registradas.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Revisar pendientes' }).getAttribute('href')).toContain('oferta=8&tab=resumen')
  })
  it('mantiene el cierre de curso y la indicación de docencia compartida', () => {
    render(vista([oferta(8, '103A', { docentes: [{ id: 37 }, { id: 38 }], cierre: { cerradoEn: '2026-10-20T18:00:00Z', docente: 'Laura', acreditados: 20, total: 25, noAcreditados: 5 } })]))
    expect(screen.getByText('Avance compartido por 2 docentes')).toBeTruthy()
    expect(screen.getByText(/20 de 25 acreditados/)).toBeTruthy()
  })
  it('muestra un estado vacío cuando el docente no tiene materias asignadas', () => {
    render(vista([]))
    expect(screen.getByText('Sin materias asignadas')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})

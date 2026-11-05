import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DocentesEnLinea from '@/pages/jefe-carrera/components/DocentesEnLinea'
import { useClases } from '@/pages/jefe-carrera/supervision/useClasesSemana'
vi.mock('@/pages/jefe-carrera/supervision/useClasesSemana', () => ({ useClases: vi.fn() }))
const actualizar = vi.fn()
const j = { carreraId: '1', periodo: '2026-B', historico: false, toDesde: (path) => path }
const clase = (id, extra = {}) => ({
  id,
  fecha: '2026-11-04',
  horaInicio: '09:00',
  horaFin: '10:00',
  estado: 'REGISTRO_EN_CURSO',
  registros: 0,
  alumnos: 20,
  docente: { id, nombre: `Docente ${id}` },
  materia: { nombre: 'Cálculo' },
  grupo: { nombre: '1A' },
  ...extra,
})
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-04T15:30:00Z'))
  vi.clearAllMocks()
  useClases.mockReturnValue({ clases: [], actualizar, reintentar: vi.fn(), cargando: false, error: '' })
})
afterEach(() => vi.useRealTimers())
const vista = (contexto = j) => (
  <MemoryRouter>
    <DocentesEnLinea j={contexto} />
  </MemoryRouter>
)
describe('docentes en línea según horario institucional', () => {
  it('distingue sin registro, captura parcial y captura completa sin incluir futuras ni suspendidas', () => {
    useClases.mockReturnValue({
      clases: [
        clase(1),
        clase(2, { registros: 3 }),
        clase(3, { registros: 20 }),
        clase(4, { horaInicio: '10:00', horaFin: '11:00' }),
        clase(5, { estado: 'SUSPENDIDA' }),
      ],
      actualizar,
    })
    render(vista())
    expect(screen.getByText('Sin asistencias aún')).toBeTruthy()
    expect(screen.getByText('Asistencias · 3 de 20')).toBeTruthy()
    expect(screen.getByText('Asistencias', { exact: true })).toBeTruthy()
    expect(screen.queryByText('Docente 4')).toBeNull()
    expect(screen.queryByText('Docente 5')).toBeNull()
    act(() => vi.advanceTimersByTime(30 * 60 * 1000))
    expect(screen.queryByText('Docente 1')).toBeNull()
    expect(actualizar).toHaveBeenCalled()
  })
  it('no afirma que estén conectados si la consulta falla', () => {
    useClases.mockReturnValue({ clases: [clase(1)], actualizar, error: 'Sin conexión', reintentar: vi.fn() })
    render(vista())
    expect(screen.getByRole('alert').textContent).toContain('No se pudo actualizar')
    expect(screen.queryByText('Docente 1')).toBeNull()
  })
  it('no muestra actividad actual en un periodo histórico', () => {
    render(vista({ ...j, historico: true }))
    expect(screen.queryByRole('heading', { name: 'Docentes en línea' })).toBeNull()
  })
})

import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import HoyEnLaCarrera from '@/pages/jefe-carrera/components/HoyEnLaCarrera'
import { useClases } from '@/pages/jefe-carrera/supervision/useClasesSemana'
import './setup'

vi.mock('@/pages/jefe-carrera/supervision/useClasesSemana', () => ({ useClases: vi.fn() }))
const j = {
  carreraId: 'sistemas', periodo: '2026-B', historico: false,
  to: (path) => path,
  toDesde: (path, params) => `${path}?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined))}`,
}
const clase = (id, horaInicio, horaFin, extra = {}) => ({
  id, fecha: '2026-10-28', horaInicio, horaFin, estado: 'PROGRAMADA', elegible: true,
  materia: { nombre: `Materia ${id}` }, docente: { nombre: 'Laura Martínez' },
  grupo: { nombre: '103-SA', modalidad: 'ESCOLARIZADO' }, aula: { nombre: 'Aula 4' },
  ...extra,
})
const clases = [
  clase('a', '08:00', '09:00', { estado: 'LISTA_COMPLETA' }),
  clase('b', '09:00', '10:00', { estado: 'SIN_CAPTURA' }),
  clase('c', '11:00', '12:00'),
  clase('d', '13:00', '14:00'),
  clase('e', '16:00', '17:00'),
]
const vista = (contexto = j) => <MemoryRouter><HoyEnLaCarrera j={contexto} /></MemoryRouter>
const hora = (hhmm) => vi.setSystemTime(new Date(`2026-10-28T${hhmm}:00-06:00`))

beforeEach(() => {
  vi.useFakeTimers()
  hora('10:40')
  useClases.mockReturnValue({ clases, cargando: false, error: '', reintentar: vi.fn() })
})
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

describe('clase destacada en el inicio de jefatura', () => {
  it('muestra solo la próxima clase, expande las demás en orden y permite volver a contraer', () => {
    render(vista())
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(within(screen.getByRole('article')).getByRole('heading').textContent).toBe('Materia c')
    expect(screen.getByText('Próxima clase · En 20 minutos')).toBeTruthy()
    const boton = screen.getByRole('button', { name: 'Ver las otras 4 clases' })
    expect(boton.getAttribute('aria-expanded')).toBe('false')
    expect(document.getElementById(boton.getAttribute('aria-controls')).hidden).toBe(true)
    fireEvent.click(boton)
    expect(screen.getAllByRole('article')).toHaveLength(5)
    expect(screen.getAllByRole('article').slice(1).map((a) => within(a).getByRole('heading').textContent)).toEqual(['Materia a', 'Materia b', 'Materia d', 'Materia e'])
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar solo la clase destacada' }))
    expect(screen.getAllByRole('article')).toHaveLength(1)
  })

  it('prioriza la clase en horario aunque aún no haya evidencia de registro', () => {
    hora('09:30'); render(vista())
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(within(screen.getByRole('article')).getByRole('heading').textContent).toBe('Materia b')
    expect(screen.getByText('En curso · según horario')).toBeTruthy()
    expect(within(screen.getByRole('article')).getByText('Sin captura')).toBeTruthy()
  })

  it('actualiza la próxima clase al llegar la hora sin recargar la página', () => {
    hora('10:59'); render(vista())
    expect(screen.getByText('Próxima clase · En 1 minuto')).toBeTruthy()
    act(() => vi.advanceTimersByTime(60000))
    expect(screen.getByText('En curso · según horario')).toBeTruthy()
    expect(screen.getAllByRole('article')).toHaveLength(1)
  })

  it('muestra la última clase al terminar el día y no destaca sesiones suspendidas', () => {
    hora('22:24')
    useClases.mockReturnValue({ clases: [...clases, clase('suspendida', '18:00', '19:00', { estado: 'SUSPENDIDA' })] })
    render(vista())
    expect(within(screen.getByRole('article')).getByRole('heading').textContent).toBe('Materia e')
    expect(screen.getByText('Última clase del día')).toBeTruthy()
    expect(screen.getByText(/La jornada terminó/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ver las otras 4 clases' }))
    expect(screen.queryByRole('heading', { name: 'Materia suspendida' })).toBeNull()
    expect(screen.getByText('5 clases programadas · 1 suspendida')).toBeTruthy()
  })

  it('abre el detalle real y conserva la modalidad Mixto y la fecha', () => {
    useClases.mockReturnValue({ clases: [clase('mixto', '11:00', '12:00', { grupo: { nombre: '103-M', modalidad: 'MIXTO' } })] })
    render(vista())
    expect(screen.queryByRole('button')).toBeNull()
    const enlace = within(screen.getByRole('article')).getByRole('link')
    const params = new URL(enlace.getAttribute('href'), 'https://sicat.test').searchParams
    expect(params.get('clase')).toBe('mixto')
    expect(params.get('fecha')).toBe('2026-10-28')
    expect(params.get('modalidad')).toBe('MIXTO')
  })

  it('mantiene el día institucional y reinicia la expansión al cambiar de carrera', () => {
    hora('22:24')
    const { rerender } = render(vista())
    expect(useClases).toHaveBeenCalledWith(expect.objectContaining({ desde: '2026-10-28', hasta: '2026-10-28' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ver las otras 4 clases' }))
    rerender(vista({ ...j, carreraId: 'otra' }))
    expect(screen.getAllByRole('article')).toHaveLength(1)
  })

  it('conserva los estados vacío, de error con reintento e histórico', () => {
    useClases.mockReturnValue({ clases: [] })
    const { rerender } = render(vista())
    expect(screen.getByText('Hoy no hay clases programadas en la carrera.')).toBeTruthy()
    const reintentar = vi.fn()
    useClases.mockReturnValue({ clases: null, error: 'Sin conexión', reintentar })
    rerender(vista())
    expect(screen.getByRole('alert').textContent).toContain('Sin conexión')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(reintentar).toHaveBeenCalledOnce()
    rerender(vista({ ...j, historico: true }))
    expect(screen.queryByRole('heading', { name: 'Clases de hoy' })).toBeNull()
  })
})

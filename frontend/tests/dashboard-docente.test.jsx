import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../src/api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
vi.mock('../src/components/PeriodoEscolarCard', () => ({ default: () => null }))

import api from '../src/api/axios'
import DashboardDocente from '../src/pages/docente/DashboardDocente'
import { useAuthStore } from '../src/store/authStore'

const clase = {
  horarioId: 5,
  materia: { nombre: 'Matemáticas' },
  grupo: { nombre: '103A' },
  aula: { nombre: 'A1' },
  horaInicio: '08:00',
  horaFin: '10:00',
  dentroDeHorario: false,
  sesion: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: { nombre: 'Laura Pérez', rol: 'DOCENTE' } })
})

test('un festivo institucional se anuncia arriba y deja la agenda sin pase de lista', async () => {
  api.get.mockResolvedValue({ data: {
    suspensionHoy: { fecha: '2026-09-16', motivo: 'Independencia', institucional: true },
    proximasSuspensiones: [{ fecha: '2026-11-02', motivo: 'Día de muertos', institucional: true }],
    claseActual: null,
    proximaClase: null,
    clasesHoy: [{ ...clase, estado: 'SUSPENDIDA', suspensionMotivo: 'Independencia' }],
    resumen: { materias: 1, clasesHoy: 0, listasPendientes: 0 },
    pendientes: {},
    materias: [],
  } })
  render(<MemoryRouter><DashboardDocente /></MemoryRouter>)

  const aviso = await screen.findByRole('status')
  expect(aviso.textContent).toContain('Hoy no hay clases')
  expect(aviso.textContent).toContain('Independencia')
  expect(aviso.textContent).toContain('marcada por la institución')
  expect(screen.getByText('Sin clases')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Pasar lista' })).toBeNull()
  expect(screen.getByText(/Día de muertos/).textContent).toContain('institución')
})

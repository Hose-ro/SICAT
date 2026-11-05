import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '@/api/axios'
import { descargarArchivo } from '@/lib/descargas'
import ReporteAcademico from '@/pages/jefe-carrera/components/ReporteAcademico'
vi.mock('@/api/axios', () => ({ default: { get: vi.fn() } }))
vi.mock('@/lib/descargas', () => ({ descargarArchivo: vi.fn(), mensajeDeBlob: vi.fn(async () => null) }))
const j = { carreraId: '1', periodo: '2026-B' }
const resumen = {
  grupos: [
    { id: 8, nombre: '1A' },
    { id: 9, nombre: '3A' },
  ],
  ofertas: [
    { grupo: { id: 8 }, materia: { id: 411, nombre: 'Cálculo' }, unidades: [{ id: 1, orden: 1, nombre: 'Límites' }] },
    { grupo: { id: 9 }, materia: { id: 412, nombre: 'Programación' }, unidades: [] },
  ],
}
const datos = {
  generadoEn: '2026-11-04T15:00:00Z',
  materia: { nombre: 'Cálculo' },
  grupo: { nombre: '1A' },
  unidadId: 1,
  unidades: [{ id: 1, orden: 1 }],
  avance: { cerradas: 1, total: 2, porcentaje: 50, unidades: [] },
  resumen: { promedio: 0, asistencia: null },
  nota: 'Promedio solo con calificación.',
  filas: [
    {
      alumno: { id: 10, nombre: 'Ana', sexo: 'MUJER', numeroControl: '2210' },
      notas: [{ unidadId: 1, calificacion: 0, tipo: 'REAL' }],
      promedio: 0,
      provisional: false,
      asistencia: { registradas: 0, porcentaje: null },
      pendientes: 0,
    },
  ],
}
beforeEach(() => {
  vi.clearAllMocks()
  api.get.mockResolvedValue({ data: datos })
})
function abrir() {
  render(
    <MemoryRouter>
      <ReporteAcademico j={j} resumen={resumen} />
    </MemoryRouter>,
  )
}
const elegir = () => {
  fireEvent.change(screen.getByLabelText('Grupo', { exact: true }), { target: { value: '8' } })
  fireEvent.change(screen.getByLabelText('Materia', { exact: true }), { target: { value: '411' } })
}
describe('consulta académica de jefatura', () => {
  it('limita materias al grupo y exporta el mismo alcance por unidad', async () => {
    abrir()
    elegir()
    expect(screen.queryByRole('option', { name: 'Programación' })).toBeNull()
    fireEvent.change(screen.getByLabelText('Alcance', { exact: true }), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar reporte' }))
    await screen.findByRole('button', { name: 'PDF institucional' })
    expect(screen.getByRole('rowheader', { name: /Ana/ }).textContent).toContain('MAna')
    api.get.mockResolvedValueOnce({ data: new Blob(['PDF']), headers: {} })
    fireEvent.click(screen.getByRole('button', { name: 'PDF institucional' }))
    await waitFor(() => expect(descargarArchivo).toHaveBeenCalled())
    expect(api.get).toHaveBeenLastCalledWith(
      '/jefe-carrera/calificaciones/exportar',
      expect.objectContaining({
        params: { carreraId: '1', periodo: '2026-B', grupoId: '8', materiaId: '411', unidadId: '1', formato: 'pdf' },
      }),
    )
    fireEvent.change(screen.getByLabelText('Grupo', { exact: true }), { target: { value: '9' } })
    expect(screen.getByLabelText('Materia', { exact: true }).value).toBe('')
    expect(screen.queryByRole('button', { name: 'PDF institucional' })).toBeNull()
  })
  it('ignora la respuesta de un grupo anterior si cambia la selección', async () => {
    let resolver
    api.get.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolver = r
        }),
    )
    abrir()
    elegir()
    fireEvent.click(screen.getByRole('button', { name: 'Consultar reporte' }))
    fireEvent.change(screen.getByLabelText('Grupo', { exact: true }), { target: { value: '9' } })
    await act(async () => resolver({ data: datos }))
    expect(screen.queryByRole('button', { name: 'PDF institucional' })).toBeNull()
  })
  it('muestra el error de consulta y permite reintentar', async () => {
    api.get.mockRejectedValueOnce(new Error('Sin conexión'))
    abrir()
    elegir()
    fireEvent.click(screen.getByRole('button', { name: 'Consultar reporte' }))
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: 'Excel institucional' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Consultar reporte' }))
    await screen.findByRole('button', { name: 'Excel institucional' })
  })
})

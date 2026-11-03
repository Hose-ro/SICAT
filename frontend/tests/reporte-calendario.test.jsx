import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '@/api/axios'
import ReporteAsistenciasCalendario from '@/pages/docente/components/ReporteAsistenciasCalendario'

vi.mock('@/api/axios', () => ({ default: { get: vi.fn() } }))
const grupos = [{ id: 1, nombre: '103A' }, { id: 2, nombre: '301M', modalidad: 'MIXTO' }]
const materias = [{ id: 10, nombre: 'Cálculo', clave: 'MAT-10' }]
const unidades = [{ id: 101, nombre: 'Unidad 1' }, { id: 102, nombre: 'Unidad 2' }]
function respuesta(params) {
  return {
    grupos,
    materias: params.grupoId ? (params.grupoId === '1' ? materias : [{ id: 20, nombre: 'Programación' }]) : [],
    unidades: params.materiaId ? unidades : [],
    fechasClase: params.unidadId === '101' ? ['2026-09-10', '2026-09-14'] : [],
    diasClase: params.unidadId === '101' ? [{ fecha: '2026-09-10', sesiones: 2 }, { fecha: '2026-09-14', sesiones: 1 }] : [],
  }
}
beforeEach(() => {
  vi.clearAllMocks()
  api.get.mockImplementation(async (_url, { params }) => ({ data: respuesta(params) }))
})
async function elegir(campo, valor) {
  await waitFor(() => expect(screen.getByRole('combobox', { name: campo }).disabled).toBe(false))
  fireEvent.change(screen.getByRole('combobox', { name: campo }), { target: { value: valor } })
}
async function abrirUnidad() {
  await elegir('Grupo', '1')
  await elegir('Materia', '10')
  await elegir('Unidad', '101')
  await screen.findByRole('button', { name: /10 de septiembre de 2026: ver reporte de 2 sesiones/ })
}

describe('reporte de asistencias por grupo, materia, unidad y día', () => {
  it('solicita opciones en orden y abre exactamente el día seleccionado con su unidad y grupo', async () => {
    const onVer = vi.fn()
    render(<ReporteAsistenciasCalendario onVer={onVer} />)
    expect(screen.getByRole('combobox', { name: 'Materia' }).disabled).toBe(true)
    expect(screen.getByRole('combobox', { name: 'Unidad' }).disabled).toBe(true)
    await abrirUnidad()
    expect(api.get).toHaveBeenLastCalledWith('/asistencias/filtros-disponibles', expect.objectContaining({ params: { orden: 'grupo', grupoId: '1', materiaId: '10', unidadId: '101' } }))
    expect(screen.getByRole('button', { name: /11 de septiembre de 2026: sin sesiones/ }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /10 de septiembre de 2026: ver reporte/ }))
    expect(onVer).toHaveBeenCalledWith(expect.objectContaining({ materiaId: '10', opciones: { grupoId: '1', unidadId: '101', fecha: '2026-09-10' } }))
  })

  it('al cambiar de grupo borra materia, unidad y calendario y ofrece solo las materias recibidas', async () => {
    render(<ReporteAsistenciasCalendario onVer={vi.fn()} />)
    await abrirUnidad()
    await elegir('Grupo', '2')
    await screen.findByRole('option', { name: 'Programación' })
    expect(screen.getByRole('combobox', { name: 'Materia' }).value).toBe('')
    expect(screen.getByRole('combobox', { name: 'Unidad' }).value).toBe('')
    expect(within(screen.getByRole('combobox', { name: 'Materia' })).queryByRole('option', { name: /Cálculo/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /10 de septiembre de 2026/ })).toBeNull()
  })

  it('una respuesta atrasada no vuelve a habilitar fechas de la unidad anterior', async () => {
    let resolver
    const onVer = vi.fn()
    api.get.mockImplementation((_url, { params }) => params.unidadId === '101'
      ? new Promise((resolve) => { resolver = resolve }) : Promise.resolve({ data: respuesta(params) }))
    render(<ReporteAsistenciasCalendario onVer={onVer} />)
    await elegir('Grupo', '1'); await elegir('Materia', '10'); await elegir('Unidad', '101')
    // Cambio rápido de grupo: la consulta anterior todavía está en vuelo.
    await elegir('Grupo', '2')
    await screen.findByRole('option', { name: 'Programación' })
    await act(async () => resolver({ data: respuesta({ grupoId: '1', materiaId: '10', unidadId: '101' }) }))
    expect(screen.queryByRole('button', { name: /ver reporte de/ })).toBeNull()
    expect(onVer).not.toHaveBeenCalled()
  })

  it('distingue una unidad sin sesiones y permite reintentar un fallo de consulta', async () => {
    render(<ReporteAsistenciasCalendario onVer={vi.fn()} />)
    await elegir('Grupo', '1'); await elegir('Materia', '10'); await elegir('Unidad', '102')
    await screen.findByText(/No hay sesiones registradas para esta unidad y grupo/)
    api.get.mockRejectedValueOnce({ response: { data: { message: 'Servicio temporalmente no disponible' } } })
    await elegir('Unidad', '101')
    expect(await screen.findByRole('alert')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await screen.findByRole('button', { name: /10 de septiembre de 2026: ver reporte/ })
  })
})

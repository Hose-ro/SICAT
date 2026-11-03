import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Informe } from '@/pages/jefe-carrera/JefeReportes'
import api from '@/api/axios'
import { descargarArchivo } from '@/lib/descargas'

vi.mock('@/api/axios', () => ({ default: { get: vi.fn() } }))
vi.mock('@/lib/descargas', () => ({ descargarArchivo: vi.fn(), mensajeDeBlob: vi.fn(async () => null) }))

const j = { carreraId: '1', periodo: '2026-B', carrera: { codigo: 'ISC', nombre: 'Sistemas' } }
const resumen = { calendarios: [{ inicio: '2026-08-24T12:00:00', fin: '2026-12-12T12:00:00' }] }
const datos = {
  carrera: { nombre: 'Sistemas', codigo: 'ISC' }, periodo: '2026-B',
  generadoEn: '2026-11-03T12:00:00', intervalo: { desde: '2026-10-01', hasta: '2026-10-31' },
  totales: { clasesEsperadas: 10, listasCompletas: 8, listasPendientes: 2, cobertura: 80, seguimientos: 1, calificacionesPendientes: 3, alumnosRiesgo: 1 },
  docentes: [{ nombre: 'Laura', horasSemanales: 10, esperadas: 10, completas: 8, parciales: 1, sinCaptura: 1, tardias: 0, cobertura: 80 }],
  listasPendientes: [], avance: [], seguimientos: [],
  riesgos: [{ nombre: 'Ana', sexo: 'MUJER', numeroControl: '221100', grupos: ['1A'], materias: ['Cálculo'], motivos: ['Inasistencias'] }],
}
function URLActual() { return <output aria-label="URL">{useLocation().search}</output> }
const abrir = (query = '?desde=2026-10-01&hasta=2026-10-31') => render(<MemoryRouter initialEntries={[`/reportes${query}`]}><Informe j={j} resumen={resumen} /><URLActual /></MemoryRouter>)
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('requestAnimationFrame', (fn) => fn())
  api.get.mockImplementation(async (path) => path.endsWith('/exportar') ? { data: new Blob(['PDF']), headers: {} } : { data: datos })
})

describe('informe guiado de jefatura', () => {
  it('respeta el paso de preparación al recargar aunque exista una sección en la URL', () => {
    abrir('?desde=2026-10-01&hasta=2026-10-31&paso=0&seccion=riesgo')
    expect(screen.getByRole('button', { name: 'Revisar informe' })).toBeTruthy()
    expect(api.get).not.toHaveBeenCalled()
  })
  it('prepara sin consultar, revisa una tabla y exporta la selección con sus fechas', async () => {
    abrir()
    expect(api.get).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('checkbox', { name: /Observaciones de seguimiento/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Revisar informe' }))
    await screen.findByLabelText('Sección que estás revisando')
    fireEvent.change(screen.getByLabelText('Sección que estás revisando'), { target: { value: 'riesgo' } })
    expect(screen.getByRole('cell', { name: /Ana/ }).textContent).toBe('MAna')
    expect(screen.queryByRole('cell', { name: 'Laura' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Elegir descarga' }))
    fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF', exact: true }))
    await waitFor(() => expect(descargarArchivo).toHaveBeenCalled())
    expect(api.get).toHaveBeenLastCalledWith('/jefe-carrera/informe/exportar', expect.objectContaining({ params: { carreraId: '1', periodo: '2026-B', desde: '2026-10-01', hasta: '2026-10-31', formato: 'pdf', secciones: 'cobertura,listas,avance,riesgo' } }))
    expect(api.get.mock.calls.filter(([path]) => path.endsWith('/informe'))).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Volver a revisar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Editar contenido' }))
    expect(screen.getByRole('checkbox', { name: /Observaciones de seguimiento/ }).checked).toBe(false)
  })

  it('bloquea fechas invertidas y ausencia de secciones', () => {
    abrir()
    fireEvent.input(screen.getByLabelText('Desde', { exact: true }), { target: { value: '2026-11-01' } })
    expect(screen.getByRole('alert').textContent).toContain('La fecha final')
    expect(screen.getByRole('button', { name: 'Revisar informe' }).disabled).toBe(true)
    fireEvent.input(screen.getByLabelText('Desde', { exact: true }), { target: { value: '2026-10-01' } })
    screen.getAllByRole('checkbox').forEach((checkbox) => fireEvent.click(checkbox))
    expect(screen.getByRole('button', { name: 'Revisar informe' }).disabled).toBe(true)
    expect(api.get).not.toHaveBeenCalled()
  })

  it('recupera enlaces con sección y selección, y permite reintentar un error de consulta', async () => {
    api.get.mockRejectedValueOnce(new Error('Sin conexión'))
    abrir('?desde=2026-10-01&hasta=2026-10-31&seccion=riesgo&secciones=riesgo')
    await screen.findByRole('button', { name: 'Reintentar' })
    expect(screen.getByRole('button', { name: 'Elegir descarga' }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await screen.findByRole('cell', { name: /Ana/ })
    expect(screen.getByLabelText('Sección que estás revisando').options).toHaveLength(2)
  })

  it('no reutiliza la respuesta anterior mientras carga otro intervalo', async () => {
    abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Revisar informe' }))
    await screen.findByLabelText('Sección que estás revisando')
    fireEvent.click(screen.getByRole('button', { name: 'Editar contenido' }))
    fireEvent.input(screen.getByLabelText('Hasta', { exact: true }), { target: { value: '2026-10-20' } })
    let resolver
    api.get.mockImplementationOnce(() => new Promise((r) => { resolver = r }))
    fireEvent.click(screen.getByRole('button', { name: 'Revisar informe' }))
    expect(screen.queryByLabelText('Sección que estás revisando')).toBeNull()
    expect(screen.getByRole('button', { name: 'Elegir descarga' }).disabled).toBe(true)
    await act(async () => resolver({ data: { ...datos, intervalo: { ...datos.intervalo, hasta: '2026-10-20' } } }))
    expect(screen.getByRole('button', { name: 'Elegir descarga' }).disabled).toBe(false)
  })

  it('informa una descarga fallida y permite volver a descargar', async () => {
    abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Revisar informe' }))
    await screen.findByLabelText('Sección que estás revisando')
    fireEvent.click(screen.getByRole('button', { name: 'Elegir descarga' }))
    api.get.mockRejectedValueOnce(new Error('Sin conexión'))
    fireEvent.click(screen.getByRole('button', { name: 'Descargar Excel' }))
    await screen.findByRole('alert')
    expect(descargarArchivo).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Descargar Excel' }).disabled).toBe(false)
  })
})

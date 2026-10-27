import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../src/api/axios', () => ({ default: { get: vi.fn() } }))
vi.mock('../src/lib/descargas', () => ({
  descargarArchivo: vi.fn(),
  mensajeDeBlob: vi.fn().mockResolvedValue(null),
}))

import api from '../src/api/axios'
import { descargarArchivo } from '../src/lib/descargas'
import ReporteParcialSemestre from '../src/pages/ReporteParcialSemestre'
import { useAuthStore } from '../src/store/authStore'

const conteo = (hombres, mujeres, sinDato = 0) => ({
  hombres,
  mujeres,
  sinDato,
  total: hombres + mujeres + sinDato,
})
const reporte = {
  institucion: 'Instituto Tecnológico Superior de Cosamaloapan',
  area: 'Subdirección Académica',
  formato: 'Reporte parcial del semestre',
  version: 2,
  carrera: {
    id: 3,
    nombre: 'Ingeniería en Sistemas Computacionales',
    codigo: 'ISC',
  },
  docente: { id: 8, nombre: 'Laura Pérez' },
  periodo: '2026-B',
  periodoTexto: 'AGOSTO - DICIEMBRE 2026',
  jefeDivision: { id: 2, nombre: 'María Hernández' },
  intervalo: { desde: '2026-08-31', hasta: '2026-10-24' },
  gruposAtendidos: 1,
  asignaturasDiferentes: 1,
  filas: [
    {
      materia: { id: 4, nombre: 'Redes de computadoras', clave: 'SCD-1021' },
      unidad: { id: 9, orden: 1, nombre: 'Unidad 1', status: 'ACTIVA' },
      semestre: 5,
      grupo: { id: 6, nombre: '503-A' },
      total: conteo(15, 6),
      po: conteo(12, 5),
      so: conteo(1, 0),
      acreditados: conteo(13, 5),
      porcentajeAcreditados: conteo(87, 83),
      noAcreditados: conteo(2, 1),
      porcentajeNoAcreditados: conteo(13, 17),
      desertores: conteo(0, 0),
      porcentajeDesertores: conteo(0, 0),
      pendientes: 1,
    },
  ],
  totales: {
    total: conteo(15, 6),
    po: conteo(12, 5),
    so: conteo(1, 0),
    acreditados: conteo(13, 5),
    porcentajeAcreditados: conteo(87, 83),
    noAcreditados: conteo(2, 1),
    porcentajeNoAcreditados: conteo(13, 17),
    desertores: conteo(0, 0),
    porcentajeDesertores: conteo(0, 0),
    pendientes: 1,
  },
  notas: ['A = alumnos inscritos.', 'Una lista sin captura no clasifica deserción.'],
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({
    user: { id: 8, nombre: 'Laura Pérez', rol: 'DOCENTE' },
  })
})

test('el docente puede ver el formato institucional antes de descargarlo', async () => {
  api.get.mockImplementation((url) => {
    if (url.endsWith('/contexto'))
      return Promise.resolve({
        data: {
          rol: 'DOCENTE',
          periodo: '2026-B',
          carreras: [reporte.carrera],
          docentes: [{ id: 8, nombre: 'Laura Pérez', carreraIds: [3] }],
          seleccion: { carreraId: 3, docenteId: 8 },
        },
      })
    return Promise.resolve({ data: reporte })
  })
  render(
    <MemoryRouter>
      <ReporteParcialSemestre />
    </MemoryRouter>,
  )

  expect(await screen.findByText('Redes de computadoras')).toBeTruthy()
  expect(screen.getAllByText('Instituto Tecnológico Superior de Cosamaloapan').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Laura Pérez').length).toBeGreaterThan(0)
  expect(screen.getByText('María Hernández')).toBeTruthy()
  expect(screen.getByText('Jefe(a) de división')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Descargar PDF' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Descargar Excel' })).toBeTruthy()
})

test('la jefatura respeta el docente de la ficha y descarga el mismo reporte visible', async () => {
  useAuthStore.setState({
    user: { id: 2, nombre: 'Jefatura', rol: 'JEFE_CARRERA' },
  })
  api.get.mockImplementation((url, options) => {
    if (url.endsWith('/contexto'))
      return Promise.resolve({
        data: {
          rol: 'JEFE_CARRERA',
          periodo: '2026-B',
          carreras: [reporte.carrera],
          docentes: [{ id: 8, nombre: 'Laura Pérez', carreraIds: [3] }],
          seleccion: { carreraId: 3, docenteId: null },
        },
      })
    if (url.endsWith('/exportar'))
      return Promise.resolve({
        data: new Blob(['xlsx']),
        headers: {
          'content-disposition': 'attachment; filename="reporte.xlsx"',
        },
      })
    expect(options.params).toEqual({ carreraId: '3', docenteId: '8' })
    return Promise.resolve({ data: reporte })
  })
  render(
    <MemoryRouter initialEntries={['/reportes/parcial-semestre?carreraId=3&docenteId=8']}>
      <ReporteParcialSemestre />
    </MemoryRouter>,
  )

  expect((await screen.findByRole('combobox', { name: 'Docente' })).value).toBe('8')
  await userEvent.click(screen.getByRole('button', { name: 'Descargar Excel' }))
  await waitFor(() => expect(descargarArchivo).toHaveBeenCalledWith(expect.any(Blob), 'reporte.xlsx'))
  expect(api.get).toHaveBeenCalledWith(
    '/reportes/parcial-semestre/exportar',
    expect.objectContaining({
      params: { carreraId: '3', docenteId: '8', formato: 'excel' },
    }),
  )
})

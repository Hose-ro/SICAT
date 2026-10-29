import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MiPerfil from '@/pages/MiPerfil'
import EncabezadoDocente from '@/pages/jefe-carrera/components/EncabezadoDocente'
import api from '@/api/axios'
import { useAuthStore } from '@/store/authStore'
import './setup'

vi.mock('@/api/axios', () => ({ default: { get: vi.fn(), patch: vi.fn() } }))
vi.mock('@/components/CambiarPasswordForm', () => ({ default: () => null }))
vi.mock('@/pages/jefe-carrera/supervision/Seguimiento', () => ({ BotonSeguimiento: () => <button>Registrar observación</button> }))
vi.mock('@/lib/feedback', () => ({ notify: vi.fn(), confirmAction: vi.fn() }))
const docente = { id: 2, nombre: 'Edgar Lopez Aguirre', rol: 'DOCENTE', email: 'edgar@example.com', telefono: '4421234567', alias: null, pertenencia: 'Imparte en esta carrera' }
beforeEach(() => { vi.clearAllMocks(); useAuthStore.setState({ user: docente }); api.get.mockResolvedValue({ data: docente }) })

describe('alias en edición y encabezado', () => {
  it('permite añadir y eliminar el alias sin cambiar el nombre', async () => {
    api.patch.mockImplementation(async (_url, payload) => ({ data: { ...docente, ...payload } }))
    render(<MemoryRouter><MiPerfil /></MemoryRouter>)
    const alias = await screen.findByLabelText('Alias (opcional)')
    fireEvent.change(alias, { target: { value: '  Profe Edgar  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/usuarios/perfil', { alias: 'Profe Edgar' }))
    await waitFor(() => expect(useAuthStore.getState().user.alias).toBe('Profe Edgar'))
    fireEvent.change(alias, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(api.patch).toHaveBeenLastCalledWith('/usuarios/perfil', { alias: null }))
    expect(screen.getByLabelText('Nombre completo').value).toBe('Edgar Lopez Aguirre')
  })
  it('no muestra el campo de alias al alumno', async () => {
    api.get.mockResolvedValue({ data: { ...docente, rol: 'ALUMNO' } })
    render(<MemoryRouter><MiPerfil /></MemoryRouter>)
    await screen.findByLabelText('Nombre completo')
    expect(screen.queryByLabelText('Alias (opcional)')).toBeNull()
  })
  it('muestra el alias encima del nombre y conserva la identidad completa', () => {
    const { container } = render(<MemoryRouter><EncabezadoDocente docente={{ ...docente, alias: 'Profe Edgar' }} j={{ carreraId: 1 }} /></MemoryRouter>)
    const alias = screen.getByText('Profe Edgar')
    const heading = screen.getByRole('heading', { level: 1, name: docente.nombre })
    expect(Boolean(alias.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
    expect(container.querySelectorAll('h1')).toHaveLength(1)
    expect(screen.queryByText('Perfil docente')).toBeNull()
    expect(screen.getByRole('link', { name: /Ver reporte parcial/ }).getAttribute('href')).toContain('docenteId=2')
  })
  it('oculta el espacio del alias cuando está vacío', () => {
    const { container } = render(<MemoryRouter><EncabezadoDocente docente={{ ...docente, alias: '   ' }} j={{ carreraId: 1 }} /></MemoryRouter>)
    expect(container.querySelector('.docente-perfil-alias')).toBeNull()
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy()
  })
})

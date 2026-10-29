import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContactoDocente from '@/pages/jefe-carrera/components/ContactoDocente'
import api from '@/api/axios'
import { actualizarJefatura } from '@/pages/jefe-carrera/supervision/actualizar'
import './setup'

vi.mock('@/api/axios', () => ({ default: { patch: vi.fn() } }))
vi.mock('@/pages/jefe-carrera/supervision/actualizar', () => ({ actualizarJefatura: vi.fn() }))
const docente = { id: 37, nombre: 'Laura Méndez', telefono: null }
const j = { carreraId: 1, periodo: '2026-B', historico: false }
beforeEach(() => vi.clearAllMocks())

describe('contacto del docente', () => {
  it('usa el teléfono registrado y normaliza un número mexicano sin prefijo', () => {
    render(<ContactoDocente docente={{ ...docente, telefono: '442 123 4567' }} j={j} />)
    expect(screen.getByRole('link', { name: /Abrir WhatsApp con Laura/ }).getAttribute('href')).toBe('https://wa.me/524421234567')
    expect(screen.getByText('+52 442 123 4567')).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
  })
  it('normaliza el antiguo prefijo móvil mexicano sin duplicar +52', () => {
    render(<ContactoDocente docente={{ ...docente, telefono: '+52 1 442 123 4567' }} j={j} />)
    expect(screen.getByRole('link').getAttribute('href')).toBe('https://wa.me/524421234567')
  })
  it('guarda el número faltante, refresca los datos y habilita WhatsApp', async () => {
    api.patch.mockResolvedValue({ data: { id: 37, telefono: '+524421234567' } })
    render(<ContactoDocente docente={docente} j={j} />)
    expect(screen.getByText('Agrega su número telefónico')).toBeTruthy()
    expect(screen.getByText('+52')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Guardar número' }).disabled).toBe(true)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '4421234567' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar número' }))
    await waitFor(() => expect(screen.getByRole('link').getAttribute('href')).toBe('https://wa.me/524421234567'))
    expect(api.patch).toHaveBeenCalledWith('/jefe-carrera/docentes/37/telefono', { telefono: '+524421234567' }, { params: { carreraId: 1, periodo: '2026-B' } })
    expect(actualizarJefatura).toHaveBeenCalledWith(1, '2026-B')
  })
  it('conserva el número si falla el guardado y permite reintentar', async () => {
    api.patch.mockRejectedValue({ response: { data: { message: 'Sin conexión' } } })
    render(<ContactoDocente docente={docente} j={j} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '4421234567' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar número' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Sin conexión'))
    expect(screen.getByRole('textbox').value).toBe('4421234567')
    expect(screen.getByRole('button', { name: 'Guardar número' }).disabled).toBe(false)
    expect(actualizarJefatura).not.toHaveBeenCalled()
  })
  it('no permite registrar teléfonos desde un periodo histórico', () => {
    render(<ContactoDocente docente={docente} j={{ ...j, historico: true }} />)
    expect(screen.getByRole('textbox').disabled).toBe(true)
    expect(screen.getByRole('button').disabled).toBe(true)
  })
})

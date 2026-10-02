import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../src/api/axios', () => ({
  default: { get: vi.fn(), put: vi.fn(), defaults: { baseURL: 'https://api.sicatapp.com/api' } },
}))
import api from '../src/api/axios'
import CompartirWhatsapp from '../src/components/whatsapp/CompartirWhatsapp'
import { contenidoTarea, nombreDocumentoTarea } from '../src/lib/documentoTarea'
import { enlaceWaMe, mensajeAviso, mensajeRecordatorio, mensajeTareaNueva } from '../src/lib/whatsapp'
import { abrirCompartirWhatsapp, cerrarCompartirWhatsapp } from '../src/store/compartirWhatsappStore'

const tarea = {
  id: 9,
  materiaId: 12,
  grupoId: 3,
  titulo: 'Práctica de subredes',
  instrucciones: 'Resuelve los 5 ejercicios.\n\nEntrega en PDF.',
  tipoEntrega: 'EN_LINEA',
  permiteReenvio: true,
  tieneFechaLimite: true,
  fechaLimite: new Date(2026, 9, 6, 23, 59).toISOString(),
  materia: { id: 12, nombre: 'Redes', clave: 'RED-01' },
  grupo: { id: 3, nombre: '103A' },
  unidadRef: { orden: 2, nombre: 'Direccionamiento' },
  rubricJson: JSON.stringify([{ criterio: 'Cálculos', peso: 70 }, { criterio: 'Presentación', peso: 30 }]),
  archivos: [{ nombre: 'tabla.xlsx' }],
}

describe('mensajes', () => {
  test('tarea nueva: corta, con fecha y aviso del documento', () => {
    expect(mensajeTareaNueva(tarea)).toBe([
      '📚 *Nueva tarea* · Redes (103A)',
      '*Práctica de subredes*',
      '📅 Entrega: martes 6 de octubre, 23:59',
      '📝 Entrega con archivo',
      'Las instrucciones completas van en el documento adjunto.',
    ].join('\n'))
    expect(mensajeTareaNueva({ ...tarea, tieneFechaLimite: false }, { conDocumento: false }))
      .toContain('📅 Entrega: sin fecha límite')
  })

  test('recordatorio según los días que faltan', () => {
    expect(mensajeRecordatorio(tarea, new Date(2026, 9, 2, 10))).toContain('Faltan *4 días* para entregar *Práctica de subredes* (martes 6 de octubre, 23:59).')
    expect(mensajeRecordatorio(tarea, new Date(2026, 9, 5, 10))).toContain('vence *mañana*')
    expect(mensajeRecordatorio(tarea, new Date(2026, 9, 6, 10))).toContain('vence *hoy* a las 23:59.')
    expect(mensajeRecordatorio(tarea, new Date(2026, 9, 8, 10))).toContain('venció')
    expect(mensajeRecordatorio(tarea, new Date(2026, 9, 2), { conDocumento: true })).toContain('documento adjunto')
  })

  test('aviso y enlace de wa.me', () => {
    expect(mensajeAviso({ titulo: 'Sin clase', cuerpo: 'Mañana no hay clase.' }, 'Redes', '103A'))
      .toBe('📢 *Aviso* · Redes (103A)\n*Sin clase*\nMañana no hay clase.')
    expect(enlaceWaMe('Hola & adiós')).toBe('https://wa.me/?text=Hola%20%26%20adi%C3%B3s')
  })
})

test('el documento lleva los datos, la rúbrica y los adjuntos', () => {
  const c = contenidoTarea(tarea, { docente: 'Jose' })
  expect(Object.fromEntries(c.datos)).toMatchObject({
    Materia: 'Redes (RED-01)',
    Grupo: '103A',
    Docente: 'Jose',
    Unidad: 'Unidad 2: Direccionamiento',
    Entrega: 'Entrega con archivo · se puede reenviar',
  })
  expect(c.rubrica).toEqual([{ criterio: 'Cálculos', peso: 70 }, { criterio: 'Presentación', peso: 30 }])
  expect(c.adjuntos).toEqual(['tabla.xlsx'])
  expect(nombreDocumentoTarea({ ...tarea, titulo: 'Tarea 1: ¿qué/es?' }, 'docx')).toBe('Tarea - Tarea 1 ¿quées - 103A.docx')
})

describe('diálogo', () => {
  let user
  const generarArchivo = vi.fn((formato) => Promise.resolve(new File(['x'], `Tarea.${formato}`, { type: 'application/octet-stream' })))

  beforeEach(() => {
    vi.clearAllMocks()
    user = userEvent.setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    vi.spyOn(window, 'open').mockReturnValue(null)
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    api.get.mockResolvedValue({ data: { enlace: null } })
    api.put.mockImplementation((_url, body) => Promise.resolve({ data: { enlace: body.enlace || null } }))
  })

  afterEach(() => {
    act(() => cerrarCompartirWhatsapp())
    delete navigator.canShare
    delete navigator.share
  })

  const abrir = () => {
    render(<CompartirWhatsapp />)
    act(() => abrirCompartirWhatsapp({
      titulo: 'Compartir tarea por WhatsApp', materiaId: 12, grupoId: 3,
      texto: (conDocumento) => mensajeTareaNueva(tarea, { conDocumento }), generarArchivo,
    }))
  }

  test('prepara el documento antes del clic, guarda el grupo y lo abre', async () => {
    abrir()
    await screen.findByText(/Tarea\.pdf/)
    expect(generarArchivo).toHaveBeenCalledWith('pdf')

    await user.click(screen.getByRole('radio', { name: 'Word' }))
    await screen.findByText(/Tarea\.docx/)

    await user.type(screen.getByLabelText('Enlace de invitación del grupo'), 'https://chat.whatsapp.com/AbCdEfGhIj12')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(api.put).toHaveBeenCalledWith('/avisos/whatsapp', { materiaId: 12, grupoId: 3, enlace: 'https://chat.whatsapp.com/AbCdEfGhIj12' })

    await user.click(await screen.findByRole('button', { name: 'Descargar, copiar y abrir el grupo' }))
    expect(window.open).toHaveBeenCalledWith('https://chat.whatsapp.com/AbCdEfGhIj12', '_blank', 'noopener,noreferrer')
    expect(URL.createObjectURL).toHaveBeenCalled()
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('*Práctica de subredes*')))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  test('sin documento ni grupo, abre wa.me con el mensaje', async () => {
    abrir()
    await screen.findByText(/Tarea\.pdf/)
    await user.click(screen.getByRole('checkbox', { name: 'Adjuntar documento con las instrucciones' }))
    expect(screen.getByRole('textbox', { name: 'Mensaje' }).value).not.toContain('documento adjunto')
    await user.click(screen.getByRole('button', { name: 'Abrir WhatsApp' }))
    expect(window.open.mock.calls[0][0]).toMatch(/^https:\/\/wa\.me\/\?text=/)
  })

  test('en el celular comparte el archivo con el menú del sistema', async () => {
    navigator.canShare = vi.fn(() => true)
    navigator.share = vi.fn(() => Promise.resolve())
    abrir()
    await user.click(await screen.findByRole('button', { name: 'Compartir en WhatsApp' }))
    expect(navigator.share).toHaveBeenCalledWith({ files: [expect.any(File)], text: expect.stringContaining('Nueva tarea') })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})

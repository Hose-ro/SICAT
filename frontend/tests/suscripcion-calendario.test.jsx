import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../src/api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn(), defaults: { baseURL: 'https://api.sicatapp.com/api' } },
}))
import api from '../src/api/axios'
import SuscripcionCalendario from '../src/components/horario/SuscripcionCalendario'

beforeEach(() => {
  vi.clearAllMocks()
  api.get.mockResolvedValue({ data: { activo: false } })
  api.post.mockResolvedValue({ data: { token: 'tok_abcdefghijklmnopqrstuvwx' } })
})

test('con HTTPS ofrece suscribirse por webcal y en Google Calendar', async () => {
  const user = userEvent.setup()
  render(<SuscripcionCalendario />)
  await user.click(screen.getByRole('button', { name: 'Agregar a mi calendario' }))
  await user.click(await screen.findByRole('button', { name: 'Crear enlace' }))

  expect((await screen.findByLabelText('Tu enlace')).value)
    .toBe('https://api.sicatapp.com/api/calendario/tok_abcdefghijklmnopqrstuvwx.ics')
  expect(screen.getByRole('link', { name: 'Abrir en Calendario (iPhone, Mac)' }).getAttribute('href'))
    .toBe('webcal://api.sicatapp.com/api/calendario/tok_abcdefghijklmnopqrstuvwx.ics')
  expect(screen.getByRole('link', { name: 'Agregar a Google Calendar' }).getAttribute('href'))
    .toBe(`https://calendar.google.com/calendar/render?cid=${encodeURIComponent('webcal://api.sicatapp.com/api/calendario/tok_abcdefghijklmnopqrstuvwx.ics')}`)
  expect(screen.queryByText(/no usa HTTPS/)).toBeNull()
})

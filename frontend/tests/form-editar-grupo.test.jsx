import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../src/api/axios', () => ({ default: { get: vi.fn(), patch: vi.fn() } }))

import api from '../src/api/axios'
import FormEditarGrupo from '../src/pages/admin/grupos/components/FormEditarGrupo'
import { useGrupoStore } from '../src/store/grupoStore'

const grupo = { id: 4, nombre: '103-A', semestre: 1, seccion: 'A', periodo: '2026-B', modalidad: 'ESCOLARIZADO', carrera: { id: 1, nombre: 'ISC' } }

beforeEach(() => {
  vi.clearAllMocks()
  useGrupoStore.setState({ grupos: [grupo], grupoActivo: grupo, error: null, loading: false })
  api.get.mockImplementation((url) => Promise.resolve({ data: url === '/grupos' ? [grupo] : { ...grupo, modalidad: 'MIXTO' } }))
  api.patch.mockResolvedValue({ data: { ...grupo, modalidad: 'MIXTO' } })
})

test('cambiar un grupo a mixto sólo envía la modalidad y avisa del calendario', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  render(<FormEditarGrupo open grupo={grupo} onClose={onClose} />)

  expect(screen.getByRole('radio', { name: /Escolarizado/ }).checked).toBe(true)
  // Sin cambios no hay nada que guardar.
  expect(screen.getByRole('button', { name: 'Guardar cambios' }).disabled).toBe(true)

  await user.click(screen.getByText('Mixto', { exact: true }))
  expect(screen.getByRole('radio', { name: /Mixto/ }).checked).toBe(true)
  expect(screen.getByText(/se regirán por el calendario mixto/)).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/grupos/4', { modalidad: 'MIXTO' }))
  await waitFor(() => expect(onClose).toHaveBeenCalled())
  expect(useGrupoStore.getState().grupoActivo.modalidad).toBe('MIXTO')
})

test('un conflicto de sección se muestra en el formulario sin cerrarlo', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  api.patch.mockRejectedValue({ response: { data: { message: 'La sección A del semestre 1 de ISC ya la ocupa el grupo mixto "103-SA" en el periodo 2026-B' } } })
  render(<FormEditarGrupo open grupo={grupo} onClose={onClose} />)

  await user.click(screen.getByText('Mixto', { exact: true }))
  await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('ya la ocupa el grupo mixto "103-SA"'))
  expect(onClose).not.toHaveBeenCalled()
})

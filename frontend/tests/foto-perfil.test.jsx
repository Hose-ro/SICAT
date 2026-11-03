import { expect, test, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'

vi.mock('../src/api/axios', () => ({ default: { defaults: { baseURL: 'http://api.test/api' } } }))
import UserAvatar from '../src/components/shared/UserAvatar'
import { mensajeErrorFoto, prepararFotoPerfil } from '../src/lib/fotoPerfil'

test('sin foto muestra la silueta genérica', () => {
  const { container } = render(<UserAvatar usuario={{ id: 3, nombre: 'Ana', avatar: null }} />)
  expect(container.querySelector('img')).toBeNull()
  expect(container.querySelector('svg circle')).not.toBeNull()
})

test('con foto pide la versión vigente y vuelve a la silueta si no carga', () => {
  const { container } = render(<UserAvatar usuario={{ id: 3, avatar: 'abc123' }} />)
  const img = container.querySelector('img')
  expect(img.getAttribute('src')).toBe('http://api.test/api/usuarios/3/foto?v=abc123')
  expect(img.getAttribute('alt')).toBe('')
  fireEvent.error(img)
  expect(container.querySelector('img')).toBeNull()
  expect(container.querySelector('svg')).not.toBeNull()
})

test('rechaza formatos peligrosos o pesados antes de subir', async () => {
  const svg = new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' })
  await expect(prepararFotoPerfil(svg)).rejects.toThrow('JPG, PNG o WebP')
  const gif = new File(['GIF89a'], 'a.gif', { type: 'image/gif' })
  await expect(prepararFotoPerfil(gif)).rejects.toThrow('JPG, PNG o WebP')
  const grande = new File([new Uint8Array(15 * 1024 * 1024 + 1)], 'a.jpg', { type: 'image/jpeg' })
  await expect(prepararFotoPerfil(grande)).rejects.toThrow('15 MB')
})

test('traduce los rechazos del servidor', () => {
  expect(mensajeErrorFoto({ response: { status: 413 } })).toMatch('5 MB')
  expect(mensajeErrorFoto({ response: { status: 429 } })).toMatch('Espera unos minutos')
  expect(mensajeErrorFoto({ response: { status: 400, data: { message: 'La foto es muy pequeña' } } })).toBe('La foto es muy pequeña')
})

import { useState } from 'react'
import { fotoPerfilUrl } from '@/lib/fotoPerfil'
import { cn } from '@/lib/utils'

/** Cabeza y hombros sobre gris: lo que se ve cuando alguien no tiene foto. */
function Silueta() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false" className="size-full">
      <rect width="100" height="100" fill="var(--avatar-fondo)" />
      <circle cx="50" cy="39" r="18" fill="var(--avatar-silueta)" />
      <path d="M15 100V87C15 72 30 62.5 50 62.5S85 72 85 87V100Z" fill="var(--avatar-silueta)" />
    </svg>
  )
}

/**
 * Foto de perfil redonda, o la silueta genérica si no hay foto o no carga.
 * El tamaño lo da `className` (p. ej. `size-8`). Es decorativa: el nombre
 * siempre va junto a ella.
 */
export default function UserAvatar({ usuario, className }) {
  const url = fotoPerfilUrl(usuario)
  const [fallida, setFallida] = useState(null)
  const conFoto = url && fallida !== url

  return (
    <span data-slot="user-avatar" className={cn('relative inline-flex size-8 shrink-0 overflow-hidden rounded-full bg-[var(--avatar-fondo)] select-none', className)}>
      {conFoto
        ? <img src={url} alt="" draggable={false} loading="lazy" decoding="async" referrerPolicy="no-referrer"
            className="size-full object-cover" onError={() => setFallida(url)} />
        : <Silueta />}
    </span>
  )
}

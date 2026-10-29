import { Chip } from '@/components/Chip'
import { cn } from '@/lib/utils'
import { infoDesempeno } from '@/lib/desempeno'

/** Semáforo con punto y texto: el color nunca va solo. */
export default function DesempenoChip({ estado, className }) {
  const info = infoDesempeno(estado)
  return (
    <Chip tone={info.tono} className={className}>
      <span aria-hidden="true" className={cn('size-2 rounded-full', info.punto)} />
      {info.label}
    </Chip>
  )
}

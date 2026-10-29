import { Button } from '@/components/ui/button'
import { useState } from 'react'
import Modal from '@/components/Modal'

/**
 * "Cómo funciona SICAT": unas cuantas pantallas que explican en orden qué se
 * prepara primero y qué se hace después. Cada perfil trae sus pantallas
 * ({ icono, titulo, texto, pasos? }).
 */
export default function VentanaBienvenida({ pantallas, open, onClose }) {
  const [indice, setIndice] = useState(0)
  const pantalla = pantallas[indice]
  const ultima = indice === pantallas.length - 1
  const cerrar = () => {
    onClose()
    setIndice(0)
  }

  return (
    <Modal open={open} onClose={cerrar} title="Cómo funciona SICAT" description={`${indice + 1} de ${pantallas.length}`}>
      <div aria-live="polite" className="min-h-[13rem]">
        <span className="grid size-11 place-items-center rounded-full bg-accent text-primary-ink">
          <pantalla.icono className="size-5" aria-hidden="true" />
        </span>
        <h3 className="mt-4 text-xl font-semibold tracking-tight text-foreground">{pantalla.titulo}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{pantalla.texto}</p>
        {pantalla.pasos && (
          <ol className="mt-3 space-y-2 text-sm text-foreground">
            {pantalla.pasos.map((paso, i) => (
              <li key={paso} className="flex gap-3">
                <span className="w-5 shrink-0 font-semibold tabular-nums text-primary-ink">{i + 1}.</span>
                {paso}
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <div className="flex gap-1.5" aria-hidden="true">
          {pantallas.map((p, i) => (
            <span key={p.titulo} className={`h-1.5 rounded-full transition-[width,background-color] duration-200 ${i === indice ? 'w-5 bg-primary' : 'w-1.5 bg-border'}`} />
          ))}
        </div>
        <div className="flex gap-2">
          {indice === 0 ? (
            <Button variant="ghost" type="button" onClick={cerrar}>Saltar</Button>
          ) : (
            <Button variant="ghost" type="button" onClick={() => setIndice(indice - 1)}>Anterior</Button>
          )}
          <Button type="button" onClick={() => (ultima ? cerrar() : setIndice(indice + 1))}>
            {ultima ? 'Empezar' : 'Siguiente'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

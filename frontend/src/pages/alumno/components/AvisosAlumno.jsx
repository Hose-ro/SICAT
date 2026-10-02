import { useEffect, useState } from 'react'
import { Megaphone, Pin } from 'lucide-react'
import { fechaAviso } from '@/lib/avisos'
import api from '../../../api/axios'

const VISIBLES = 3

/** Avisos del docente para el grupo del alumno (y los que le mandó a él). */
export default function AvisosAlumno({ materiaId }) {
  const [estado, setEstado] = useState({ materiaId: null, items: [] })
  const [verTodos, setVerTodos] = useState(false)

  useEffect(() => {
    let vigente = true
    api.get('/avisos/mios', { params: { materiaId } })
      .then((res) => { if (vigente) setEstado({ materiaId, items: res.data ?? [] }) })
      .catch(() => { if (vigente) setEstado({ materiaId, items: [] }) })
    return () => { vigente = false }
  }, [materiaId])

  const avisos = estado.materiaId === materiaId ? estado.items : []
  if (!avisos.length) return null
  const mostrados = verTodos ? avisos : avisos.slice(0, VISIBLES)

  return (
    <section aria-labelledby="avisos-alumno" className="rounded-2xl border border-border bg-card p-5">
      <h2 id="avisos-alumno" className="flex items-center gap-2 text-base font-semibold text-foreground">
        <Megaphone className="size-4" aria-hidden="true" />Avisos del docente
      </h2>
      <ul className="mt-3 space-y-2">
        {mostrados.map((aviso) => (
          <li key={aviso.id} className={`rounded-xl border px-4 py-3 ${aviso.alumnoId ? 'border-warning/40 bg-warning/5' : 'border-border bg-background'}`}>
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              {aviso.fijado && <Pin className="size-3.5 shrink-0 text-primary-ink" aria-label="Fijado" />}
              {aviso.titulo}
            </p>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{aviso.cuerpo}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {aviso.alumnoId ? 'Sólo para ti · ' : ''}{aviso.docente?.nombre ? `${aviso.docente.nombre} · ` : ''}{fechaAviso(aviso.createdAt)}
            </p>
          </li>
        ))}
      </ul>
      {avisos.length > VISIBLES && (
        <button type="button" onClick={() => setVerTodos((prev) => !prev)} className="mt-3 text-sm font-medium text-primary-ink underline-offset-4 hover:underline">
          {verTodos ? 'Ver menos' : `Ver los ${avisos.length} avisos`}
        </button>
      )}
    </section>
  )
}

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarPlus, LoaderCircle } from 'lucide-react'
import api from '@/api/axios'
import PageHeader from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import ReunionTarjeta from '@/components/reuniones/ReunionTarjeta'
import ChoquesReunion from '@/pages/docente/components/ChoquesReunion'
import { notify } from '@/lib/feedback'
import { descargarIcs, separarReuniones } from '@/lib/reuniones'

const ASISTENCIA = { true: 'Asististe', false: 'No asististe' }

/** Reuniones de academia a las que la jefatura convocó al docente. */
export default function MisReuniones() {
  const [params] = useSearchParams()
  const destacada = Number(params.get('reunion')) || null
  const [estado, setEstado] = useState({ lista: null, error: '' })
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vivo = true
    api.get('/reuniones/mias')
      .then(({ data }) => { if (vivo) setEstado({ lista: data, error: '' }) })
      .catch((error) => { if (vivo) setEstado({ lista: null, error: error.response?.data?.message ?? 'No se pudieron cargar tus reuniones' }) })
    return () => { vivo = false }
  }, [intento])

  const ics = async (r) => {
    const error = await descargarIcs(r)
    if (error) notify(error)
  }

  const actualizarChoques = (id, choques) =>
    setEstado((actual) => ({ ...actual, lista: actual.lista.map((r) => (r.id === id ? { ...r, choques } : r)) }))

  const { proximas, pasadas } = separarReuniones(estado.lista ?? [])
  const tarjeta = (r) => (
    <ReunionTarjeta
      key={r.id}
      reunion={r}
      abiertaInicial={r.id === destacada}
      extra={<span>{r.carrera.nombre}{r.miAsistencia !== null && ` · ${ASISTENCIA[r.miAsistencia]}`}</span>}
      aviso={r.choques?.length > 0 && <ChoquesReunion reunion={r} onCambio={(choques) => actualizarChoques(r.id, choques)} />}
      acciones={r.estado === 'PROGRAMADA' && <Button variant="outline" size="sm" onClick={() => ics(r)}><CalendarPlus aria-hidden="true" /> Agregar a mi calendario</Button>}
    />
  )

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Reuniones de academia" subtitle="Juntas a las que te convocó la jefatura de carrera, con su orden del día y los acuerdos. Si una se cruza con tu clase, justifícala aquí." />
      {estado.error ? (
        <div role="alert" className="rounded-[var(--radius-item)] border border-destructive/40 bg-destructive/5 p-5 text-sm">
          <p className="font-semibold text-destructive-foreground">{estado.error}</p>
          <Button variant="outline" className="mt-3" onClick={() => { setEstado({ lista: null, error: '' }); setIntento((n) => n + 1) }}>Reintentar</Button>
        </div>
      ) : estado.lista === null ? (
        <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Cargando reuniones…</p>
      ) : (
        <>
          <section aria-labelledby="reuniones-proximas">
            <h2 id="reuniones-proximas" className="text-base font-semibold text-foreground">Próximas</h2>
            {proximas.length
              ? <ul className="mt-3 space-y-3">{proximas.map(tarjeta)}</ul>
              : <p className="mt-2 border-y border-border py-5 text-sm text-muted-foreground">No tienes reuniones programadas.</p>}
          </section>
          {pasadas.length > 0 && (
            <section aria-labelledby="reuniones-pasadas" className="mt-10">
              <h2 id="reuniones-pasadas" className="text-base font-semibold text-foreground">Anteriores</h2>
              <ul className="mt-3 space-y-3">{pasadas.map(tarjeta)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}

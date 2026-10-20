import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarPlus, ClipboardList, Pencil, Plus, Trash2, XCircle } from 'lucide-react'
import api from '@/api/axios'
import { Button } from '@/components/ui/button'
import ReunionTarjeta from '@/components/reuniones/ReunionTarjeta'
import { confirmAction, notify } from '@/lib/feedback'
import { descargarIcs, fechaReunion, hoyClaveLocal, separarReuniones } from '@/lib/reuniones'
import ActaDialog from './reuniones/ActaDialog'
import ReunionForm from './reuniones/ReunionForm'
import { Aviso, Esqueleto, JefaturaPage, Segmento, Vacio } from './supervision/ui'
import { mensajeError } from './supervision/useJefatura'

export default function JefeReuniones() {
  const [dialogo, setDialogo] = useState(null)
  return (
    <JefaturaPage
      sinResumen
      alcance="global"
      titulo="Reuniones de academia"
      subtitulo="Programa las juntas de la carrera, convoca a los docentes y deja el acta con sus acuerdos."
      accion={<Button onClick={() => setDialogo({ tipo: 'form', reunion: null })}><Plus aria-hidden="true" /> Programar reunión</Button>}
    >
      {({ j }) => <Contenido j={j} dialogo={dialogo} setDialogo={setDialogo} />}
    </JefaturaPage>
  )
}

function Contenido({ j, dialogo, setDialogo }) {
  const [params, setParams] = useSearchParams()
  const vista = params.get('vista') === 'historial' ? 'historial' : 'proximas'
  const [estado, setEstado] = useState({ lista: null, error: '' })

  const cargar = useCallback(() => {
    let vivo = true
    api.get('/jefe-carrera/reuniones', { params: { carreraId: j.carreraId } })
      .then(({ data }) => { if (vivo) setEstado({ lista: data, error: '' }) })
      .catch((error) => { if (vivo) setEstado((s) => ({ ...s, error: mensajeError(error, 'No se pudieron cargar las reuniones') })) })
    return () => { vivo = false }
  }, [j.carreraId])
  useEffect(() => cargar(), [cargar])

  const reemplazar = (reunion, mensaje) => {
    setEstado((s) => ({ ...s, lista: [reunion, ...(s.lista ?? []).filter((r) => r.id !== reunion.id)] }))
    setDialogo(null)
    if (mensaje) notify(mensaje, 'success')
  }

  const cancelar = async (r) => {
    const ok = await confirmAction({
      title: '¿Cancelar la reunión?',
      description: `Se avisará a los ${r.convocados.length} docentes convocados que la reunión del ${fechaReunion(r.fecha)} se canceló.`,
      confirmLabel: 'Cancelar reunión',
    })
    if (!ok) return
    try {
      const { data } = await api.post(`/jefe-carrera/reuniones/${r.id}/cancelar`)
      reemplazar(data, 'Reunión cancelada. Se avisó a los convocados.')
    } catch (error) {
      notify(mensajeError(error, 'No se pudo cancelar la reunión'))
    }
  }

  const eliminar = async (r) => {
    const ok = await confirmAction({ title: '¿Eliminar la reunión cancelada?', description: 'Se borra del historial de la carrera. No se puede deshacer.', confirmLabel: 'Eliminar' })
    if (!ok) return
    try {
      await api.delete(`/jefe-carrera/reuniones/${r.id}`)
      setEstado((s) => ({ ...s, lista: s.lista.filter((x) => x.id !== r.id) }))
      notify('Reunión eliminada.', 'success')
    } catch (error) {
      notify(mensajeError(error, 'No se pudo eliminar la reunión'))
    }
  }

  const ics = async (r) => {
    const error = await descargarIcs(r)
    if (error) notify(error)
  }

  const dialogos = (
    <>
      {dialogo?.tipo === 'form' && <ReunionForm j={j} reunion={dialogo.reunion} onClose={() => setDialogo(null)} onGuardada={reemplazar} />}
      {dialogo?.tipo === 'acta' && <ActaDialog reunion={dialogo.reunion} onClose={() => setDialogo(null)} onGuardada={reemplazar} />}
    </>
  )

  if (estado.lista === null) {
    return estado.error
      ? <Aviso tono="error" titulo="No se pudieron cargar las reuniones" accion={<Button variant="outline" onClick={cargar}>Reintentar</Button>}>{estado.error}</Aviso>
      : <Esqueleto compacto />
  }

  const { proximas, pasadas } = separarReuniones(estado.lista)
  const lista = vista === 'proximas' ? proximas : pasadas
  const hoy = hoyClaveLocal()

  const acciones = (r) => {
    if (r.estado === 'CANCELADA') {
      return <Button variant="ghost" size="sm" onClick={() => eliminar(r)}><Trash2 aria-hidden="true" /> Eliminar</Button>
    }
    const actaDisponible = r.fecha <= hoy
    return (
      <>
        {actaDisponible && (
          <Button size="sm" variant={r.estado === 'FINALIZADA' ? 'outline' : 'default'} onClick={() => setDialogo({ tipo: 'acta', reunion: r })}>
            <ClipboardList aria-hidden="true" /> {r.estado === 'FINALIZADA' ? 'Editar acta' : 'Capturar acta'}
          </Button>
        )}
        {r.estado === 'PROGRAMADA' && (
          <Button size="sm" variant="outline" onClick={() => setDialogo({ tipo: 'form', reunion: r })}><Pencil aria-hidden="true" /> Editar</Button>
        )}
      </>
    )
  }

  const pie = (r) => r.estado === 'PROGRAMADA' && (
    <div className="flex flex-wrap gap-2 border-t border-border pt-3">
      <Button variant="ghost" size="sm" onClick={() => ics(r)}><CalendarPlus aria-hidden="true" /> Agregar a mi calendario</Button>
      <Button variant="ghost" size="sm" className="text-destructive-foreground" onClick={() => cancelar(r)}><XCircle aria-hidden="true" /> Cancelar reunión</Button>
    </div>
  )

  return (
    <>
      {dialogos}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Segmento
          label="Reuniones"
          value={vista}
          onChange={(v) => { const n = new URLSearchParams(params); if (v === 'historial') n.set('vista', v); else n.delete('vista'); setParams(n, { replace: true }) }}
          options={[{ value: 'proximas', label: `Próximas (${proximas.length})` }, { value: 'historial', label: `Historial (${pasadas.length})` }]}
        />
        {estado.error && <p role="alert" className="text-xs text-warning-foreground">{estado.error}</p>}
      </div>

      {!lista.length ? (
        <Vacio
          titulo={vista === 'proximas' ? 'Sin reuniones programadas' : 'Sin reuniones anteriores'}
          accion={vista === 'proximas' && <Button onClick={() => setDialogo({ tipo: 'form', reunion: null })}><Plus aria-hidden="true" /> Programar reunión</Button>}
        >
          {vista === 'proximas' ? 'Programa una junta y se convoca automáticamente a los docentes de la carrera.' : 'Aquí quedan las reuniones pasadas, finalizadas o canceladas, con su acta.'}
        </Vacio>
      ) : (
        <ul className="mt-5 space-y-3">
          {lista.map((r) => (
            <ReunionTarjeta
              key={r.id}
              reunion={r}
              mostrarConvocados
              acciones={acciones(r)}
              pie={pie(r)}
              extra={<span>{r.asistencia.registrada ? `Asistieron ${r.asistencia.asistieron} de ${r.asistencia.convocados}` : `${r.convocados.length} convocados`}</span>}
            />
          ))}
        </ul>
      )}
    </>
  )
}

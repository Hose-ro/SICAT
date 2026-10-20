import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import Modal from '@/components/Modal'
import { fechaHoraCorta, plural } from './supervision/formato'
import { Aviso, Esqueleto, JefaturaPage, Pestanas, Vacio, linkClass, selectClass } from './supervision/ui'
import { EstadoSeguimiento, FormSeguimiento } from './supervision/Seguimiento'
import { TIPOS_SEGUIMIENTO, esParaHoy, useSeguimientos } from './supervision/useSeguimientos'

const VISTAS = [
  { value: 'abiertos', label: 'Abiertos', filtro: (s) => s.abierto },
  { value: 'hoy', label: 'Para revisar hoy', filtro: esParaHoy },
  { value: 'cerrados', label: 'Cerrados', filtro: (s) => !s.abierto },
]

/**
 * Enlace al registro que explica el caso y si su causa sigue presente. Que el
 * caso ya no aparezca en el resumen no prueba que se resolvió (pudo cambiar
 * la configuración o el alcance): solo se afirma lo que puede verificarse.
 */
function contextoCaso(s, resumen, j) {
  const ref = s.referencia
  if (!ref) return { enlace: null, causa: null }
  switch (ref.tipo) {
    case 'ASISTENCIA_SIN_CAPTURA': {
      const id = `${ref.horarioId}:${ref.fecha}`
      const pendiente = resumen.pendientes.find((c) => c.id === id)
      const modalidad = resumen.ofertas.flatMap((o) => o.horarios).find((h) => h.id === ref.horarioId)?.grupo?.modalidad
      return {
        enlace: { label: 'Ver clase', to: j.to('/jefe-carrera/horarios', { fecha: ref.fecha, clase: id, modalidad: modalidad === 'MIXTO' ? 'MIXTO' : undefined }) },
        causa: pendiente ? { texto: 'La lista sigue sin captura completa', tono: 'pendiente' } : { texto: 'Ya no aparece entre las listas pendientes; abre la clase para confirmar su estado', tono: 'sin-verificar' },
      }
    }
    case 'ALUMNO_RIESGO': {
      const alumno = resumen.riesgos.find((a) => a.id === ref.alumnoId)
      const grupo = alumno?.causas[0]?.grupo
      return {
        enlace: grupo ? { label: 'Ver expediente', to: j.to(`/jefe-carrera/grupos/${grupo.id}`, { tab: 'alumnos', alumno: ref.alumnoId }) } : null,
        causa: alumno ? { texto: 'Sigue con señales de riesgo', tono: 'pendiente' } : { texto: 'No aparece entre los alumnos en riesgo del periodo; no se puede verificar la causa desde aquí', tono: 'sin-verificar' },
      }
    }
    case 'CALIFICACIONES_PENDIENTES': {
      const oferta = resumen.ofertas.find((o) => o.id === `${ref.materiaId}:${ref.grupoId}`)
      const n = oferta?.resumen.calificacionesPendientes ?? 0
      return {
        enlace: { label: 'Ver materia en el grupo', to: j.to(`/jefe-carrera/materias/${ref.materiaId}`, { oferta: ref.grupoId }) },
        causa: !oferta
          ? { texto: 'La materia ya no aparece en el grupo para este periodo; no se puede verificar la causa', tono: 'sin-verificar' }
          : n ? { texto: `Siguen ${plural(n, 'calificación pendiente', 'calificaciones pendientes')}`, tono: 'pendiente' } : { texto: 'Calificaciones de unidades cerradas capturadas', tono: 'resuelto' },
      }
    }
    case 'SEGUIMIENTO_DOCENTE':
      return { enlace: { label: 'Ver docente', to: j.to(`/jefe-carrera/docentes/${ref.docenteId}`) }, causa: null }
    default:
      return { enlace: null, causa: null }
  }
}

const TONO_CAUSA = { pendiente: 'text-warning-foreground', resuelto: 'text-success-foreground', 'sin-verificar': 'text-muted-foreground' }

export default function JefeSeguimientos() {
  return (
    <JefaturaPage titulo="Seguimientos" subtitulo="Acuerdos y revisiones del periodo. Cada nota queda con su autor y su fecha.">
      {({ j, resumen }) => <Contenido j={j} resumen={resumen} />}
    </JefaturaPage>
  )
}

function Contenido({ j, resumen }) {
  const [params, setParams] = useSearchParams()
  const seguimientos = useSeguimientos({ carreraId: j.carreraId, periodo: j.periodo })
  const [abierto, setAbierto] = useState(null)
  const vista = VISTAS.find((v) => v.value === params.get('vista')) ?? VISTAS[0]
  const tipo = params.get('tipo') ?? ''
  const docente = params.get('docente') ?? ''
  const set = (patch) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => { if (v) next.set(k, v); else next.delete(k) })
    setParams(next, { replace: true })
  }

  if (seguimientos.cargando) return <Esqueleto compacto />
  if (seguimientos.error && !seguimientos.lista.length) {
    return <Aviso tono="error" titulo="No se pudieron cargar los seguimientos" accion={<Button variant="outline" onClick={seguimientos.reintentar}>Reintentar</Button>}>{seguimientos.error}</Aviso>
  }

  const responsables = [...new Map(seguimientos.lista.filter((s) => s.responsable).map((s) => [String(s.responsable.id), s.responsable.nombre])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'es'))
  const filtrados = seguimientos.lista.filter((s) => (!tipo || s.tipo === tipo) && (!docente || String(s.responsable?.id) === docente))
  const visibles = filtrados.filter(vista.filtro)
  const seleccionado = abierto ? seguimientos.lista.find((s) => s.id === abierto) : null

  return (
    <>
      <Pestanas
        label="Vista de seguimientos"
        activa={vista.value}
        items={VISTAS.map((v) => {
          const query = new URLSearchParams(params)
          query.set('vista', v.value)
          return { value: v.value, label: v.label, count: filtrados.filter(v.filtro).length, to: `?${query}` }
        })}
      />

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label className="w-full sm:w-56">
          <span className="text-xs font-medium text-muted-foreground">Tipo de caso</span>
          <select value={tipo} onChange={(e) => set({ tipo: e.target.value })} className={`${selectClass} mt-1.5`}>
            <option value="">Todos</option>
            {Object.entries(TIPOS_SEGUIMIENTO).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="w-full sm:w-64">
          <span className="text-xs font-medium text-muted-foreground">Docente</span>
          <select value={docente} onChange={(e) => set({ docente: e.target.value })} className={`${selectClass} mt-1.5`}>
            <option value="">Todos los docentes</option>
            {responsables.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
          </select>
        </label>
        {(tipo || docente) && <Button variant="ghost" className="min-h-11" onClick={() => set({ tipo: '', docente: '' })}>Quitar filtros</Button>}
      </div>

      {visibles.length ? (
        <ul className="mt-5 divide-y divide-border border-y border-border">
          {visibles.map((s) => {
            const { enlace, causa } = contextoCaso(s, resumen, j)
            const ultima = s.notas.at(-1)
            return (
              <li key={s.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_auto] md:gap-6">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{s.titulo}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{[TIPOS_SEGUIMIENTO[s.tipo], s.mensaje].filter(Boolean).join(' · ')}</p>
                  {causa && <p className={`mt-1 text-xs ${TONO_CAUSA[causa.tono]}`}>{causa.texto}</p>}
                  {enlace && <Link className={`${linkClass} mt-1 inline-flex min-h-11 items-center text-xs md:min-h-0`} to={enlace.to}>{enlace.label}</Link>}
                </div>
                <div className="min-w-0 text-[0.8125rem]">
                  {ultima && (
                    <>
                      <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{ultima.autor}</span> · {fechaHoraCorta(ultima.creadoEn)}{s.notas.length > 1 ? ` · ${plural(s.notas.length, 'nota', 'notas')}` : ''}</p>
                      <p className="mt-0.5 line-clamp-2 text-foreground">{ultima.texto}</p>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 md:flex-col md:items-end">
                  <EstadoSeguimiento seguimiento={s} />
                  <Button variant="outline" size="sm" onClick={() => setAbierto(s.id)}>{j.historico ? 'Ver historial' : 'Agregar nota'}</Button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <Vacio titulo={seguimientos.lista.length ? 'Nada en esta vista' : 'Todavía no hay seguimientos en el periodo'}>
          {seguimientos.lista.length
            ? (tipo || docente ? 'Ningún seguimiento coincide con los filtros.' : vista.value === 'hoy' ? 'Ningún caso abierto tiene revisión programada para hoy.' : 'No hay casos en esta vista.')
            : 'Registra un seguimiento desde los pendientes de Inicio, el detalle de una clase o la ficha de un docente. Aquí quedará el historial.'}
        </Vacio>
      )}

      <Modal open={Boolean(seleccionado)} onClose={() => setAbierto(null)} title={seleccionado?.titulo} description={seleccionado?.mensaje} wide>
        {seleccionado && (
          <FormSeguimiento
            j={j}
            caso={seleccionado.referencia}
            seguimientoId={seleccionado.id}
            onCancelar={() => setAbierto(null)}
            onGuardado={(s) => { if (!s.abierto) setAbierto(null) }}
          />
        )}
      </Modal>
    </>
  )
}

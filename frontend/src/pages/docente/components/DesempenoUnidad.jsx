import { useEffect, useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Eye, EyeOff, SlidersHorizontal } from 'lucide-react'
import api from '@/api/axios'
import TaskNotice from '@/components/TaskNotice'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import CriteriosModal from '@/components/calificaciones/CriteriosModal'
import DesempenoChip from '@/components/calificaciones/DesempenoChip'
import FiltroDesempeno from '@/components/calificaciones/FiltroDesempeno'
import { useIsMobile } from '@/hooks/use-mobile'
import { resumenCriterios } from '@/lib/criterios'
import { ordenarPorDesempeno, textoMotivos, valorCorto } from '@/lib/desempeno'
import { cn } from '@/lib/utils'
import { Segmentado } from './tareas/Controles'

const VISIBLES = 10
const ESTADO_UNIDAD = { ACTIVA: 'en curso', FINALIZADA: 'cerrada', PENDIENTE: 'por iniciar' }
const CAMPO = 'h-10 w-full min-w-0 rounded-[10px] border border-input bg-background px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40'

// Recordar la clase y si se ocultan las calificaciones es comodidad de este
// navegador: si el almacenamiento no está disponible, el panel funciona igual.
function leer(clave) {
  try { return window.localStorage.getItem(clave) } catch { return null }
}
function guardar(clave, valor) {
  try {
    if (valor == null) window.localStorage.removeItem(clave)
    else window.localStorage.setItem(clave, valor)
  } catch { /* sin almacenamiento */ }
}

const claveDe = (materiaId, grupoId) => (materiaId && grupoId ? `${materiaId}:${grupoId}` : null)

function mensajeError(error) {
  if (error.response?.status === 404) return 'El servidor todavía no tiene el desempeño por unidad.'
  return error.response?.data?.message || 'No se pudo cargar el desempeño de la unidad.'
}

/**
 * Cómo va cada alumno de una clase en una unidad: promedio, asistencia, cada
 * criterio de evaluación y el semáforo. Abre en la clase que se está dando (o
 * la última que se eligió) y en la unidad en curso.
 */
export default function DesempenoUnidad({ materias = [], claseActual, proximaClase, userId }) {
  const isMobile = useIsMobile()
  const idTitulo = useId()
  const claveRecordada = `sicat.desempeno.clase.${userId ?? 'docente'}`
  const clases = useMemo(
    () => materias
      .filter((materia) => materia.grupo?.id)
      .map((materia) => ({ materiaId: materia.id, nombre: materia.nombre, grupo: materia.grupo, clave: claveDe(materia.id, materia.grupo.id) })),
    [materias],
  )
  const [elegida, setElegida] = useState(null)
  const porDefecto = useMemo(() => {
    const existe = (clave) => clave && clases.some((item) => item.clave === clave)
    return [
      claveDe(claseActual?.materiaId, claseActual?.grupoId),
      leer(claveRecordada),
      claveDe(proximaClase?.materiaId, proximaClase?.grupoId),
    ].find(existe) ?? clases[0]?.clave ?? null
  }, [clases, claseActual, proximaClase, claveRecordada])
  const clase = clases.find((item) => item.clave === (elegida ?? porDefecto)) ?? clases.find((item) => item.clave === porDefecto) ?? null

  const [unidadPedida, setUnidadPedida] = useState({ clase: null, unidadId: null })
  const unidadId = unidadPedida.clase === clase?.clave ? unidadPedida.unidadId : null
  const [version, setVersion] = useState(0)
  const pedido = clase ? `${clase.clave}:${unidadId ?? ''}:${version}` : null
  const [resultado, setResultado] = useState({ pedido: null, clase: null, datos: null, error: '' })
  const materiaId = clase?.materiaId
  const grupoId = clase?.grupo.id
  const claseClave = clase?.clave

  useEffect(() => {
    if (!pedido) return undefined
    let vigente = true
    api.get('/calificaciones/desempeno', { params: { materiaId, grupoId, ...(unidadId ? { unidadId } : {}) } })
      .then((res) => { if (vigente) setResultado({ pedido, clase: claseClave, datos: res.data, error: '' }) })
      .catch((error) => { if (vigente) setResultado({ pedido, clase: claseClave, datos: null, error: mensajeError(error) }) })
    return () => { vigente = false }
  }, [pedido, materiaId, grupoId, unidadId, claseClave])

  const [filtro, setFiltro] = useState('TODOS')
  const [verTodos, setVerTodos] = useState(false)
  const [ocultas, setOcultas] = useState(() => leer('sicat.desempeno.ocultar') === '1')
  const [criteriosAbierto, setCriteriosAbierto] = useState(false)

  if (!clases.length) return null

  const cargando = resultado.pedido !== pedido
  const deEstaClase = resultado.clase === clase?.clave
  const datos = deEstaClase && resultado.datos && !Array.isArray(resultado.datos) && Array.isArray(resultado.datos.alumnos)
    ? resultado.datos
    : null
  const error = deEstaClase && !cargando ? resultado.error : ''

  const elegirClase = (event) => {
    setElegida(event.target.value)
    guardar(claveRecordada, event.target.value)
    setVerTodos(false)
  }
  const elegirUnidad = (id) => {
    setUnidadPedida({ clase: clase.clave, unidadId: id })
    setVerTodos(false)
  }
  const alternarOcultas = () => {
    guardar('sicat.desempeno.ocultar', ocultas ? null : '1')
    setOcultas(!ocultas)
  }

  const criterios = datos?.criterios ?? []
  const asistencia = criterios.find((item) => item.tipo === 'ASISTENCIA')
  const columnas = criterios.filter((item) => item.tipo !== 'ASISTENCIA')
  const ordenados = datos ? ordenarPorDesempeno(datos.alumnos) : []
  const filtrados = filtro === 'TODOS' ? ordenados : ordenados.filter((item) => item.desempeno === filtro)
  const visibles = verTodos ? filtrados : filtrados.slice(0, VISIBLES)
  const unidad = datos?.unidad
  const enlaceCalificaciones = clase
    ? `/calificaciones?materia=${clase.materiaId}&grupo=${clase.grupo.id}${unidad ? `&unidad=${unidad.id}` : ''}`
    : '/calificaciones'

  return (
    <section aria-labelledby={idTitulo} className="@container rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="agenda-eyebrow">Calificaciones</p>
          <h2 id={idTitulo} className="text-xl font-semibold tracking-tight text-foreground">Desempeño por unidad</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={alternarOcultas} aria-pressed={ocultas}
            aria-label={ocultas ? 'Mostrar calificaciones' : 'Ocultar calificaciones'}>
            {ocultas ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
            {ocultas ? 'Mostrar' : 'Ocultar'}<span className="@max-[30rem]:sr-only"> calificaciones</span>
          </Button>
          <Button variant="outline" onClick={() => setCriteriosAbierto(true)} disabled={!clase}>
            <SlidersHorizontal aria-hidden="true" />
            Editar criterios
          </Button>
          <Link to={enlaceCalificaciones} className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-sm font-medium text-primary-ink underline-offset-4 hover:underline">
            Abrir en Calificaciones
          </Link>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 @min-[40rem]:flex-row @min-[40rem]:items-end">
        <label className="flex flex-col gap-1.5 @min-[40rem]:w-72">
          <span className="text-[13px] font-medium text-foreground">Clase</span>
          <select value={clase?.clave ?? ''} onChange={elegirClase} className={CAMPO}>
            {clases.map((item) => (
              <option key={item.clave} value={item.clave}>{item.nombre} · {item.grupo.nombre}</option>
            ))}
          </select>
        </label>
        {datos?.unidades?.length > 0 && (
          <div className="flex min-w-0 flex-col items-start gap-1.5">
            <span className="text-[13px] font-medium text-foreground" aria-hidden="true">Unidad</span>
            <Segmentado label="Unidad" value={unidad?.id} onChange={elegirUnidad}
              options={datos.unidades.map((item) => ({
                value: item.id,
                label: <>U{item.orden}<span className="sr-only"> — {item.nombre}{ESTADO_UNIDAD[item.status] ? `, ${ESTADO_UNIDAD[item.status]}` : ''}</span></>,
              }))} />
          </div>
        )}
      </div>

      {error ? (
        <div className="mt-4"><TaskNotice error={error} onRetry={() => setVersion((actual) => actual + 1)} /></div>
      ) : !datos ? (
        cargando ? (
          <div role="status" aria-label="Cargando desempeño" className="mt-4 space-y-2">
            <Skeleton className="h-14 rounded-[12px]" />
            <Skeleton className="h-40 rounded-[14px]" />
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No hay datos de desempeño para esta clase.</p>
        )
      ) : !unidad ? (
        <p className="mt-4 text-sm text-muted-foreground">Esta materia todavía no tiene unidades.</p>
      ) : (
        <div aria-busy={cargando || undefined} className={cn('mt-4 space-y-4 transition-opacity', cargando && 'opacity-60')}>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{unidad.nombre}</span>
            {ESTADO_UNIDAD[unidad.status] && ` · ${ESTADO_UNIDAD[unidad.status]}`}
            {criterios.length > 0 && ` · ${datos.origenCriterios === 'PREDETERMINADA' ? 'Predeterminada: ' : ''}${resumenCriterios(criterios)}`}
            {datos.origenCriterios === 'UNIDAD' && ' (porcentajes propios de la unidad)'}
          </p>

          {datos.alumnos.length === 0 ? (
            <p className="rounded-[14px] border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              Todavía no hay alumnos inscritos en {clase.grupo.nombre}.
            </p>
          ) : (
            <>
              <FiltroDesempeno resumen={datos.resumen} value={filtro} onChange={(valor) => { setFiltro(valor); setVerTodos(false) }}
                className="@max-[30rem]:grid-flow-row @max-[30rem]:grid-cols-3" />
              {datos.actividadesSinCriterio > 0 && (
                <p className="text-sm text-warning-foreground">
                  {datos.actividadesSinCriterio === 1 ? '1 actividad no tiene' : `${datos.actividadesSinCriterio} actividades no tienen`} un criterio de este grupo y no cuenta{datos.actividadesSinCriterio === 1 ? '' : 'n'}.{' '}
                  <Link to={`/tareas?materia=${clase.materiaId}&grupo=${clase.grupo.id}`} className="font-medium underline underline-offset-2">Revisar en Tareas</Link>
                </p>
              )}
              {ocultas ? (
                <p className="rounded-[14px] border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  Calificaciones ocultas. Usa «Mostrar calificaciones» para verlas.
                </p>
              ) : filtrados.length === 0 ? (
                <p className="rounded-[14px] border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  Ningún alumno en este estado.
                </p>
              ) : isMobile ? (
                <ListaDesempeno alumnos={visibles} columnas={columnas} asistencia={asistencia} umbrales={datos.umbrales} />
              ) : (
                <TablaDesempeno alumnos={visibles} columnas={columnas} asistencia={asistencia} umbrales={datos.umbrales}
                  titulo={`${clase.nombre} · ${clase.grupo.nombre}, ${unidad.nombre}. Primero los reprobados y en riesgo.`} />
              )}
              {!ocultas && filtrados.length > VISIBLES && (
                <Button variant="ghost" onClick={() => setVerTodos(!verTodos)} aria-expanded={verTodos}>
                  <ChevronDown aria-hidden="true" className={cn('transition-transform', verTodos && 'rotate-180')} />
                  {verTodos ? 'Ver menos' : `Ver los ${filtrados.length}`}
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {clase && (
        <CriteriosModal open={criteriosAbierto} onClose={() => setCriteriosAbierto(false)}
          materiaId={clase.materiaId} grupo={clase.grupo} materiaNombre={clase.nombre}
          alcanceInicial={unidad?.id ?? 'base'} onGuardado={() => setVersion((actual) => actual + 1)} />
      )}
    </section>
  )
}

function detalleCriterio(criterio, valor) {
  if (!valor) return null
  if (criterio.tipo === 'PARTICIPACION') return `${valor.puntos ?? 0} de ${criterio.meta ?? '—'} pts`
  return `${valor.calificadas}/${valor.total}`
}

function detalleAsistencia(item) {
  const partes = []
  if (item.asistencia.faltas) partes.push(`${item.asistencia.faltas} F`)
  if (item.asistencia.retardos) partes.push(`${item.asistencia.retardos} R`)
  return partes.join(' · ')
}

function Valor({ valor, sufijo = '' }) {
  if (typeof valor !== 'number') {
    return <><span aria-hidden="true">—</span><span className="sr-only">sin calificar</span></>
  }
  return <>{valorCorto(valor)}{sufijo}</>
}

function TablaDesempeno({ alumnos, columnas, asistencia, umbrales, titulo }) {
  const idTabla = useId()
  return (
    <div role="region" aria-labelledby={idTabla} tabIndex={0} className="overflow-x-auto rounded-[14px] border border-border focus-visible:outline-2 focus-visible:outline-ring">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <caption id={idTabla} className="sr-only">{titulo}</caption>
        <thead className="bg-muted/60 text-xs text-muted-foreground">
          <tr className="align-bottom">
            <th scope="col" className="min-w-44 px-3 py-2.5 text-left font-medium">Alumno</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Promedio</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">
              Asistencia
              {asistencia && <span className="block whitespace-nowrap font-normal">{asistencia.peso} %</span>}
            </th>
            {columnas.map((criterio) => (
              <th key={criterio.clave} scope="col" className="px-3 py-2.5 text-right font-medium">
                {criterio.nombre}
                <span className="block whitespace-nowrap font-normal">{criterio.peso} %</span>
              </th>
            ))}
            <th scope="col" className="min-w-36 px-3 py-2.5 text-left font-medium">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {alumnos.map((item) => {
            const valores = Object.fromEntries((item.criterios ?? []).map((valor) => [valor.clave, valor]))
            const motivos = textoMotivos(item, umbrales)
            return (
              <tr key={item.alumno.id} className="align-top">
                <th scope="row" className="px-3 py-2.5 text-left font-medium text-foreground">
                  {item.alumno.nombre}
                  {item.alumno.numeroControl && <span className="block text-xs font-normal text-muted-foreground">{item.alumno.numeroControl}</span>}
                </th>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-foreground">
                  <Valor valor={item.calificacion} />
                  {item.fuente === 'MANUAL' && <span className="block text-xs font-normal text-muted-foreground">a mano</span>}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                  <Valor valor={item.asistencia.porcentaje} sufijo=" %" />
                  {detalleAsistencia(item) && <span className="block text-xs text-muted-foreground">{detalleAsistencia(item)}</span>}
                </td>
                {columnas.map((criterio) => (
                  <td key={criterio.clave} className="px-3 py-2.5 text-right tabular-nums text-foreground">
                    <Valor valor={valores[criterio.clave]?.valor} />
                    {detalleCriterio(criterio, valores[criterio.clave]) && (
                      <span className="block text-xs text-muted-foreground">{detalleCriterio(criterio, valores[criterio.clave])}</span>
                    )}
                  </td>
                ))}
                <td className="px-3 py-2.5">
                  <DesempenoChip estado={item.desempeno} />
                  {motivos.length > 0 && <span className="mt-1 block text-xs text-muted-foreground">{motivos.join(' · ')}</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ListaDesempeno({ alumnos, columnas, asistencia, umbrales }) {
  const [abierto, setAbierto] = useState(null)
  return (
    <ul className="divide-y divide-border rounded-[14px] border border-border">
      {alumnos.map((item) => {
        const valores = Object.fromEntries((item.criterios ?? []).map((valor) => [valor.clave, valor]))
        const expandido = abierto === item.alumno.id
        const motivos = textoMotivos(item, umbrales)
        return (
          <li key={item.alumno.id}>
            <button type="button" aria-expanded={expandido} onClick={() => setAbierto(expandido ? null : item.alumno.id)}
              className="flex min-h-12 w-full items-center gap-3 px-3 py-2.5 text-left">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{item.alumno.nombre}</span>
                {motivos.length > 0 && <span className="block text-xs text-muted-foreground">{motivos.join(' · ')}</span>}
              </span>
              <span className="text-sm font-semibold tabular-nums text-foreground"><Valor valor={item.calificacion} /></span>
              <DesempenoChip estado={item.desempeno} />
              <ChevronDown aria-hidden="true" className={cn('size-4 shrink-0 text-muted-foreground transition-transform', expandido && 'rotate-180')} />
            </button>
            {expandido && (
              <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-3 pb-3 text-sm">
                <dt className="text-muted-foreground">Asistencia{asistencia ? ` · ${asistencia.peso} %` : ''}</dt>
                <dd className="text-right tabular-nums text-foreground"><Valor valor={item.asistencia.porcentaje} sufijo=" %" /></dd>
                {columnas.map((criterio) => (
                  <div key={criterio.clave} className="contents">
                    <dt className="text-muted-foreground">{criterio.nombre} · {criterio.peso} %</dt>
                    <dd className="text-right tabular-nums text-foreground">
                      <Valor valor={valores[criterio.clave]?.valor} />
                      {detalleCriterio(criterio, valores[criterio.clave]) && <span className="ml-1.5 text-xs text-muted-foreground">({detalleCriterio(criterio, valores[criterio.clave])})</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        )
      })}
    </ul>
  )
}

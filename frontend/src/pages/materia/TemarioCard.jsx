import { useCallback, useEffect, useId, useState } from 'react'
import { FileDown, FileSpreadsheet, Plus, X } from 'lucide-react'
import api from '@/api/axios'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { descargarArchivo, mensajeDeBlob } from '@/lib/descargas'
import { confirmAction, notify } from '@/lib/feedback'
import { cn } from '@/lib/utils'

const CAMPO = 'h-9 w-full rounded-[10px] border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 aria-invalid:border-destructive sm:text-sm'

function fechaCorta(valor) {
  return new Date(valor).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

/**
 * Una línea pegada del programa: «Modelo OSI» o, copiada de Excel con dos
 * columnas, «Modelo OSI⇥3» (la semana planeada).
 */
function temaDeLinea(linea) {
  const [nombre, semana] = linea.split('\t').map((parte) => parte.trim())
  const numero = Number(semana)
  return { nombre, semana: Number.isInteger(numero) && numero > 0 ? String(numero) : '' }
}

function EstadoTema({ tema, conGrupo }) {
  if (!conGrupo) {
    return tema.semana ? <span className="text-xs text-muted-foreground">Semana {tema.semana}</span> : null
  }
  if (tema.estado === 'VISTO') {
    return <span className="rounded-full bg-success/22 px-2 py-0.5 text-xs font-medium text-success-foreground">Visto el {fechaCorta(tema.vistoEn)}</span>
  }
  if (tema.estado === 'ATRASADO') {
    return <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium text-warning-foreground">Atrasado · semana {tema.semana}</span>
  }
  return <span className="text-xs text-muted-foreground">{tema.semana ? `Semana ${tema.semana}` : 'Pendiente'}</span>
}

function EditorTemas({ unidad, onCancelar, onGuardado }) {
  const id = useId()
  const [filas, setFilas] = useState(() => unidad.temas.map((tema) => ({ id: tema.id, nombre: tema.nombre, semana: tema.semana ? String(tema.semana) : '' })))
  const [pegado, setPegado] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const invalida = (fila) => fila.semana !== '' && !(Number.isInteger(Number(fila.semana)) && Number(fila.semana) >= 1 && Number(fila.semana) <= 30)
  const errores = filas.filter((fila) => fila.nombre.trim() === '' || invalida(fila)).length
  const cambiar = (indice, cambio) => setFilas((prev) => prev.map((fila, i) => (i === indice ? { ...fila, ...cambio } : fila)))

  const agregarPegado = () => {
    const nuevas = pegado.split('\n').map((linea) => linea.trim()).filter(Boolean).map(temaDeLinea)
    setFilas((prev) => [...prev, ...nuevas])
    setPegado(null)
  }

  const guardar = async () => {
    const quitados = unidad.temas.filter((tema) => tema.estado === 'VISTO' && !filas.some((fila) => fila.id === tema.id))
    if (quitados.length && !(await confirmAction({
      title: 'Quitar temas ya vistos',
      description: `${quitados.map((tema) => tema.nombre).join(', ')} ya se ${quitados.length === 1 ? 'marcó' : 'marcaron'} en clase. Si ${quitados.length === 1 ? 'lo quitas' : 'los quitas'}, también se borra de la bitácora.`,
      confirmLabel: 'Quitar y guardar',
    }))) return
    setGuardando(true)
    try {
      const { data } = await api.put(`/temario/unidad/${unidad.id}`, {
        temas: filas.map((fila) => ({
          ...(fila.id ? { id: fila.id } : {}),
          nombre: fila.nombre.trim(),
          semana: fila.semana === '' ? null : Number(fila.semana),
        })),
      })
      onGuardado(data)
      notify(`Guardaste el temario de ${unidad.nombre}.`, 'success')
    } catch (err) {
      const mensaje = err.response?.data?.message
      notify(Array.isArray(mensaje) ? mensaje.join(' ') : mensaje ?? 'No se pudo guardar el temario.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="mt-3 space-y-3">
      {filas.length > 0 && (
        <div className="hidden grid-cols-[minmax(0,1fr)_6rem_2.25rem] gap-2 text-xs font-medium text-muted-foreground sm:grid">
          <span>Tema</span><span>Semana</span><span className="sr-only">Quitar</span>
        </div>
      )}
      <ol className="space-y-2">
        {filas.map((fila, indice) => (
          <li key={fila.id ?? `nuevo-${indice}`} className="grid grid-cols-[minmax(0,1fr)_5rem_2.25rem] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_2.25rem]">
            <input aria-label={`Tema ${indice + 1}`} className={CAMPO} value={fila.nombre} maxLength={300}
              aria-invalid={fila.nombre.trim() === ''} onChange={(event) => cambiar(indice, { nombre: event.target.value })} />
            <input aria-label={`Semana planeada del tema ${indice + 1}`} className={cn(CAMPO, 'text-center tabular-nums')} inputMode="numeric"
              placeholder="—" value={fila.semana} aria-invalid={invalida(fila)} onChange={(event) => cambiar(indice, { semana: event.target.value.trim() })} />
            <Button variant="ghost" size="icon" type="button" className="size-9" aria-label={`Quitar el tema ${indice + 1}`}
              onClick={() => setFilas((prev) => prev.filter((_, i) => i !== indice))}>
              <X aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ol>

      {pegado !== null ? (
        <div className="space-y-2">
          <label htmlFor={`${id}-pegar`} className="block text-sm font-medium text-foreground">Pega los temas, uno por renglón</label>
          <textarea id={`${id}-pegar`} rows={5} value={pegado} onChange={(event) => setPegado(event.target.value)}
            placeholder={'1.1 Modelo OSI\n1.2 Arquitectura TCP/IP\n…'}
            className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 sm:text-sm" />
          <p className="text-xs text-muted-foreground">Si los copias de Excel con una segunda columna de semana, se toma como semana planeada.</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={agregarPegado} disabled={!pegado.trim()}>Agregar a la lista</Button>
            <Button type="button" variant="ghost" onClick={() => setPegado(null)}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="gap-1.5" onClick={() => setFilas((prev) => [...prev, { nombre: '', semana: '' }])}>
            <Plus aria-hidden="true" />Agregar tema
          </Button>
          <Button type="button" variant="ghost" onClick={() => setPegado('')}>Pegar lista</Button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
        {errores > 0 && <p className="mr-auto text-xs text-destructive-foreground">Revisa {errores === 1 ? 'un tema' : `${errores} temas`}: sin nombre o con una semana fuera de 1 a 30.</p>}
        <Button type="button" variant="outline" onClick={onCancelar} disabled={guardando}>Cancelar</Button>
        <Button type="button" onClick={guardar} disabled={guardando || errores > 0}>{guardando ? 'Guardando…' : 'Guardar temario'}</Button>
      </div>
    </div>
  )
}

/**
 * Temario de la materia por unidad y, con un grupo elegido, su avance: qué se
 * vio en sus clases y qué va atrasado contra la semana planeada.
 */
export default function TemarioCard({ materia, grupo, puedeEditar }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [editando, setEditando] = useState(null)
  const [descargando, setDescargando] = useState(null)
  const grupoId = grupo?.id ?? null

  const cargar = useCallback(() => api.get('/temario', { params: { materiaId: materia.id, ...(grupoId ? { grupoId } : {}) } }), [materia.id, grupoId])
  useEffect(() => {
    let vigente = true
    cargar()
      .then(({ data }) => {
        if (!vigente) return
        setDatos(data)
        setError('')
      })
      .catch((err) => { if (vigente) setError(err.response?.data?.message ?? 'No se pudo cargar el temario.') })
    return () => { vigente = false }
  }, [cargar])

  // Guardar devuelve el temario sin grupo: se vuelve a pedir para el avance.
  const recargar = async () => {
    setEditando(null)
    const { data } = await cargar()
    setDatos(data)
  }

  const descargar = async (formato) => {
    setDescargando(formato)
    try {
      const respuesta = await api.get('/temario/exportar', { params: { materiaId: materia.id, grupoId, formato }, responseType: 'blob' })
      descargarArchivo(respuesta.data, `avance-${materia.clave ?? materia.id}-${grupo.nombre}.${formato === 'pdf' ? 'pdf' : 'xlsx'}`.replace(/\s+/g, '-').toLowerCase())
    } catch (err) {
      notify((await mensajeDeBlob(err.response?.data)) ?? 'No se pudo descargar el avance.')
    } finally {
      setDescargando(null)
    }
  }

  const avance = datos?.avance
  return (
    <section aria-labelledby="temario-titulo" className="rounded-[var(--radius-card)] border border-border bg-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 id="temario-titulo" className="text-lg font-semibold text-foreground">Temario y avance</h2>
          {avance && datos.periodo ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {grupo.nombre}: <span className="font-medium text-foreground">{avance.vistos} de {avance.total} temas vistos ({avance.porcentaje} %)</span>
              {' · '}semana {datos.periodo.semanaActual} de {datos.periodo.semanas}
              {avance.planeadosALaFecha > 0 && ` · a esta semana se planeaban ${avance.planeadosALaFecha}`}
              {avance.atrasados > 0 && <span className="text-warning-foreground"> · {avance.atrasados} {avance.atrasados === 1 ? 'atrasado' : 'atrasados'}</span>}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Los temas de cada unidad. {grupo ? '' : 'Elige un grupo arriba para ver su avance.'} Se marcan como vistos al finalizar cada clase.
            </p>
          )}
        </div>
        {avance && avance.total > 0 && (
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" type="button" className="gap-1.5" disabled={descargando !== null} onClick={() => descargar('excel')}>
              <FileSpreadsheet aria-hidden="true" />{descargando === 'excel' ? 'Generando…' : 'Excel'}
            </Button>
            <Button variant="outline" type="button" className="gap-1.5" disabled={descargando !== null} onClick={() => descargar('pdf')}>
              <FileDown aria-hidden="true" />{descargando === 'pdf' ? 'Generando…' : 'PDF'}
            </Button>
          </div>
        )}
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive-foreground">{error}</p>
      ) : !datos ? (
        <div role="status" aria-label="Cargando el temario" className="mt-4 space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-16 w-full rounded-[var(--radius-item)]" />
        </div>
      ) : datos.unidades.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">La materia no tiene unidades todavía.</p>
      ) : (
        <div className="mt-4 divide-y divide-border border-y border-border">
          {datos.unidades.map((unidad) => {
            const enEdicion = editando === unidad.id
            const progreso = unidad.avance
            return (
              <div key={unidad.id} className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {unidad.nombre}
                    <span className="font-normal text-muted-foreground">
                      {' · '}{unidad.temas.length === 0 ? 'sin temas' : progreso ? `${progreso.vistos} de ${progreso.total} vistos` : `${unidad.temas.length} ${unidad.temas.length === 1 ? 'tema' : 'temas'}`}
                    </span>
                  </h3>
                  {puedeEditar && !enEdicion && (
                    <Button variant="ghost" type="button" className="h-8 px-2 text-sm" onClick={() => setEditando(unidad.id)}>
                      {unidad.temas.length ? 'Editar temas' : 'Agregar temas'}
                    </Button>
                  )}
                </div>
                {progreso && progreso.total > 0 && !enEdicion && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="meter" aria-valuemin={0} aria-valuemax={progreso.total}
                    aria-valuenow={progreso.vistos} aria-label={`Avance de ${unidad.nombre}: ${progreso.vistos} de ${progreso.total} temas`}>
                    <div className="h-full rounded-full bg-success" style={{ width: `${progreso.porcentaje}%` }} />
                  </div>
                )}
                {enEdicion ? (
                  <EditorTemas unidad={unidad} onCancelar={() => setEditando(null)} onGuardado={recargar} />
                ) : unidad.temas.length > 0 ? (
                  <ol className="mt-2 space-y-1">
                    {unidad.temas.map((tema) => (
                      <li key={tema.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1 text-sm">
                        <span className={cn('min-w-0', tema.estado === 'VISTO' && grupo ? 'text-muted-foreground' : 'text-foreground')}>
                          <span className="tabular-nums text-muted-foreground">{tema.orden}.</span> {tema.nombre}
                        </span>
                        <EstadoTema tema={tema} conGrupo={Boolean(grupo)} />
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {puedeEditar ? 'Agrega los temas de esta unidad; puedes pegarlos del programa de la materia.' : 'Sin temas.'}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

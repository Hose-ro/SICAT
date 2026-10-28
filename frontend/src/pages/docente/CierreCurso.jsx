import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FileDown, FileSpreadsheet, Lock, LockOpen, PencilLine, RotateCcw } from 'lucide-react'
import api from '@/api/axios'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import TaskNotice from '@/components/TaskNotice'
import useUnsavedChangesGuard from '@/hooks/useUnsavedChangesGuard'
import { moverFoco } from '@/lib/capturaTeclado'
import { descargarArchivo, mensajeDeBlob } from '@/lib/descargas'
import { confirmAction, notify } from '@/lib/feedback'
import { cn } from '@/lib/utils'
import { Segmentado } from './components/tareas/Controles'

const NIVEL = { EXCELENTE: 'Excelente', NOTABLE: 'Notable', BUENO: 'Bueno', SUFICIENTE: 'Suficiente', INSUFICIENTE: 'Insuficiente' }
const RESULTADO = {
  ACREDITADO: { etiqueta: 'Acreditado', tono: 'bg-success/22 text-success-foreground' },
  NO_ACREDITADO: { etiqueta: 'No acreditado', tono: 'bg-destructive/18 text-destructive-foreground' },
  PENDIENTE: { etiqueta: 'Pendiente', tono: 'bg-warning/20 text-warning-foreground' },
}
const CAMPO = 'h-9 w-full rounded-[10px] border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-50 aria-invalid:border-destructive sm:text-sm'

const nota = (valor) => (valor == null ? '—' : Number.isInteger(valor) ? String(valor) : valor.toFixed(1))
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`
const clave = (alumnoId, unidadId) => `${alumnoId}:${unidadId}`

function fechaLarga(valor) {
  return new Date(valor).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })
}

/** Lo que el servidor tiene de la segunda oportunidad, en la forma del formulario. */
function borradoresDe(datos) {
  const borradores = {}
  for (const item of datos?.alumnos ?? []) {
    for (const celda of item.unidades) {
      if (celda.primera != null && celda.primera < datos.aprobatoria) {
        borradores[clave(item.alumno.id, celda.unidadId)] = {
          calificacion: celda.segunda == null ? '' : String(celda.segunda),
          noPresento: celda.noPresento,
        }
      }
    }
  }
  return borradores
}

const aNumero = (texto) => Number(String(texto).trim().replace(',', '.'))

function invalida({ calificacion, noPresento }) {
  if (noPresento || calificacion.trim() === '') return false
  const valor = aNumero(calificacion)
  return !Number.isFinite(valor) || valor < 0 || valor > 100
}

function manualInvalida(valor) {
  if (String(valor).trim() === '') return false
  const numero = aNumero(valor)
  return !Number.isFinite(numero) || numero < 1 || numero > 100
}

/** Captura manual guardada y cálculo de respaldo por alumno y unidad. */
function manualesDe(reporte, datos) {
  const filas = new Map(
    (reporte?.rows ?? []).map((fila) => [clave(fila.alumno?.id, fila.unidad?.id), fila]),
  )
  return Object.fromEntries((datos?.alumnos ?? []).flatMap((item) =>
    (datos?.unidades ?? []).map((unidad) => {
      const llave = clave(item.alumno.id, unidad.id)
      const fila = filas.get(llave)
      return [llave, {
        alumnoId: item.alumno.id,
        unidadId: unidad.id,
        calificacion: fila?.calificacionManual == null ? '' : String(fila.calificacionManual),
        calculada: typeof fila?.calificacionCalculada === 'number' ? fila.calificacionCalculada : null,
      }]
    }),
  ))
}

/**
 * Cierre del curso (TecNM): primera y segunda oportunidad por unidad,
 * calificación final y nivel de desempeño, y el concentrado que se entrega.
 */
export default function CierreCurso() {
  const [params, setParams] = useSearchParams()
  const materiaId = Number(params.get('materia')) || null
  const grupoId = Number(params.get('grupo')) || null
  const [materias, setMaterias] = useState(null)
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)
  const [servidor, setServidor] = useState({})
  const [borradores, setBorradores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [accion, setAccion] = useState(null)
  const [filtro, setFiltro] = useState('TODOS')
  const [capturaManual, setCapturaManual] = useState(false)
  const [cargandoManual, setCargandoManual] = useState(false)
  const [guardandoManual, setGuardandoManual] = useState(false)
  const [manualServidor, setManualServidor] = useState({})
  const [manualBorradores, setManualBorradores] = useState({})

  useEffect(() => {
    api.get('/materias/mis-materias')
      .then(({ data }) => setMaterias(data ?? []))
      .catch(() => setMaterias([]))
  }, [])

  const materia = materias?.find((item) => item.id === materiaId) ?? null
  const elegir = useCallback((cambios) => setParams((actual) => {
    const siguiente = new URLSearchParams(actual)
    Object.entries(cambios).forEach(([nombre, valor]) => (valor ? siguiente.set(nombre, String(valor)) : siguiente.delete(nombre)))
    return siguiente
  }, { replace: true }), [setParams])

  // Con una sola opción no tiene sentido obligar a elegirla.
  useEffect(() => {
    if (!materias) return
    if (!materiaId && materias.length === 1) elegir({ materia: materias[0].id })
    else if (materia && !grupoId && materia.grupos?.length === 1) elegir({ grupo: materia.grupos[0].id })
  }, [materias, materia, materiaId, grupoId, elegir])

  const aplicar = useCallback((nuevos) => {
    setDatos(nuevos)
    const base = borradoresDe(nuevos)
    setServidor(base)
    setBorradores(base)
  }, [])

  useEffect(() => {
    if (!materiaId || !grupoId) {
      setDatos(null)
      return undefined
    }
    let activo = true
    setError('')
    setDatos(null)
    api.get('/calificaciones/cierre', { params: { materiaId, grupoId } })
      .then(({ data }) => { if (activo) aplicar(data) })
      .catch((err) => { if (activo) setError(err.response?.data?.message ?? 'No se pudo cargar el cierre del curso.') })
    return () => { activo = false }
  }, [materiaId, grupoId, intento, aplicar])

  const cambiados = Object.keys(borradores).filter((llave) =>
    borradores[llave].calificacion !== servidor[llave]?.calificacion || borradores[llave].noPresento !== servidor[llave]?.noPresento)
  const invalidos = cambiados.filter((llave) => invalida(borradores[llave]))
  const manualCambiados = Object.keys(manualBorradores).filter((llave) =>
    manualBorradores[llave].calificacion !== manualServidor[llave]?.calificacion)
  const manualInvalidos = manualCambiados.filter((llave) => manualInvalida(manualBorradores[llave].calificacion))
  const cambiosSinGuardar = cambiados.length + manualCambiados.length
  useUnsavedChangesGuard(cambiosSinGuardar > 0, useMemo(() => ({
    title: 'Calificaciones sin guardar',
    description: `Si sales ahora se ${cambiosSinGuardar === 1 ? 'pierde' : 'pierden'} ${plural(cambiosSinGuardar, 'calificación', 'calificaciones')}.`,
    confirmLabel: 'Salir sin guardar',
  }), [cambiosSinGuardar]))

  const limpiarCapturaManual = useCallback(() => {
    setCapturaManual(false)
    setManualServidor({})
    setManualBorradores({})
  }, [])

  const abrirCapturaManual = async () => {
    if (cambiados.length) {
      notify('Guarda o descarta primero los cambios de segunda oportunidad.')
      return
    }
    setCargandoManual(true)
    try {
      const { data: reporte } = await api.get('/calificaciones/docente', { params: { materiaId, grupoId } })
      const base = manualesDe(reporte, datos)
      setManualServidor(base)
      setManualBorradores(base)
      setCapturaManual(true)
      setFiltro('TODOS')
    } catch (err) {
      notify(err.response?.data?.message ?? 'No se pudo abrir la captura manual.')
    } finally {
      setCargandoManual(false)
    }
  }

  const cancelarCapturaManual = async () => {
    if (manualCambiados.length && !(await confirmAction({
      title: 'Salir de la captura manual',
      description: `Se ${manualCambiados.length === 1 ? 'perderá' : 'perderán'} ${plural(manualCambiados.length, 'calificación', 'calificaciones')} sin guardar.`,
      confirmLabel: 'Salir sin guardar',
    }))) return
    limpiarCapturaManual()
  }

  const guardarManuales = async () => {
    if (!manualCambiados.length || manualInvalidos.length || guardandoManual) return
    setGuardandoManual(true)
    try {
      const { data: reporte } = await api.patch('/calificaciones/manual/lote', {
        materiaId,
        grupoId,
        calificaciones: manualCambiados.map((llave) => {
          const item = manualBorradores[llave]
          return {
            alumnoId: item.alumnoId,
            unidadId: item.unidadId,
            calificacionManual: item.calificacion.trim() === '' ? null : aNumero(item.calificacion),
          }
        }),
      }, { params: { grupoId } })
      const cantidad = manualCambiados.length
      const baseGuardada = manualesDe(reporte, datos)
      setManualServidor(baseGuardada)
      setManualBorradores(baseGuardada)
      try {
        const { data: cierreActualizado } = await api.get('/calificaciones/cierre', { params: { materiaId, grupoId } })
        aplicar(cierreActualizado)
        const baseActualizada = manualesDe(reporte, cierreActualizado)
        setManualServidor(baseActualizada)
        setManualBorradores(baseActualizada)
      } catch {
        notify('Las calificaciones sí se guardaron, pero no se pudo actualizar el concentrado. Recarga la página para ver el resultado.')
        return
      }
      notify(`Se ${cantidad === 1 ? 'guardó' : 'guardaron'} ${plural(cantidad, 'calificación manual', 'calificaciones manuales')}.`, 'success')
    } catch (err) {
      notify(err.response?.data?.message ?? 'No se pudieron guardar las calificaciones manuales.')
    } finally {
      setGuardandoManual(false)
    }
  }

  const cambiarSeleccion = async (cambios) => {
    if (cambiosSinGuardar && !(await confirmAction({
      title: 'Cambiar de curso',
      description: `Se ${cambiosSinGuardar === 1 ? 'perderá' : 'perderán'} ${plural(cambiosSinGuardar, 'calificación', 'calificaciones')} sin guardar.`,
      confirmLabel: 'Cambiar sin guardar',
    }))) return
    limpiarCapturaManual()
    elegir(cambios)
  }

  const guardarSegunda = async () => {
    if (!cambiados.length || invalidos.length || guardando) return
    setGuardando(true)
    try {
      const { data } = await api.patch('/calificaciones/cierre/segunda', {
        materiaId,
        grupoId,
        capturas: cambiados.map((llave) => {
          const [alumnoId, unidadId] = llave.split(':').map(Number)
          const { calificacion, noPresento } = borradores[llave]
          return { alumnoId, unidadId, noPresento, calificacion: noPresento || calificacion.trim() === '' ? null : aNumero(calificacion) }
        }),
      })
      aplicar(data)
      notify(`Guardaste ${plural(cambiados.length, 'calificación', 'calificaciones')} de segunda oportunidad.`, 'success')
    } catch (err) {
      notify(err.response?.data?.message ?? 'No se pudo guardar la segunda oportunidad.')
    } finally {
      setGuardando(false)
    }
  }

  const cerrar = async () => {
    if (cambiosSinGuardar) {
      notify('Guarda o descarta las calificaciones antes de cerrar el curso.')
      return
    }
    if (!(await confirmAction({
      title: `Cerrar ${datos.materia.nombre} · ${datos.grupo?.nombre}`,
      description: `Se guarda el concentrado: ${plural(datos.resumen.acreditados, 'acreditado', 'acreditados')} y ${plural(datos.resumen.noAcreditados, 'no acreditado', 'no acreditados')}. Después, las calificaciones de este grupo no se pueden cambiar sin reabrir el curso.`,
      confirmLabel: 'Cerrar curso',
    }))) return
    setAccion('cerrar')
    try {
      const { data } = await api.post('/calificaciones/cierre', { materiaId, grupoId })
      aplicar(data)
      notify('Cerraste el curso. Ya puedes descargar el concentrado.', 'success')
    } catch (err) {
      notify(err.response?.data?.message ?? 'No se pudo cerrar el curso.')
    } finally {
      setAccion(null)
    }
  }

  const reabrir = async () => {
    if (!(await confirmAction({
      title: 'Reabrir el curso',
      description: 'El concentrado guardado se descarta. Al volver a cerrar se genera de nuevo con las calificaciones de ese momento.',
      confirmLabel: 'Reabrir',
    }))) return
    setAccion('reabrir')
    try {
      const { data } = await api.delete('/calificaciones/cierre', { params: { materiaId, grupoId } })
      aplicar(data)
      notify('El curso está abierto otra vez.', 'success')
    } catch (err) {
      notify(err.response?.data?.message ?? 'No se pudo reabrir el curso.')
    } finally {
      setAccion(null)
    }
  }

  const descargar = async (formato) => {
    setAccion(formato)
    try {
      const respuesta = await api.get('/calificaciones/cierre/exportar', {
        params: { materiaId, grupoId, formato },
        responseType: 'blob',
      })
      const nombre = [`concentrado-${datos.materia.clave ?? datos.materia.id}`, datos.grupo?.nombre, datos.cierre ? null : 'preliminar']
        .filter(Boolean).join('-').replace(/\s+/g, '-').toLowerCase()
      descargarArchivo(respuesta.data, `${nombre}.${formato === 'pdf' ? 'pdf' : 'xlsx'}`)
    } catch (err) {
      notify((await mensajeDeBlob(err.response?.data)) ?? 'No se pudo descargar el concentrado.')
    } finally {
      setAccion(null)
    }
  }

  const titulo = (
    <header>
      <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-foreground">Cierre de curso</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {datos
          ? `${datos.materia.nombre} · ${datos.grupo?.nombre ?? ''} · Periodo ${datos.periodo}`
          : 'Primera y segunda oportunidad, calificación final y el concentrado del grupo.'}
      </p>
    </header>
  )

  const selectores = materias && materias.length > 0 && (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex flex-col gap-1 sm:w-72">
        <span className="text-sm font-medium text-foreground">Materia</span>
        <select className={CAMPO} value={materiaId ?? ''} onChange={(event) => cambiarSeleccion({ materia: event.target.value, grupo: null })}>
          <option value="">Elige una materia</option>
          {materias.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
        </select>
      </label>
      {materia && (
        <label className="flex flex-col gap-1 sm:w-48">
          <span className="text-sm font-medium text-foreground">Grupo</span>
          <select className={CAMPO} value={grupoId ?? ''} onChange={(event) => cambiarSeleccion({ grupo: event.target.value })}>
            <option value="">Elige un grupo</option>
            {(materia.grupos ?? []).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            {/* Un grupo que llega por enlace y no está en la lista igual se ve elegido. */}
            {datos?.grupo && !(materia.grupos ?? []).some((item) => item.id === datos.grupo.id) && (
              <option value={datos.grupo.id}>{datos.grupo.nombre}</option>
            )}
          </select>
        </label>
      )}
    </div>
  )

  let contenido
  if (error) {
    contenido = <TaskNotice error={error} onRetry={() => setIntento((n) => n + 1)} />
  } else if (!materiaId || !grupoId) {
    contenido = (
      <p className="rounded-[var(--radius-card)] border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
        {materias?.length === 0 ? 'No tienes materias asignadas en este periodo.' : 'Elige la materia y el grupo que quieres cerrar.'}
      </p>
    )
  } else if (!datos) {
    contenido = (
      <div role="status" aria-label="Cargando el cierre del curso" className="space-y-3">
        <Skeleton className="h-24 w-full rounded-[var(--radius-card)]" />
        <Skeleton className="h-72 w-full rounded-[var(--radius-card)]" />
      </div>
    )
  } else {
    contenido = (
      <>
        <Estado datos={datos} accion={accion} bloqueoCierre={cambiosSinGuardar > 0 || capturaManual} onCerrar={cerrar} onReabrir={reabrir} onDescargar={descargar} />
        <SegundaOportunidad datos={datos} borradores={borradores} servidor={servidor}
          cerrado={Boolean(datos.cierre)} capturaManual={capturaManual}
          onCambiar={(llave, cambio) => setBorradores((prev) => ({ ...prev, [llave]: { ...prev[llave], ...cambio } }))} />
        <Concentrado datos={datos} filtro={filtro} onFiltro={setFiltro}
          capturaManual={capturaManual} cargandoManual={cargandoManual} guardandoManual={guardandoManual}
          manuales={manualBorradores} manualCambiados={manualCambiados.length} manualInvalidos={manualInvalidos.length}
          onAbrirManual={abrirCapturaManual} onCancelarManual={cancelarCapturaManual} onGuardarManual={guardarManuales}
          onCambiarManual={(llave, calificacion) => setManualBorradores((prev) => ({
            ...prev,
            [llave]: { ...prev[llave], calificacion },
          }))} />
        {!capturaManual && cambiados.length > 0 && (
          <div className="sticky bottom-[calc(var(--barra-inferior,0px)+env(safe-area-inset-bottom,0px)+0.75rem)] z-10 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-item)] border border-border bg-card p-3">
            <p className="text-sm font-medium text-foreground" role="status">
              {plural(cambiados.length, 'calificación', 'calificaciones')} de segunda oportunidad sin guardar
              {invalidos.length > 0 && <span className="text-destructive-foreground"> · {plural(invalidos.length, 'está', 'están')} fuera de 0 a 100</span>}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" type="button" disabled={guardando} onClick={() => setBorradores(servidor)}>Descartar</Button>
              <Button type="button" disabled={guardando || invalidos.length > 0} onClick={guardarSegunda}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
            </div>
          </div>
        )}
        {capturaManual && manualCambiados.length > 0 && (
          <div className="sticky bottom-[calc(var(--barra-inferior,0px)+env(safe-area-inset-bottom,0px)+0.75rem)] z-10 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-item)] border border-border bg-card p-3">
            <p className="text-sm font-medium text-foreground" role="status">
              {plural(manualCambiados.length, 'calificación manual', 'calificaciones manuales')} sin guardar
              {manualInvalidos.length > 0 && <span className="text-destructive-foreground"> · {plural(manualInvalidos.length, 'está', 'están')} fuera de 1 a 100</span>}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" type="button" disabled={guardandoManual} onClick={() => setManualBorradores(manualServidor)}>Descartar</Button>
              <Button type="button" disabled={guardandoManual || manualInvalidos.length > 0} onClick={guardarManuales}>{guardandoManual ? 'Guardando…' : 'Guardar calificaciones'}</Button>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="mx-auto max-w-[76rem] space-y-6">
      {titulo}
      {selectores}
      {contenido}
    </div>
  )
}

function Estado({ datos, accion, bloqueoCierre, onCerrar, onReabrir, onDescargar }) {
  const { resumen, cierre } = datos
  const partes = [
    plural(resumen.total, 'alumno', 'alumnos'),
    plural(resumen.acreditados, 'acreditado', 'acreditados'),
    plural(resumen.noAcreditados, 'no acreditado', 'no acreditados'),
    resumen.pendientes ? plural(resumen.pendientes, 'pendiente', 'pendientes') : null,
    resumen.promedio != null ? `promedio ${nota(resumen.promedio)}` : null,
  ].filter(Boolean)
  const ocupado = accion !== null

  return (
    <section aria-labelledby="estado-cierre" className="rounded-[var(--radius-card)] border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <h2 id="estado-cierre" className="flex items-center gap-2 text-lg font-semibold text-foreground">
            {cierre ? <Lock className="size-4 text-success-foreground" aria-hidden="true" /> : <LockOpen className="size-4 text-muted-foreground" aria-hidden="true" />}
            {cierre ? 'Curso cerrado' : 'Curso abierto'}
          </h2>
          <p className="text-sm tabular-nums text-muted-foreground">{partes.join(' · ')}</p>
          {cierre ? (
            <p className="text-sm text-foreground">
              Se cerró el {fechaLarga(cierre.cerradoEn)}{cierre.docente ? ` (${cierre.docente})` : ''}. El concentrado que descargues es el de ese momento.
            </p>
          ) : datos.bloqueos.length > 0 ? (
            <div className="text-sm text-foreground">
              <p className="font-medium">Para cerrar el curso falta:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                {datos.bloqueos.map((bloqueo) => <li key={bloqueo}>{bloqueo}</li>)}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-success-foreground">Todo está calificado: ya puedes cerrar el curso.</p>
          )}
          {cierre?.cambios?.length > 0 && (
            <p role="status" className="rounded-[var(--radius-item)] border border-warning/45 bg-warning/18 px-3 py-2 text-sm text-warning-foreground">
              Después del cierre cambió la calificación de {cierre.cambios.map((item) => `${item.alumno.nombre} (${item.antes ?? 'NA'} → ${item.ahora ?? 'NA'})`).join(', ')}.
              Reabre el curso si el concentrado debe actualizarse.
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" type="button" disabled={ocupado} onClick={() => onDescargar('excel')} className="gap-2">
            <FileSpreadsheet className="size-4" aria-hidden="true" />{accion === 'excel' ? 'Generando…' : 'Excel'}
          </Button>
          <Button variant="outline" type="button" disabled={ocupado} onClick={() => onDescargar('pdf')} className="gap-2">
            <FileDown className="size-4" aria-hidden="true" />{accion === 'pdf' ? 'Generando…' : 'PDF'}
          </Button>
          {cierre ? (
            <Button variant="ghost" type="button" disabled={ocupado} onClick={onReabrir}>
              {accion === 'reabrir' ? 'Reabriendo…' : 'Reabrir curso'}
            </Button>
          ) : (
            <Button type="button" disabled={ocupado || bloqueoCierre || !datos.puedeCerrar} onClick={onCerrar}
              aria-describedby={datos.puedeCerrar ? undefined : 'estado-cierre'}>
              {accion === 'cerrar' ? 'Cerrando…' : 'Cerrar curso'}
            </Button>
          )}
        </div>
      </div>
      {!cierre && (
        <p className="mt-4 text-xs text-muted-foreground">
          Las descargas con el curso abierto salen marcadas como preliminares. Es un concentrado para revisar y capturar en el sistema de la escuela; no sustituye el acta oficial.
        </p>
      )}
    </section>
  )
}

/**
 * Lo que decide el docente por cada alumno que no alcanzó la unidad: le pone
 * la calificación de segunda oportunidad o lo reprueba (sin calificación).
 * En los datos, "reprobar" es `noPresento`.
 */
function SegundaOportunidad({ datos, borradores, servidor, cerrado, capturaManual, onCambiar }) {
  const bloqueado = cerrado || capturaManual
  const porUnidad = datos.unidades
    .map((unidad) => ({
      unidad,
      filas: datos.alumnos
        .map((item) => ({ item, celda: item.unidades.find((celda) => celda.unidadId === unidad.id) }))
        .filter(({ celda }) => celda?.primera != null && celda.primera < datos.aprobatoria),
    }))
    .filter((grupo) => grupo.filas.length)
  if (!porUnidad.length) return null

  return (
    <section aria-labelledby="segunda-oportunidad" className="rounded-[var(--radius-card)] border border-border bg-card p-5 sm:p-6">
      <h2 id="segunda-oportunidad" className="text-lg font-semibold text-foreground">Segunda oportunidad</h2>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        Estos alumnos sacaron menos de {datos.aprobatoria} en la unidad. Ponles la calificación de su segunda oportunidad
        (con {datos.aprobatoria} o más acreditan la unidad) o repruébalos.
        {cerrado
          ? ' El curso está cerrado: reábrelo para cambiar algo.'
          : capturaManual ? ' Sal de la captura manual para editar la segunda oportunidad.' : ''}
      </p>
      <div className="mt-4 space-y-6">
        {porUnidad.map(({ unidad, filas }) => {
          const faltan = filas.filter(({ item }) => {
            const borrador = borradores[clave(item.alumno.id, unidad.id)]
            return borrador && !borrador.noPresento && borrador.calificacion.trim() === ''
          })
          return (
            <div key={unidad.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {unidad.nombre} <span className="font-normal text-muted-foreground">· {plural(filas.length, 'alumno', 'alumnos')}</span>
                </h3>
                {!bloqueado && faltan.length > 0 && (
                  <Button variant="ghost" type="button" className="h-8 px-2 text-sm text-destructive-foreground hover:bg-destructive/18 hover:text-destructive-foreground"
                    onClick={() => faltan.forEach(({ item }) => onCambiar(clave(item.alumno.id, unidad.id), { noPresento: true, calificacion: '' }))}>
                    {faltan.length === filas.length ? 'Reprobar a todos' : faltan.length === 1 ? 'Reprobar al que falta' : `Reprobar a los ${faltan.length} que faltan`}
                  </Button>
                )}
              </div>
              <ul className="mt-2 divide-y divide-border border-y border-border">
                {filas.map(({ item, celda }) => (
                  <FilaSegunda key={item.alumno.id} item={item} celda={celda} unidad={unidad} cerrado={bloqueado}
                    aprobatoria={datos.aprobatoria} borrador={borradores[clave(item.alumno.id, unidad.id)]}
                    guardado={servidor[clave(item.alumno.id, unidad.id)]}
                    onCambiar={(cambio) => onCambiar(clave(item.alumno.id, unidad.id), cambio)} />
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function FilaSegunda({ item, celda, unidad, cerrado, aprobatoria, borrador = { calificacion: '', noPresento: false }, guardado, onCambiar }) {
  const id = `segunda-${item.alumno.id}-${unidad.id}`
  const mal = invalida(borrador)
  const vacia = borrador.calificacion.trim() === ''
  const valor = aNumero(borrador.calificacion)
  const sinGuardar = borrador.calificacion !== guardado?.calificacion || borrador.noPresento !== guardado?.noPresento

  let resultado = { texto: 'Falta decidir', tono: 'text-warning-foreground' }
  if (borrador.noPresento) resultado = { texto: 'Reprueba la unidad', tono: 'text-destructive-foreground' }
  else if (mal) resultado = { texto: 'Escribe un número de 0 a 100', tono: 'text-destructive-foreground' }
  else if (!vacia && valor >= aprobatoria) resultado = { texto: `Acredita la unidad con ${nota(valor)}`, tono: 'text-success-foreground' }
  else if (!vacia) resultado = { texto: `Reprueba la unidad (menos de ${aprobatoria})`, tono: 'text-destructive-foreground' }

  return (
    <li className="grid gap-x-5 gap-y-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto_14rem] sm:items-center">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{item.alumno.nombre}</p>
        <p className="text-xs tabular-nums text-muted-foreground">
          {item.alumno.numeroControl ?? 'Sin número de control'} · sacó <span className="font-medium text-destructive-foreground">{nota(celda.primera)}</span> en primera oportunidad
        </p>
      </div>

      <div className="flex items-center gap-2">
        {borrador.noPresento ? (
          <p className="flex h-9 w-[10.5rem] items-center rounded-[10px] bg-destructive/18 px-3 text-sm font-medium text-destructive-foreground">Reprobado</p>
        ) : (
          <div className="flex w-[10.5rem] items-center justify-between gap-2">
            <label htmlFor={id} className="text-sm text-muted-foreground">Calificación</label>
            <input id={id} type="text" inputMode="decimal" autoComplete="off" placeholder="0–100"
              className={cn(CAMPO, 'w-20 text-center tabular-nums')} disabled={cerrado} aria-invalid={mal}
              aria-describedby={`${id}-resultado`}
              value={borrador.calificacion}
              onChange={(event) => onCambiar({ calificacion: event.target.value })} />
          </div>
        )}
        {!cerrado && (borrador.noPresento ? (
          <Button variant="ghost" type="button" className="h-9 px-2" onClick={() => onCambiar({ noPresento: false })}
            aria-label={`Deshacer: quitar el reprobado de ${item.alumno.nombre} en ${unidad.nombre}`}>
            Deshacer
          </Button>
        ) : (
          <Button variant="outline" type="button" className="h-9 text-destructive-foreground hover:bg-destructive/18 hover:text-destructive-foreground"
            onClick={() => onCambiar({ noPresento: true, calificacion: '' })}
            aria-label={`Reprobar a ${item.alumno.nombre} en ${unidad.nombre}`}>
            Reprobar
          </Button>
        ))}
      </div>

      <p id={`${id}-resultado`} className={cn('text-sm font-medium', resultado.tono)}>
        {resultado.texto}
        {sinGuardar && <span className="block text-xs font-normal text-muted-foreground">Sin guardar</span>}
      </p>
    </li>
  )
}

function CeldaUnidad({ celda }) {
  if (!celda || celda.estado === 'SIN_CALIFICAR') {
    return <span className="text-muted-foreground">—<span className="sr-only"> sin calificar</span></span>
  }
  if (celda.estado === 'PENDIENTE_SEGUNDA') {
    return (
      <span className="text-warning-foreground">
        {nota(celda.calificacion)} <span className="text-[11px] font-medium">2ª pendiente</span>
      </span>
    )
  }
  const texto = celda.calificacion == null ? 'NA' : nota(celda.calificacion)
  return (
    <span className={celda.estado === 'NO_ALCANZADA' ? 'font-medium text-destructive-foreground' : 'text-foreground'}>
      {texto}
      {celda.oportunidad === 2 && <sup className="ml-0.5 text-[10px] font-semibold text-muted-foreground">2ª<span className="sr-only"> (segunda oportunidad)</span></sup>}
      {celda.calificacion == null && <span className="sr-only"> (reprobada en segunda oportunidad)</span>}
    </span>
  )
}

function CampoManual({ item, unidad, manuales, disabled, onCambiar }) {
  const llave = clave(item.alumno.id, unidad.id)
  const captura = manuales[llave] ?? { calificacion: '', calculada: null }
  const error = manualInvalida(captura.calificacion)
  const manual = captura.calificacion.trim() !== ''
  const ayudaId = `manual-${item.alumno.id}-${unidad.id}`

  return (
    <div className="inline-flex min-w-20 flex-col items-end">
      <div className="flex items-center gap-1">
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-label={`Calificación manual de ${item.alumno.nombre} en ${unidad.nombre}`}
          aria-describedby={ayudaId}
          aria-invalid={error}
          data-captura="calificacion"
          data-columna={unidad.id}
          value={captura.calificacion}
          placeholder={captura.calculada == null ? '—' : nota(captura.calculada)}
          disabled={disabled}
          onChange={(event) => onCambiar(llave, event.target.value)}
          onKeyDown={moverFoco}
          className={cn(CAMPO, 'w-20 text-center font-medium tabular-nums placeholder:font-normal placeholder:text-muted-foreground')}
        />
        {manual && (
          <Button variant="ghost" size="icon-sm" type="button" disabled={disabled}
            onClick={() => onCambiar(llave, '')}
            aria-label={`Usar la calificación calculada para ${item.alumno.nombre} en ${unidad.nombre}`}
            title="Usar la calculada">
            <RotateCcw aria-hidden="true" />
          </Button>
        )}
      </div>
      <span id={ayudaId} className={cn('mt-1 text-[11px]', error ? 'font-medium text-destructive-foreground' : 'text-muted-foreground')}>
        {error ? 'De 1 a 100' : manual ? 'Manual' : captura.calculada == null ? 'Sin cálculo' : `Calculada ${nota(captura.calculada)}`}
      </span>
    </div>
  )
}

function Concentrado({
  datos,
  filtro,
  onFiltro,
  capturaManual,
  cargandoManual,
  guardandoManual,
  manuales,
  manualCambiados,
  manualInvalidos,
  onAbrirManual,
  onCancelarManual,
  onGuardarManual,
  onCambiarManual,
}) {
  // Cerrado se muestra lo que se entregó; abierto, lo de hoy.
  const vista = datos.cierre?.foto ?? { unidades: datos.unidades, alumnos: datos.alumnos }
  const contar = (estado) => vista.alumnos.filter((item) => item.estado === estado).length
  const visibles = capturaManual || filtro === 'TODOS' ? vista.alumnos : vista.alumnos.filter((item) => item.estado === filtro)
  const final = (item) => (item.estado === 'NO_ACREDITADO'
    ? <span className="font-semibold text-destructive-foreground">NA</span>
    : <span className="font-semibold tabular-nums text-foreground">{nota(item.final)}</span>)
  const resultado = (item) => (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', RESULTADO[item.estado]?.tono)}>
      {RESULTADO[item.estado]?.etiqueta ?? item.estado}
    </span>
  )

  const indices = vista.unidades.map((unidad) => {
    const estados = vista.alumnos.map((item) => item.unidades.find((celda) => celda.unidadId === unidad.id)?.estado)
    const n = (estado) => estados.filter((valor) => valor === estado).length
    return { unidad, primera: n('ALCANZADA'), segunda: n('ALCANZADA_SEGUNDA'), no: n('NO_ALCANZADA'), pendientes: n('PENDIENTE_SEGUNDA') + n('SIN_CALIFICAR') }
  })

  return (
    <section aria-labelledby="concentrado" className="rounded-[var(--radius-card)] border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="concentrado" className="text-lg font-semibold text-foreground">Concentrado</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {capturaManual
              ? 'Captura sólo las excepciones manuales. Los campos vacíos conservan la calificación calculada por el sistema.'
              : 'Final = promedio de las unidades, sólo si todas están alcanzadas; si alguna no, el curso queda NA.'}
          </p>
        </div>
        {capturaManual ? (
          <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
            <Button variant="outline" type="button" disabled={guardandoManual} onClick={onCancelarManual}>Salir de captura</Button>
            <Button type="button" disabled={guardandoManual || !manualCambiados || manualInvalidos > 0} onClick={onGuardarManual}>
              {guardandoManual ? 'Guardando…' : 'Guardar calificaciones'}
            </Button>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            {!datos.cierre && (
              <Button variant="outline" type="button" className="w-full gap-2 sm:w-auto" disabled={cargandoManual} onClick={onAbrirManual}>
                <PencilLine className="size-4" aria-hidden="true" />
                {cargandoManual ? 'Preparando captura…' : 'Capturar manualmente'}
              </Button>
            )}
            <Segmentado apilado label="Mostrar alumnos" value={filtro} onChange={onFiltro} className="w-full sm:w-auto"
              options={[
                { value: 'TODOS', label: 'Todos', count: vista.alumnos.length },
                { value: 'PENDIENTE', label: 'Pendientes', count: contar('PENDIENTE'), tono: 'text-warning-foreground' },
                { value: 'NO_ACREDITADO', label: 'No acreditados', count: contar('NO_ACREDITADO'), tono: 'text-destructive-foreground' },
                { value: 'ACREDITADO', label: 'Acreditados', count: contar('ACREDITADO'), tono: 'text-success-foreground' },
              ]} />
          </div>
        )}
      </div>

      {capturaManual && (
        <div role="note" className="mt-4 rounded-[var(--radius-item)] border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
          Puedes capturar a todos los alumnos en todas las unidades. Una calificación manual sustituye el cálculo automático de esa celda;
          usa el botón de restaurar para volver a la calculada. En unidades abiertas se guardará ahora y se reflejará en el concentrado cuando la unidad finalice.
        </div>
      )}

      {visibles.length === 0 ? (
        <p className="mt-4 rounded-[var(--radius-item)] border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Ningún alumno en este filtro.
        </p>
      ) : (
        <>
          <div className="mt-4 hidden overflow-x-auto sm:block" tabIndex={0} role="region" aria-label="Concentrado de calificaciones">
            <table className="w-full min-w-[40rem] text-sm">
              <caption className="sr-only">Calificación por unidad, final y resultado de cada alumno</caption>
              <thead className="border-b border-border text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-medium">Alumno</th>
                  {vista.unidades.map((unidad) => <th key={unidad.id} scope="col" className="px-2 py-2 text-right font-medium">{unidad.nombre}</th>)}
                  <th scope="col" className="px-2 py-2 text-right font-medium">Final</th>
                  <th scope="col" className="px-2 py-2 font-medium">Nivel</th>
                  <th scope="col" className="py-2 pl-2 font-medium">Resultado</th>
                </tr>
              </thead>
              <tbody data-captura-grupo className="divide-y divide-border">
                {visibles.map((item) => (
                  <tr key={item.alumno.id}>
                    <th scope="row" className="py-2.5 pr-3 text-left font-normal">
                      <span className="block font-medium text-foreground">{item.alumno.nombre}</span>
                      <span className="block text-xs tabular-nums text-muted-foreground">{item.alumno.numeroControl ?? 'Sin número de control'}</span>
                    </th>
                    {vista.unidades.map((unidad) => (
                      <td key={unidad.id} className="px-2 py-2.5 text-right tabular-nums">
                        {capturaManual ? (
                          <CampoManual item={item} unidad={unidad} manuales={manuales} disabled={guardandoManual} onCambiar={onCambiarManual} />
                        ) : (
                          <CeldaUnidad celda={item.unidades.find((celda) => celda.unidadId === unidad.id)} />
                        )}
                      </td>
                    ))}
                    <td className="px-2 py-2.5 text-right">{final(item)}</td>
                    <td className="px-2 py-2.5 text-muted-foreground">{item.nivel ? NIVEL[item.nivel] : '—'}</td>
                    <td className="py-2.5 pl-2">{resultado(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul data-captura-grupo className="mt-4 divide-y divide-border border-y border-border sm:hidden" aria-label="Concentrado de calificaciones">
            {visibles.map((item) => (
              <li key={item.alumno.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.alumno.nombre}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">{item.alumno.numeroControl ?? 'Sin número de control'}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm">Final {final(item)}</p>
                    <div className="mt-1">{resultado(item)}</div>
                  </div>
                </div>
                <dl className={cn('mt-2 text-sm tabular-nums', capturaManual ? 'grid grid-cols-2 gap-3 min-[420px]:grid-cols-3' : 'flex flex-wrap gap-x-4 gap-y-1')}>
                  {vista.unidades.map((unidad) => (
                    <div key={unidad.id} className={cn(capturaManual ? '' : 'flex gap-1.5')}>
                      <dt className={cn('text-muted-foreground', capturaManual && 'mb-1 text-xs font-medium')}>{capturaManual ? unidad.nombre : `U${unidad.orden}`}</dt>
                      <dd>{capturaManual
                        ? <CampoManual item={item} unidad={unidad} manuales={manuales} disabled={guardandoManual} onCambiar={onCambiarManual} />
                        : <CeldaUnidad celda={item.unidades.find((celda) => celda.unidadId === unidad.id)} />}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}

      {!capturaManual && (
        <>
          <h3 className="mt-6 text-sm font-semibold text-foreground">Por unidad</h3>
          <ul className="mt-2 space-y-1 text-sm tabular-nums text-muted-foreground">
            {indices.map(({ unidad, primera, segunda, no, pendientes }) => (
              <li key={unidad.id}>
                <span className="font-medium text-foreground">{unidad.nombre}:</span>{' '}
                {primera} en 1ª · {segunda} en 2ª · <span className={no ? 'text-destructive-foreground' : ''}>{plural(no, 'no la alcanzó', 'no la alcanzaron')}</span>
                {pendientes > 0 && <> · <span className="text-warning-foreground">{plural(pendientes, 'pendiente', 'pendientes')}</span></>}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        {capturaManual ? (
          <>Los campos vacíos usan la nota calculada que aparece como referencia. Sólo se guardan las celdas que cambiaste.</>
        ) : (
          <><sup>2ª</sup> segunda oportunidad · NA reprobada o no acreditado. Para ver el desglose completo, ve a <Link className="font-medium text-primary-ink underline-offset-4 hover:underline" to={`/calificaciones?materia=${datos.materia.id}&grupo=${datos.grupo?.id ?? ''}`}>Calificaciones</Link>.</>
        )}
      </p>
    </section>
  )
}

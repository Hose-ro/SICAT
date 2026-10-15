import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '@/api/axios'
import Modal from '@/components/Modal'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { notify } from '@/lib/feedback'

function fechaCorta(valor) {
  return new Date(valor).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

/** Carga la bitácora de una clase; `version` fuerza volver a pedirla. */
function useBitacora(sesionId, activo, version = 0) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!activo || !sesionId) return undefined
    let vigente = true
    api.get(`/temario/sesion/${sesionId}`)
      .then(({ data }) => {
        if (!vigente) return
        setDatos(data)
        setError('')
      })
      .catch((err) => { if (vigente) setError(err.response?.data?.message ?? 'No se pudo cargar el temario de la clase.') })
    return () => { vigente = false }
  }, [sesionId, activo, version])
  return { datos, error }
}

/**
 * "¿Qué se vio hoy?": los temas de la unidad de la clase para marcar y una
 * nota. Al finalizar la clase es el último paso; también sirve para corregir
 * la bitácora de una clase pasada.
 */
export function BitacoraDialog({ sesionId, open, modo = 'editar', onClose, onListo }) {
  const id = useId()
  const { datos, error } = useBitacora(sesionId, open)
  // Sólo lo que el docente cambia; lo demás sale de lo guardado.
  const [cambios, setCambios] = useState(null)
  const [otras, setOtras] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const marcados = cambios?.marcados
    ?? (datos ? new Set(datos.unidades.flatMap((unidad) => unidad.temas.filter((tema) => tema.enEstaClase).map((tema) => tema.id))) : null)
  const nota = cambios?.nota ?? datos?.sesion.nota ?? ''
  const editar = (cambio) => setCambios((prev) => ({ marcados, nota, ...prev, ...cambio }))
  const cerrar = () => {
    setCambios(null)
    setOtras(false)
    onClose?.()
  }

  const finalizar = modo === 'finalizar'
  const [principal, ...resto] = datos?.unidades ?? []
  const sinTemario = datos && !datos.unidades.some((unidad) => unidad.temas.length)
  const alternar = (temaId) => {
    const siguiente = new Set(marcados)
    if (siguiente.has(temaId)) siguiente.delete(temaId)
    else siguiente.add(temaId)
    editar({ marcados: siguiente })
  }

  const guardar = async () => {
    setGuardando(true)
    try {
      await api.put(`/temario/sesion/${sesionId}`, { temaIds: [...(marcados ?? [])], nota })
      setCambios(null)
      await onListo?.()
    } catch (err) {
      notify(err.response?.data?.message ?? 'No se pudo guardar la bitácora de la clase.')
    } finally {
      setGuardando(false)
    }
  }

  const listaTemas = (unidad) => (
    <fieldset key={unidad.id} className="space-y-1">
      <legend className="mb-1 text-sm font-semibold text-foreground">{unidad.nombre}</legend>
      {unidad.temas.length === 0 && <p className="text-sm text-muted-foreground">Sin temas cargados.</p>}
      {unidad.temas.map((tema) => (
        <label key={tema.id} className="flex min-h-10 cursor-pointer items-start gap-3 rounded-[10px] px-2 py-2 hover:bg-muted">
          <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
            checked={marcados?.has(tema.id) ?? false} onChange={() => alternar(tema.id)} />
          <span className="min-w-0 text-sm text-foreground">
            {tema.nombre}
            {(tema.vistoAntes || tema.semana) && (
              <span className="block text-xs text-muted-foreground">
                {tema.vistoAntes ? `Ya se vio el ${fechaCorta(tema.vistoAntes)}` : `Planeado para la semana ${tema.semana}`}
              </span>
            )}
          </span>
        </label>
      ))}
    </fieldset>
  )

  return (
    <Modal open={open} onClose={cerrar} busy={guardando}
      title={finalizar ? 'Finalizar clase' : 'Qué se vio en esta clase'}
      description={finalizar
        ? 'Antes de cerrar, marca los temas que viste hoy. Quedan en la bitácora y cuentan para el avance del grupo.'
        : 'Marca los temas que se vieron. Cuentan para el avance del grupo.'}>
      {error ? (
        <p role="alert" className="text-sm text-destructive-foreground">{error}</p>
      ) : !datos || !marcados ? (
        <div role="status" aria-label="Cargando el temario" className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <>
          {sinTemario ? (
            <p className="rounded-[var(--radius-item)] border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
              Esta materia todavía no tiene temario.{' '}
              <Link to={`/materias/${datos.materia.id}`} className="font-medium text-primary-ink underline-offset-4 hover:underline">Cárgalo en la materia</Link>{' '}
              para llevar el avance. Por ahora puedes dejar una nota.
            </p>
          ) : (
            <div className="max-h-[45dvh] space-y-4 overflow-y-auto pr-1">
              {principal && listaTemas(principal)}
              {resto.some((unidad) => unidad.temas.length) && (
                otras ? resto.map(listaTemas) : (
                  <Button variant="ghost" type="button" className="h-8 px-2 text-sm" onClick={() => setOtras(true)}>
                    Ver temas de otras unidades
                  </Button>
                )
              )}
            </div>
          )}
          <div>
            <label htmlFor={`${id}-nota`} className="mb-1 block text-sm font-medium text-foreground">Nota de la clase (opcional)</label>
            <textarea id={`${id}-nota`} rows={2} maxLength={500} value={nota} onChange={(event) => editar({ nota: event.target.value })}
              placeholder="Práctica en laboratorio, se quedó pendiente el ejercicio 3…"
              className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 sm:text-sm" />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" type="button" onClick={cerrar} disabled={guardando}>Cancelar</Button>
            <Button type="button" onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : finalizar ? 'Finalizar clase' : 'Guardar'}
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}

/** Lo que va marcado en la bitácora de la clase, con acceso a editarla. */
export function BitacoraResumen({ sesionId }) {
  const [version, setVersion] = useState(0)
  const [editando, setEditando] = useState(false)
  const { datos } = useBitacora(sesionId, true, version)
  if (!datos) return null
  const temas = datos.unidades.flatMap((unidad) => unidad.temas).filter((tema) => tema.enEstaClase)

  return (
    <section aria-labelledby="bitacora-clase" className="mt-4 rounded-[var(--radius-card)] border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="bitacora-clase" className="text-base font-semibold text-foreground">Qué se vio en esta clase</h2>
          {temas.length || datos.sesion.nota ? (
            <>
              {temas.length > 0 && <p className="mt-1 text-sm text-foreground">{temas.map((tema) => tema.nombre).join(' · ')}</p>}
              {datos.sesion.nota && <p className="mt-1 text-sm text-muted-foreground">{datos.sesion.nota}</p>}
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              {datos.sesion.activa ? 'Al finalizar la clase te pediremos los temas que viste.' : 'No se registraron temas en esta clase.'}
            </p>
          )}
        </div>
        <Button variant="outline" type="button" onClick={() => setEditando(true)}>
          {temas.length || datos.sesion.nota ? 'Editar' : 'Registrar temas'}
        </Button>
      </div>
      <BitacoraDialog sesionId={sesionId} open={editando} onClose={() => setEditando(false)}
        onListo={() => {
          setEditando(false)
          setVersion((n) => n + 1)
          notify('Guardaste lo que se vio en la clase.', 'success')
        }} />
    </section>
  )
}

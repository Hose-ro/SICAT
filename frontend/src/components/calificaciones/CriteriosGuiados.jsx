import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import useCriterios from '@/hooks/useCriterios'
import { avanceUnidades, colorCriterio, listaEfectiva, resumenCriterios, tipoCriterio } from '@/lib/criterios'
import CriteriosModal from './CriteriosModal'

const numero = (valor) => Number(valor.toFixed(2)).toLocaleString('es-MX')

export default function CriteriosGuiados({ materiaId, materiaNombre, grupo, unidadId, unidades = [], onGuardado }) {
  const { datos, error, recargar, setDatos } = useCriterios(materiaId, grupo?.id)
  const [editando, setEditando] = useState(false)
  const lista = listaEfectiva(datos, unidadId).filter((item) => item.peso > 0)
  const propia = datos?.unidades.find((item) => item.unidad.id === Number(unidadId) && item.personalizada)
  const excepciones = datos?.unidades.filter((item) => item.personalizada) ?? []
  const participacion = lista.find((item) => item.tipo === 'PARTICIPACION')
  const avance = avanceUnidades(unidades)

  return (
    <section aria-labelledby="evaluacion-guiada" className="min-w-0 rounded-[var(--radius-card)] border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-xs font-semibold tabular-nums text-muted-foreground">02 · CRITERIOS DE EVALUACIÓN</span>
          <h2 id="evaluacion-guiada" className="mt-2 text-lg font-semibold tracking-tight">Revisa la evaluación</h2>
          <p className="mt-2 text-sm text-muted-foreground">Confirma los porcentajes antes de capturar calificaciones.</p>
        </div>
        {grupo && <Button variant="outline" onClick={() => setEditando(true)}><SlidersHorizontal aria-hidden="true" />Editar criterios</Button>}
      </div>
      <p className="mt-5 break-words text-sm font-medium">{[materiaNombre, grupo?.nombre, propia?.unidad.nombre].filter(Boolean).join(' / ') || 'Tu evaluación comienza con una materia'}</p>
      {!grupo ? (
        <p className="mt-5 rounded-[var(--radius-item)] border border-dashed border-border p-5 text-sm text-muted-foreground">Cada grupo tiene sus criterios. Elige un grupo para verlos o editarlos.</p>
      ) : error ? (
        <div role="alert" className="mt-5 text-sm"><p>{error}</p><Button variant="outline" onClick={recargar} className="mt-3">Reintentar</Button></div>
      ) : !datos ? (
        <p role="status" className="mt-5 text-sm text-muted-foreground">Cargando criterios…</p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-y border-border py-4">
            <div><p className="text-xs text-muted-foreground">Estos criterios se aplican a</p><p className="mt-1 text-sm font-medium">{propia ? propia.unidad.nombre : 'Todas las unidades'} · {grupo.nombre}</p></div>
            {avance.total > 0 && (
              <div className="min-w-40 text-right">
                <p className="text-xs text-muted-foreground">Avance de unidades</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-success-foreground" aria-label={`${avance.porcentaje} % completado: ${avance.cerradas} de ${avance.total} unidades cerradas`}>
                  {avance.porcentaje} % <span className="font-medium">completo</span>
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div className="h-full rounded-full bg-success transition-[width] duration-200" style={{ width: `${avance.porcentaje}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{avance.cerradas} de {avance.total} cerradas</p>
              </div>
            )}
          </div>
          {!propia && datos.base.origen === 'PREDETERMINADA' && <p className="mt-4 text-xs text-muted-foreground">Predeterminada: {resumenCriterios(lista)}. Puedes agregar participación, exámenes u otros criterios.</p>}
          <ul aria-label="Ponderación vigente" className="mt-5 space-y-5">
            {lista.map((criterio) => {
              const info = tipoCriterio(criterio.tipo)
              const Icono = info.icono
              const color = colorCriterio(criterio.tipo)
              return <li key={criterio.clave ?? criterio.id ?? criterio.tipo} className={color}>
                <div className="flex items-center gap-2 text-sm"><span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_oklab,var(--criterio-color)_14%,transparent)] text-[var(--criterio-color)]"><Icono className="size-4" aria-hidden="true" /></span><span className="min-w-0 flex-1 break-words font-medium">{criterio.nombre}</span><span className="font-semibold tabular-nums text-[var(--criterio-color)]">{criterio.peso} %</span></div>
                <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[var(--criterio-color)]" style={{ width: `${criterio.peso}%` }} /></div>
              </li>
            })}
          </ul>
          {excepciones.length > 0 && <p className="mt-5 text-xs text-muted-foreground">Porcentajes propios: {excepciones.map((item) => item.unidad.nombre).join(', ')}. Selecciona una de estas unidades para revisar su evaluación.</p>}
          {participacion?.meta > 0 && <div className="mt-5 rounded-[var(--radius-item)] bg-muted p-4 text-sm">
            <p className="font-medium">Cada participación cuenta</p>
            <p className="mt-1 text-muted-foreground">Cada participación registrada suma {numero(participacion.peso / participacion.meta)} puntos al aporte de este criterio. Con {participacion.meta} participaciones se alcanzan los {participacion.peso} puntos asignados; las adicionales no superan ese límite.</p>
            <p className="mt-2 text-xs text-muted-foreground">Registra las participaciones en Asistencias. El acumulado corresponde a cada alumno y unidad.</p>
          </div>}
        </>
      )}
      <CriteriosModal open={editando} onClose={() => setEditando(false)} materiaId={materiaId} grupo={grupo}
        materiaNombre={materiaNombre} alcanceInicial={unidadId ? Number(unidadId) : 'base'}
        onGuardado={(nuevos) => { setDatos(nuevos); onGuardado?.(nuevos) }} />
    </section>
  )
}

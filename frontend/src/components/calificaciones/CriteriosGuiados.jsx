import { useState } from 'react'
import { Check, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import useCriterios from '@/hooks/useCriterios'
import { listaEfectiva, resumenCriterios, sumaPesos, tipoCriterio } from '@/lib/criterios'
import CriteriosModal from './CriteriosModal'

const numero = (valor) => Number(valor.toFixed(2)).toLocaleString('es-MX')

export default function CriteriosGuiados({ materiaId, materiaNombre, grupo, unidadId, onGuardado }) {
  const { datos, error, recargar, setDatos } = useCriterios(materiaId, grupo?.id)
  const [editando, setEditando] = useState(false)
  const lista = listaEfectiva(datos, unidadId).filter((item) => item.peso > 0)
  const propia = datos?.unidades.find((item) => item.unidad.id === Number(unidadId) && item.personalizada)
  const excepciones = datos?.unidades.filter((item) => item.personalizada) ?? []
  const participacion = lista.find((item) => item.tipo === 'PARTICIPACION')

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
            {sumaPesos(lista) === 100 && <span className="inline-flex items-center gap-1.5 text-xs text-success-foreground"><Check className="size-4" aria-hidden="true" />100 % completo</span>}
          </div>
          {!propia && datos.base.origen === 'PREDETERMINADA' && <p className="mt-4 text-xs text-muted-foreground">Predeterminada: {resumenCriterios(lista)}. Puedes agregar participación, exámenes u otros criterios.</p>}
          <ul aria-label="Ponderación vigente" className="mt-5 space-y-5">
            {lista.map((criterio) => {
              const info = tipoCriterio(criterio.tipo)
              const Icono = info.icono
              return <li key={criterio.clave ?? criterio.id ?? criterio.tipo}>
                <div className="flex items-center gap-2 text-sm"><Icono className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><span className="min-w-0 flex-1 break-words font-medium">{criterio.nombre}</span><span className="font-semibold tabular-nums">{criterio.peso} %</span></div>
                <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-foreground/40" style={{ width: `${criterio.peso}%` }} /></div>
                <p className="mt-2 text-xs text-muted-foreground">{criterio.tipo === 'PARTICIPACION' ? `Acumulativa · meta de ${criterio.meta} participaciones por unidad` : criterio.tipo === 'ASISTENCIA' ? 'Se calcula a partir del pase de lista.' : 'Se calcula con las actividades asignadas a este criterio.'}</p>
              </li>
            })}
          </ul>
          {excepciones.length > 0 && <p className="mt-5 text-xs text-muted-foreground">Porcentajes propios: {excepciones.map((item) => item.unidad.nombre).join(', ')}. Selecciona una de estas unidades para revisar su evaluación.</p>}
          {participacion?.meta > 0 && <div className="mt-5 rounded-[var(--radius-item)] bg-muted p-4 text-sm">
            <p className="font-medium">Cada participación cuenta</p>
            <p className="mt-1 text-muted-foreground">Cada participación registrada suma {numero(participacion.peso / participacion.meta)} puntos al aporte de este criterio. Con {participacion.meta} participaciones se alcanzan los {participacion.peso} puntos asignados; las adicionales no superan ese límite.</p>
            <p className="mt-2 text-xs text-muted-foreground">Registra las participaciones en Asistencias. El acumulado corresponde a cada alumno y unidad.</p>
          </div>}
          <details className="mt-5 border-t border-border pt-4 text-sm">
            <summary className="cursor-pointer rounded-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/40">¿Cómo se calcula la calificación?</summary>
            <p className="mt-3 text-muted-foreground">Cada resultado se multiplica por su porcentaje. Por ejemplo, 80 de calificación en un criterio de 40 % aporta 32 puntos. La participación se calcula como participaciones acumuladas ÷ meta, hasta completar su porcentaje.</p>
            <p className="mt-2 text-xs text-muted-foreground">Mientras haya criterios sin evaluar, el promedio usa los criterios con resultado y ajusta sus pesos. Las calificaciones manuales tienen prioridad.</p>
          </details>
        </>
      )}
      <CriteriosModal open={editando} onClose={() => setEditando(false)} materiaId={materiaId} grupo={grupo}
        materiaNombre={materiaNombre} alcanceInicial={unidadId ? Number(unidadId) : 'base'}
        onGuardado={(nuevos) => { setDatos(nuevos); onGuardado?.(nuevos) }} />
    </section>
  )
}

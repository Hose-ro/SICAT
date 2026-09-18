import { CalendarDays } from 'lucide-react'
import PeriodoEscolarCard from '../../components/PeriodoEscolarCard'
import CalendarioClases from '../../components/CalendarioClases'

/**
 * Fechas del periodo y días festivos de toda la institución. Lo que el admin
 * marque aquí deja sin clases a todos los docentes ese día.
 */
export default function CalendarioEscolar() {
  return (
    <div className="flex h-full flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary-ink">
          <CalendarDays className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">Calendario escolar</h1>
          <p className="text-sm text-muted-foreground">
            Fechas del periodo y días sin clases para toda la institución.
          </p>
        </div>
      </div>

      <PeriodoEscolarCard editable />

      <CalendarioClases modo="institucional" />
    </div>
  )
}

import HorarioCarrera from './supervision/HorarioCarrera'
import { JefaturaPage } from './supervision/ui'

export default function JefeHorarios() {
  return (
    <JefaturaPage titulo="Horarios">
      {({ j, resumen }) => (
        <HorarioCarrera j={j} resumen={resumen} titulo="Horario de la carrera" descripcion={null} ocultarTitulo />
      )}
    </JefaturaPage>
  )
}

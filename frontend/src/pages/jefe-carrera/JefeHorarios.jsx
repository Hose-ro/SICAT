import HorarioCarrera from './supervision/HorarioCarrera'
import { JefaturaPage } from './supervision/ui'

export default function JefeHorarios() {
  return (
    <JefaturaPage titulo="Horarios" subtitulo="Clases esperadas por grupo, con su estado de registro y sus conflictos.">
      {({ j, resumen }) => (
        <HorarioCarrera j={j} resumen={resumen} titulo="Horario general" descripcion="Filtra por modalidad, semestre, grupo o docente; la vista se conserva al volver de un expediente." />
      )}
    </JefaturaPage>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Clock3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import UserAvatar from '@/components/shared/UserAvatar'
import { useClases } from '../supervision/useClasesSemana'
import { claveInstitucional, ZONA_INSTITUCIONAL } from '../supervision/estados'
import { linkClass } from '../supervision/ui'

const reloj = new Intl.DateTimeFormat('es-MX', {
  timeZone: ZONA_INSTITUCIONAL,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export default function DocentesEnLinea({ j }) {
  const [ahora, setAhora] = useState(() => new Date())
  const hoy = claveInstitucional(ahora)
  const { clases, error, cargando, reintentar, actualizar } = useClases({
    carreraId: j.carreraId,
    periodo: j.historico ? null : j.periodo,
    desde: hoy,
    hasta: hoy,
  })
  useEffect(() => {
    if (j.historico) return undefined
    const refrescar = () => {
      setAhora(new Date())
      actualizar()
    }
    const timer = setInterval(refrescar, 30000)
    window.addEventListener('focus', refrescar)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refrescar)
    }
  }, [actualizar, j.historico])
  if (j.historico) return null
  const hora = reloj.format(ahora)
  const activas = (clases ?? []).filter(
    (c) => c.fecha === hoy && c.horaInicio <= hora && hora < c.horaFin && c.estado !== 'SUSPENDIDA',
  )
  const docentes = new Map()
  activas.forEach((c) => {
    if (!docentes.has(c.docente.id)) docentes.set(c.docente.id, { docente: c.docente, clases: [] })
    docentes.get(c.docente.id).clases.push(c)
  })
  return (
    <aside aria-labelledby="docentes-en-linea" className="docentes-en-linea">
      <div className="flex items-center justify-between gap-3">
        <h2 id="docentes-en-linea" className="text-base font-semibold">
          En clase ahora
        </h2>
        <Clock3 aria-hidden="true" className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Según el horario · {hora}</p>
      {error ? (
        <div role="alert" className="mt-5 text-sm">
          <p>No se pudo actualizar el estado de las clases.</p>
          <Button variant="outline" className="mt-3" onClick={reintentar}>
            Reintentar
          </Button>
        </div>
      ) : cargando || clases === null ? (
        <p role="status" className="mt-5 text-sm text-muted-foreground">
          Consultando docentes…
        </p>
      ) : !docentes.size ? (
        <p className="mt-4 text-sm text-muted-foreground">Nadie tiene clase ahora.</p>
      ) : (
        <ul className="mt-5 divide-y divide-border">
          {[...docentes.values()]
            .sort((a, b) => a.docente.nombre.localeCompare(b.docente.nombre, 'es'))
            .map(({ docente, clases: propias }) => (
              <li key={docente.id} className="py-4 first:pt-0">
                <div className="flex items-start gap-2.5">
                  <UserAvatar usuario={docente} className="size-9 shrink-0" />
                  <div className="min-w-0">
                    <Link
                      className={`${linkClass} text-sm font-medium`}
                      to={j.toDesde(`/jefe-carrera/docentes/${docente.id}`)}
                    >
                      {docente.nombre}
                    </Link>
                    <p className="mt-1 text-xs font-medium">En clase</p>
                  </div>
                </div>
                {propias.map((c) => (
                  <div key={c.id} className="mt-3 text-xs">
                    <p>
                      {c.materia.nombre} · {c.grupo.nombre}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {c.horaInicio}–{c.horaFin}
                    </p>
                    {c.registros > 0 ? (
                      <p className="mt-2 inline-flex items-center gap-1.5 text-success-foreground">
                        <span>Asistencias{c.registros < c.alumnos ? ` · ${c.registros} de ${c.alumnos}` : ''}</span>
                        <Check aria-label="Asistencias registradas" className="size-4" />
                      </p>
                    ) : (
                      <p className="mt-2 text-muted-foreground">
                        {c.estado === 'SIN_ALUMNOS' ? 'Sin alumnos inscritos' : 'Sin asistencias aún'}
                      </p>
                    )}
                    <Link
                      className={`${linkClass} mt-1 flex min-h-11 items-center`}
                      to={j.toDesde('/jefe-carrera/horarios', {
                        fecha: c.fecha,
                        clase: c.id,
                        modalidad: c.grupo.modalidad === 'MIXTO' ? 'MIXTO' : undefined,
                      })}
                    >
                      Ver clase
                    </Link>
                  </div>
                ))}
              </li>
            ))}
        </ul>
      )}
    </aside>
  )
}

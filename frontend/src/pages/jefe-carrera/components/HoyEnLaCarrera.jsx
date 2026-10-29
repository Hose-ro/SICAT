import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, ChevronDown, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { claveInstitucional, esIncidencia, estadoClase, ZONA_INSTITUCIONAL } from '../supervision/estados'
import { fechaCorta, minutos, plural } from '../supervision/formato'
import { useClases } from '../supervision/useClasesSemana'
import { SeccionTitulo, linkClass } from '../supervision/ui'

const relojInstitucional = new Intl.DateTimeFormat('es-MX', {
  timeZone: ZONA_INSTITUCIONAL, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

export default function HoyEnLaCarrera({ j }) {
  const [ahora, setAhora] = useState(() => new Date())
  const hoy = claveInstitucional(ahora)
  const { clases, error, cargando, reintentar } = useClases({
    carreraId: j.carreraId, periodo: j.historico ? null : j.periodo, desde: hoy, hasta: hoy,
  })

  useEffect(() => {
    if (j.historico) return undefined
    const actualizar = () => setAhora(new Date())
    const timer = window.setInterval(actualizar, 30000)
    window.addEventListener('focus', actualizar)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', actualizar) }
  }, [j.historico])

  if (j.historico) return null

  return (
    <section aria-labelledby="hoy-carrera" className="inicio-hoy mt-6">
      <SeccionTitulo
        id="hoy-carrera" titulo="Clases de hoy" descripcion={fechaCorta(hoy)}
        accion={<Link className={cn(linkClass, 'inline-flex min-h-11 items-center text-[0.8125rem]')} to={j.to('/jefe-carrera/horarios')}>Ver horario completo</Link>}
      />
      {error ? (
        <p role="alert" className="flex flex-wrap items-center gap-3 border-y border-border py-4 text-[0.8125rem] text-warning-foreground">
          {error}<Button variant="outline" size="sm" onClick={reintentar}>Reintentar</Button>
        </p>
      ) : cargando || clases === null ? (
        <div role="status" aria-busy="true" className="hoy-esqueleto">
          <span className="sr-only">Consultando las clases de hoy…</span>
          <div /><div /><div />
        </div>
      ) : (
        <AgendaClases key={`${j.carreraId}:${j.periodo}:${hoy}`} j={j} clases={clases.filter((c) => c.fecha === hoy)} ahora={ahora} />
      )}
    </section>
  )
}

function AgendaClases({ j, clases, ahora }) {
  const [expandido, setExpandido] = useState(false)
  const panelId = useId()
  const activas = clases.filter((c) => c.estado !== 'SUSPENDIDA')
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio) || a.horaFin.localeCompare(b.horaFin) || String(a.id).localeCompare(String(b.id)))
  const suspendidas = clases.length - activas.length

  if (!activas.length) {
    return <p className="border-y border-border py-4 text-[0.8125rem] text-muted-foreground">
      {suspendidas ? `Hoy no hay clases: ${plural(suspendidas, 'clase suspendida', 'clases suspendidas')}.` : 'Hoy no hay clases programadas en la carrera.'}
    </p>
  }

  const minuto = minutos(relojInstitucional.format(ahora))
  const enHorario = activas.find((c) => minutos(c.horaInicio) <= minuto && minuto < minutos(c.horaFin))
  const proxima = activas.find((c) => minutos(c.horaInicio) > minuto)
  const ultima = [...activas].sort((a, b) => b.horaFin.localeCompare(a.horaFin) || b.horaInicio.localeCompare(a.horaInicio))[0]
  const destacada = enHorario ?? proxima ?? ultima
  const restantes = activas.filter((c) => c.id !== destacada.id)
  const espera = minutos(destacada.horaInicio) - minuto
  const contexto = enHorario ? 'En curso · según horario' : proxima ? `Próxima clase · En ${plural(espera, 'minuto', 'minutos')}` : 'Última clase del día'

  return (
    <>
      <TarjetaClase clase={destacada} j={j} contexto={contexto} destacada />
      {restantes.length > 0 && (
        <>
          <Button
            className="hoy-expandir" variant={expandido ? 'secondary' : 'default'}
            aria-expanded={expandido} aria-controls={panelId}
            onClick={() => setExpandido((v) => !v)}
          >
            {expandido ? 'Mostrar solo la clase destacada' : `Ver ${restantes.length === 1 ? 'la otra clase' : `las otras ${restantes.length} clases`}`}
            <ChevronDown aria-hidden="true" className={cn('hoy-expandir-icono', expandido && 'hoy-expandir-icono-abierto')} />
          </Button>
          <div id={panelId} hidden={!expandido} className="hoy-restantes">
            <div className="hoy-restantes-titulo"><h3>Las demás clases de hoy</h3><span>En orden de horario</span></div>
            <div className="hoy-tarjetas">
              {restantes.map((c) => <TarjetaClase key={c.id} clase={c} j={j} />)}
            </div>
          </div>
        </>
      )}
      <div className="hoy-nota">
        <span>{plural(activas.length, 'clase programada', 'clases programadas')}{suspendidas > 0 && ` · ${plural(suspendidas, 'suspendida', 'suspendidas')}`}</span>
        {!enHorario && !proxima && <span>La jornada terminó. No hay más clases por comenzar.</span>}
      </div>
    </>
  )
}

function TarjetaClase({ clase: c, j, contexto, destacada = false }) {
  const estado = estadoClase(c.estado)
  const incidencia = esIncidencia(c)
  const completa = ['LISTA_COMPLETA', 'REGISTRO_TARDIO'].includes(c.estado)
  const destino = j.toDesde('/jefe-carrera/horarios', {
    fecha: c.fecha, clase: c.id, modalidad: c.grupo.modalidad === 'MIXTO' ? 'MIXTO' : undefined,
  })

  return (
    <article className={cn('hoy-tarjeta', destacada && 'hoy-tarjeta-destacada')}>
      <div className="hoy-tarjeta-horario">
        <p className="hoy-hora">{c.horaInicio}<span>hasta {c.horaFin}</span></p>
        <p className="hoy-grupo">Grupo {c.grupo.nombre}</p>
      </div>
      <div className="hoy-tarjeta-cuerpo">
        {contexto && <p className="hoy-contexto">{contexto}</p>}
        <h3 className="hoy-materia">{c.materia.nombre}</h3>
        <p className="hoy-docente">{c.docente?.nombre ?? 'Sin docente asignado'}</p>
        <div className="hoy-estados">
          <span className={cn('hoy-registro', estado.texto)}>
            {completa && <Check aria-hidden="true" />}{estado.label}
          </span>
          {incidencia && <span className="hoy-incidencia"><TriangleAlert aria-hidden="true" />Con incidencia</span>}
        </div>
      </div>
      <div className="hoy-tarjeta-pie">
        <span>{c.aula?.nombre ?? 'Sin aula asignada'}</span>
        <Link className="hoy-accion" to={destino} aria-label={`Ver detalle de ${c.materia.nombre}, grupo ${c.grupo.nombre}, ${c.horaInicio} a ${c.horaFin}`}>
          {c.estado === 'PROGRAMADA' ? 'Ver detalles' : completa ? 'Ver registro' : 'Revisar clase'}<ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </article>
  )
}

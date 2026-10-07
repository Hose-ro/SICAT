import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import HorarioCarrera from './supervision/HorarioCarrera'
import { MOTIVOS_RIESGO } from './supervision/estados'
import { fechaCorta, haceTiempo, parseClave } from './supervision/formato'
import { JefaturaPage, SeccionTitulo, Senales, linkClass } from './supervision/ui'

const MAX_PENDIENTES = 12

function fechaBreve(clave) {
  return parseClave(clave).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

/** Pendientes prioritarios: listas más antiguas primero, luego calificaciones, riesgo y entregas. */
function construirPendientes(resumen, j) {
  const listas = [...resumen.pendientes]
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.horaInicio.localeCompare(b.horaInicio))
    .map((c) => ({
      id: `lista-${c.id}`,
      situacion: c.estado === 'CAPTURA_PARCIAL' ? `Lista con captura parcial (${c.registros} de ${c.alumnos})` : 'Lista de asistencia sin captura',
      contexto: `${c.materia.nombre} · ${c.grupo.nombre} · ${fechaCorta(c.fecha)}, ${c.horaInicio}`,
      antiguedad: haceTiempo(c.fecha),
      responsable: { nombre: c.docente.nombre, to: j.to(`/jefe-carrera/docentes/${c.docente.id}`) },
      consulta: { label: 'Ver clase', to: j.to('/jefe-carrera/horarios', { fecha: c.fecha, clase: c.id, modalidad: c.grupo.modalidad === 'MIXTO' ? 'MIXTO' : undefined }) },
    }))
  const calificaciones = resumen.ofertas
    .filter((o) => o.resumen.calificacionesPendientes > 0)
    .sort((a, b) => b.resumen.calificacionesPendientes - a.resumen.calificacionesPendientes)
    .map((o) => ({
      id: `calif-${o.id}`,
      situacion: `${o.resumen.calificacionesPendientes} ${o.resumen.calificacionesPendientes === 1 ? 'calificación' : 'calificaciones'} de unidad pendiente${o.resumen.calificacionesPendientes === 1 ? '' : 's'}`,
      contexto: `${o.materia.nombre} · ${o.grupo.nombre} · unidad cerrada sin calificación`,
      antiguedad: 'Sin plazo definido',
      responsable: o.docentes[0] ? { nombre: o.docentes.map((d) => d.nombre).join(', '), to: j.to(`/jefe-carrera/docentes/${o.docentes[0].id}`) } : { nombre: 'Sin docente asignado' },
      consulta: { label: 'Ver oferta', to: j.to(`/jefe-carrera/materias/${o.materia.id}`, { oferta: o.grupo.id }) },
    }))
  const riesgos = [...resumen.riesgos]
    .sort((a, b) => b.causas.length - a.causas.length)
    .map((alumno) => {
      const causa = alumno.causas[0]
      const motivos = [...new Set(alumno.causas.flatMap((c) => c.motivos))].map((m) => MOTIVOS_RIESGO[m] ?? m)
      return {
        id: `riesgo-${alumno.id}`,
        situacion: 'Alumno requiere seguimiento',
        contexto: `${[...new Set(alumno.causas.map((c) => c.materia.nombre))].join(', ')} · ${motivos.join(' · ')}`,
        antiguedad: causa.unidad?.nombre ?? '—',
        responsable: { nombre: alumno.nombre, to: j.to(`/jefe-carrera/grupos/${causa.grupo.id}`, { tab: 'alumnos', alumno: alumno.id }) },
        consulta: { label: 'Ver expediente', to: j.to(`/jefe-carrera/grupos/${causa.grupo.id}`, { tab: 'alumnos', alumno: alumno.id }) },
      }
    })
  const entregas = resumen.ofertas
    .filter((o) => o.resumen.entregasPendientes > 0)
    .sort((a, b) => b.resumen.entregasPendientes - a.resumen.entregasPendientes)
    .map((o) => ({
      id: `entregas-${o.id}`,
      situacion: `${o.resumen.entregasPendientes} ${o.resumen.entregasPendientes === 1 ? 'entrega recibida' : 'entregas recibidas'} sin revisar`,
      contexto: `${o.materia.nombre} · ${o.grupo.nombre}`,
      antiguedad: 'Sin plazo definido',
      responsable: o.docentes[0] ? { nombre: o.docentes.map((d) => d.nombre).join(', '), to: j.to(`/jefe-carrera/docentes/${o.docentes[0].id}`) } : { nombre: 'Sin docente asignado' },
      consulta: { label: 'Ver oferta', to: j.to(`/jefe-carrera/materias/${o.materia.id}`, { oferta: o.grupo.id }) },
    }))
  return [...listas, ...calificaciones, ...riesgos, ...entregas]
}

export default function JefeInicio() {
  return (
    <JefaturaPage titulo="Inicio" subtitulo="La jornada de tu carrera, en un solo lugar.">
      {({ j, resumen }) => {
        const pendientes = construirPendientes(resumen, j)
        const { indicadores, intervalo } = resumen
        return (
          <>
            <Senales
              items={[
                { label: indicadores.listasPendientes === 1 ? 'Lista por completar' : 'Listas por completar', value: indicadores.listasPendientes, vacio: 'Listas al día', to: j.to('/jefe-carrera/horarios', { incidencias: 1 }) },
                { label: indicadores.calificacionesPendientes === 1 ? 'Calificación pendiente' : 'Calificaciones pendientes', value: indicadores.calificacionesPendientes, vacio: 'Sin calificaciones pendientes', to: j.to('/jefe-carrera/materias', { pendientes: 1 }) },
                { label: indicadores.alumnosRiesgo === 1 ? 'Alumno en riesgo' : 'Alumnos en riesgo', value: indicadores.alumnosRiesgo, vacio: 'Sin alumnos en riesgo', to: j.to('/jefe-carrera/grupos', { riesgo: 1 }) },
              ]}
              nota={intervalo ? `Listas revisadas del ${fechaBreve(intervalo.desde)} al ${fechaBreve(intervalo.hasta)}` : null}
            />

            <HorarioCarrera j={j} resumen={resumen} />

            <section aria-labelledby="pendientes-prioritarios" className="mt-10">
              <SeccionTitulo
                id="pendientes-prioritarios"
                titulo="Pendientes para revisar"
                descripcion="Primero las listas más antiguas; cada fila abre el registro que la explica."
                accion={pendientes.length > MAX_PENDIENTES && <span className="text-xs text-muted-foreground">{MAX_PENDIENTES} de {pendientes.length}</span>}
              />
              {pendientes.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[0.8125rem]">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th scope="col" className="py-2.5 pr-4 font-medium">Situación</th>
                        <th scope="col" className="py-2.5 pr-4 font-medium max-md:hidden">Contexto</th>
                        <th scope="col" className="py-2.5 pr-4 font-medium max-sm:hidden">Antigüedad</th>
                        <th scope="col" className="py-2.5 pr-4 font-medium max-lg:hidden">Responsable</th>
                        <th scope="col" className="py-2.5 font-medium"><span className="sr-only">Consulta</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendientes.slice(0, MAX_PENDIENTES).map((p) => (
                        <tr key={p.id} className="border-t border-border align-top">
                          <td className="py-3.5 pr-4 text-foreground">
                            {p.situacion}
                            <span className="mt-0.5 block text-xs text-muted-foreground md:hidden">{p.contexto}</span>
                          </td>
                          <td className="py-3.5 pr-4 text-muted-foreground max-md:hidden">{p.contexto}</td>
                          <td className="whitespace-nowrap py-3.5 pr-4 text-muted-foreground max-sm:hidden">{p.antiguedad}</td>
                          <td className="py-3.5 pr-4 max-lg:hidden">{p.responsable.to ? <Link className={linkClass} to={p.responsable.to}>{p.responsable.nombre}</Link> : <span className="text-muted-foreground">{p.responsable.nombre}</span>}</td>
                          <td className="whitespace-nowrap py-3.5 text-right"><Link className={`${linkClass} text-xs`} to={p.consulta.to}>{p.consulta.label}</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="border-t border-border py-6 text-sm text-muted-foreground">Sin pendientes detectados en el periodo.</p>
              )}
            </section>

            <nav aria-label="Seguimiento y reportes" className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-5 text-[0.8125rem]">
              {[['Alertas', '/jefe-carrera/alertas'], ['Seguimiento', '/jefe-carrera/seguimiento'], ['Reportes', '/jefe-carrera/reportes']].map(([label, path]) => (
                <Link key={path} to={path} className={`${linkClass} inline-flex min-h-11 items-center gap-1`}>{label} <ArrowRight className="size-3.5" aria-hidden="true" /></Link>
              ))}
            </nav>
          </>
        )
      }}
    </JefaturaPage>
  )
}

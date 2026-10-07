import { Link, useParams } from 'react-router-dom'
import { Chip } from '@/components/Chip'
import { cn } from '@/lib/utils'
import HorarioCarrera from './supervision/HorarioCarrera'
import { ESTADO_UNIDAD, ESTADOS_PENDIENTES, estadoClase } from './supervision/estados'
import { fechaCorta, fechaHoraCorta, haceTiempo, hoyClave, minutos, modalidadTexto, parseClave, diasTexto } from './supervision/formato'
import { useClases } from './supervision/useClasesSemana'
import { Aviso, Cifra, Contacto, JefaturaPage, SeccionTitulo, Vacio, linkClass } from './supervision/ui'

const DIAS_REVISION_UNIDAD = 28
const fechaBreve = (clave) => parseClave(clave).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
const fechaUnidad = (iso) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' })

export default function JefeDocenteDetalle() {
  const { id } = useParams()
  return (
    <JefaturaPage titulo={(r) => r.docentes.find((d) => d.id === Number(id))?.nombre} volver={{ to: '/jefe-carrera/docentes', label: 'Docentes' }}>
      {({ j, resumen }) => <Contenido j={j} resumen={resumen} docenteId={Number(id)} />}
    </JefaturaPage>
  )
}

function Contenido({ j, resumen, docenteId }) {
  const docente = resumen.docentes.find((d) => d.id === docenteId)
  const { clases, error, reintentar } = useClases({
    carreraId: j.carreraId, periodo: j.periodo, desde: resumen.intervalo?.desde, hasta: resumen.intervalo?.hasta, docenteId,
  })
  if (!docente) {
    return <Aviso titulo="Sin asignación en esta carrera">Este docente no imparte clases de la carrera en {j.periodo}. <Link className={linkClass} to={j.to('/jefe-carrera/docentes')}>Volver a Docentes</Link></Aviso>
  }
  const ofertas = resumen.ofertas.filter((o) => docente.ofertas.includes(o.id))

  return (
    <>
      <header className="mt-4 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[0.8125rem] text-muted-foreground">{docente.pertenencia} · {[docente.email, docente.telefono].filter(Boolean).join(' · ') || 'Sin contacto registrado'}</p>
        </div>
        <Contacto persona={docente} compacto />
      </header>

      <Carga ofertas={ofertas} docente={docente} j={j} />
      <Registro docente={docente} clases={clases} error={error} reintentar={reintentar} intervalo={resumen.intervalo} j={j} />
      <Avance ofertas={ofertas} j={j} />
      <HorarioCarrera j={j} resumen={resumen} fijo={{ docenteId }} titulo="Horario semanal" descripcion="Solo las clases de este docente en la carrera." headingId="horario-docente" />
    </>
  )
}

function horasBloque(h) {
  const dias = h.dias.split(',').map((d) => d.trim()).filter(Boolean).length
  return Math.max(0, minutos(h.horaFin) - minutos(h.horaInicio)) / 60 * dias
}

function Carga({ ofertas, docente, j }) {
  return (
    <section className="mt-8" aria-labelledby="carga-docente">
      <SeccionTitulo id="carga-docente" titulo="Carga académica" descripcion={`${docente.horasSemanales} horas a la semana, calculadas con la duración y los días de cada bloque.`} />
      {ofertas.length ? (
        <div className="overflow-x-auto rounded-[var(--radius-item)] border border-border bg-card">
          <table className="w-full min-w-[720px] border-collapse text-[0.8125rem]">
            <thead>
              <tr className="border-b border-border bg-background text-left text-xs text-muted-foreground">
                <th scope="col" className="px-4 py-2.5 font-medium">Materia</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Grupo</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Bloques</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Horas / semana</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Inscritos</th>
              </tr>
            </thead>
            <tbody>
              {ofertas.map((o) => {
                const bloques = o.horarios.filter((h) => h.docenteId === docente.id)
                return (
                  <tr key={o.id} className="border-b border-border align-top last:border-b-0">
                    <th scope="row" className="px-4 py-3 text-left font-medium">
                      <Link className={cn(linkClass, 'text-foreground')} to={j.to(`/jefe-carrera/materias/${o.materia.id}`, { oferta: o.grupo.id })}>{o.materia.nombre}</Link>
                      {o.docentes.length > 1 && <span className="block text-xs font-normal text-muted-foreground">Compartida con {o.docentes.filter((d) => d.id !== docente.id).map((d) => d.nombre).join(', ')}</span>}
                    </th>
                    <td className="px-4 py-3"><Link className={linkClass} to={j.to(`/jefe-carrera/grupos/${o.grupo.id}`)}>{o.grupo.nombre}</Link><span className="block text-xs text-muted-foreground">{modalidadTexto(o.grupo.modalidad)}</span></td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {bloques.length ? bloques.map((h) => <span key={h.id} className="block tabular-nums">{diasTexto(h.dias)} · {h.horaInicio}–{h.horaFin}{h.aula ? ` · ${h.aula.nombre}` : ''}</span>) : 'Docente principal sin bloque de horario'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{Math.round(bloques.reduce((n, h) => n + horasBloque(h), 0) * 10) / 10}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{o.resumen.alumnos}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : <Vacio titulo="Sin carga en el periodo" />}
    </section>
  )
}

function Registro({ docente, clases, error, reintentar, intervalo, j }) {
  const hoy = hoyClave()
  const elegibles = (clases ?? []).filter((c) => c.elegible)
  const cuenta = (estado) => elegibles.filter((c) => c.estado === estado).length
  const completas = cuenta('LISTA_COMPLETA') + cuenta('REGISTRO_TARDIO')
  const sinEvidencia = elegibles.filter((c) => ESTADOS_PENDIENTES.has(c.estado)).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.horaInicio.localeCompare(a.horaInicio))
  const suspendidas = (clases ?? []).filter((c) => c.estado === 'SUSPENDIDA' && c.fecha <= hoy).length

  return (
    <section className="mt-10" aria-labelledby="registro-docente">
      <SeccionTitulo
        id="registro-docente"
        titulo="Registro de clases y asistencia"
        descripcion={intervalo ? `Clases concluidas del ${fechaBreve(intervalo.desde)} al ${fechaBreve(intervalo.hasta)}, sin suspensiones ni días fuera del calendario.` : null}
      />
      {error && !clases ? <Aviso tono="error" titulo="No se pudo consultar el registro" accion={<button type="button" className={linkClass} onClick={reintentar}>Reintentar</button>}>{error}</Aviso> : !clases ? (
        <div className="h-24 animate-pulse rounded-[var(--radius-item)] bg-muted" aria-busy="true" />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
            <Cifra label="Cobertura" value={elegibles.length ? `${Math.round((completas / elegibles.length) * 100)} %` : 'No aplica'} />
            <Cifra label="Clases elegibles" value={elegibles.length} />
            <Cifra label="Lista completa" value={completas} tono="text-success-foreground" />
            <Cifra label="Captura parcial" value={cuenta('CAPTURA_PARCIAL')} tono={cuenta('CAPTURA_PARCIAL') ? 'text-warning-foreground' : undefined} />
            <Cifra label="Sin evidencia de registro" value={cuenta('SIN_CAPTURA')} tono={cuenta('SIN_CAPTURA') ? 'text-warning-foreground' : undefined} />
            <Cifra label="Registro tardío" value={cuenta('REGISTRO_TARDIO')} />
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Cobertura = clases con lista completa ({completas}) ÷ clases elegibles ya concluidas ({elegibles.length}).
            {suspendidas > 0 && ` ${suspendidas} ${suspendidas === 1 ? 'clase suspendida no cuenta' : 'clases suspendidas no cuentan'}.`}
            {' '}La falta de captura no prueba ausencia del docente; confírmala en el seguimiento.
          </p>

          <h3 className="mt-6 text-sm font-semibold text-foreground">Clases sin evidencia de registro</h3>
          {sinEvidencia.length ? (
            <ul className="mt-2 divide-y divide-border border-y border-border text-[0.8125rem]">
              {sinEvidencia.slice(0, 15).map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="text-foreground first-letter:uppercase">{fechaCorta(c.fecha)}, {c.horaInicio}</span>
                    <span className="text-muted-foreground"> · {c.materia.nombre} · {c.grupo.nombre}</span>
                    <span className={cn('block text-xs', estadoClase(c.estado).texto)}>{estadoClase(c.estado).label}{c.estado === 'CAPTURA_PARCIAL' ? ` (${c.registros} de ${c.alumnos})` : ''} · {haceTiempo(c.fecha)}</span>
                  </span>
                  <Link className={`${linkClass} text-xs`} to={j.to(`/jefe-carrera/docentes/${docente.id}`, { fecha: c.fecha, clase: c.id, vista: 'dia', modalidad: c.grupo.modalidad === 'MIXTO' ? 'MIXTO' : undefined })}>Ver clase</Link>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 border-t border-border py-4 text-sm text-muted-foreground">Sin pendientes detectados en el intervalo.</p>}
          {sinEvidencia.length > 15 && <p className="mt-2 text-xs text-muted-foreground">Se muestran las 15 más recientes de {sinEvidencia.length}.</p>}
          <p className="mt-3 text-xs text-muted-foreground">Última captura: {fechaHoraCorta(docente.ultimaCaptura)}</p>
        </>
      )}
    </section>
  )
}

function senalUnidad(u) {
  if (u.status === 'FINALIZADA') return null
  const hoy = new Date()
  if (u.fechaFin && new Date(u.fechaFin) < hoy) return `Cierre previsto el ${fechaUnidad(u.fechaFin)} sin registrar`
  if (u.status === 'ACTIVA' && u.fechaInicio) {
    const dias = Math.floor((hoy - new Date(u.fechaInicio)) / 86400000)
    if (dias > DIAS_REVISION_UNIDAD) return `Abierta hace ${dias} días; revisar avance`
  }
  return null
}

function Avance({ ofertas, j }) {
  return (
    <section className="mt-10" aria-labelledby="avance-docente">
      <SeccionTitulo id="avance-docente" titulo="Calificaciones, actividades y unidades" descripcion="Por materia y grupo. «Sin entrega» describe al alumno, no un atraso del docente." />
      {ofertas.length ? (
        <ul className="divide-y divide-border border-y border-border">
          {ofertas.map((o) => (
            <li key={o.id} className="py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link className={cn(linkClass, 'text-sm text-foreground')} to={j.to(`/jefe-carrera/materias/${o.materia.id}`, { oferta: o.grupo.id })}>{o.materia.nombre} · {o.grupo.nombre}</Link>
                {o.docentes.length > 1 && <span className="text-xs text-muted-foreground">Avance compartido por {o.docentes.length} docentes</span>}
              </div>
              <ul className="mt-2.5 flex flex-wrap gap-2" aria-label="Unidades">
                {o.unidades.map((u) => {
                  const info = ESTADO_UNIDAD[u.status] ?? ESTADO_UNIDAD.PENDIENTE
                  const senal = senalUnidad(u)
                  return (
                    <li key={u.id}>
                      <Chip tone={senal ? 'warning' : info.tono}>
                        {u.nombre} · {info.label}{u.status !== 'FINALIZADA' && (u.fechaFin ? ` · cierre ${fechaUnidad(u.fechaFin)}` : ' · sin plazo definido')}
                      </Chip>
                      {senal && <span className="mt-1 block text-xs text-warning-foreground">{senal}</span>}
                    </li>
                  )
                })}
              </ul>
              <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                <div className="flex gap-1.5"><dt className="text-muted-foreground">Calificaciones de unidad pendientes</dt><dd className="font-medium tabular-nums text-foreground">{o.resumen.calificacionesPendientes}</dd></div>
                <div className="flex gap-1.5"><dt className="text-muted-foreground">Entregas recibidas por revisar</dt><dd className="font-medium tabular-nums text-foreground">{o.resumen.entregasPendientes}</dd></div>
                <div className="flex gap-1.5"><dt className="text-muted-foreground">Actividades sin entrega de alumnos</dt><dd className="font-medium tabular-nums text-foreground">{o.resumen.sinEntrega}</dd></div>
              </dl>
            </li>
          ))}
        </ul>
      ) : <Vacio titulo="Sin materias asignadas" />}
    </section>
  )
}

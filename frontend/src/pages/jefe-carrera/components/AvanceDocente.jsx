import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarClock, Check, CircleAlert, CircleCheck, ChevronDown, NotebookPen, TriangleAlert, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ESTADO_UNIDAD, senalUnidad, textoCierre } from '../supervision/estados'
import { plural } from '../supervision/formato'
import { SeccionTitulo, Vacio, linkClass } from '../supervision/ui'
import './avance-docente.css'

const fechaUnidad = (iso) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' })

export default function AvanceDocente({ ofertas, j }) {
  return (
    <section className="avance-docente mt-10" aria-labelledby="avance-docente">
      <SeccionTitulo id="avance-docente" titulo="Calificaciones, actividades y unidades" />
      {ofertas.length ? (
        <div className="avance-materias">
          {ofertas.map((o, i) => <AvanceMateria key={o.id} oferta={o} j={j} inicialmenteAbierta={i === 0} />)}
        </div>
      ) : <Vacio titulo="Sin materias asignadas" />}
    </section>
  )
}

function AvanceMateria({ oferta: o, j, inicialmenteAbierta }) {
  const id = useId()
  const [abierta, setAbierta] = useState(inicialmenteAbierta)
  const [unidadId, setUnidadId] = useState(null)
  const unidades = [...o.unidades].sort((a, b) => a.orden - b.orden)
  const cerradas = unidades.filter((u) => u.status === 'FINALIZADA')
  const activas = unidades.filter((u) => u.status === 'ACTIVA')
  const revision = unidades.filter((u) => senalUnidad(u))
  const seleccionada = unidades.find((u) => u.id === unidadId) ?? activas[0] ?? cerradas.at(-1) ?? unidades[0]
  const senalSeleccionada = seleccionada && senalUnidad(seleccionada)
  const estadoSeleccionado = seleccionada && (ESTADO_UNIDAD[seleccionada.status] ?? ESTADO_UNIDAD.PENDIENTE)
  const pendientes = [
    o.resumen.calificacionesPendientes > 0 && plural(o.resumen.calificacionesPendientes, 'calificación por capturar', 'calificaciones por capturar'),
    o.resumen.entregasPendientes > 0 && plural(o.resumen.entregasPendientes, 'entrega por revisar', 'entregas por revisar'),
    revision.length > 0 && plural(revision.length, 'unidad por revisar', 'unidades por revisar'),
  ].filter(Boolean)
  const destino = j.toDesde(`/jefe-carrera/materias/${o.materia.id}`, { oferta: o.grupo.id, tab: o.resumen.calificacionesPendientes || revision.length ? 'unidades' : 'resumen' })

  return (
    <section className="avance-materia" aria-label={`${o.materia.nombre}, grupo ${o.grupo.nombre}`}>
      <div className="avance-cabecera">
        <div className="min-w-0">
          <div className="avance-identidad">
            <h3><Link className={linkClass} to={j.toDesde(`/jefe-carrera/materias/${o.materia.id}`, { oferta: o.grupo.id, tab: 'unidades' })}>{o.materia.nombre}</Link></h3>
            <span className="avance-grupo">Grupo {o.grupo.nombre}</span>
          </div>
          <p className="avance-resumen">
            {plural(cerradas.length, 'unidad cerrada', 'unidades cerradas')}
            {activas.length > 0 && <> · <strong>{activas.length === 1 ? `${activas[0].nombre} en curso` : plural(activas.length, 'unidad en curso', 'unidades en curso')}</strong></>}
          </p>
          <p className={cn('avance-resumen-pendientes', !pendientes.length && 'avance-sin-pendientes')}>
            {pendientes.length ? <CircleAlert aria-hidden="true" /> : <Check aria-hidden="true" />}
            {pendientes.length ? pendientes.join(' · ') : 'Sin pendientes del docente'}
          </p>
          {o.docentes.length > 1 && <p className="avance-compartido">Avance compartido por {o.docentes.length} docentes</p>}
          {o.cierre && <p className="avance-cierre">{textoCierre(o.cierre)}</p>}
        </div>
        <Button
          variant="secondary" className="avance-expandir" aria-expanded={abierta} aria-controls={`${id}-detalle`}
          aria-label={`${abierta ? 'Contraer' : 'Expandir'} ${o.materia.nombre}, grupo ${o.grupo.nombre}`}
          onClick={() => setAbierta((v) => !v)}
        >
          {abierta ? 'Ocultar detalle' : 'Ver detalle'}
          <ChevronDown aria-hidden="true" className={cn('avance-flecha', abierta && 'avance-flecha-abierta')} />
        </Button>
      </div>
      <div id={`${id}-detalle`} hidden={!abierta} className="avance-contenido">
        {unidades.length ? (
          <>
            <ol className="avance-unidades" aria-label="Estado de las unidades" style={{ '--avance-columnas': Math.min(unidades.length, 5) }}>
              {unidades.map((u, i) => {
                const estado = ESTADO_UNIDAD[u.status] ?? ESTADO_UNIDAD.PENDIENTE
                const senal = senalUnidad(u)
                return (
                  <li key={u.id}>
                    <button type="button" className={cn('avance-unidad', u.status === 'FINALIZADA' && 'avance-unidad-cerrada', u.status === 'ACTIVA' && 'avance-unidad-actual', senal && 'avance-unidad-alerta')} aria-pressed={u.id === seleccionada.id} aria-label={`${u.nombre}, ${estado.label}${senal ? `, ${senal}` : ''}`} onClick={() => setUnidadId(u.id)}>
                      <span className="avance-circulo">{senal ? <TriangleAlert aria-hidden="true" /> : u.status === 'FINALIZADA' ? <Check aria-hidden="true" /> : u.orden ?? i + 1}</span>
                      <span className="avance-unidad-nombre"><span className="avance-unidad-completo">Unidad </span><span className="avance-unidad-corto">U</span>{u.orden ?? i + 1}</span>
                      <span className="avance-unidad-estado">{estado.label}</span>
                    </button>
                  </li>
                )
              })}
            </ol>
            <div className="avance-seleccion" role="status">
              <CalendarClock aria-hidden="true" />
              <div><strong>{seleccionada.nombre}</strong> · {estadoSeleccionado.label}
                {seleccionada.status !== 'FINALIZADA' && (seleccionada.fechaFin ? ` · Cierre ${fechaUnidad(seleccionada.fechaFin)}` : ' · Sin plazo definido')}
                {senalSeleccionada && <p className="avance-senal">{senalSeleccionada}</p>}
              </div>
            </div>
          </>
        ) : <p className="avance-sin-unidades">Sin unidades registradas.</p>}

        {pendientes.length ? (
          <div className="avance-atencion">
            <span><NotebookPen aria-hidden="true" />{pendientes.join(' · ')}</span>
            <Link className="avance-revisar" to={destino}>Revisar pendientes<ArrowRight aria-hidden="true" /></Link>
          </div>
        ) : <p className="avance-al-dia"><CircleCheck aria-hidden="true" />Sin calificaciones ni entregas pendientes del docente</p>}
        <dl className="avance-cantidades">
          <div><dt>Revisión del docente</dt><dd><strong>{o.resumen.entregasPendientes}</strong> entregas recibidas por revisar</dd></div>
          <div><dt>Entregas del alumnado</dt><dd><UsersRound aria-hidden="true" /><span><strong>{o.resumen.sinEntrega}</strong> actividades sin entrega</span></dd></div>
        </dl>
      </div>
    </section>
  )
}

import { Link, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ResultadosAlumnos from './supervision/BuscarAlumno'
import { useBuscarAlumnos } from './supervision/useBuscarAlumnos'
import { periodoTexto, plural, semestreTexto } from './supervision/formato'
import { FiltroChip, Senal } from './supervision/senales'
import { JefaturaPage, Vacio } from './supervision/ui'
import './supervision/consulta.css'

const MODALIDADES = [['', 'Todos'], ['ESCOLARIZADO', 'Escolarizado'], ['MIXTO', 'Mixto']]
const MAX_PUNTOS = 64

export default function JefeGrupos() {
  return (
    <JefaturaPage titulo="Grupos y alumnos">
      {({ j, resumen }) => <Contenido j={j} resumen={resumen} />}
    </JefaturaPage>
  )
}

/**
 * Un solo buscador para alumnos y grupos, y los grupos por semestre como
 * fichas: un punto por alumno (de color si está en riesgo) y solo los
 * pendientes que existen.
 */
function Contenido({ j, resumen }) {
  const [params, setParams] = useSearchParams()
  const set = (patch) => {
    const n = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => { if (v) n.set(k, v); else n.delete(k) })
    setParams(n, { replace: true })
  }
  const modalidad = params.get('modalidad') ?? ''
  const soloRiesgo = params.get('riesgo') === '1'
  // ?alumno= de enlaces anteriores sigue funcionando como búsqueda.
  const busqueda = params.get('q') ?? params.get('alumno') ?? ''
  const alumnos = useBuscarAlumnos(j, busqueda)

  const pendientesPorGrupo = new Map()
  resumen.pendientes.forEach((c) => pendientesPorGrupo.set(c.grupo.id, (pendientesPorGrupo.get(c.grupo.id) ?? 0) + 1))
  const gruposPeriodo = new Map(resumen.grupos.map((g) => [g.id, g]))
  const gruposActivos = resumen.catalogo?.grupos ?? resumen.grupos
  const filas = gruposActivos.map((g) => {
    const seguimiento = gruposPeriodo.get(g.id)
    const ofertas = seguimiento ? resumen.ofertas.filter((o) => o.grupo.id === g.id) : []
    return {
      ...g,
      seguimiento,
      calificaciones: ofertas.reduce((n, o) => n + o.resumen.calificacionesPendientes, 0),
      entregas: ofertas.reduce((n, o) => n + o.resumen.entregasPendientes, 0),
      listas: pendientesPorGrupo.get(g.id) ?? 0,
      alumnosRiesgo: seguimiento?.alumnosRiesgo ?? 0,
      reprobando: seguimiento?.riesgoPorMotivo?.reprobando ?? 0,
      periodoDisponible: j.periodos.includes(g.periodoConsulta),
    }
  })

  const q = busqueda.trim().toLocaleLowerCase()
  const gruposDeAlumnos = new Set(alumnos.items.map((a) => a.grupo?.id).filter(Boolean))
  const coincide = (g) => !q || g.nombre.toLocaleLowerCase().includes(q) || gruposDeAlumnos.has(g.id)
  const porModalidad = (m) => filas.filter((g) => coincide(g) && (!m || g.modalidad === m) && (!soloRiesgo || g.alumnosRiesgo > 0)).length
  const conRiesgo = filas.filter((g) => coincide(g) && (!modalidad || g.modalidad === modalidad) && g.alumnosRiesgo > 0).length
  const visibles = filas.filter((g) => coincide(g) && (!modalidad || g.modalidad === modalidad) && (!soloRiesgo || g.alumnosRiesgo > 0))
  const semestres = [...new Set(visibles.map((g) => g.semestre))].sort((a, b) => a - b)
  const restablecer = () => set({ modalidad: '', riesgo: '', q: '', alumno: '' })

  return (
    <div className="consulta">
      <div className="consulta-controles">
        <label className="consulta-buscar">
          <span className="sr-only">Buscar alumno o grupo</span>
          <Search aria-hidden="true" />
          <input type="search" value={busqueda} onChange={(e) => set({ q: e.target.value, alumno: '' })} placeholder="Buscar alumno o grupo" />
        </label>
        <div className="filtros-chips" role="group" aria-label="Filtrar grupos">
          {MODALIDADES.map(([valor, label]) => (
            <FiltroChip key={valor || 'todos'} activo={modalidad === valor} n={porModalidad(valor)} onClick={() => set({ modalidad: valor })}>{label}</FiltroChip>
          ))}
          <span className="filtros-chips-sep" aria-hidden="true" />
          <FiltroChip tipo="riesgo" activo={soloRiesgo} n={conRiesgo} onClick={() => set({ riesgo: soloRiesgo ? '' : '1' })}>Con alumnos en riesgo</FiltroChip>
        </div>
      </div>

      <ResultadosAlumnos j={j} resumen={resumen} busqueda={alumnos} hayGrupos={visibles.length > 0} />

      {!gruposActivos.length ? (
        <Vacio titulo="Sin grupos activos">La carrera no tiene grupos marcados como activos.</Vacio>
      ) : !visibles.length ? (
        (!q || !alumnos.items.length) && <Vacio titulo="Ningún grupo coincide" accion={<Button variant="outline" onClick={restablecer}>Quitar filtros</Button>} />
      ) : (
        <div className="consulta-libro">
          {semestres.map((semestre) => (
            <section key={semestre} aria-labelledby={`semestre-${semestre}`} className="consulta-semestre">
              <h2 id={`semestre-${semestre}`} className="consulta-semestre-titulo">{semestreTexto(semestre)}</h2>
              <ul className="fichas-grupo">
                {visibles.filter((g) => g.semestre === semestre).map((g) => <li key={g.id}><FichaGrupo j={j} g={g} /></li>)}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function FichaGrupo({ j, g }) {
  const evaluable = Boolean(g.seguimiento)
  const otros = Math.max(0, g.alumnosRiesgo - g.reprobando)
  const puntos = Math.min(MAX_PUNTOS, Math.max(g.alumnosBase ?? 0, g.alumnosRiesgo))
  const contenido = (
    <>
      <span className="ficha-grupo-cabeza">
        <span className="ficha-grupo-nombre">{g.nombre}</span>
        {g.modalidad === 'MIXTO' && <span className="consulta-etiqueta">Mixto</span>}
        <span className="ficha-grupo-alumnos">{plural(g.alumnosBase ?? 0, 'alumno', 'alumnos')}</span>
      </span>
      {evaluable && puntos > 0 && (
        <span className="ficha-grupo-puntos" aria-hidden="true" title={g.alumnosRiesgo ? `${plural(g.reprobando, 'reprobando', 'reprobando')} · ${otros} con otras señales` : undefined}>
          {Array.from({ length: puntos }, (_, i) => <span key={i} data-estado={i < g.reprobando ? 'reprobando' : i < g.alumnosRiesgo ? 'riesgo' : undefined} />)}
        </span>
      )}
      <span className="ficha-grupo-pie">
        {!g.periodoDisponible ? <span className="consulta-tenue">Periodo no compatible con supervisión</span>
          : !evaluable ? <span className="consulta-tenue">Consulta {periodoTexto(g.periodoConsulta)}</span>
            : g.alumnosRiesgo
              ? <span className="ficha-grupo-riesgo">{g.alumnosRiesgo} en riesgo{g.reprobando ? <span className="sr-only">, {g.reprobando} reprobando</span> : null}</span>
              : <span className="consulta-tenue">Sin riesgo</span>}
        {evaluable && <>
          <Senal tipo="listas" n={g.listas} />
          <Senal tipo="calificaciones" n={g.calificaciones} />
          <Senal tipo="entregas" n={g.entregas} />
        </>}
      </span>
    </>
  )
  if (!g.periodoDisponible) return <div className="ficha-grupo">{contenido}</div>
  return <Link className="ficha-grupo" to={j.to(`/jefe-carrera/grupos/${g.id}`, { periodo: g.periodoConsulta })}>{contenido}</Link>
}

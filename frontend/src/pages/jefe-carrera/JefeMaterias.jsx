import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Pencil, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { esDeLaParidad, periodoTexto, plural, semestreTexto } from './supervision/formato'
import MateriaDialog from './supervision/MateriaDialog'
import { FiltroChip, Senal } from './supervision/senales'
import { JefaturaPage, Segmento, Vacio } from './supervision/ui'
import './supervision/consulta.css'

// Cada filtro de revisión elige exactamente las asignaciones (materia en un grupo) que cuenta su indicador.
const REVISIONES = {
  incompleta: { label: 'Sin docente u horario', filtro: (o) => !o.docentes.length || !o.horarios.length },
  'sin-docente': { label: 'Sin docente', filtro: (o) => !o.docentes.length },
  'sin-horario': { label: 'Sin horario', filtro: (o) => !o.horarios.length },
}
const conPendientes = (o) => o.resumen.calificacionesPendientes > 0
const conEntregas = (o) => o.resumen.entregasPendientes > 0

export default function JefeMaterias() {
  const [params, setParams] = useSearchParams()
  // null: cerrado; { materia: null } agrega; { materia } edita. Los primeros
  // pasos de Inicio llegan con ?nueva=1 para abrir el alta directamente.
  const [dialogo, setDialogo] = useState(() => (params.get('nueva') === '1' ? { materia: null } : null))
  useEffect(() => {
    setParams((actual) => {
      if (!actual.has('nueva')) return actual
      const n = new URLSearchParams(actual)
      n.delete('nueva')
      return n
    }, { replace: true })
  }, [setParams])
  const [aviso, setAviso] = useState('')
  const setVarios = (patch) => {
    const n = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => { if (v) n.set(k, v); else n.delete(k) })
    setParams(n, { replace: true })
  }
  const set = (k, v) => setVarios({ [k]: v })
  const revision = REVISIONES[params.get('revision')] ? params.get('revision') : ''
  const soloPendientes = params.get('pendientes') === '1'
  const soloEntregas = params.get('entregas') === '1'
  const soloSinGrupo = params.get('sinGrupo') === '1'
  // Oferta del periodo es la vista de trabajo; la retícula (catálogo) se abre al pedirla o con sus filtros.
  const vistaPedida = params.get('vista') === 'reticula' || params.get('vista') === 'ofertas' ? params.get('vista')
    : soloSinGrupo || params.has('paridad') ? 'reticula' : null
  const delCiclo = params.get('paridad') === 'ciclo'
  const busqueda = params.get('q') ?? ''
  // Un filtro a la vez: elegir uno quita los demás.
  const filtrar = (patch) => setVarios({ revision: '', pendientes: '', entregas: '', sinGrupo: '', paridad: '', ...patch })

  return (
    <JefaturaPage titulo="Materias">
      {({ j, resumen, estado }) => {
        // Sin oferta todavía, lo útil es el catálogo.
        const vista = vistaPedida ?? (resumen.ofertas.length ? 'ofertas' : 'reticula')
        const ofertasPorMateria = new Map()
        resumen.ofertas.forEach((o) => ofertasPorMateria.set(o.materia.id, [...(ofertasPorMateria.get(o.materia.id) ?? []), o]))
        const q = busqueda.trim().toLocaleLowerCase()
        const coincide = (m) => !q || m.nombre.toLocaleLowerCase().includes(q) || m.clave.toLocaleLowerCase().includes(q)
        const paridad = j.periodo?.endsWith('B') ? 'impares' : 'pares'

        // Oferta: cada materia conserva solo las asignaciones que cumplen el filtro.
        const ofertadas = resumen.reticula.filter((m) => ofertasPorMateria.has(m.id) && coincide(m))
        const conFiltro = (filtro) => ofertadas.filter((m) => ofertasPorMateria.get(m.id).some(filtro)).length
        const filtroOferta = revision ? REVISIONES[revision].filtro : soloPendientes ? conPendientes : soloEntregas ? conEntregas : null
        const materiasOfertadas = ofertadas
          .map((m) => ({ ...m, ofertas: ofertasPorMateria.get(m.id).filter((o) => !filtroOferta || filtroOferta(o)) }))
          .filter((m) => m.ofertas.length)

        // Retícula: el catálogo completo, el del ciclo o lo del ciclo que no tiene grupo.
        const enCatalogo = resumen.reticula.filter(coincide)
        const ciclo = enCatalogo.filter((m) => esDeLaParidad(m.semestre, j.periodo))
        const sinGrupo = ciclo.filter((m) => !m.ofertas.length)
        const reticula = soloSinGrupo ? sinGrupo : delCiclo ? ciclo : enCatalogo

        const lista = vista === 'reticula' ? reticula : materiasOfertadas
        const semestres = [...new Set(lista.map((m) => m.semestre ?? 0))].sort((a, b) => a - b)
        const restablecer = () => filtrar({ q: '' })
        const agregar = (semestre) => { setAviso(''); setDialogo({ materia: null, semestre }) }

        return (
          <div className="consulta">
            {dialogo && (
              <MateriaDialog
                j={j}
                materia={dialogo.materia}
                semestre={dialogo.semestre}
                onClose={() => setDialogo(null)}
                onGuardada={(texto) => { setDialogo(null); setAviso(texto); estado.reintentar() }}
              />
            )}
            {aviso && <p role="status" className="mt-4 text-[0.8125rem] text-success-foreground">{aviso}</p>}

            <div className="consulta-controles">
              <div className="consulta-fila-controles">
                <Segmento label="Vista" value={vista} onChange={(v) => setVarios({ vista: v, revision: '', pendientes: '', entregas: '', sinGrupo: '', paridad: '' })} options={[{ value: 'ofertas', label: 'Oferta del periodo' }, { value: 'reticula', label: 'Retícula' }]} />
                <label className="consulta-buscar">
                  <span className="sr-only">Buscar materia</span>
                  <Search aria-hidden="true" />
                  <input type="search" value={busqueda} onChange={(e) => set('q', e.target.value)} placeholder="Nombre o clave" />
                </label>
                {vista === 'reticula' && <Button className="ml-auto" onClick={() => agregar(undefined)}><Plus aria-hidden="true" /> Agregar a la retícula</Button>}
              </div>
              {vista === 'ofertas' ? (
                <div className="filtros-chips" role="group" aria-label="Revisión de la oferta">
                  <FiltroChip activo={!filtroOferta} n={ofertadas.length} onClick={() => filtrar({})}>Todas</FiltroChip>
                  <FiltroChip tipo="calificaciones" activo={soloPendientes} n={conFiltro(conPendientes)} onClick={() => filtrar({ pendientes: soloPendientes ? '' : '1' })}>Calificaciones pendientes</FiltroChip>
                  <FiltroChip tipo="entregas" activo={soloEntregas} n={conFiltro(conEntregas)} onClick={() => filtrar({ entregas: soloEntregas ? '' : '1' })}>Entregas sin revisar</FiltroChip>
                  {revision === 'incompleta' && <FiltroChip tipo="asignacion" activo n={conFiltro(REVISIONES.incompleta.filtro)} onClick={() => filtrar({})}>Sin docente u horario</FiltroChip>}
                  <FiltroChip tipo="asignacion" activo={revision === 'sin-docente'} n={conFiltro(REVISIONES['sin-docente'].filtro)} onClick={() => filtrar({ revision: revision === 'sin-docente' ? '' : 'sin-docente' })}>Sin docente</FiltroChip>
                  <FiltroChip tipo="asignacion" activo={revision === 'sin-horario'} n={conFiltro(REVISIONES['sin-horario'].filtro)} onClick={() => filtrar({ revision: revision === 'sin-horario' ? '' : 'sin-horario' })}>Sin horario</FiltroChip>
                </div>
              ) : (
                <div className="filtros-chips" role="group" aria-label="Semestres de la retícula">
                  <FiltroChip activo={!delCiclo && !soloSinGrupo} n={enCatalogo.length} onClick={() => filtrar({ vista: 'reticula' })}>Todos los semestres</FiltroChip>
                  <FiltroChip activo={delCiclo} n={ciclo.length} onClick={() => filtrar({ vista: 'reticula', paridad: delCiclo ? '' : 'ciclo' })}>Semestres {paridad}</FiltroChip>
                  <FiltroChip tipo="asignacion" activo={soloSinGrupo} n={sinGrupo.length} onClick={() => filtrar({ vista: 'reticula', sinGrupo: soloSinGrupo ? '' : '1' })}>Sin grupo en {periodoTexto(j.periodo)}</FiltroChip>
                </div>
              )}
              {vista === 'reticula' && <p className="consulta-tenue">Catálogo compartido entre periodos: agregar o editar una materia la cambia también en {j.historico ? 'este y los demás ciclos' : 'los ciclos anteriores'}.</p>}
            </div>

            {vista === 'ofertas' && !resumen.ofertas.length ? (
              <Vacio titulo="Ninguna materia con grupo este periodo">Ninguna materia de la carrera está asignada a un grupo activo en este periodo.</Vacio>
            ) : !semestres.length ? (
              <Vacio titulo={vista === 'reticula' && soloSinGrupo ? 'Todas las materias del ciclo tienen grupo' : 'Ninguna materia coincide'} accion={<Button variant="outline" onClick={restablecer}>Restablecer filtros</Button>} />
            ) : (
              <div className="consulta-libro">
                {semestres.map((s) => (
                  <section key={s} className="consulta-semestre" aria-labelledby={`sem-${s}`}>
                    <div className="consulta-semestre-titulo">
                      <h2 id={`sem-${s}`}>{s ? semestreTexto(s) : 'Sin semestre en retícula'}</h2>
                      {vista === 'reticula' && <Button variant="ghost" size="sm" className="consulta-semestre-accion -ml-2" aria-label={`Agregar materia a ${s ? semestreTexto(s) : 'la retícula'}`} onClick={() => agregar(s || undefined)}><Plus aria-hidden="true" /> Agregar</Button>}
                    </div>
                    <ul className="consulta-lista">
                      {lista.filter((m) => (m.semestre ?? 0) === s).map((m) => (
                        <FilaMateria
                          key={m.id}
                          j={j}
                          m={m}
                          ofertas={vista === 'reticula' ? ofertasPorMateria.get(m.id) ?? [] : m.ofertas}
                          reticula={vista === 'reticula'}
                          onEditar={() => { setAviso(''); setDialogo({ materia: m }) }}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        )
      }}
    </JefaturaPage>
  )
}

/** Una materia y sus grupos como «grupo · docente», con solo lo que le falta a cada uno. */
function FilaMateria({ j, m, ofertas, reticula, onEditar }) {
  const inscritos = ofertas.reduce((n, o) => n + o.resumen.alumnos, 0)
  const delCiclo = esDeLaParidad(m.semestre, j.periodo)
  return (
    <li className="consulta-materia">
      <div className="min-w-0">
        {ofertas.length || m.ofertas?.length
          ? <Link className="consulta-nombre" to={j.to(`/jefe-carrera/materias/${m.id}`)}>{m.nombre}</Link>
          : <span className="consulta-nombre">{m.nombre}</span>}
        <p className="consulta-tenue consulta-meta">
          {m.clave}
          {inscritos > 0 && ` · ${plural(inscritos, 'inscrito', 'inscritos')}`}
          {!reticula && !delCiclo && ' · fuera del ciclo (recursamiento o extraordinaria)'}
        </p>
      </div>
      <div className="consulta-acciones flex-wrap justify-between">
        <ul className="consulta-ofertas" aria-label={`Grupos de ${m.nombre}`}>
          {ofertas.length ? ofertas.map((o) => (
            <li key={o.id}>
              <Link className="consulta-oferta" to={j.to(`/jefe-carrera/materias/${m.id}`, { oferta: o.grupo.id })}>
                <b>{o.grupo.nombre}</b>
                {o.docentes.length ? <span>{o.docentes.map((d) => d.nombre).join(', ')}</span> : <span className="consulta-falta">Sin docente</span>}
                {!o.horarios.length && <Senal tipo="asignacion">Sin horario</Senal>}
                <Senal tipo="calificaciones" n={o.resumen.calificacionesPendientes} />
                <Senal tipo="entregas" n={o.resumen.entregasPendientes} />
              </Link>
            </li>
          )) : (
            <li>{delCiclo ? <Senal tipo="asignacion">Sin grupo en el periodo</Senal> : <span className="consulta-tenue">No se imparte en este ciclo</span>}</li>
          )}
        </ul>
        {reticula && <Button variant="ghost" size="sm" aria-label={`Editar ${m.nombre}`} onClick={onEditar}><Pencil aria-hidden="true" /> Editar</Button>}
      </div>
    </li>
  )
}

import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Pencil, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { esDeLaParidad, periodoTexto, plural, semestreTexto } from './supervision/formato'
import MateriaDialog from './supervision/MateriaDialog'
import { JefaturaPage, Segmento, Vacio, linkClass, selectClass } from './supervision/ui'

// Cada filtro de revisión elige exactamente las asignaciones (materia en un grupo) que cuenta su indicador.
const REVISIONES = {
  incompleta: { label: 'Sin docente u horario', filtro: (o) => !o.docentes.length || !o.horarios.length },
  'sin-docente': { label: 'Sin docente', filtro: (o) => !o.docentes.length },
  'sin-horario': { label: 'Sin horario', filtro: (o) => !o.horarios.length },
}
const conPendientes = (o) => o.resumen.calificacionesPendientes > 0

export default function JefeMaterias() {
  const [params, setParams] = useSearchParams()
  // null: cerrado; { materia: null } agrega; { materia } edita.
  const [dialogo, setDialogo] = useState(null)
  const [aviso, setAviso] = useState('')
  const setVarios = (patch) => {
    const n = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => { if (v) n.set(k, v); else n.delete(k) })
    setParams(n, { replace: true })
  }
  const set = (k, v) => setVarios({ [k]: v })
  const revision = REVISIONES[params.get('revision')] ? params.get('revision') : ''
  const soloPendientes = params.get('pendientes') === '1'
  // Un enlace con filtros de oferta abre la vista de ofertas aunque no la nombre.
  const vista = params.get('vista') === 'ofertas' || (!params.get('vista') && (revision || soloPendientes)) ? 'ofertas' : 'reticula'
  const soloSinGrupo = params.get('sinGrupo') === '1'
  const todas = params.get('paridad') !== 'ciclo' && !soloSinGrupo
  const busqueda = params.get('q') ?? ''

  return (
    <JefaturaPage
      titulo="Materias"
      subtitulo="La retícula de la carrera y lo que se imparte en el periodo."
      accion={<Button onClick={() => { setAviso(''); setDialogo({ materia: null }) }}><Plus aria-hidden="true" /> Agregar a la retícula</Button>}
    >
      {({ j, resumen, estado }) => {
        const ofertasPorMateria = new Map()
        resumen.ofertas.forEach((o) => ofertasPorMateria.set(o.materia.id, [...(ofertasPorMateria.get(o.materia.id) ?? []), o]))
        const sinOferta = resumen.reticula.filter((m) => esDeLaParidad(m.semestre, j.periodo) && !m.ofertas.length)
        const sinDocente = resumen.ofertas.filter(REVISIONES['sin-docente'].filtro)
        const sinHorario = resumen.ofertas.filter(REVISIONES['sin-horario'].filtro)
        const q = busqueda.trim().toLocaleLowerCase()
        const coincide = (m) => !q || m.nombre.toLocaleLowerCase().includes(q) || m.clave.toLocaleLowerCase().includes(q)
        const paridad = j.periodo?.endsWith('B') ? 'impares' : 'pares'
        const filtrando = Boolean(revision || soloPendientes)

        // Con un filtro activo cada materia conserva solo las asignaciones que lo cumplen.
        const materiasOfertadas = resumen.reticula
          .filter((m) => ofertasPorMateria.has(m.id) && coincide(m))
          .map((m) => ({
            ...m,
            ofertas: ofertasPorMateria.get(m.id)
              .filter((o) => !revision || REVISIONES[revision].filtro(o))
              .filter((o) => !soloPendientes || conPendientes(o)),
          }))
          .filter((m) => m.ofertas.length)
        const asignacionesVisibles = materiasOfertadas.reduce((n, m) => n + m.ofertas.length, 0)
        const reticula = resumen.reticula
          .filter((m) => (todas || esDeLaParidad(m.semestre, j.periodo)) && coincide(m))
          .filter((m) => !soloSinGrupo || !m.ofertas.length)
        const semestres = [...new Set(reticula.map((m) => m.semestre ?? 0))].sort((a, b) => a - b)
        const restablecer = () => {
          const n = new URLSearchParams(params)
          ;['pendientes', 'revision', 'q', 'sinGrupo', 'paridad'].forEach((k) => n.delete(k))
          setParams(n, { replace: true })
        }

        return (
          <>
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
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-1 border-y border-border py-3 text-[0.8125rem]" aria-label="Revisión del periodo">
              <li>
                {sinOferta.length
                  ? <button type="button" aria-pressed={vista === 'reticula' && soloSinGrupo} className={cn(linkClass, 'min-h-11 md:min-h-0')} onClick={() => setVarios({ vista: 'reticula', sinGrupo: soloSinGrupo ? '' : '1', revision: '', pendientes: '' })}>{plural(sinOferta.length, 'materia del ciclo sin grupo', 'materias del ciclo sin grupo')}</button>
                  : <span className="text-muted-foreground">Retícula del ciclo cubierta</span>}
              </li>
              <li>
                {sinDocente.length
                  ? <button type="button" aria-pressed={vista === 'ofertas' && revision === 'sin-docente'} className={cn(linkClass, 'min-h-11 text-warning-foreground md:min-h-0')} onClick={() => setVarios({ vista: 'ofertas', revision: revision === 'sin-docente' ? '' : 'sin-docente', pendientes: '' })}>{plural(sinDocente.length, 'materia en un grupo sin docente', 'materias en grupos sin docente')}</button>
                  : <span className="text-muted-foreground">Todas las materias con docente</span>}
              </li>
              <li>
                {sinHorario.length
                  ? <button type="button" aria-pressed={vista === 'ofertas' && revision === 'sin-horario'} className={cn(linkClass, 'min-h-11 text-warning-foreground md:min-h-0')} onClick={() => setVarios({ vista: 'ofertas', revision: revision === 'sin-horario' ? '' : 'sin-horario', pendientes: '' })}>{plural(sinHorario.length, 'materia en un grupo sin horario', 'materias en grupos sin horario')}</button>
                  : <span className="text-muted-foreground">Todas las materias con horario</span>}
              </li>
            </ul>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Segmento label="Vista" value={vista} onChange={(v) => set('vista', v)} options={[{ value: 'reticula', label: 'Retícula completa' }, { value: 'ofertas', label: 'Con grupo este periodo' }]} />
              <label className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <span className="sr-only">Buscar materia</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input type="search" value={busqueda} onChange={(e) => set('q', e.target.value)} placeholder="Nombre o clave" className="h-11 w-full rounded-[0.7rem] border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40" />
              </label>
              {vista === 'reticula' ? (
                <>
                  <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-[0.8125rem]">
                    <input type="checkbox" checked={todas} disabled={soloSinGrupo} onChange={(e) => set('paridad', e.target.checked ? '' : 'ciclo')} className="size-[17px] accent-primary" />
                    Incluir todos los semestres
                  </label>
                  <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-[0.8125rem]">
                    <input type="checkbox" checked={soloSinGrupo} onChange={(e) => set('sinGrupo', e.target.checked ? '1' : '')} className="size-[17px] accent-primary" />
                    Solo las del ciclo sin grupo
                  </label>
                </>
              ) : (
                <>
                  <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-[0.8125rem]">
                    <input type="checkbox" checked={soloPendientes} onChange={(e) => set('pendientes', e.target.checked ? '1' : '')} className="size-[17px] accent-primary" />
                    Con calificaciones pendientes
                  </label>
                  <label className="w-full sm:w-56">
                    <span className="sr-only">Revisión de la asignación</span>
                    <select value={revision} onChange={(e) => set('revision', e.target.value)} className={selectClass}>
                      <option value="">Todas las asignaciones</option>
                      {Object.entries(REVISIONES).map(([value, r]) => <option key={value} value={value}>{r.label}</option>)}
                    </select>
                  </label>
                </>
              )}
            </div>

            {vista === 'reticula' ? (
              <>
                <p className="mt-4 rounded-[var(--radius-item)] border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
                  <b className="font-medium text-foreground">La retícula es un catálogo de la carrera, común a todos los periodos.</b>{' '}
                  Agregar o editar una materia la cambia también al consultar {j.historico ? 'este y los demás ciclos' : 'ciclos anteriores'}.
                  {' '}{soloSinGrupo ? `Materias de semestres ${paridad} sin grupo en ${periodoTexto(j.periodo)}.` : todas ? 'Toda la retícula de la carrera.' : `Semestres ${paridad}, los que corresponden a ${periodoTexto(j.periodo)}.`}
                  {' '}La oferta real manda: una materia de otro semestre puede impartirse como recursamiento.
                </p>
                {semestres.length ? semestres.map((s) => (
                  <section key={s} className="mt-6" aria-labelledby={`ret-${s}`}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h2 id={`ret-${s}`} className="text-base font-semibold text-foreground">{s ? semestreTexto(s) : 'Sin semestre en retícula'}</h2>
                      <Button variant="ghost" size="sm" onClick={() => { setAviso(''); setDialogo({ materia: null, semestre: s || undefined }) }}><Plus aria-hidden="true" /> Agregar</Button>
                    </div>
                    <ul className="divide-y divide-border rounded-[var(--radius-item)] border border-border bg-card">
                      {reticula.filter((m) => (m.semestre ?? 0) === s).map((m) => (
                        <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[0.8125rem]">
                          <span className="min-w-0">
                            {m.ofertas.length ? <Link className={cn(linkClass, 'text-foreground')} to={j.to(`/jefe-carrera/materias/${m.id}`)}>{m.nombre}</Link> : <span className="text-foreground">{m.nombre}</span>}
                            <span className="ml-2 text-xs text-muted-foreground">{m.clave}</span>
                          </span>
                          <span className="flex items-center gap-2">
                            {m.ofertas.length
                              ? <span className="text-xs text-muted-foreground">{m.ofertas.length === 1 ? 'En 1 grupo este periodo' : `En ${m.ofertas.length} grupos este periodo`}</span>
                              : <span className="text-xs font-medium text-warning-foreground">Sin grupo en el periodo</span>}
                            <Button variant="ghost" size="sm" aria-label={`Editar ${m.nombre}`} onClick={() => { setAviso(''); setDialogo({ materia: m }) }}>
                              <Pencil aria-hidden="true" /> Editar
                            </Button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )) : <Vacio titulo={soloSinGrupo ? 'Todas las materias del ciclo tienen grupo' : 'Ninguna materia coincide'} accion={<Button variant="outline" onClick={restablecer}>Restablecer filtros</Button>} />}
                {soloSinGrupo && semestres.length > 0 && (
                  <p className="mt-3 text-xs text-muted-foreground">Para impartirlas falta asignarlas a un grupo con docente y horario: lo registra coordinación o el docente al capturar su horario.</p>
                )}
              </>
            ) : (
              <p className="mt-4 text-xs text-muted-foreground">
                Materias asignadas a un grupo activo en {periodoTexto(j.periodo)}: quién las imparte, cuántos alumnos tienen y si les falta horario o calificaciones.
                {filtrando && ` Se muestran ${plural(asignacionesVisibles, 'asignación (materia en un grupo) que cumple', 'asignaciones (materia en un grupo) que cumplen')} el filtro.`}
              </p>
            )}
            {vista === 'ofertas' && revision && asignacionesVisibles > 0 && (
              <p className="mt-2 rounded-[var(--radius-item)] border border-warning/35 bg-warning/10 px-4 py-3 text-xs text-foreground">
                <b className="font-medium">Quién lo corrige:</b> el docente al capturar su horario en SICAT, o coordinación desde Horarios. La jefatura lo consulta aquí; registra el acuerdo como seguimiento con el docente.
              </p>
            )}
            {vista === 'reticula' ? null : !resumen.ofertas.length ? (
              <Vacio titulo="Ninguna materia con grupo este periodo">Ninguna materia de la carrera está asignada a un grupo activo en este periodo.</Vacio>
            ) : !materiasOfertadas.length ? (
              <Vacio titulo={revision ? `Ninguna asignación ${REVISIONES[revision].label.toLowerCase()}` : soloPendientes ? 'Sin calificaciones pendientes' : 'Ninguna materia coincide'} accion={<Button variant="outline" onClick={restablecer}>Restablecer filtros</Button>} />
            ) : (
              <div role="region" tabIndex={0} aria-label="Materias ofertadas en el periodo" className="mt-5 overflow-x-auto rounded-[var(--radius-item)] border border-border bg-card focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
                <table className="w-full min-w-[860px] border-collapse text-[0.8125rem]">
                  <thead>
                    <tr className="border-b border-border bg-background text-left text-xs text-muted-foreground">
                      <th scope="col" className="px-4 py-2.5 font-medium">Materia</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Semestre de retícula</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Grupos</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Docentes</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">Inscritos</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium" title="Calificaciones de unidades ya cerradas que el docente no ha capturado">Calif. de unidades cerradas sin capturar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materiasOfertadas.map((m) => {
                      const docentes = [...new Map(m.ofertas.flatMap((o) => o.docentes).map((d) => [d.id, d])).values()]
                      const pendientes = m.ofertas.reduce((n, o) => n + o.resumen.calificacionesPendientes, 0)
                      return (
                        <tr key={m.id} className="border-b border-border align-top last:border-b-0">
                          <th scope="row" className="px-4 py-3 text-left font-medium">
                            <Link className={cn(linkClass, 'text-foreground')} to={j.to(`/jefe-carrera/materias/${m.id}`)}>{m.nombre}</Link>
                            <span className="block text-xs font-normal text-muted-foreground">{m.clave}</span>
                          </th>
                          <td className="px-4 py-3 text-muted-foreground">
                            {semestreTexto(m.semestre)}
                            {!esDeLaParidad(m.semestre, j.periodo) && <span className="block text-xs text-warning-foreground">Fuera del ciclo: recursamiento o extraordinaria</span>}
                          </td>
                          <td className="px-4 py-3">
                            {m.ofertas.map((o) => (
                              <span key={o.id} className="block">
                                <Link className={linkClass} to={j.to(`/jefe-carrera/materias/${m.id}`, { oferta: o.grupo.id })}>{o.grupo.nombre}</Link>
                                {!o.horarios.length && <span className="ml-1.5 text-xs text-warning-foreground">sin horario</span>}
                                {!o.docentes.length && <span className="ml-1.5 text-xs text-warning-foreground">sin docente</span>}
                              </span>
                            ))}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{docentes.length ? docentes.map((d) => <span key={d.id} className="block">{d.nombre}</span>) : <span className="text-warning-foreground">Sin docente asignado</span>}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{m.ofertas.reduce((n, o) => n + o.resumen.alumnos, 0)}</td>
                          <td className={cn('px-4 py-3 text-right tabular-nums', pendientes ? 'font-semibold text-warning-foreground' : 'text-muted-foreground')}>{pendientes}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )
      }}
    </JefaturaPage>
  )
}

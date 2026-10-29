import { Link, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ComparativoRiesgo from './graficas/ComparativoRiesgo'
import BuscarAlumno from './supervision/BuscarAlumno'
import { modalidadTexto, periodoTexto, semestreTexto } from './supervision/formato'
import { JefaturaPage, Segmento, Vacio, linkClass } from './supervision/ui'

function textoPendientes(g) {
  if (g.listas == null) return g.periodoDisponible ? `Consulta ${periodoTexto(g.periodoConsulta)}` : 'Periodo no compatible con supervisión'
  if (!g.listas && !g.calificaciones) return 'Sin pendientes detectados'
  return [g.listas && `${g.listas} ${g.listas === 1 ? 'lista' : 'listas'}`, g.calificaciones && `${g.calificaciones} ${g.calificaciones === 1 ? 'calificación' : 'calificaciones'}`].filter(Boolean).join(' · ')
}

export default function JefeGrupos() {
  const [params, setParams] = useSearchParams()
  const set = (k, v) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); setParams(n, { replace: true }) }
  const modalidad = params.get('modalidad') ?? ''
  const soloRiesgo = params.get('riesgo') === '1'
  const busqueda = params.get('q') ?? ''

  return (
    <JefaturaPage titulo="Grupos y alumnos" subtitulo="Busca a un alumno o abre un grupo para ver su alumnado y el expediente de cada persona.">
      {({ j, resumen }) => {
        const pendientesPorGrupo = new Map()
        resumen.pendientes.forEach((c) => pendientesPorGrupo.set(c.grupo.id, (pendientesPorGrupo.get(c.grupo.id) ?? 0) + 1))
        const gruposPeriodo = new Map(resumen.grupos.map((g) => [g.id, g]))
        const gruposActivos = resumen.catalogo?.grupos ?? resumen.grupos
        const filas = gruposActivos.map((g) => {
          const seguimiento = gruposPeriodo.get(g.id)
          const ofertas = seguimiento ? resumen.ofertas.filter((o) => o.grupo.id === g.id) : []
          return {
            ...g,
            materias: g.ofertas?.length ?? ofertas.length,
            inscripciones: seguimiento ? ofertas.reduce((n, o) => n + o.resumen.alumnos, 0) : null,
            calificaciones: seguimiento ? ofertas.reduce((n, o) => n + o.resumen.calificacionesPendientes, 0) : null,
            listas: seguimiento ? (pendientesPorGrupo.get(g.id) ?? 0) : null,
            alumnosRiesgo: seguimiento?.alumnosRiesgo ?? null,
            periodoDisponible: j.periodos.includes(g.periodoConsulta),
          }
        })
        const q = busqueda.trim().toLocaleLowerCase()
        const visibles = filas.filter((g) => (!modalidad || g.modalidad === modalidad) && (!soloRiesgo || g.alumnosRiesgo > 0) && (!q || g.nombre.toLocaleLowerCase().includes(q)))
        const semestres = [...new Set(visibles.map((g) => g.semestre))].sort((a, b) => a - b)
        const filtrando = Boolean(modalidad || soloRiesgo || q)
        const restablecer = () => {
          const n = new URLSearchParams(params)
          ;['modalidad', 'riesgo', 'q'].forEach((k) => n.delete(k))
          setParams(n, { replace: true })
        }
        const alumnosTo = (g) => j.to(`/jefe-carrera/grupos/${g.id}`, { periodo: g.periodoConsulta, tab: 'alumnos' })

        return (
          <>
            <BuscarAlumno j={j} resumen={resumen} />

            <h2 className="mt-9 text-sm font-semibold text-foreground">Grupos activos</h2>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Segmento label="Modalidad" value={modalidad} onChange={(v) => set('modalidad', v)} options={[{ value: '', label: 'Todas' }, { value: 'ESCOLARIZADO', label: 'Escolarizado' }, { value: 'MIXTO', label: 'Mixto' }]} />
              <label className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <span className="sr-only">Buscar grupo</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input type="search" value={busqueda} onChange={(e) => set('q', e.target.value)} placeholder="Buscar grupo" className="h-11 w-full rounded-[0.7rem] border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40" />
              </label>
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-[0.8125rem] text-foreground">
                <input type="checkbox" checked={soloRiesgo} onChange={(e) => set('riesgo', e.target.checked ? '1' : '')} className="size-[17px] accent-primary" />
                Con alumnos en riesgo
              </label>
              {filtrando && <Button variant="ghost" className="min-h-11" onClick={restablecer}>Quitar filtros</Button>}
            </div>
            {filtrando && (
              <p role="status" className="mt-2 text-xs text-muted-foreground">
                Mostrando {visibles.length} de {filas.length} grupos · {[modalidad && modalidadTexto(modalidad), soloRiesgo && 'con alumnos en riesgo', q && `nombre con «${busqueda.trim()}»`].filter(Boolean).join(' · ')}
              </p>
            )}

            <p className="mt-4 max-w-3xl text-xs text-muted-foreground">
              <b className="font-medium text-foreground">Alumnos del grupo</b>: personas con ese grupo base. <b className="font-medium text-foreground">Inscripciones a materias</b>: materias aceptadas en {periodoTexto(j.periodo)}; cada persona tiene varias, por eso la cifra es mayor. Inscripciones, riesgo y pendientes son del periodo seleccionado.
            </p>

            <ComparativoRiesgo
              j={j}
              grupos={visibles.flatMap((g) => {
                const seguimiento = gruposPeriodo.get(g.id)
                return seguimiento ? [{ ...seguimiento, periodoConsulta: g.periodoConsulta, periodoDisponible: g.periodoDisponible }] : []
              })}
            />

            {!gruposActivos.length ? (
              <Vacio titulo="Sin grupos activos">La carrera no tiene grupos marcados como activos.</Vacio>
            ) : !visibles.length ? (
              <Vacio titulo="Ningún grupo coincide" accion={<Button variant="outline" onClick={restablecer}>Quitar filtros</Button>}>
                {soloRiesgo ? 'Ningún grupo tiene alumnos con señales de riesgo.' : 'Prueba con otra modalidad o búsqueda.'}
              </Vacio>
            ) : semestres.map((semestre) => (
              <section key={semestre} aria-labelledby={`semestre-${semestre}`} className="mt-8">
                <h2 id={`semestre-${semestre}`} className="mb-2 text-base font-semibold text-foreground">{semestreTexto(semestre)}</h2>
                {/* En móvil, una tarjeta por grupo con lo necesario para decidir si abrirlo. */}
                <ul className="divide-y divide-border rounded-[var(--radius-item)] border border-border bg-card md:hidden">
                  {visibles.filter((g) => g.semestre === semestre).map((g) => (
                    <li key={g.id} className="px-4 py-3 text-[0.8125rem]">
                      <div className="flex items-baseline justify-between gap-3">
                        {g.periodoDisponible
                          ? <Link to={j.to(`/jefe-carrera/grupos/${g.id}`, { periodo: g.periodoConsulta })} className={`${linkClass} text-[0.9375rem] font-semibold text-foreground`}>{g.nombre}</Link>
                          : <span className="text-[0.9375rem] font-semibold text-foreground">{g.nombre}</span>}
                        <span className="shrink-0 text-xs text-muted-foreground">{modalidadTexto(g.modalidad)} · {periodoTexto(g.periodo)}</span>
                      </div>
                      <p className="mt-1 tabular-nums text-muted-foreground">
                        {g.alumnosBase} alumnos del grupo · {g.inscripciones ?? '—'} inscripciones a materias · <span className={g.alumnosRiesgo ? 'font-semibold text-warning-foreground' : undefined}>{g.alumnosRiesgo ?? '—'} en riesgo</span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{textoPendientes(g)}</p>
                      {g.periodoDisponible && <Link to={alumnosTo(g)} className={`${linkClass} text-xs`}>Ver alumnos y expedientes</Link>}
                    </li>
                  ))}
                </ul>
                <div role="region" tabIndex={0} aria-label={`Grupos de ${semestreTexto(semestre)}`} className="overflow-x-auto max-md:hidden rounded-[var(--radius-item)] border border-border bg-card focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
                  <table className="w-full min-w-[820px] border-collapse text-[0.8125rem]">
                    <thead>
                      <tr className="border-b border-border bg-background text-left text-xs text-muted-foreground">
                        <th scope="col" className="px-4 py-2.5 font-medium">Grupo</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">Periodo</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">Modalidad</th>
                        <th scope="col" className="px-4 py-2.5 text-right font-medium">Alumnos del grupo</th>
                        <th scope="col" className="px-4 py-2.5 text-right font-medium">Materias</th>
                        <th scope="col" className="px-4 py-2.5 text-right font-medium">Inscripciones a materias</th>
                        <th scope="col" className="px-4 py-2.5 text-right font-medium">En riesgo</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">Pendientes de registro</th>
                        <th scope="col" className="px-4 py-2.5 font-medium"><span className="sr-only">Alumnado</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibles.filter((g) => g.semestre === semestre).map((g) => (
                        <tr key={g.id} className="border-b border-border last:border-b-0">
                          <th scope="row" className="px-4 py-3 text-left font-semibold">
                            {g.periodoDisponible
                              ? <Link to={j.to(`/jefe-carrera/grupos/${g.id}`, { periodo: g.periodoConsulta })} className={`${linkClass} text-foreground`}>{g.nombre}</Link>
                              : <span className="text-foreground">{g.nombre}</span>}
                          </th>
                          <td className="px-4 py-3 text-muted-foreground">{periodoTexto(g.periodo)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{modalidadTexto(g.modalidad)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{g.alumnosBase}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{g.materias}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{g.inscripciones ?? '—'}</td>
                          <td className={`px-4 py-3 text-right tabular-nums ${g.alumnosRiesgo ? 'font-semibold text-warning-foreground' : 'text-muted-foreground'}`}>{g.alumnosRiesgo ?? '—'}</td>
                          <td className="px-4 py-3 text-muted-foreground">{textoPendientes(g)}</td>
                          <td className="px-4 py-3 text-right">{g.periodoDisponible && <Link to={alumnosTo(g)} className={`${linkClass} whitespace-nowrap text-xs`} aria-label={`Ver alumnos del grupo ${g.nombre}`}>Ver alumnos</Link>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </>
        )
      }}
    </JefaturaPage>
  )
}

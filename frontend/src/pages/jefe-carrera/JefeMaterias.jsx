import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { esDeLaParidad, semestreTexto } from './supervision/formato'
import { JefaturaPage, Segmento, Vacio, linkClass } from './supervision/ui'

export default function JefeMaterias() {
  const [params, setParams] = useSearchParams()
  const [busqueda, setBusqueda] = useState('')
  const set = (k, v) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); setParams(n, { replace: true }) }
  const vista = params.get('vista') === 'reticula' ? 'reticula' : ''
  const todas = params.get('paridad') === 'todas'
  const soloPendientes = params.get('pendientes') === '1'

  return (
    <JefaturaPage titulo="Materias" subtitulo="Lo que se imparte en el periodo frente a la retícula de la carrera.">
      {({ j, resumen }) => {
        const ofertasPorMateria = new Map()
        resumen.ofertas.forEach((o) => ofertasPorMateria.set(o.materia.id, [...(ofertasPorMateria.get(o.materia.id) ?? []), o]))
        const sinOferta = resumen.reticula.filter((m) => esDeLaParidad(m.semestre, j.periodo) && !m.ofertas.length)
        const sinDocente = resumen.ofertas.filter((o) => !o.docentes.length)
        const sinHorario = resumen.ofertas.filter((o) => !o.horarios.length)
        const q = busqueda.trim().toLocaleLowerCase()
        const coincide = (m) => !q || m.nombre.toLocaleLowerCase().includes(q) || m.clave.toLocaleLowerCase().includes(q)
        const paridad = j.periodo?.endsWith('B') ? 'impares' : 'pares'

        const materiasOfertadas = resumen.reticula
          .filter((m) => ofertasPorMateria.has(m.id) && coincide(m))
          .map((m) => ({ ...m, ofertas: ofertasPorMateria.get(m.id) }))
          .filter((m) => !soloPendientes || m.ofertas.some((o) => o.resumen.calificacionesPendientes > 0))
        const reticula = resumen.reticula.filter((m) => (todas || esDeLaParidad(m.semestre, j.periodo)) && coincide(m))
        const semestres = [...new Set(reticula.map((m) => m.semestre ?? 0))].sort((a, b) => a - b)

        return (
          <>
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-1 border-y border-border py-3 text-[0.8125rem]" aria-label="Revisión de la oferta">
              <li>{sinOferta.length ? <button type="button" className={linkClass} onClick={() => set('vista', 'reticula')}>{sinOferta.length} {sinOferta.length === 1 ? 'materia' : 'materias'} de la retícula sin oferta</button> : <span className="text-muted-foreground">Retícula del ciclo cubierta</span>}</li>
              <li className={sinDocente.length ? 'text-warning-foreground' : 'text-muted-foreground'}>{sinDocente.length ? `${sinDocente.length} ${sinDocente.length === 1 ? 'oferta' : 'ofertas'} sin docente` : 'Todas las ofertas con docente'}</li>
              <li className={sinHorario.length ? 'text-warning-foreground' : 'text-muted-foreground'}>{sinHorario.length ? `${sinHorario.length} ${sinHorario.length === 1 ? 'oferta' : 'ofertas'} sin horario` : 'Todas las ofertas con horario'}</li>
            </ul>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Segmento label="Vista" value={vista} onChange={(v) => set('vista', v)} options={[{ value: '', label: 'Ofertas del periodo' }, { value: 'reticula', label: 'Retícula' }]} />
              <label className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <span className="sr-only">Buscar materia</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre o clave" className="h-11 w-full rounded-[0.7rem] border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40" />
              </label>
              {vista === 'reticula' ? (
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-[0.8125rem]">
                  <input type="checkbox" checked={todas} onChange={(e) => set('paridad', e.target.checked ? 'todas' : '')} className="size-[17px] accent-primary" />
                  Incluir semestres fuera del ciclo
                </label>
              ) : (
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-[0.8125rem]">
                  <input type="checkbox" checked={soloPendientes} onChange={(e) => set('pendientes', e.target.checked ? '1' : '')} className="size-[17px] accent-primary" />
                  Con calificaciones pendientes
                </label>
              )}
            </div>

            {vista === 'reticula' ? (
              <>
                <p className="mt-4 text-xs text-muted-foreground">{todas ? 'Toda la retícula de la carrera.' : `Semestres ${paridad}, los que corresponden a ${j.periodo}.`} La oferta real manda: una materia de otro semestre puede impartirse como recursamiento.</p>
                {semestres.length ? semestres.map((s) => (
                  <section key={s} className="mt-6" aria-labelledby={`ret-${s}`}>
                    <h2 id={`ret-${s}`} className="mb-2 text-base font-semibold text-foreground">{s ? semestreTexto(s) : 'Sin semestre en retícula'}</h2>
                    <ul className="divide-y divide-border rounded-[var(--radius-item)] border border-border bg-card">
                      {reticula.filter((m) => (m.semestre ?? 0) === s).map((m) => (
                        <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[0.8125rem]">
                          <span className="min-w-0">
                            {m.ofertas.length ? <Link className={cn(linkClass, 'text-foreground')} to={j.to(`/jefe-carrera/materias/${m.id}`)}>{m.nombre}</Link> : <span className="text-foreground">{m.nombre}</span>}
                            <span className="ml-2 text-xs text-muted-foreground">{m.clave}</span>
                          </span>
                          {m.ofertas.length
                            ? <span className="text-xs text-muted-foreground">{m.ofertas.length === 1 ? 'Ofertada en 1 grupo' : `Ofertada en ${m.ofertas.length} grupos`}</span>
                            : <span className="text-xs font-medium text-warning-foreground">Sin oferta en el periodo</span>}
                        </li>
                      ))}
                    </ul>
                  </section>
                )) : <Vacio titulo="Ninguna materia coincide" />}
              </>
            ) : !resumen.ofertas.length ? (
              <Vacio titulo="Sin oferta en el periodo">Ninguna materia de la carrera está asignada a un grupo activo en este periodo.</Vacio>
            ) : !materiasOfertadas.length ? (
              <Vacio titulo={soloPendientes ? 'Sin calificaciones pendientes' : 'Ninguna materia coincide'} accion={<Button variant="outline" onClick={() => { setBusqueda(''); set('pendientes', '') }}>Restablecer filtros</Button>} />
            ) : (
              <div className="mt-5 overflow-x-auto rounded-[var(--radius-item)] border border-border bg-card">
                <table className="w-full min-w-[860px] border-collapse text-[0.8125rem]">
                  <thead>
                    <tr className="border-b border-border bg-background text-left text-xs text-muted-foreground">
                      <th scope="col" className="px-4 py-2.5 font-medium">Materia</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Semestre de retícula</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Grupos</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Docentes</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">Inscritos</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">Calif. pendientes</th>
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

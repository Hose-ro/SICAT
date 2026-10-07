import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { modalidadTexto, semestreTexto } from './supervision/formato'
import { JefaturaPage, Segmento, Vacio, linkClass } from './supervision/ui'

export default function JefeGrupos() {
  const [params, setParams] = useSearchParams()
  const [busqueda, setBusqueda] = useState('')
  const set = (k, v) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); setParams(n, { replace: true }) }
  const modalidad = params.get('modalidad') ?? ''
  const soloRiesgo = params.get('riesgo') === '1'

  return (
    <JefaturaPage titulo="Grupos" subtitulo="Grupos activos de la carrera en el periodo, con su alumnado y sus pendientes.">
      {({ j, resumen }) => {
        const pendientesPorGrupo = new Map()
        resumen.pendientes.forEach((c) => pendientesPorGrupo.set(c.grupo.id, (pendientesPorGrupo.get(c.grupo.id) ?? 0) + 1))
        const filas = resumen.grupos.map((g) => {
          const ofertas = resumen.ofertas.filter((o) => o.grupo.id === g.id)
          return {
            ...g,
            materias: ofertas.length,
            inscripciones: ofertas.reduce((n, o) => n + o.resumen.alumnos, 0),
            calificaciones: ofertas.reduce((n, o) => n + o.resumen.calificacionesPendientes, 0),
            listas: pendientesPorGrupo.get(g.id) ?? 0,
          }
        })
        const q = busqueda.trim().toLocaleLowerCase()
        const visibles = filas.filter((g) => (!modalidad || g.modalidad === modalidad) && (!soloRiesgo || g.alumnosRiesgo > 0) && (!q || g.nombre.toLocaleLowerCase().includes(q)))
        const semestres = [...new Set(visibles.map((g) => g.semestre))].sort((a, b) => a - b)

        return (
          <>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Segmento label="Modalidad" value={modalidad} onChange={(v) => set('modalidad', v)} options={[{ value: '', label: 'Todas' }, { value: 'ESCOLARIZADO', label: 'Escolarizado' }, { value: 'MIXTO', label: 'Mixto' }]} />
              <label className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <span className="sr-only">Buscar grupo</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar grupo" className="h-11 w-full rounded-[0.7rem] border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40" />
              </label>
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-[0.8125rem] text-foreground">
                <input type="checkbox" checked={soloRiesgo} onChange={(e) => set('riesgo', e.target.checked ? '1' : '')} className="size-[17px] accent-primary" />
                Con alumnos en riesgo
              </label>
            </div>

            <p className="mt-4 max-w-3xl text-xs text-muted-foreground">
              <b className="font-medium text-foreground">Alumnos</b> cuenta a quienes pertenecen al grupo base. <b className="font-medium text-foreground">Inscripciones</b> suma las inscripciones aceptadas en sus materias, incluidos alumnos de otros grupos; un alumno cuenta una vez por materia.
            </p>

            {!resumen.grupos.length ? (
              <Vacio titulo="Sin grupos en el periodo">La carrera no tiene grupos activos en este periodo.</Vacio>
            ) : !visibles.length ? (
              <Vacio titulo="Ningún grupo coincide" accion={<Button variant="outline" onClick={() => { setBusqueda(''); setParams(new URLSearchParams({ carrera: j.carreraId, periodo: j.periodo }), { replace: true }) }}>Restablecer filtros</Button>}>
                {soloRiesgo ? 'Ningún grupo tiene alumnos con señales de riesgo.' : 'Prueba con otra modalidad o búsqueda.'}
              </Vacio>
            ) : semestres.map((semestre) => (
              <section key={semestre} aria-labelledby={`semestre-${semestre}`} className="mt-8">
                <h2 id={`semestre-${semestre}`} className="mb-2 text-base font-semibold text-foreground">{semestreTexto(semestre)}</h2>
                <div className="overflow-x-auto rounded-[var(--radius-item)] border border-border bg-card">
                  <table className="w-full min-w-[720px] border-collapse text-[0.8125rem]">
                    <thead>
                      <tr className="border-b border-border bg-background text-left text-xs text-muted-foreground">
                        <th scope="col" className="px-4 py-2.5 font-medium">Grupo</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">Modalidad</th>
                        <th scope="col" className="px-4 py-2.5 text-right font-medium">Alumnos</th>
                        <th scope="col" className="px-4 py-2.5 text-right font-medium">Materias</th>
                        <th scope="col" className="px-4 py-2.5 text-right font-medium">Inscripciones</th>
                        <th scope="col" className="px-4 py-2.5 text-right font-medium">En riesgo</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">Pendientes de registro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibles.filter((g) => g.semestre === semestre).map((g) => (
                        <tr key={g.id} className="border-b border-border last:border-b-0">
                          <th scope="row" className="px-4 py-3 text-left font-semibold">
                            <Link to={j.to(`/jefe-carrera/grupos/${g.id}`)} className={`${linkClass} text-foreground`}>{g.nombre}</Link>
                          </th>
                          <td className="px-4 py-3 text-muted-foreground">{modalidadTexto(g.modalidad)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{g.alumnosBase}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{g.materias}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{g.inscripciones}</td>
                          <td className={`px-4 py-3 text-right tabular-nums ${g.alumnosRiesgo ? 'font-semibold text-warning-foreground' : 'text-muted-foreground'}`}>{g.alumnosRiesgo}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {g.listas || g.calificaciones
                              ? [g.listas && `${g.listas} ${g.listas === 1 ? 'lista' : 'listas'}`, g.calificaciones && `${g.calificaciones} ${g.calificaciones === 1 ? 'calificación' : 'calificaciones'}`].filter(Boolean).join(' · ')
                              : 'Sin pendientes detectados'}
                          </td>
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

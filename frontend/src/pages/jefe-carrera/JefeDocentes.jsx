import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { fechaHoraCorta } from './supervision/formato'
import { JefaturaPage, Segmento, Vacio, linkClass } from './supervision/ui'

function cobertura(d) {
  return d.clasesEsperadas ? `${d.cobertura} %` : 'No aplica'
}

export default function JefeDocentes() {
  const [params, setParams] = useSearchParams()
  const [busqueda, setBusqueda] = useState('')
  const filtro = params.get('filtro') === 'pendientes' ? 'pendientes' : ''

  return (
    <JefaturaPage titulo="Docentes" subtitulo="Carga académica y registro de cada docente dentro de esta carrera.">
      {({ j, resumen }) => {
        const ofertas = new Map(resumen.ofertas.map((o) => [o.id, o]))
        const q = busqueda.trim().toLocaleLowerCase()
        const filas = resumen.docentes
          .filter((d) => !q || d.nombre.toLocaleLowerCase().includes(q))
          .filter((d) => !filtro || d.listasPendientes || d.calificacionesPendientes || d.entregasPendientes)
          .sort((a, b) => a.nombre.localeCompare(b.nombre))

        return (
          <>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <label className="relative min-w-[220px] flex-1 sm:max-w-sm">
                <span className="sr-only">Buscar docente</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar docente" className="h-11 w-full rounded-[0.7rem] border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40" />
              </label>
              <Segmento label="Mostrar" value={filtro} onChange={(v) => { const n = new URLSearchParams(params); if (v) n.set('filtro', v); else n.delete('filtro'); setParams(n, { replace: true }) }} options={[{ value: '', label: 'Todos' }, { value: 'pendientes', label: 'Con pendientes' }]} />
            </div>
            <p className="mt-4 max-w-3xl text-xs text-muted-foreground">
              Aparecen quienes imparten clases de la carrera en el periodo. SICAT aún no registra la adscripción institucional, así que un docente compartido muestra aquí solo su trabajo en esta carrera. La cobertura es listas completas entre clases concluidas y elegibles del intervalo.
            </p>

            {!resumen.docentes.length ? (
              <Vacio titulo="Sin docentes asignados">Ninguna materia de la carrera tiene docente en este periodo.</Vacio>
            ) : !filas.length ? (
              <Vacio titulo={filtro ? 'Sin pendientes detectados' : 'Ningún docente coincide'} accion={<Button variant="outline" onClick={() => { setBusqueda(''); setParams(new URLSearchParams({ carrera: j.carreraId, periodo: j.periodo }), { replace: true }) }}>Restablecer filtros</Button>} />
            ) : (
              <div className="mt-5 overflow-x-auto rounded-[var(--radius-item)] border border-border bg-card">
                <table className="w-full min-w-[920px] border-collapse text-[0.8125rem]">
                  <thead>
                    <tr className="border-b border-border bg-background text-left text-xs text-muted-foreground">
                      <th scope="col" className="px-4 py-2.5 font-medium">Docente</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Materias y grupos</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">Horas / semana</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">Listas pendientes</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">Calif. pendientes</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">Cobertura</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Última captura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((d) => (
                      <tr key={d.id} className="border-b border-border align-top last:border-b-0">
                        <th scope="row" className="px-4 py-3 text-left font-medium">
                          <Link className={cn(linkClass, 'text-foreground')} to={j.to(`/jefe-carrera/docentes/${d.id}`)}>{d.nombre}</Link>
                          <span className="block text-xs font-normal text-muted-foreground">{d.pertenencia}</span>
                        </th>
                        <td className="px-4 py-3 text-muted-foreground">
                          {d.ofertas.map((id) => ofertas.get(id)).filter(Boolean).map((o) => <span key={o.id} className="block">{o.materia.nombre} · {o.grupo.nombre}</span>)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{d.horasSemanales}</td>
                        <td className={cn('px-4 py-3 text-right tabular-nums', d.listasPendientes ? 'font-semibold text-warning-foreground' : 'text-muted-foreground')}>{d.listasPendientes}</td>
                        <td className={cn('px-4 py-3 text-right tabular-nums', d.calificacionesPendientes ? 'font-semibold text-warning-foreground' : 'text-muted-foreground')}>{d.calificacionesPendientes}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {cobertura(d)}
                          {d.clasesEsperadas > 0 && <span className="block text-xs text-muted-foreground">{d.listasCompletas} de {d.clasesEsperadas}</span>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{fechaHoraCorta(d.ultimaCaptura)}</td>
                      </tr>
                    ))}
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

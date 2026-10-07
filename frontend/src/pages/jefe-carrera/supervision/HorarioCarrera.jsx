import { useMemo, useState, useSyncExternalStore } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import ClaseDetalle from './ClaseDetalle'
import { esIncidencia, estadoClase } from './estados'
import {
  claveFecha, diaCorto, diaSemana, esClaveValida, fechaLarga, hoyClave, lunesDe, minutos,
  modalidadTexto, plural, rangoTexto, semestreTexto, sumarDias,
} from './formato'
import { useClases } from './useClasesSemana'
import { Segmento, Vacio, linkClass, selectClass } from './ui'

const GRUPOS_POR_PAGINA = 10

const movilQuery = '(max-width: 767px)'
const suscribir = (cb) => { const m = window.matchMedia(movilQuery); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) }
const useMovil = () => useSyncExternalStore(suscribir, () => window.matchMedia(movilQuery).matches, () => false)

const pad = (n) => String(n).padStart(2, '0')

function ajustarFecha(fecha, modalidad) {
  const dia = diaSemana(fecha)
  if (modalidad === 'MIXTO') return sumarDias(lunesDe(fecha), 5)
  if (dia === 6) return sumarDias(fecha, 2)
  if (dia === 0) return sumarDias(fecha, 1)
  return fecha
}

/** Hoy si cae en el calendario de la modalidad; si no, su último día (histórico) o el primero. */
function fechaInicial(modalidad, calendarios) {
  const hoy = hoyClave()
  const cal = calendarios?.find((c) => c.modalidad === modalidad)
  if (!cal) return ajustarFecha(hoy, modalidad)
  const inicio = claveFecha(new Date(cal.inicio))
  const fin = claveFecha(new Date(cal.fin))
  if (hoy < inicio) return ajustarFecha(inicio, modalidad)
  if (hoy > fin) {
    const ultimo = ajustarFecha(fin, modalidad)
    return ultimo > fin ? sumarDias(ultimo, -7) : ultimo
  }
  return ajustarFecha(hoy, modalidad)
}

function useVista(resumen, fijo) {
  const [params, setParams] = useSearchParams()
  const set = (patch, { replace = true } = {}) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => { if (v === undefined || v === null || v === '') next.delete(k); else next.set(k, String(v)) })
    setParams(next, { replace })
  }
  const grupoFijo = fijo.grupoId ? resumen.grupos.find((g) => g.id === fijo.grupoId) : null
  const modalidades = [...new Set(resumen.grupos.map((g) => g.modalidad))]
  const pedida = params.get('modalidad')
  const modalidad = grupoFijo?.modalidad
    ?? (['ESCOLARIZADO', 'MIXTO'].includes(pedida) ? pedida : modalidades.includes('ESCOLARIZADO') || !modalidades.length ? 'ESCOLARIZADO' : 'MIXTO')
  const fechaParam = params.get('fecha')
  const fecha = esClaveValida(fechaParam) ? ajustarFecha(fechaParam, modalidad) : fechaInicial(modalidad, resumen.calendarios)
  return {
    set,
    vista: params.get('vista') === 'semana' ? 'semana' : 'dia',
    modalidad,
    fecha,
    semestre: params.get('semestre') ?? '',
    grupo: fijo.grupoId ? String(fijo.grupoId) : params.get('grupo') ?? '',
    docente: fijo.docenteId ? String(fijo.docenteId) : params.get('docente') ?? '',
    incidencias: params.get('incidencias') === '1',
    agenda: params.get('agenda'),
    claseId: params.get('clase'),
    hayFiltros: ['semestre', 'grupo', 'docente', 'incidencias'].some((k) => params.get(k)) || (pedida && pedida !== 'ESCOLARIZADO'),
  }
}

/**
 * Horario de la carrera. Día: filas por grupo y escala de horas, para comparar
 * clases simultáneas. Semana: filas por grupo y columnas por día. Los filtros
 * viven en la URL y responden sin animación.
 */
export default function HorarioCarrera({ j, resumen, fijo = {}, titulo = 'Horario de la carrera', descripcion = 'Compara grupos y abre una clase para consultar su registro.', headingId = 'horario-carrera' }) {
  const v = useVista(resumen, fijo)
  const movil = useMovil()
  const [limite, setLimite] = useState(GRUPOS_POR_PAGINA)
  const lunes = lunesDe(v.fecha)
  const { clases, error, cargando, reintentar } = useClases({
    carreraId: j.carreraId, periodo: j.periodo, desde: lunes, hasta: sumarDias(lunes, 5),
    grupoId: fijo.grupoId, docenteId: fijo.docenteId, prefetch: 1,
  })

  const dias = v.modalidad === 'MIXTO' ? [sumarDias(lunes, 5)] : [0, 1, 2, 3, 4].map((n) => sumarDias(lunes, n))
  const visibles = v.vista === 'dia' ? [v.fecha] : dias
  const calendario = resumen.calendarios?.find((c) => c.modalidad === v.modalidad)
  const fuera = calendario && (visibles.at(-1) < claveFecha(new Date(calendario.inicio)) || visibles[0] > claveFecha(new Date(calendario.fin)))

  const gruposModalidad = resumen.grupos.filter((g) => g.modalidad === v.modalidad)
  const semestres = [...new Set(gruposModalidad.map((g) => g.semestre))].sort((a, b) => a - b)
  const gruposOpciones = gruposModalidad.filter((g) => !v.semestre || String(g.semestre) === v.semestre)

  const filtradas = useMemo(() => (clases ?? []).filter((c) =>
    c.grupo.modalidad === v.modalidad &&
    (!v.semestre || String(c.grupo.semestre) === v.semestre) &&
    (!v.grupo || String(c.grupo.id) === v.grupo) &&
    (!v.docente || String(c.docente.id) === v.docente) &&
    (!v.incidencias || esIncidencia(c))), [clases, v.modalidad, v.semestre, v.grupo, v.docente, v.incidencias])
  const delPeriodo = filtradas.filter((c) => visibles.includes(c.fecha))

  // Con filtro de docente o de incidencias solo interesan los grupos con clases.
  const soloConClases = Boolean(v.docente || v.incidencias)
  const filas = (soloConClases
    ? [...new Map(delPeriodo.map((c) => [c.grupo.id, resumen.grupos.find((g) => g.id === c.grupo.id) ?? c.grupo])).values()]
    : gruposOpciones.filter((g) => !v.grupo || String(g.id) === v.grupo)
  ).sort((a, b) => a.semestre - b.semestre || a.nombre.localeCompare(b.nombre))
  const filasVisibles = filas.slice(0, limite)

  const verAgenda = v.agenda === '1' || (v.agenda !== '0' && movil)
  const claseAbierta = v.claseId ? (clases ?? []).find((c) => c.id === v.claseId) ?? null : null
  const abrir = (clase) => v.set({ clase: clase.id })

  const mover = (dir) => {
    if (v.vista === 'semana' || v.modalidad === 'MIXTO') return v.set({ fecha: sumarDias(v.fecha, 7 * dir), clase: null })
    let next = sumarDias(v.fecha, dir)
    while ([0, 6].includes(diaSemana(next))) next = sumarDias(next, dir)
    v.set({ fecha: next, clase: null })
  }
  const restablecer = () => v.set({ modalidad: null, semestre: null, grupo: fijo.grupoId ? undefined : null, docente: null, incidencias: null, clase: null })
  const hoy = hoyClave()

  return (
    <section aria-labelledby={headingId} className="mt-7">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={headingId} className="text-[1.1875rem] font-semibold tracking-[-0.015em] text-foreground">{titulo}</h2>
          {descripcion && <p className="mt-1 text-xs text-muted-foreground">{descripcion}</p>}
        </div>
        <Segmento label="Vista del horario" value={v.vista} onChange={(vista) => v.set({ vista: vista === 'dia' ? null : vista })} options={[{ value: 'dia', label: 'Día' }, { value: 'semana', label: 'Semana' }]} />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:flex lg:flex-wrap">
        {!fijo.grupoId && (
          <Filtro label="Modalidad" value={v.modalidad} onChange={(value) => v.set({ modalidad: value === 'ESCOLARIZADO' ? null : value, semestre: null, grupo: null, fecha: null, clase: null })}>
            <option value="ESCOLARIZADO">Escolarizado</option>
            <option value="MIXTO">Mixto (sábado)</option>
          </Filtro>
        )}
        {!fijo.grupoId && (
          <Filtro label="Semestre" value={v.semestre} onChange={(value) => v.set({ semestre: value, grupo: null })}>
            <option value="">Todos los semestres</option>
            {semestres.map((s) => <option key={s} value={s}>{semestreTexto(s)}</option>)}
          </Filtro>
        )}
        {!fijo.grupoId && (
          <Filtro label="Grupo" value={v.grupo} onChange={(value) => v.set({ grupo: value })}>
            <option value="">Todos los grupos</option>
            {gruposOpciones.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </Filtro>
        )}
        {!fijo.docenteId && (
          <Filtro label="Docente" value={v.docente} onChange={(value) => v.set({ docente: value })}>
            <option value="">Todos los docentes</option>
            {resumen.docentes.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </Filtro>
        )}
      </div>

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-card max-md:rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border px-3 py-3 sm:px-[18px] sm:py-[15px]">
          <div className="flex flex-wrap items-center gap-1 sm:gap-2">
            <Button variant="outline" size="icon-lg" className="size-11" onClick={() => mover(-1)} aria-label={v.vista === 'dia' ? 'Día anterior' : 'Semana anterior'}><ChevronLeft aria-hidden="true" /></Button>
            <Button variant="outline" size="icon-lg" className="size-11" onClick={() => mover(1)} aria-label={v.vista === 'dia' ? 'Día siguiente' : 'Semana siguiente'}><ChevronRight aria-hidden="true" /></Button>
            <Button variant="outline" className="min-h-11 px-3.5" onClick={() => v.set({ fecha: null, clase: null })}>Hoy</Button>
            <p aria-live="polite" className="ml-1 text-sm font-semibold text-foreground first-letter:uppercase max-sm:text-xs sm:min-w-[185px]">
              {v.vista === 'dia' ? fechaLarga(v.fecha) : rangoTexto(dias[0], dias.at(-1))}
            </p>
            {cargando && clases === null && <LoaderCircle className="size-4 animate-spin text-muted-foreground" aria-label="Consultando horario" />}
          </div>
          <div className="flex items-center gap-3 text-xs max-sm:w-full max-sm:justify-between">
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-foreground">
              <input type="checkbox" checked={v.incidencias} onChange={(e) => v.set({ incidencias: e.target.checked ? '1' : null })} className="size-[17px] accent-primary" />
              Solo incidencias
            </label>
            <Button variant="outline" className="min-h-11 px-3.5" onClick={() => v.set({ agenda: verAgenda ? '0' : '1' })}>
              {verAgenda ? 'Ver matriz' : 'Ver agenda'}
            </Button>
          </div>
        </div>

        {error && clases === null ? (
          <Vacio titulo="No se pudo consultar el horario" accion={<Button variant="outline" onClick={reintentar}>Reintentar</Button>}>{error}</Vacio>
        ) : clases === null ? (
          <div className="h-[340px] animate-pulse bg-muted/50" aria-hidden="true" />
        ) : !resumen.grupos.length ? (
          <Vacio titulo="Sin grupos en el periodo">No hay grupos activos de la carrera en este periodo.</Vacio>
        ) : !gruposModalidad.length ? (
          <Vacio titulo={`Sin grupos de ${modalidadTexto(v.modalidad)}`} accion={<Button variant="outline" onClick={restablecer}>Restablecer filtros</Button>}>
            La carrera no tiene grupos de esta modalidad en el periodo.
          </Vacio>
        ) : fuera ? (
          <Vacio titulo="Fuera del calendario escolar" accion={<Button variant="outline" onClick={() => v.set({ fecha: null })}>Ir a la fecha actual</Button>}>
            El calendario de {modalidadTexto(v.modalidad)} va del {fechaLarga(claveFecha(new Date(calendario.inicio)))} al {fechaLarga(claveFecha(new Date(calendario.fin)))}.
          </Vacio>
        ) : !(clases ?? []).some((c) => c.grupo.modalidad === v.modalidad) && !fijo.docenteId && !fijo.grupoId && !v.hayFiltros ? (
          <Vacio titulo="Sin horarios publicados">No hay bloques de horario activos para {modalidadTexto(v.modalidad)} en esta semana.</Vacio>
        ) : !filas.length || (soloConClases && !delPeriodo.length) ? (
          <Vacio titulo={v.incidencias ? 'Sin incidencias detectadas' : 'Ningún resultado con estos filtros'} accion={v.hayFiltros && <Button variant="outline" onClick={restablecer}>Restablecer filtros</Button>}>
            {v.incidencias ? 'No hay listas pendientes, registros tardíos ni conflictos en lo que estás viendo.' : 'Prueba con otro grupo, docente o fecha.'}
          </Vacio>
        ) : verAgenda ? (
          <Agenda dias={visibles} clases={delPeriodo} abrir={abrir} fijo={fijo} />
        ) : v.vista === 'dia' ? (
          <TableroDia grupos={filasVisibles} clases={delPeriodo} semana={filtradas} abrir={abrir} j={j} fijo={fijo} />
        ) : (
          <TablaSemana grupos={filasVisibles} dias={dias} clases={delPeriodo} hoy={hoy} abrir={abrir} j={j} fijo={fijo} />
        )}

        {filas.length > limite && !verAgenda && (
          <div className="border-t border-border px-[18px] py-3">
            <Button variant="ghost" onClick={() => setLimite((n) => n + GRUPOS_POR_PAGINA)}>
              Mostrar {Math.min(GRUPOS_POR_PAGINA, filas.length - limite)} grupos más de {filas.length}
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border px-3 py-3 text-xs text-muted-foreground sm:px-[18px]">
          <Leyenda tono="bg-success-foreground" label="Lista completa" />
          <Leyenda tono="bg-primary-ink" label="Registro en curso" />
          <Leyenda tono="bg-warning-foreground" label="Captura pendiente o tardía" />
          <Leyenda tono="bg-muted-foreground" label="Programada / suspendida" />
        </div>
        <p className="px-3 pb-3.5 text-xs text-muted-foreground sm:px-[18px]">El registro en SICAT es evidencia de captura; no confirma presencia física del docente.</p>
      </div>
      {clases !== null && (
        <p className="mt-2.5 text-xs text-muted-foreground">
          {plural(delPeriodo.length, 'clase', 'clases')} · {plural(filas.length, 'grupo', 'grupos')} · {modalidadTexto(v.modalidad)}
        </p>
      )}

      <ClaseDetalle clase={claseAbierta} clases={clases ?? []} j={j} onClose={() => v.set({ clase: null })} />
    </section>
  )
}

function Filtro({ label, value, onChange, children }) {
  return (
    <label className="grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground lg:min-w-[150px] lg:flex-1">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>{children}</select>
    </label>
  )
}

function Leyenda({ tono, label }) {
  return <span className="flex items-center gap-1.5"><i aria-hidden="true" className={cn('size-2 rounded-full', tono)} />{label}</span>
}

function BloqueClase({ clase, abrir, fijo, style, className }) {
  const estado = estadoClase(clase.estado)
  return (
    <button
      type="button"
      onClick={() => abrir(clase)}
      style={style}
      aria-label={`${clase.horaInicio} a ${clase.horaFin}, ${clase.materia.nombre}, grupo ${clase.grupo.nombre}, ${clase.docente.nombre}. ${estado.label}${clase.conflictos?.length ? '. Con conflicto de horario' : ''}`}
      className={cn(
        'relative z-[1] flex min-h-[105px] flex-col gap-[3px] overflow-hidden rounded-[11px] border p-2.5 text-left text-xs leading-[1.35] transition-[transform,border-color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.98] motion-reduce:active:scale-100 [@media(hover:hover)_and_(pointer:fine)]:hover:border-primary-ink',
        estado.bloque, className,
      )}
    >
      <span className="tabular-nums text-foreground">{clase.horaInicio}–{clase.horaFin}</span>
      <strong className="font-semibold text-foreground">{clase.materia.nombre}</strong>
      {!fijo.docenteId && <span className="text-muted-foreground">{clase.docente.nombre}</span>}
      {fijo.docenteId && <span className="text-muted-foreground">{clase.grupo.nombre}</span>}
      <span className="text-muted-foreground">{clase.aula?.nombre ?? 'Sin aula'}</span>
      {clase.conflictos?.length > 0 && <span className="font-medium text-destructive-foreground">Conflicto: {[...new Set(clase.conflictos)].join(', ').toLowerCase()}</span>}
      <span className={cn('mt-auto pt-[7px] font-medium', estado.texto)}>{estado.label}</span>
    </button>
  )
}

function EtiquetaGrupo({ grupo, j, fijo }) {
  return (
    <div className="flex flex-col gap-1 bg-background px-4 py-6 text-sm">
      {fijo.grupoId ? <strong className="font-semibold text-foreground">{grupo.nombre}</strong>
        : <Link to={j.to(`/jefe-carrera/grupos/${grupo.id}`)} className={cn(linkClass, 'font-semibold text-foreground')}>{grupo.nombre}</Link>}
      <small className="text-xs text-muted-foreground">{semestreTexto(grupo.semestre)}</small>
      {grupo.alumnosBase != null && <small className="text-xs text-muted-foreground">{plural(grupo.alumnosBase, 'alumno', 'alumnos')}</small>}
    </div>
  )
}

function TableroDia({ grupos, clases, semana, abrir, j, fijo }) {
  // Escala estable para toda la semana: cambiar de día no mueve las columnas.
  const base = semana.length ? semana : clases
  const desde = Math.min(7, ...base.map((c) => Math.floor(minutos(c.horaInicio) / 60)))
  const hasta = Math.max(desde + 8, ...base.map((c) => Math.ceil(minutos(c.horaFin) / 60)))
  const horas = Array.from({ length: hasta - desde }, (_, i) => desde + i)
  const columnas = (hasta - desde) * 12
  const col = (hora) => Math.min(columnas + 1, Math.max(1, Math.round((minutos(hora) - desde * 60) / 5) + 1))

  return (
    <div role="region" aria-label="Horario del día por grupo y hora" tabIndex={0} className="overflow-auto focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/40 [scrollbar-color:var(--border)_var(--card)] [scrollbar-width:thin]">
      <div className="min-w-[1000px]">
        <div className="grid h-[42px] grid-cols-[133px_minmax(0,1fr)] border-b border-border bg-background">
          <div className="px-4 py-3 text-xs font-medium text-muted-foreground">Grupo / hora</div>
          <div className="grid" style={{ gridTemplateColumns: `repeat(${horas.length}, minmax(0, 1fr))` }}>
            {horas.map((h) => <span key={h} className="border-l border-border pl-[7px] pt-3 text-xs tabular-nums text-muted-foreground">{pad(h)}:00</span>)}
          </div>
        </div>
        {grupos.map((grupo) => {
          const propias = clases.filter((c) => c.grupo.id === grupo.id).sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
          return (
            <div key={grupo.id} className="grid min-h-[132px] grid-cols-[133px_minmax(0,1fr)] border-b border-border last:border-b-0">
              <EtiquetaGrupo grupo={grupo} j={j} fijo={fijo} />
              <div className="relative grid py-2" style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))`, gridAutoFlow: 'row dense', gridAutoRows: 'minmax(116px, auto)' }}>
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${horas.length}, minmax(0, 1fr))` }}>
                  {horas.map((h) => <span key={h} className="border-l border-border" />)}
                </div>
                {propias.length ? propias.map((c) => (
                  <BloqueClase key={c.id} clase={c} abrir={abrir} fijo={fijo} className="mx-1" style={{ gridColumn: `${col(c.horaInicio)} / ${Math.max(col(c.horaFin), col(c.horaInicio) + 1)}` }} />
                )) : (
                  <p className="relative self-center px-4 text-xs text-muted-foreground" style={{ gridColumn: '1 / -1' }}>Sin clases este día</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TablaSemana({ grupos, dias, clases, hoy, abrir, j, fijo }) {
  return (
    <div role="region" aria-label="Horario semanal por grupo y día" tabIndex={0} className="overflow-auto focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/40 [scrollbar-width:thin]">
      <table className={cn('w-full table-fixed border-collapse', dias.length > 1 ? 'min-w-[1000px]' : 'min-w-[420px]')}>
        <thead>
          <tr>
            <th scope="col" className="w-[110px] border-b border-border bg-background p-3 text-left text-xs font-medium text-foreground">Grupo</th>
            {dias.map((dia) => (
              <th key={dia} scope="col" aria-current={dia === hoy ? 'date' : undefined} className={cn('border-b border-border p-3 text-left text-xs font-medium capitalize', dia === hoy ? 'bg-accent text-primary-ink' : 'bg-background text-foreground')}>
                {diaCorto(dia)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grupos.map((grupo) => (
            <tr key={grupo.id} className="[&:last-child>*]:border-b-0">
              <th scope="row" className="border-b border-r border-border p-0 text-left align-middle font-normal">
                <EtiquetaGrupo grupo={grupo} j={j} fijo={fijo} />
              </th>
              {dias.map((dia) => {
                const propias = clases.filter((c) => c.grupo.id === grupo.id && c.fecha === dia).sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
                return (
                  <td key={dia} className="border-b border-r border-border p-2 align-top last:border-r-0">
                    {propias.length
                      ? <div className="grid gap-[7px]">{propias.map((c) => <BloqueClase key={c.id} clase={c} abrir={abrir} fijo={fijo} className="min-h-[118px] w-full" />)}</div>
                      : <p className="p-3 text-xs text-muted-foreground">Sin clases</p>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Agenda({ dias, clases, abrir, fijo }) {
  return (
    <div className="px-3.5 pb-2.5 sm:px-[18px]">
      {dias.map((dia) => {
        const propias = clases.filter((c) => c.fecha === dia).sort((a, b) => a.horaInicio.localeCompare(b.horaInicio) || a.grupo.nombre.localeCompare(b.grupo.nombre))
        return (
          <section key={dia} aria-label={fechaLarga(dia)}>
            <h3 className="mb-2.5 mt-[18px] text-[0.8125rem] font-semibold text-foreground first-letter:uppercase">{fechaLarga(dia)}</h3>
            {propias.length ? (
              <ul>
                {propias.map((c) => {
                  const estado = estadoClase(c.estado)
                  return (
                    <li key={c.id}>
                      <button type="button" onClick={() => abrir(c)} className="grid w-full grid-cols-[65px_1fr] items-center gap-x-2.5 gap-y-1 border-b border-border py-3.5 text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/40 sm:grid-cols-[100px_1fr_auto] sm:gap-4 sm:py-4 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-background">
                        <span className="row-span-2 text-xs tabular-nums text-foreground sm:row-span-1 sm:text-sm">{c.horaInicio}<br />{c.horaFin}</span>
                        <span className="min-w-0">
                          <strong className="block text-[0.8125rem] font-semibold text-foreground sm:text-sm">{c.materia.nombre}</strong>
                          <small className="mt-1 block text-xs text-muted-foreground">
                            {[fijo.grupoId ? null : c.grupo.nombre, fijo.docenteId ? null : c.docente.nombre, c.aula?.nombre].filter(Boolean).join(' · ')}
                          </small>
                          {c.conflictos?.length > 0 && <small className="mt-1 block text-xs font-medium text-destructive-foreground">Conflicto de horario</small>}
                        </span>
                        <span className={cn('text-xs font-medium max-sm:col-start-2', estado.texto)}>{estado.label}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : <p className="pb-3 text-xs text-muted-foreground">Sin clases</p>}
          </section>
        )
      })}
    </div>
  )
}


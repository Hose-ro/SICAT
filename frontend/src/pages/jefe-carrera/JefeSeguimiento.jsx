import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpenCheck, ChevronDown, ChevronUp, UsersRound } from 'lucide-react'
import api from '@/api/axios'
import PageHeader from '@/components/PageHeader'
import { CarreraSelector, PageState } from '@/components/jefe-carrera/JefeCarreraUI'
import { useJefeCarreraStore } from '@/store/jefeCarreraStore'

export default function JefeSeguimiento() {
  const carreraId = useJefeCarreraStore((state) => state.carreraId)
  const [tab, setTab] = useState('materias')
  const [materias, setMaterias] = useState([])
  const [grupos, setGrupos] = useState([])
  const [openId, setOpenId] = useState(null)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [materiasResponse, gruposResponse] = await Promise.all([
        api.get('/jefe-carrera/materias', { params: carreraId ? { carreraId } : {} }),
        api.get('/jefe-carrera/grupos', { params: carreraId ? { carreraId } : {} }),
      ])
      setMaterias(materiasResponse.data)
      setGrupos(gruposResponse.data)
      setError('')
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'No se pudo cargar el seguimiento')
    } finally {
      setLoading(false)
    }
  }, [carreraId])

  useEffect(() => { cargar() }, [cargar])

  const items = tab === 'materias' ? materias : grupos
  const filtrados = useMemo(() => {
    const term = q.trim().toLocaleLowerCase('es-MX')
    if (!term) return items
    return items.filter((item) => [item.nombre, item.clave, item.carrera?.nombre]
      .filter(Boolean).some((value) => value.toLocaleLowerCase('es-MX').includes(term)))
  }, [items, q])

  return (
    <div className="space-y-5">
      <PageHeader title="Seguimiento académico" subtitle="Materias, unidades, grupos y alumnos" action={<CarreraSelector />} />
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div role="tablist" aria-label="Seguimiento académico" className="inline-flex w-fit rounded-xl bg-muted p-1">
          <Tab active={tab === 'materias'} onClick={() => { setTab('materias'); setOpenId(null) }}>Materias</Tab>
          <Tab active={tab === 'grupos'} onClick={() => { setTab('grupos'); setOpenId(null) }}>Grupos</Tab>
        </div>
        <label className="space-y-1"><span className="text-xs font-medium text-muted-foreground">Buscar</span><input value={q} onChange={(event) => setQ(event.target.value)} placeholder={tab === 'materias' ? 'Materia o clave' : 'Grupo o carrera'} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40 sm:w-64" /></label>
      </div>
      <PageState loading={loading} error={error} empty={!filtrados.length} emptyText={`No hay ${tab} para mostrar.`} />
      {!loading && !error && filtrados.length > 0 && <div className="space-y-3">{filtrados.map((item) => tab === 'materias' ? <MateriaRow key={item.id} materia={item} open={openId === item.id} toggle={() => setOpenId(openId === item.id ? null : item.id)} /> : <GrupoRow key={item.id} grupo={item} open={openId === item.id} toggle={() => setOpenId(openId === item.id ? null : item.id)} />)}</div>}
    </div>
  )
}

function MateriaRow({ materia, open, toggle }) {
  const activa = materia.unidades.find((unidad) => unidad.status === 'ACTIVA')
  return <article className="overflow-hidden rounded-2xl border border-border bg-card"><button type="button" onClick={toggle} aria-expanded={open} className="grid w-full gap-3 p-4 text-left sm:grid-cols-[1fr_auto_auto] sm:items-center"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground"><BookOpenCheck className="h-5 w-5" /></span><div className="min-w-0"><h2 className="truncate font-medium text-foreground">{materia.clave} · {materia.nombre}</h2><p className="truncate text-xs text-muted-foreground">{materia.carrera?.nombre} · Semestre {materia.semestre ?? 'sin asignar'}</p></div></div><div className="text-sm text-muted-foreground">{materia.docente?.nombre ?? 'Sin docente'}</div><span className="flex items-center justify-end gap-2 text-sm text-muted-foreground">{activa?.nombre ?? 'Sin unidad activa'} {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span></button>{open && <div className="border-t border-border bg-muted/35 px-4 py-4"><div className="grid gap-4 sm:grid-cols-3"><Info label="Sesiones" value={materia._count.claseSesiones} /><Info label="Inscripciones" value={materia._count.inscripciones} /><Info label="Horarios" value={materia.horarios.length} /></div><div className="mt-4 flex flex-wrap gap-2">{materia.unidades.map((unidad) => <span key={unidad.id} className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground">{unidad.orden}. {unidad.nombre}: {unidad.status}</span>)}</div></div>}</article>
}

function GrupoRow({ grupo, open, toggle }) {
  return <article className="overflow-hidden rounded-2xl border border-border bg-card"><button type="button" onClick={toggle} aria-expanded={open} className="grid w-full gap-3 p-4 text-left sm:grid-cols-[1fr_auto_auto] sm:items-center"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground"><UsersRound className="h-5 w-5" /></span><div><h2 className="font-medium text-foreground">{grupo.nombre}</h2><p className="text-xs text-muted-foreground">{grupo.carrera.nombre} · {grupo.periodo}</p></div></div><span className="text-sm text-muted-foreground">{grupo.alumnos.length} alumnos</span><span className="flex items-center justify-end gap-2 text-sm text-muted-foreground">{grupo.horarios.length} horarios {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span></button>{open && <div className="border-t border-border bg-muted/35 p-4"><div className="grid gap-5 lg:grid-cols-2"><div><h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Horario</h3><div className="space-y-2">{grupo.horarios.map((horario) => <p key={horario.id} className="text-sm text-foreground">{horario.materia.nombre} <span className="text-muted-foreground">· {horario.dias} {horario.horaInicio}-{horario.horaFin}</span></p>)}</div></div><div><h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Alumnos</h3><div className="max-h-48 space-y-2 overflow-y-auto">{grupo.alumnos.map((alumno) => <p key={alumno.id} className="text-sm text-foreground">{alumno.nombre} <span className="text-muted-foreground">· {alumno.numeroControl ?? 'Sin control'}</span></p>)}</div></div></div></div>}</article>
}

function Info({ label, value }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold text-foreground">{value}</p></div> }
function Tab({ active, onClick, children }) { return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`rounded-lg px-4 py-2 text-sm font-medium transition ${active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{children}</button> }

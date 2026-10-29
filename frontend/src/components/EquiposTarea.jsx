import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '@/api/axios'
import { Button } from '@/components/ui/button'
import TaskNotice from '@/components/TaskNotice'
import { useAuthStore } from '@/store/authStore'

export default function EquiposTarea({ tareaId, rol = 'ALUMNO', onChange }) {
  const usuarioId = useAuthStore((state) => state.user?.id)
  const [data, setData] = useState(null)
  const [nombre, setNombre] = useState('')
  const [seleccion, setSeleccion] = useState([])
  const [editando, setEditando] = useState(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const cargar = useCallback(() => api.get(`/tareas/${tareaId}/equipos`).then((res) => { setData(res.data); setError('') }).catch((err) => setError(err.response?.data?.message || 'No se pudieron cargar los equipos.')), [tareaId])
  useEffect(() => { cargar() }, [cargar])
  const ocupados = useMemo(() => new Set((data?.equipos || []).flatMap((e) => e.integrantes.map((m) => m.alumnoId))), [data])
  if (!data?.esGrupal && !error) return null
  const puedeCrear = rol !== 'ALUMNO' || data?.equiposEditablesPorAlumnos
  const guardar = async () => {
    if (!nombre.trim() || seleccion.length < 2) return setError('Escribe un nombre y selecciona al menos dos integrantes.')
    setGuardando(true)
    try { await api.post(`/tareas/${tareaId}/equipos`, { equipoId: editando || undefined, nombre, integranteIds: seleccion }); setNombre(''); setSeleccion([]); setEditando(null); await cargar(); onChange?.() }
    catch (err) { setError(err.response?.data?.message || 'No se pudo guardar el equipo.') }
    finally { setGuardando(false) }
  }
  return <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
    <h2 className="text-lg font-semibold text-foreground">Equipos · {data?.tipoTrabajo || 'Trabajo en equipo'}</h2>
    <p className="mt-1 text-sm text-muted-foreground">Cuando un integrante entregue, la entrega aparecerá para todo su equipo.</p>
    <TaskNotice error={error} />
    <div className="mt-4 grid gap-3 md:grid-cols-2">{data?.equipos?.map((equipo) => <article key={equipo.id} className="rounded-2xl border border-border bg-muted/30 p-4"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-foreground">{equipo.nombre}</p>{(rol !== 'ALUMNO' || (data.equiposEditablesPorAlumnos && equipo.creadoPorId === usuarioId)) && <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => { setEditando(equipo.id); setNombre(equipo.nombre); setSeleccion(equipo.integrantes.map((m) => m.alumnoId)) }}>Editar</Button>}</div><ul className="mt-2 space-y-1 text-sm text-muted-foreground">{equipo.integrantes.map((m) => <li key={m.alumnoId}>{m.alumno.nombre}{m.alumno.numeroControl ? ` · ${m.alumno.numeroControl}` : ''}</li>)}</ul></article>)}</div>
    {puedeCrear && <div className="mt-5 rounded-2xl border border-dashed border-border p-4">
      <label className="text-sm font-semibold text-foreground">{editando ? 'Editar equipo' : 'Nuevo equipo'}<input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Equipo 1" className="mt-2 block w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" /></label>
      <div className="mt-3 grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">{data?.alumnos?.map((alumno) => { const delActual = editando && data.equipos.find((e) => e.id === editando)?.integrantes.some((m) => m.alumnoId === alumno.id); const ocupado = ocupados.has(alumno.id) && !delActual; return <label key={alumno.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${ocupado ? 'opacity-50' : ''}`}><input type="checkbox" disabled={ocupado} checked={seleccion.includes(alumno.id)} onChange={() => setSeleccion((s) => s.includes(alumno.id) ? s.filter((id) => id !== alumno.id) : [...s, alumno.id])} />{alumno.nombre}</label> })}</div>
      <div className="mt-4 flex gap-2"><Button onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear equipo'}</Button>{editando && <Button variant="outline" onClick={() => { setEditando(null); setNombre(''); setSeleccion([]) }}>Cancelar</Button>}</div>
    </div>}
  </section>
}

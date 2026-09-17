import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import '../src/index.css'
import { Button } from '../src/components/ui/button'
import Modal from '../src/components/Modal'
import FeedbackDialogs from '../src/components/FeedbackDialogs'
import { confirmAction } from '../src/lib/feedback'
import useAsyncAction from '../src/hooks/useAsyncAction'
import HorarioForm from '../src/pages/admin/horarios/components/HorarioForm'
import { useHorarioStore } from '../src/store/horarioStore'
import { Moon } from 'lucide-react'

const docente={id:2,nombre:'Docente de prueba',rol:'DOCENTE',activo:true}
const grupo={id:1,nombre:'101A',semestre:1,periodo:'2026-B'}
const materia={id:1,nombre:'Matemáticas',clave:'MAT-1',semestre:1}
useHorarioStore.setState({docenteSeleccionado:docente,docentesCatalogo:[docente],grupos:[grupo],materiasCatalogo:[materia],aulasCatalogo:[{id:1,nombre:'Aula 1'}]})

export default function Fixture(){
 const[open,setOpen]=useState(false),[count,setCount]=useState(0),[dark,setDark]=useState(false)
 const action=useAsyncAction(async()=>{if(await confirmAction({title:'Finalizar clase',description:'Los alumnos sin captura quedarán como falta.',confirmLabel:'Finalizar clase'}))setCount(n=>n+1)})
 return <main className="space-y-5 p-5"><h1 className="text-xl">Verificación de SICAT</h1>
 <Button onClick={()=>{document.documentElement.classList.toggle('dark');setDark(!dark)}}>Cambiar tema</Button>
 <Button onClick={()=>setOpen(true)}>Abrir formulario</Button><Button onClick={action}>Cerrar clase</Button><output aria-label="Acciones realizadas">{count}</output>
 <Modal open={open} onClose={()=>setOpen(false)} title="Formulario de prueba"><label>Nombre<input className="m-2 border border-border p-2" /></label><Button onClick={action}>Cerrar clase anidada</Button><Button variant="outline" onClick={()=>setOpen(false)}>Terminar</Button></Modal>
 <FeedbackDialogs />
 <div data-palette className="grid gap-2 bg-card p-4">
 {['background','card','muted','accent'].flatMap(bg=>['foreground','muted-foreground','primary-ink'].map(fg=><p key={bg+fg} data-sample={`${bg}/${fg}`} style={{backgroundColor:`var(--${bg})`,color:`var(--${fg})`}}>Texto institucional de 14 px</p>))}
 {['primary','success','warning','destructive'].flatMap(status=>[0,10,15,20].map(tint=><p key={status+tint} data-sample={`${status}/${tint||'fill'}`} style={{backgroundColor:tint?`color-mix(in oklab, var(--${status}) ${tint}%, transparent)`:`var(--${status})`,color:`var(--${status==='primary'?(tint?'primary-ink':'primary-foreground'):status+(tint?'-foreground':'-on-fill')})`}}>Estado institucional de 14 px</p>))}
 <Button data-sample="primary/button">Guardar</Button><Button data-sample="destructive/button" variant="destructive">Eliminar</Button><Button size="icon-xs" variant="ghost" aria-label="Icono de muestra"><Moon /></Button>
 </div>
 <section><h2>Horario de prueba</h2><HorarioForm modo="docente" preset={{dia:'Lunes',horaInicio:'08:00',horaFin:'09:00'}} /></section>
 </main>
}
createRoot(document.getElementById('root')).render(<Fixture />)

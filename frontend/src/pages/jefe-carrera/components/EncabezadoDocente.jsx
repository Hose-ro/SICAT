import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Copy, FileChartColumn, Mail, MessagesSquare, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/buttonVariants'
import { BotonSeguimiento } from '../supervision/Seguimiento'
import './perfil-docente.css'

export default function EncabezadoDocente({ docente, j }) {
  const [copiado, setCopiado] = useState(false)
  const [copiaManual, setCopiaManual] = useState(false)
  const manual = useRef(null)
  const iniciales = docente.nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('')
  const alias = docente.alias?.trim()
  const telefono = docente.telefono?.replace(/[^\d+]/g, '')
  const contacto = [docente.nombre, docente.email, docente.telefono].filter(Boolean).join(' · ')
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(contacto)
      setCopiado(true); setCopiaManual(false)
    } catch { setCopiaManual(true) }
  }

  return (
    <header className="docente-perfil" aria-labelledby="docente-perfil-nombre">
      <div className="docente-perfil-identidad">
        <span className="docente-perfil-avatar" aria-hidden="true">{iniciales}</span>
        <div className="min-w-0">
          {alias && <p className="docente-perfil-alias">{alias}</p>}
          <h1 id="docente-perfil-nombre">{docente.nombre}</h1>
          <p className="docente-perfil-pertenencia">{docente.pertenencia}</p>
        </div>
      </div>
      <div className="docente-perfil-contacto" aria-label="Datos de contacto">
        {docente.email && <a href={`mailto:${docente.email}`} aria-label={`Preparar correo para ${docente.nombre}`}><Mail aria-hidden="true" />{docente.email}</a>}
        {telefono && <a href={`tel:${telefono}`} aria-label={`Llamar a ${docente.nombre}`}><Phone aria-hidden="true" />{docente.telefono}</a>}
        {!docente.email && !telefono && <p className="text-xs text-muted-foreground">Sin contacto registrado</p>}
        {(docente.email || telefono) && <Button variant="ghost" size="sm" className="docente-perfil-copiar" onClick={copiar}><Copy aria-hidden="true" /><span role="status">{copiado ? 'Contacto copiado' : 'Copiar contacto'}</span></Button>}
      </div>
      {copiaManual && <label className="docente-perfil-copia-manual">Selecciona y copia el contacto<input ref={manual} readOnly value={contacto} onFocus={() => manual.current?.select()} /></label>}
      <div className="docente-perfil-acciones">
        <BotonSeguimiento j={j} caso={{ tipo: 'SEGUIMIENTO_DOCENTE', docenteId: docente.id }} titulo={`Observación con ${docente.nombre}`} contexto="Acuerdos y revisiones con el docente. Cada nota queda con tu nombre y la fecha." size="default" className="docente-perfil-observar" />
        <Link className={`${buttonVariants({ variant: 'outline' })} docente-perfil-reporte`} to={`/reportes/parcial-semestre?carreraId=${j.carreraId}&docenteId=${docente.id}`}><FileChartColumn aria-hidden="true" />Ver reporte parcial<ArrowUpRight aria-hidden="true" /></Link>
        <span className="docente-perfil-seguimiento"><MessagesSquare aria-hidden="true" />Seguimiento del docente</span>
      </div>
    </header>
  )
}

import { Button } from '@/components/ui/button'
import Modal from '@/components/Modal'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PeriodoEscolarCard from '../../components/PeriodoEscolarCard'
import { CalendarClock, Download } from 'lucide-react'
import api from '../../api/axios'
import HorarioSemanal from '../../components/horario/HorarioSemanal'
import CalendarioClases from '../../components/CalendarioClases'
import { horasSemanales as calcularHorasSemanales } from '../../lib/horarioColors'
import { generarHorarioPdf } from '../../lib/generarHorarioPdf'

export default function MiHorario() {
  const [docente, setDocente] = useState(null)
  const [horarios, setHorarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detalle, setDetalle] = useState(null)

  useEffect(() => {
    let cancelled = false
    api
      .get('/horarios/mis-horarios')
      .then((res) => {
        if (cancelled) return
        setDocente(res.data.docente ?? null)
        setHorarios(res.data.horarios ?? [])
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.response?.data?.message ?? 'Error al cargar tu horario')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const horasSemanales = calcularHorasSemanales(horarios)

  return (
    <div className="flex h-full flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6 print:gap-2 print:px-0 print:py-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary-ink">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">Mi Horario</h1>
            <p className="text-sm text-muted-foreground">
              {loading
                ? 'Cargando...'
                : error
                  ? ' '
                  : `${horarios.length} clase${horarios.length !== 1 ? 's' : ''} · ${horasSemanales}h semanales`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/docente/horario/editar"
            className="print-hidden inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-[color,background-color,border-color,opacity,transform] duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            Editar mi horario
          </Link>

        {!loading && !error && horarios.length > 0 && (
          <Button variant="outline"
            type="button"
            onClick={() =>
              generarHorarioPdf({
                nombreArchivo: `Horario - ${docente?.nombre ?? 'Docente'}`,
                titulo: 'Mi Horario',
                subtitulo: `${docente?.nombre ?? ''} · ${horarios.length} clase${horarios.length !== 1 ? 's' : ''} · ${horasSemanales}h semanales`,
                horarios,
              })
            }
            className="print-hidden inline-flex items-center gap-2 border px-4 py-2 text-sm font-medium shadow-sm duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            <Download className="h-4 w-4" />
            Descargar PDF
          </Button>
        )}
        </div>
      </div>

      <div className="print-hidden">
        <PeriodoEscolarCard editable />
      </div>

      {!loading && !error && <CalendarioClases horarios={horarios} />}

      {error && (
        <div className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
          {error}
        </div>
      )}

      {!loading && !error && horarios.length === 0 && (
        <div className="flex h-48 items-center justify-center rounded-2xl border border-border bg-card text-sm text-muted-foreground">
          Aún no tienes materias asignadas en el horario.
        </div>
      )}

      {!loading && horarios.length > 0 && <HorarioSemanal horarios={horarios} onSelect={setDetalle} />}

      {detalle && (
        <Modal open onClose={() => setDetalle(null)} title={detalle.materia.nombre}><p className="text-sm text-muted-foreground">{detalle.materia.clave}</p>
            

            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Grupo:</span>{' '}
                {detalle.grupo?.nombre ?? 'Sin grupo asignado'}
              </p>
              <p>
                <span className="font-medium text-foreground">Aula:</span>{' '}
                {detalle.aula?.nombre ?? 'Sin aula asignada'}
              </p>
              <p>
                <span className="font-medium text-foreground">Días:</span> {detalle.dias}
              </p>
              <p>
                <span className="font-medium text-foreground">Horario:</span> {detalle.horaInicio} –{' '}
                {detalle.horaFin}
              </p>
              {detalle.materia.carrera && (
                <p>
                  <span className="font-medium text-foreground">Carrera:</span> {detalle.materia.carrera.nombre}
                </p>
              )}
              {detalle.semestre && (
                <p>
                  <span className="font-medium text-foreground">Semestre:</span> {detalle.semestre}
                </p>
              )}
            </div>
          </Modal>
      )}
    </div>
  )
}

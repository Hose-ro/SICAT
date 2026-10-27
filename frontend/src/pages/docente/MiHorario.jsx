import { Button } from '@/components/ui/button'
import Modal from '@/components/Modal'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PeriodoEscolarCard from '../../components/PeriodoEscolarCard'
import { Download } from 'lucide-react'
import { buttonVariants } from '@/components/ui/buttonVariants'
import { cn } from '@/lib/utils'
import api from '../../api/axios'
import HorarioSemanal from '../../components/horario/HorarioSemanal'
import SuscripcionCalendario from '../../components/horario/SuscripcionCalendario'
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
    <div className="flex h-full flex-col gap-4 print:gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div>
            <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-foreground">Mi horario</h1>
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
            className={cn(buttonVariants({ variant: 'outline' }), 'print-hidden px-4')}
          >
            Editar mi horario
          </Link>

          <SuscripcionCalendario />

        {!loading && !error && horarios.length > 0 && (
          <Button variant="outline"
            type="button"
            onClick={() =>
              generarHorarioPdf({
                nombreArchivo: `Horario - ${docente?.nombre ?? 'Docente'}`,
                titulo: 'Horario de clases',
                subtitulo: `${docente?.nombre ?? ''} · ${horarios.length} clase${horarios.length !== 1 ? 's' : ''} · ${horasSemanales}h semanales`,
                horarios,
              })
            }
            className="print-hidden gap-2 px-4"
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
            <Link
              to={`/materias/${detalle.materiaId ?? detalle.materia.id}${detalle.grupo?.id ? `?grupo=${detalle.grupo.id}` : ''}`}
              className={cn(buttonVariants({ variant: 'outline' }), 'mt-4 px-4')}
            >
              Abrir la materia
            </Link>
          </Modal>
      )}
    </div>
  )
}

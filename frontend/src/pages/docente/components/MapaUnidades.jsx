import { useEffect, useMemo, useState } from 'react'
import TaskNotice from '@/components/TaskNotice'
import { Skeleton } from '@/components/ui/skeleton'
import MapaRiesgo, { LeyendaRiesgo } from '@/components/graficas/MapaRiesgo'
import { matrizUnidades } from '@/components/graficas/riesgo'
import api from '@/api/axios'

const ESTADO_UNIDAD = { ACTIVA: 'en curso', FINALIZADA: 'cerrada' }
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

/**
 * Todas las unidades de una clase a la vez: quién viene mal desde el inicio,
 * quién bajó y quién se recuperó. Cada celda abre esa unidad en la lista.
 */
export default function MapaUnidades({ clase, ocultas, onElegirUnidad }) {
  const pedido = `${clase.materiaId}:${clase.grupo.id}`
  const [version, setVersion] = useState(0)
  const [resultado, setResultado] = useState({ pedido: null, datos: null, error: '' })

  useEffect(() => {
    let vigente = true
    api.get('/calificaciones/docente', { params: { materiaId: clase.materiaId, grupoId: clase.grupo.id } })
      .then((res) => { if (vigente) setResultado({ pedido, datos: res.data, error: '' }) })
      .catch((error) => { if (vigente) setResultado({ pedido, datos: null, error: error.response?.data?.message || 'No se pudieron cargar las unidades de la clase.' }) })
    return () => { vigente = false }
  }, [pedido, clase.materiaId, clase.grupo.id, version])

  const datos = resultado.pedido === pedido ? resultado.datos : null
  const matriz = useMemo(() => (datos ? matrizUnidades(datos) : null), [datos])

  if (resultado.pedido === pedido && resultado.error) {
    return <div className="mt-4"><TaskNotice error={resultado.error} onRetry={() => setVersion((v) => v + 1)} /></div>
  }
  if (!matriz) {
    return (
      <div role="status" aria-label="Cargando todas las unidades" className="mt-4 space-y-2">
        <Skeleton className="h-8 w-72 rounded-[10px]" />
        <Skeleton className="h-48 rounded-[14px]" />
      </div>
    )
  }
  if (!matriz.columnas.length) return <p className="mt-4 text-sm text-muted-foreground">Ninguna unidad ha empezado todavía.</p>
  if (!matriz.filas.length) return <p className="mt-4 text-sm text-muted-foreground">Todavía no hay alumnos inscritos en {clase.grupo.nombre}.</p>
  if (ocultas) {
    return (
      <p className="mt-4 rounded-[14px] border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        Calificaciones ocultas. Usa «Mostrar calificaciones» para verlas.
      </p>
    )
  }

  const enRiesgo = matriz.filas.filter((f) => f.enRiesgo > 0).length
  return (
    <div className="mt-4" style={{ '--mapa-fondo': 'var(--card)' }}>
      <p className="text-sm text-muted-foreground">
        {enRiesgo ? `${plural(enRiesgo, 'alumno', 'alumnos')} de ${matriz.filas.length} con señales en alguna unidad.` : 'Ningún alumno tiene señales de riesgo en las unidades que han empezado.'} Cada celda muestra la calificación de la unidad; elige una para verla en detalle.
      </p>
      <LeyendaRiesgo className="mt-3" estados={['REPROBADO', 'EN_RIESGO', 'APROBADO', 'SIN_CALIFICAR']} />
      <MapaRiesgo
        columnas={matriz.columnas.map((u) => ({
          id: u.id,
          titulo: `U${u.orden}`,
          nombre: `${u.nombre}${ESTADO_UNIDAD[u.status] ? `, ${ESTADO_UNIDAD[u.status]}` : ''}`,
          detalle: u.enRiesgo ? `${u.enRiesgo} en riesgo` : ESTADO_UNIDAD[u.status],
          detalleRiesgo: u.enRiesgo > 0,
        }))}
        filas={matriz.filas}
        caption={`${clase.nombre} · ${clase.grupo.nombre}: estado de cada alumno en cada unidad. Usa las flechas para recorrer las celdas; cada celda abre esa unidad.`}
        etiquetaRegion={`Unidades de ${clase.nombre}, ${clase.grupo.nombre}`}
        accion="Ver la unidad"
        onCelda={(_, k) => onElegirUnidad(matriz.columnas[k].id)}
        subtituloFila={(x) => (x.enRiesgo ? `${plural(x.enRiesgo, 'unidad', 'unidades')} con señales` : x.alumno.numeroControl ?? 'Sin señales')}
        mostrarUnidades={false}
      />
    </div>
  )
}

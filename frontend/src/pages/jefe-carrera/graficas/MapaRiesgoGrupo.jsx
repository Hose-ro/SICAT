import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import MapaRiesgo, { LeyendaRiesgo } from '@/components/graficas/MapaRiesgo'
import { conRiesgo, matrizRiesgo } from '@/components/graficas/riesgo'
import { plural } from '../supervision/formato'
import { BotonSeguimiento } from '../supervision/Seguimiento'
import { estadoConjunto, reintentarReportes } from '../supervision/useReportes'
import { AvisoParcial, Segmento, SeccionTitulo, Vacio } from '../supervision/ui'

const VISTAS = [
  { value: '', label: 'En riesgo' },
  { value: 'todos', label: 'Todos' },
]

/**
 * Qué alumno está en riesgo y en qué materia. Cada celda es la peor unidad
 * del alumno en esa materia; el color solo aparece donde hay que actuar.
 */
export default function MapaRiesgoGrupo({ j, grupo, ofertas, reportes, expediente, abrirAlumno, alumnoActivo }) {
  const [params, setParams] = useSearchParams()
  const vista = params.get('ver') === 'todos' ? 'todos' : ''
  const setVista = (v) => { const n = new URLSearchParams(params); if (v) n.set('ver', v); else n.delete('ver'); setParams(n, { replace: true }) }

  const alumnos = expediente.data?.alumnos
  const conjunto = estadoConjunto(reportes, ofertas.map((o) => `${o.materia.id}:${grupo.id}`))
  const matriz = useMemo(() => (alumnos ? matrizRiesgo(alumnos, ofertas, reportes, grupo.id) : null), [alumnos, ofertas, reportes, grupo.id])

  if (expediente.error) return <Vacio titulo="No se pudo cargar el alumnado">{expediente.error}</Vacio>
  if (!matriz || (conjunto.cargando && !Object.values(reportes).some((r) => r.data))) {
    return <div className="mt-6 h-72 animate-pulse rounded-[var(--radius-item)] bg-muted" aria-busy="true" aria-label="Cargando el mapa de riesgo" />
  }
  if (!ofertas.length) return <Vacio titulo="Sin materias en el periodo">El grupo no tiene materias asignadas en este periodo.</Vacio>

  const enRiesgo = matriz.filas.filter((f) => f.enRiesgo > 0)
  const filas = vista === 'todos' ? matriz.filas : enRiesgo

  return (
    <section className="mt-6" aria-labelledby="mapa-riesgo">
      <SeccionTitulo
        id="mapa-riesgo"
        titulo="Alumnos en riesgo por materia"
        descripcion={`${plural(enRiesgo.length, 'alumno', 'alumnos')} de ${matriz.filas.length} con señales en alguna materia. Cada celda muestra el promedio del alumno en esa materia.`}
        accion={<Segmento label="Alumnos que se muestran" value={vista} onChange={setVista} options={VISTAS} />}
      />
      <AvisoParcial conjunto={conjunto} total={ofertas.length} onReintentar={reintentarReportes} />

      <LeyendaRiesgo className="mt-4" />

      {filas.length ? (
        <MapaRiesgo
          columnas={matriz.columnas.map((col) => ({
            id: col.id,
            titulo: col.materia.clave || col.materia.nombre,
            nombre: col.materia.nombre,
            detalle: col.reporte.error ? 'No disponible' : col.enRiesgo ? `${col.enRiesgo} en riesgo` : 'Sin riesgo',
            detalleRiesgo: col.enRiesgo > 0,
          }))}
          filas={filas}
          caption="Estado de cada alumno en cada materia del grupo. Usa las flechas para recorrer las celdas; cada celda abre el expediente del alumno."
          etiquetaRegion="Mapa de riesgo del grupo"
          accion="Abrir expediente"
          onCelda={(x) => abrirAlumno(x.alumno.id)}
          onAlumno={(x) => abrirAlumno(x.alumno.id)}
          subtituloFila={(x) => (x.enRiesgo ? `${plural(x.enRiesgo, 'materia', 'materias')} en riesgo` : x.alumno.numeroControl ?? 'Sin señales')}
          activa={(x) => alumnoActivo === x.alumno.id}
          encabezadoAccion="Observación"
          accionFila={(x) => x.enRiesgo > 0 && (
            <BotonSeguimiento
              j={j}
              caso={{ tipo: 'ALUMNO_RIESGO', alumnoId: x.alumno.id }}
              titulo={`Observación de ${x.alumno.nombre}`}
              contexto={matriz.columnas.filter((_, k) => conRiesgo(x.celdas[k].estado)).map((col) => col.materia.nombre).join(', ')}
              className="whitespace-nowrap"
            />
          )}
        />
      ) : (
        <Vacio titulo={conjunto.completo ? 'Nadie del grupo tiene señales de riesgo' : 'Sin señales en las materias consultadas'}>
          {conjunto.completo
            ? 'Ningún alumno tiene señales de riesgo en este periodo. Cambia a Todos para ver al grupo completo.'
            : 'Faltan materias por consultar; reintenta para confirmar.'}
        </Vacio>
      )}

      <p className="mt-3 max-w-3xl text-xs text-muted-foreground">
        Una materia queda en riesgo si alguna de sus unidades lo está: calificación menor a 80, faltas y retardos de 30 % o más, o 30 % o más de las tareas vencidas sin entregar. Las tareas que todavía no vencen no cuentan.
      </p>
    </section>
  )
}

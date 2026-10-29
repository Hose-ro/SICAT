import { plural } from './supervision/formato'

/** Materias del periodo a las que les falta docente u horario (como Inicio y Materias). */
export const ofertasIncompletas = (resumen) =>
  (resumen?.ofertas ?? []).filter((o) => !o.docentes.length || !o.horarios.length).length

/**
 * Los cuatro pasos para dejar lista una carrera. El jefe no crea grupos ni
 * horarios (los capturan coordinación y los docentes): la guía dice qué
 * revisar y a quién pedírselo. Cada paso se marca con los datos de la carrera
 * o, cuando sólo se trata de revisar, al abrirlo una vez.
 */
export function pasosDeJefatura({ resumen, reuniones, revision = {}, j }) {
  const ofertas = resumen?.ofertas ?? []
  const incompletas = ofertasIncompletas(resumen)
  const docentes = resumen?.docentes ?? []

  return [
    {
      clave: 'reticula',
      titulo: 'Revisa la retícula de tu carrera',
      detalle: 'Agrega las materias que falten o corrige sus unidades y semestre. Coordinación las asigna a cada grupo.',
      hecho: (resumen?.reticula ?? []).length > 0,
      accion: 'Agregar materia',
      destino: j.to('/jefe-carrera/materias', { vista: 'reticula', nueva: '1' }),
    },
    {
      clave: 'oferta',
      titulo: 'Confirma grupos y horarios del periodo',
      detalle: !ofertas.length
        ? 'Coordinación crea los grupos del periodo y cada docente captura su horario. Aquí ves qué falta y a quién pedírselo.'
        : incompletas
          ? `${plural(incompletas, 'materia', 'materias')} sin docente o sin horario. Aquí ves a quién pedírselo.`
          : 'Revisa que cada materia tenga grupo, docente y horario.',
      hecho: (ofertas.length > 0 && incompletas === 0) || (ofertas.length > 0 && Boolean(revision.oferta)),
      accion: 'Revisar oferta',
      destino: j.to('/jefe-carrera/materias', incompletas ? { vista: 'ofertas', revision: 'incompleta' } : { vista: 'ofertas' }),
    },
    {
      clave: 'docentes',
      titulo: 'Conoce a tus docentes',
      detalle: docentes.length
        ? 'Revisa la carga de cada docente y cómo va su captura de listas y calificaciones.'
        : 'Aparecen cuando capturan su horario con grupos de tu carrera.',
      hecho: docentes.length > 0 && Boolean(revision.docentes),
      accion: 'Ver docentes',
      destino: j.to('/jefe-carrera/docentes'),
    },
    {
      clave: 'reunion',
      titulo: 'Programa la primera reunión de academia',
      detalle: 'Convoca a los docentes y deja el acta con los acuerdos.',
      hecho: (reuniones ?? []).length > 0,
      accion: 'Programar reunión',
      destino: j.to('/jefe-carrera/reuniones', { nueva: '1' }),
    },
  ]
}

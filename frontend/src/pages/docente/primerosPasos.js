/**
 * Los cuatro pasos para dejar listo un curso, en el orden en que dependen uno
 * del otro. Cada uno se marca solo con lo que ya hay en el sistema (salvo
 * revisar alumnos, que se marca al abrirlo) y lleva directo a la acción.
 */
export function pasosDelDocente({ configuracion, materias, revisado }) {
  const grupos = configuracion?.grupos ?? []
  const sinAlumnos = grupos.filter((grupo) => grupo.alumnos === 0)
  const clase = materias.find((materia) => materia.grupo)

  return [
    {
      titulo: 'Agrega tu grupo',
      detalle: 'Búscalo en el catálogo de grupos de tu carrera y agrégalo a tus grupos.',
      hecho: grupos.length > 0,
      accion: 'Agregar grupo',
      destino: '/docente/grupos?agregar=1',
    },
    {
      titulo: 'Carga tu lista de alumnos',
      detalle: sinAlumnos.length && grupos.length
        ? `Importa la lista desde Excel o agrégalos uno a uno. Sin alumnos: ${sinAlumnos.map((g) => g.nombre).join(', ')}.`
        : 'Importa la lista desde Excel o agrégalos uno a uno.',
      hecho: grupos.length > 0 && sinAlumnos.length === 0,
      accion: 'Cargar lista',
      destino: sinAlumnos[0] ? `/docente/grupos?alumnos=${sinAlumnos[0].id}&pestana=importar` : '/docente/grupos',
    },
    {
      titulo: 'Elige tus materias y ajusta tu horario',
      detalle: 'Para cada materia elige el grupo, los días y las horas. Al guardar, los alumnos del grupo quedan en tu materia.',
      hecho: (configuracion?.clasesProgramadas ?? 0) > 0,
      accion: 'Programar clase',
      destino: grupos[0] ? `/docente/horario/editar?nueva=1&grupo=${grupos[0].id}` : '/docente/horario/editar?nueva=1',
    },
    {
      titulo: 'Revisa los alumnos de cada materia',
      detalle: 'Confirma que estén todos y completa los datos que falten antes de pasar lista.',
      hecho: revisado,
      accion: 'Revisar alumnos',
      destino: clase ? `/materias/${clase.id}?grupo=${clase.grupo.id}` : '/materias',
      alAbrir: true,
    },
  ]
}

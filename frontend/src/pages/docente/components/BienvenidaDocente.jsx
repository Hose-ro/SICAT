import { ClipboardCheck, FileCheck2, Sparkles, UsersRound } from 'lucide-react'
import VentanaBienvenida from '@/components/onboarding/VentanaBienvenida'

/**
 * Lo que el docente necesita saber antes de tocar nada: en qué orden se
 * prepara un curso y qué hará después cada semana. Se ve una sola vez; la
 * guía de primeros pasos la vuelve a abrir.
 */
const PANTALLAS = [
  {
    icono: Sparkles,
    titulo: 'Bienvenido a SICAT',
    texto: 'Aquí llevas tus listas de asistencia, tareas y calificaciones en un solo lugar. Tus alumnos ven lo mismo que tú registras.',
  },
  {
    icono: UsersRound,
    titulo: 'Primero, prepara tu curso',
    texto: 'Se hace una sola vez al inicio del semestre:',
    pasos: [
      'Agrega tu grupo.',
      'Carga la lista de alumnos (puede ser desde Excel).',
      'Elige tus materias y sus horas en el horario.',
      'Revisa los alumnos de cada materia.',
    ],
  },
  {
    icono: ClipboardCheck,
    titulo: 'Tu día a día',
    texto: 'Cuando empiece cada clase, pasa lista desde Inicio. Deja tareas a tus grupos y captura las calificaciones de la unidad que esté abierta.',
  },
  {
    icono: FileCheck2,
    titulo: 'Al final del semestre',
    texto: 'En Calificaciones › Cierre de curso revisas los promedios finales y cierras el curso. Mientras tanto, Inicio te avisa de lo pendiente.',
  },
]

export default function BienvenidaDocente({ open, onClose }) {
  return <VentanaBienvenida pantallas={PANTALLAS} open={open} onClose={onClose} />
}

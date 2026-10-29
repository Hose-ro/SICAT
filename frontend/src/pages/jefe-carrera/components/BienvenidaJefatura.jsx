import { CalendarCheck, ClipboardList, FileBarChart, Sparkles } from 'lucide-react'
import VentanaBienvenida from '@/components/onboarding/VentanaBienvenida'

/**
 * Lo que el jefe de carrera necesita saber antes de empezar: qué revisa
 * primero, qué hace cada semana y qué entrega al cierre. Se ve una sola vez;
 * la guía de primeros pasos la vuelve a abrir.
 */
const PANTALLAS = [
  {
    icono: Sparkles,
    titulo: 'Bienvenido a SICAT',
    texto: 'Aquí supervisas tu carrera con lo que registran los docentes: asistencia, calificaciones, entregas y alumnos en riesgo. SICAT no reemplaza la conversación con ellos; te dice con quién conviene tenerla.',
  },
  {
    icono: ClipboardList,
    titulo: 'Primero, prepara tu carrera',
    texto: 'Al inicio del periodo:',
    pasos: [
      'Revisa la retícula: agrega o corrige materias.',
      'Confirma grupos y horarios (los capturan coordinación y los docentes).',
      'Conoce a tus docentes y su carga.',
      'Programa la primera reunión de academia.',
    ],
  },
  {
    icono: CalendarCheck,
    titulo: 'Tu día a día',
    texto: 'Empieza por «Requiere atención» en Inicio. «Ver detalle» y «Ver clase» muestran lo registrado; sin captura no se prueba que la clase no se impartiera. «Registrar observación» guarda el acuerdo con tu nombre y fecha.',
  },
  {
    icono: FileBarChart,
    titulo: 'Al cierre del periodo',
    texto: 'En Informe del periodo exportas el resumen a PDF o Excel, y en Reuniones quedan las actas con los acuerdos de la academia.',
  },
]

export default function BienvenidaJefatura({ open, onClose }) {
  return <VentanaBienvenida pantallas={PANTALLAS} open={open} onClose={onClose} />
}

import { useEffect } from 'react'
import { useInscripcionStore } from '../../../store/inscripcionStore'

export default function TabAlumnosMateria({ materiaId }) {
  const { alumnosMateria, obtenerAlumnos, loading } = useInscripcionStore()

  useEffect(() => { obtenerAlumnos(materiaId) }, [materiaId])

  return (
    <div>
      {loading ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : alumnosMateria.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No hay alumnos inscritos</p>
      ) : (
        <table className="min-w-full text-sm border">
          <thead className="bg-gray-50">
            <tr>
              <th className="border px-3 py-2 text-left">Nombre</th>
              <th className="border px-3 py-2 text-left">Num. Control</th>
              <th className="border px-3 py-2 text-left">Email</th>
            </tr>
          </thead>
          <tbody>
            {alumnosMateria.map((i) => (
              <tr key={i.id} className="hover:bg-gray-50">
                <td className="border px-3 py-2 font-medium">{i.alumno?.nombre}</td>
                <td className="border px-3 py-2 text-gray-600">{i.alumno?.numeroControl || '-'}</td>
                <td className="border px-3 py-2 text-gray-600">{i.alumno?.email || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

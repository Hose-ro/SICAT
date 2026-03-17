import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import api from '../api/axios'

export default function Carreras() {
  const [carreras, setCarreras] = useState([])
  const [modal, setModal] = useState(false)
  const [nombre, setNombre] = useState('')

  const fetch = () => api.get('/carreras').then((r) => setCarreras(r.data))
  useEffect(() => { fetch() }, [])

  const crear = async (e) => {
    e.preventDefault()
    await api.post('/carreras', { nombre })
    setModal(false)
    setNombre('')
    fetch()
  }

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar esta carrera?')) return
    await api.delete(`/carreras/${id}`)
    fetch()
  }

  return (
    <>
      <PageHeader
        title="Carreras"
        subtitle="Gestión de carreras disponibles"
        action={
          <button
            onClick={() => setModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition"
          >
            + Nueva carrera
          </button>
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {carreras.map((c) => (
          <div key={c.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎓</span>
              <span className="font-medium text-gray-800">{c.nombre}</span>
            </div>
            <button
              onClick={() => eliminar(c.id)}
              className="text-red-400 hover:text-red-600 text-sm px-2 py-1 rounded-lg hover:bg-red-50 transition"
            >
              Eliminar
            </button>
          </div>
        ))}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Nueva carrera">
        <form onSubmit={crear} className="space-y-4">
          <input
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Ingeniería en Sistemas"
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 transition">
            Crear carrera
          </button>
        </form>
      </Modal>
    </>
  )
}

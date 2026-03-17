import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import api from '../api/axios'
import { useAuthStore } from '../store/authStore'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export default function Materias() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [materias, setMaterias] = useState([])
  const [solicitudesEnviadas, setSolicitudesEnviadas] = useState(new Set())
  const [busqueda, setBusqueda] = useState('')
  const [filtroCarrera, setFiltroCarrera] = useState('')
  const [filtroSemestre, setFiltroSemestre] = useState('')
  const [modal, setModal] = useState(false)
  const [modalBuscar, setModalBuscar] = useState(false)
  const [claveBuscar, setClaveBuscar] = useState('')
  const [materiaEncontrada, setMateriaEncontrada] = useState(null)
  const [errorBuscar, setErrorBuscar] = useState('')
  const [diasSeleccionados, setDiasSeleccionados] = useState([])
  const [carreras, setCarreras] = useState([])
  const [docentes, setDocentes] = useState([])
  const [form, setForm] = useState({
    nombre: '', clave: '', descripcion: '', horaInicio: '08:00', horaFin: '10:00',
    numUnidades: 3, carreraId: '', semestre: '', docenteId: '',
  })
  const [error, setError] = useState('')

  const esAlumno = user?.rol === 'ALUMNO'
  const esAdmin = user?.rol === 'ADMIN'
  const canCreate = esAdmin || user?.rol === 'DOCENTE'

  const fetchMaterias = () => {
    const endpoint = esAlumno ? '/materias/para-alumno' : user?.rol === 'DOCENTE' ? '/materias/mis-materias' : '/materias'
    api.get(endpoint).then((r) => setMaterias(r.data))
  }

  useEffect(() => {
    fetchMaterias()
    api.get('/carreras').then((r) => setCarreras(r.data))
    if (esAdmin) {
      api.get('/usuarios?rol=DOCENTE').then((r) => setDocentes(r.data))
    }
  }, [])

  const toggleDia = (dia) => {
    setDiasSeleccionados((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]
    )
  }

  const crear = async (e) => {
    e.preventDefault()
    setError('')
    if (diasSeleccionados.length === 0) { setError('Selecciona al menos un día'); return }
    try {
      const payload = {
        ...form,
        dias: diasSeleccionados.join(','),
        numUnidades: parseInt(form.numUnidades),
        carreraId: form.carreraId ? parseInt(form.carreraId) : undefined,
        semestre: form.semestre ? parseInt(form.semestre) : undefined,
        docenteId: form.docenteId ? parseInt(form.docenteId) : undefined,
      }
      await api.post('/materias', payload)
      setModal(false)
      setForm({ nombre: '', clave: '', descripcion: '', horaInicio: '08:00', horaFin: '10:00', numUnidades: 3, carreraId: '', semestre: '', docenteId: '' })
      setDiasSeleccionados([])
      fetchMaterias()
    } catch (err) {
      setError(err.response?.data?.message ?? 'Error al crear')
    }
  }

  const buscarMateria = async () => {
    setErrorBuscar('')
    setMateriaEncontrada(null)
    try {
      const r = await api.get(`/materias/clave/${claveBuscar}`)
      setMateriaEncontrada(r.data)
    } catch {
      setErrorBuscar('No se encontró ninguna materia con esa clave')
    }
  }

  const solicitarInscripcion = async (materiaId, desdeModal = false) => {
    try {
      await api.post('/inscripciones/solicitar', { materiaId, periodo: '2026-A' })
      setSolicitudesEnviadas((prev) => new Set([...prev, materiaId]))
      if (desdeModal) {
        setModalBuscar(false)
        setClaveBuscar('')
        setMateriaEncontrada(null)
      }
    } catch (err) {
      const msg = err.response?.data?.message ?? 'Error al enviar solicitud'
      if (msg.includes('Ya')) {
        setSolicitudesEnviadas((prev) => new Set([...prev, materiaId]))
      } else {
        alert(msg)
      }
    }
  }

  const materiasFiltradas = materias.filter((m) => {
    const q = busqueda.toLowerCase()
    const matchBusqueda = !q || m.nombre.toLowerCase().includes(q) || m.clave.toLowerCase().includes(q)
    const matchCarrera = !filtroCarrera || m.carrera?.id === parseInt(filtroCarrera)
    const matchSemestre = !filtroSemestre || m.semestre === parseInt(filtroSemestre)
    return matchBusqueda && matchCarrera && matchSemestre
  })

  const hayFiltros = busqueda || filtroCarrera || filtroSemestre

  const MateriaCard = ({ m }) => (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition cursor-pointer"
      onClick={() => navigate(`/materias/${m.id}`)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">{m.clave}</span>
          <h3 className="font-semibold text-gray-800 mt-1">{m.nombre}</h3>
        </div>
        <span className="text-xs text-gray-400 ml-2 shrink-0">{m._count?.inscripciones ?? 0} alumnos</span>
      </div>
      <div className="text-xs text-gray-500 space-y-1">
        <p>👨‍🏫 {m.docente?.nombre} {m.docente?.academia ? `· ${m.docente.academia}` : ''}</p>
        <p>🕐 {m.horaInicio} – {m.horaFin}</p>
        <p>📅 {m.dias}</p>
        {m.carrera && <p>🎓 {m.carrera.nombre} {m.semestre ? `· Sem. ${m.semestre}` : ''}</p>}
      </div>
      {esAlumno && (
        solicitudesEnviadas.has(m.id) ? (
          <div className="mt-auto w-full flex items-center justify-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-xs py-2 rounded-xl font-medium">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Solicitud enviada
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); solicitarInscripcion(m.id) }}
            className="mt-auto w-full bg-green-600 text-white text-xs py-2 rounded-xl font-medium hover:bg-green-700 transition"
          >
            Solicitar unirme
          </button>
        )
      )}
    </div>
  )

  return (
    <>
      <PageHeader
        title="Materias"
        subtitle={esAlumno ? 'Materias disponibles para tu carrera y semestre' : 'Materias disponibles este semestre'}
        action={
          <div className="flex gap-2">
            {esAlumno && (
              <button
                onClick={() => setModalBuscar(true)}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-200 transition"
              >
                Buscar por clave
              </button>
            )}
            {canCreate && (
              <button
                onClick={() => setModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition"
              >
                + Nueva materia
              </button>
            )}
          </div>
        }
      />

      {/* Filtros — solo para admin/docente */}
      {!esAlumno && (
        <div className="flex flex-wrap gap-3 mb-5">
          <input
            type="text"
            placeholder="Buscar por nombre o clave..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-60"
          />
          <select
            value={filtroCarrera}
            onChange={(e) => { setFiltroCarrera(e.target.value); setFiltroSemestre('') }}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-60"
          >
            <option value="">Todas las carreras</option>
            {carreras.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <select
            value={filtroSemestre}
            onChange={(e) => setFiltroSemestre(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
          >
            <option value="">Todos los semestres</option>
            {[1,2,3,4,5,6,7,8].map((s) => (
              <option key={s} value={s}>Semestre {s}</option>
            ))}
          </select>
          {hayFiltros && (
            <button
              onClick={() => { setBusqueda(''); setFiltroCarrera(''); setFiltroSemestre('') }}
              className="text-sm text-gray-400 hover:text-gray-600 px-2 transition"
            >
              Limpiar
            </button>
          )}
          {hayFiltros && (
            <span className="text-sm text-gray-400 self-center">
              {materiasFiltradas.length} resultado{materiasFiltradas.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {materiasFiltradas.map((m) => <MateriaCard key={m.id} m={m} />)}
        {materiasFiltradas.length === 0 && (
          <div className="col-span-3 text-center py-16 text-gray-400">
            {esAlumno
              ? 'No hay materias disponibles para tu carrera y semestre. Usa "Buscar por clave" para encontrar otras.'
              : hayFiltros ? 'No hay materias que coincidan con los filtros.'
              : 'No hay materias registradas'}
          </div>
        )}
      </div>

      {/* Modal: Nueva materia */}
      <Modal open={modal} onClose={() => setModal(false)} title="Nueva materia">
        <form onSubmit={crear} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre *</label>
            <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej: Cálculo Diferencial"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Clave *</label>
            <input required value={form.clave} onChange={(e) => setForm({ ...form, clave: e.target.value.toUpperCase() })}
              placeholder="RSB-2403"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Admin: asignar docente */}
          {esAdmin && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Docente *</label>
              <select required value={form.docenteId} onChange={(e) => setForm({ ...form, docenteId: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Selecciona un docente</option>
                {docentes.map((d) => (
                  <option key={d.id} value={d.id}>{d.nombre}{d.academia ? ` – ${d.academia}` : ''}</option>
                ))}
              </select>
            </div>
          )}

          {/* Carrera y semestre */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Carrera</label>
              <select value={form.carreraId} onChange={(e) => setForm({ ...form, carreraId: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Todas</option>
                {carreras.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Semestre</label>
              <select value={form.semestre} onChange={(e) => setForm({ ...form, semestre: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Todos</option>
                {[1,2,3,4,5,6,7,8,9,10,11,12].map((s) => (
                  <option key={s} value={s}>{s}°</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Hora inicio</label>
              <input type="time" required value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Hora fin</label>
              <input type="time" required value={form.horaFin} onChange={(e) => setForm({ ...form, horaFin: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Días de clase</label>
            <div className="flex flex-wrap gap-2">
              {DIAS.map((d) => (
                <button key={d} type="button" onClick={() => toggleDia(d)}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${diasSeleccionados.includes(d) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Número de unidades</label>
            <input type="number" min={1} max={10} required value={form.numUnidades}
              onChange={(e) => setForm({ ...form, numUnidades: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 transition">
            Crear materia
          </button>
        </form>
      </Modal>

      {/* Modal: Buscar materia por clave */}
      <Modal open={modalBuscar} onClose={() => { setModalBuscar(false); setMateriaEncontrada(null); setClaveBuscar(''); setErrorBuscar('') }} title="Buscar materia por clave">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Si tu materia no aparece en la lista, puedes buscarla por su clave.</p>
          <div className="flex gap-2">
            <input
              value={claveBuscar}
              onChange={(e) => setClaveBuscar(e.target.value.toUpperCase())}
              placeholder="Clave de materia (RSB-2403)"
              className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={buscarMateria} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition">
              Buscar
            </button>
          </div>
          {errorBuscar && <p className="text-red-500 text-sm">{errorBuscar}</p>}
          {materiaEncontrada && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">{materiaEncontrada.clave}</span>
                <span className="text-xs text-gray-400">{materiaEncontrada._count?.inscripciones ?? 0} alumnos</span>
              </div>
              <p className="font-semibold text-gray-800">{materiaEncontrada.nombre}</p>
              <p className="text-sm text-gray-500">👨‍🏫 {materiaEncontrada.docente?.nombre}</p>
              <p className="text-sm text-gray-500">🕐 {materiaEncontrada.horaInicio} – {materiaEncontrada.horaFin} · {materiaEncontrada.dias}</p>
              {materiaEncontrada.carrera && (
                <p className="text-sm text-gray-500">🎓 {materiaEncontrada.carrera.nombre} {materiaEncontrada.semestre ? `· Sem. ${materiaEncontrada.semestre}` : ''}</p>
              )}
              {solicitudesEnviadas.has(materiaEncontrada.id) ? (
                <div className="w-full flex items-center justify-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm py-2 rounded-xl font-medium mt-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Solicitud enviada
                </div>
              ) : (
                <button
                  onClick={() => solicitarInscripcion(materiaEncontrada.id, true)}
                  className="w-full bg-green-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-green-700 transition mt-2"
                >
                  Enviar solicitud de inscripción
                </button>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}

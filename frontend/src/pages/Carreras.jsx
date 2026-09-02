import { useCallback, useEffect, useState } from 'react'
import { FileSpreadsheet, UploadCloud } from 'lucide-react'
import { CiRead } from 'react-icons/ci'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import api from '../api/axios'

const EMPTY_FORM = {
  nombre: '',
  codigo: '',
  planEstudios: '',
}

function apiError(error, fallback) {
  const message = error.response?.data?.message
  return Array.isArray(message) ? message.join('. ') : (message || fallback)
}

export default function Carreras() {
  const [carreras, setCarreras] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [reticula, setReticula] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [pageError, setPageError] = useState('')

  const fetchCarreras = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.get('/carreras')
      setCarreras(response.data)
      setPageError('')
    } catch (requestError) {
      setPageError(apiError(requestError, 'No se pudieron cargar las carreras'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCarreras()
  }, [fetchCarreras])

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setReticula(null)
    setError('')
    setModal(true)
  }

  const closeCreate = () => {
    if (saving) return
    setModal(false)
    setError('')
  }

  const crear = async (event) => {
    event.preventDefault()
    setError('')
    if (!reticula) {
      setError('Selecciona el archivo de retícula para continuar')
      return
    }

    setSaving(true)
    try {
      const data = new FormData()
      data.append('nombre', form.nombre.trim())
      data.append('codigo', form.codigo.trim().toUpperCase())
      if (form.planEstudios.trim()) data.append('planEstudios', form.planEstudios.trim())
      data.append('reticula', reticula)

      await api.post('/carreras', data)
      setModal(false)
      setForm(EMPTY_FORM)
      setReticula(null)
      await fetchCarreras()
    } catch (requestError) {
      setError(apiError(requestError, 'No se pudo crear la carrera'))
    } finally {
      setSaving(false)
    }
  }

  const eliminar = async (carrera) => {
    if (!window.confirm(`¿Eliminar la carrera "${carrera.nombre}"?`)) return
    setPageError('')
    try {
      await api.delete(`/carreras/${carrera.id}`)
      await fetchCarreras()
    } catch (requestError) {
      setPageError(apiError(requestError, 'No se pudo eliminar la carrera'))
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Carreras"
        subtitle="Gestiona carreras y sus retículas académicas"
        action={
          <button
            type="button"
            onClick={openCreate}
            className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 sm:w-auto"
          >
            + Nueva carrera
          </button>
        }
      />

      {pageError && (
        <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {pageError}
        </div>
      )}

      {loading && carreras.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Cargando carreras...</p>
      ) : carreras.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="font-medium text-foreground">No hay carreras registradas</p>
          <p className="mt-1 text-sm text-muted-foreground">Crea la primera carrera y carga su retícula.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {carreras.map((carrera) => (
            <article key={carrera.id} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                  <CiRead className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate font-medium text-foreground">{carrera.nombre}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {carrera.codigo} · {carrera._count?.reticulaMaterias ?? 0} materias
                  </p>
                  {carrera.planEstudios && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">Plan {carrera.planEstudios}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => eliminar(carrera)}
                className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                Eliminar
              </button>
            </article>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={closeCreate} title="Nueva carrera">
        <form onSubmit={crear} className="space-y-5">
          <div>
            <label htmlFor="carrera-nombre" className="mb-1.5 block text-sm font-medium text-foreground">
              Nombre de la carrera *
            </label>
            <input
              id="carrera-nombre"
              required
              maxLength={120}
              autoComplete="off"
              value={form.nombre}
              onChange={(event) => setForm({ ...form, nombre: event.target.value })}
              placeholder="Ej: Ingeniería en Sistemas Computacionales"
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="carrera-codigo" className="mb-1.5 block text-sm font-medium text-foreground">
                Código *
              </label>
              <input
                id="carrera-codigo"
                required
                maxLength={20}
                pattern="[A-Za-z0-9][A-Za-z0-9._-]*"
                autoComplete="off"
                value={form.codigo}
                onChange={(event) => setForm({ ...form, codigo: event.target.value.toUpperCase() })}
                placeholder="ISC"
                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm uppercase text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
              />
            </div>
            <div>
              <label htmlFor="carrera-plan" className="mb-1.5 block text-sm font-medium text-foreground">
                Plan de estudios
              </label>
              <input
                id="carrera-plan"
                maxLength={80}
                autoComplete="off"
                value={form.planEstudios}
                onChange={(event) => setForm({ ...form, planEstudios: event.target.value })}
                placeholder="ISIC-2010-224"
                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
              />
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">Retícula de la carrera *</p>
            <label
              htmlFor="carrera-reticula"
              className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-input bg-background px-5 py-6 text-center transition-colors hover:border-primary/50 focus-within:ring-3 focus-within:ring-ring/40"
            >
              {reticula ? (
                <FileSpreadsheet className="h-7 w-7 text-success" aria-hidden="true" />
              ) : (
                <UploadCloud className="h-7 w-7 text-primary" aria-hidden="true" />
              )}
              <span className="mt-3 text-sm font-medium text-foreground">
                {reticula?.name || 'Seleccionar archivo de retícula'}
              </span>
              <span id="reticula-help" className="mt-1 text-xs leading-5 text-muted-foreground">
                XLSX, CSV, JSON o Markdown, máximo 5 MB. Columnas: nombre, clave, semestre, horasTeoria, horasPractica y creditos.
              </span>
              <input
                id="carrera-reticula"
                type="file"
                required
                accept=".xlsx,.csv,.json,.md"
                aria-describedby="reticula-help"
                onChange={(event) => setReticula(event.target.files?.[0] ?? null)}
                className="sr-only"
              />
            </label>
          </div>

          {error && (
            <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-primary py-2.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Creando carrera...' : 'Crear carrera y cargar retícula'}
          </button>
        </form>
      </Modal>
    </div>
  )
}

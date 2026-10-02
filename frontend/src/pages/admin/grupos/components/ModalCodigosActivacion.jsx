import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { Download, KeyRound, Printer } from 'lucide-react'
import Modal from '@/components/Modal'
import api from '../../../../api/axios'

function mensajeError(error, fallback) {
  const message = error?.response?.data?.message
  return Array.isArray(message) ? message.join('. ') : message || fallback
}

const escaparHtml = (texto) =>
  String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

function descargarCsv(grupo, alumnos) {
  const celda = (valor) => `"${String(valor ?? '').replace(/"/g, '""')}"`
  const filas = [
    ['Número de control', 'Nombre', 'Código de activación'],
    ...alumnos.map((a) => [a.numeroControl, a.nombre, a.codigo]),
  ]
  // BOM para que Excel respete los acentos.
  const contenido = `﻿${filas.map((fila) => fila.map(celda).join(',')).join('\r\n')}`
  const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }))
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `codigos-activacion-${grupo.nombre.replace(/\s+/g, '-').toLowerCase()}.csv`
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}

/** Una hoja con un recorte por alumno, para repartir en papel. */
function imprimir(grupo, alumnos, vigenciaDias) {
  const ventana = window.open('', '_blank', 'width=900,height=700')
  if (!ventana) return false
  const tarjetas = alumnos.map((a) => `
    <div class="tarjeta">
      <p class="nombre">${escaparHtml(a.nombre)}</p>
      <p>Número de control: <strong>${escaparHtml(a.numeroControl ?? '—')}</strong></p>
      <p>Código: <strong class="codigo">${escaparHtml(a.codigo)}</strong></p>
      <p class="ayuda">Entra a SICAT → "Activa tu cuenta con tu código". Vigente ${vigenciaDias} días, un solo uso.</p>
    </div>`).join('')
  ventana.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8">
    <title>Códigos de activación · ${escaparHtml(grupo.nombre)}</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 24px; color: #111; }
      h1 { font-size: 18px; margin: 0 0 16px; }
      .rejilla { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .tarjeta { border: 1px dashed #888; border-radius: 8px; padding: 12px; break-inside: avoid; }
      .tarjeta p { margin: 4px 0; font-size: 13px; }
      .nombre { font-weight: 600; font-size: 14px; }
      .codigo { font-family: ui-monospace, monospace; font-size: 16px; letter-spacing: 2px; }
      .ayuda { color: #555; font-size: 11px; }
    </style></head><body>
    <h1>Códigos de activación · Grupo ${escaparHtml(grupo.nombre)}</h1>
    <div class="rejilla">${tarjetas}</div>
    </body></html>`)
  ventana.document.close()
  ventana.focus()
  ventana.print()
  return true
}

/**
 * Genera los códigos con los que los alumnos del grupo activan su cuenta.
 * Sólo se guardan cifrados, así que ésta es la única vez que se ven.
 */
export default function ModalCodigosActivacion({ grupo, onClose }) {
  const pendientes = (grupo.alumnos ?? []).filter((a) => !a.activadoAt).length
  const [todos, setTodos] = useState(pendientes === 0)
  const [resultado, setResultado] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const generar = async () => {
    setCargando(true)
    setError('')
    try {
      const { data } = await api.post(`/grupos/${grupo.id}/codigos-activacion`, { todos })
      setResultado(data)
    } catch (err) {
      setError(mensajeError(err, 'No se pudieron generar los códigos'))
    } finally {
      setCargando(false)
    }
  }

  const alumnos = resultado?.alumnos ?? []

  return (
    <Modal open onClose={onClose} busy={cargando} wide={Boolean(resultado)} title={`Códigos de activación · ${grupo.nombre}`}>
      {!resultado ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Cada alumno activa su cuenta con su número de control y un código de un solo uso. Los
            códigos se muestran una sola vez: descárgalos o imprímelos al generarlos.
          </p>
          <fieldset className="space-y-2">
            <legend className="sr-only">¿Para quién?</legend>
            <label className="flex items-start gap-3 rounded-xl border border-border p-3">
              <input type="radio" name="destino" className="mt-1" checked={!todos} disabled={pendientes === 0} onChange={() => setTodos(false)} />
              <span className="text-sm">
                <span className="block font-medium text-foreground">Sólo quienes no han activado ({pendientes})</span>
                <span className="text-muted-foreground">Lo normal al cargar un grupo nuevo.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-border p-3">
              <input type="radio" name="destino" className="mt-1" checked={todos} onChange={() => setTodos(true)} />
              <span className="text-sm">
                <span className="block font-medium text-foreground">Todo el grupo ({grupo.alumnos?.length ?? 0})</span>
                <span className="text-muted-foreground">
                  También sirve para quien olvidó su contraseña: el código nuevo reemplaza al anterior.
                </span>
              </span>
            </label>
          </fieldset>
          {error && <p role="alert" className="text-sm text-destructive-foreground">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
            <Button type="button" onClick={generar} disabled={cargando}>
              <KeyRound aria-hidden="true" />
              {cargando ? 'Generando...' : 'Generar códigos'}
            </Button>
          </div>
        </div>
      ) : alumnos.length === 0 ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">No había alumnos a quienes generarles código.</p>
          <div className="flex justify-end"><Button type="button" onClick={onClose}>Cerrar</Button></div>
        </div>
      ) : (
        <div className="space-y-4">
          <p role="status" className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">
            Se generaron {alumnos.length} código{alumnos.length === 1 ? '' : 's'}, vigentes {resultado.vigenciaDias} días.
            Descárgalos o imprímelos ahora: al cerrar esta ventana ya no se pueden volver a ver.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => descargarCsv(grupo, alumnos)}>
              <Download aria-hidden="true" />
              Descargar lista (CSV)
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!imprimir(grupo, alumnos, resultado.vigenciaDias)) {
                  setError('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes e intenta de nuevo.')
                }
              }}
            >
              <Printer aria-hidden="true" />
              Imprimir para repartir
            </Button>
          </div>
          {error && <p role="alert" className="text-sm text-destructive-foreground">{error}</p>}
          <div className="max-h-80 overflow-auto rounded-xl border border-border" tabIndex={0} role="region" aria-label="Códigos generados">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">No. control</th>
                  <th className="px-4 py-2">Nombre</th>
                  <th className="px-4 py-2">Código</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {alumnos.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-2 font-mono text-muted-foreground">{a.numeroControl ?? '—'}</td>
                    <td className="px-4 py-2 text-foreground">{a.nombre}</td>
                    <td className="px-4 py-2 font-mono font-semibold tracking-widest text-foreground">{a.codigo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end"><Button variant="outline" type="button" onClick={onClose}>Cerrar</Button></div>
        </div>
      )}
    </Modal>
  )
}

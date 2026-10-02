import { create } from 'zustand'

/**
 * Diálogo único para compartir por WhatsApp; se monta en BaseLayout para
 * poder abrirlo desde menús y toasts que no renderizan nada.
 *
 * config: { titulo, materiaId, grupoId, texto, generarArchivo?(formato),
 *           adjuntarPorDefecto?, exito? }
 */
export const useCompartirWhatsappStore = create(() => ({ config: null }))

export function abrirCompartirWhatsapp(config) {
  useCompartirWhatsappStore.setState({ config: { ...config, clave: crypto.randomUUID() } })
}

export function cerrarCompartirWhatsapp() {
  useCompartirWhatsappStore.setState({ config: null })
}

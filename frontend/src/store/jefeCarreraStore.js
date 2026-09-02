import { create } from 'zustand'
import api from '@/api/axios'

export const useJefeCarreraStore = create((set, get) => ({
  carreras: [],
  carreraId: '',
  loading: false,
  error: '',

  cargarCarreras: async () => {
    if (get().loading) return
    set({ loading: true, error: '' })
    try {
      const { data } = await api.get('/jefe-carrera/carreras')
      const actual = get().carreraId
      set({
        carreras: data,
        carreraId: actual && data.some((item) => String(item.id) === String(actual))
          ? actual
          : data.length === 1 ? String(data[0].id) : '',
      })
    } catch (error) {
      set({ error: error.response?.data?.message ?? 'No se pudieron cargar las carreras' })
    } finally {
      set({ loading: false })
    }
  },

  seleccionarCarrera: (carreraId) => set({ carreraId }),
}))

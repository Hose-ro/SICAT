import { describe, expect, test } from 'vitest'
import {
  criteriosDeActividad,
  avanceUnidades,
  listaEfectiva,
  resumenCriterios,
  validarCriterios,
} from '../src/lib/criterios'

const criterio = (id, nombre, tipo, peso, meta = null) => ({ id, clave: `c${id}`, nombre, tipo, peso, meta })
const datos = {
  base: { origen: 'GRUPO', criterios: [criterio(1, 'Examen', 'EXAMEN', 60), criterio(2, 'Asistencia', 'ASISTENCIA', 40)] },
  unidades: [
    { unidad: { id: 7, orden: 1 }, personalizada: true, criterios: [criterio(3, 'Proyecto', 'PROYECTO', 90), criterio(2, 'Asistencia', 'ASISTENCIA', 10)] },
    { unidad: { id: 8, orden: 2 }, personalizada: false, criterios: null },
  ],
}

describe('criterios de evaluación', () => {
  test('una unidad usa su lista si la tiene y si no la de todas', () => {
    expect(listaEfectiva(datos, 7).map((item) => item.nombre)).toEqual(['Proyecto', 'Asistencia'])
    expect(listaEfectiva(datos, '8').map((item) => item.nombre)).toEqual(['Examen', 'Asistencia'])
    expect(listaEfectiva(datos, '').map((item) => item.nombre)).toEqual(['Examen', 'Asistencia'])
    expect(listaEfectiva(null, 7)).toEqual([])
  })

  test('una actividad sólo puede llevar criterios de actividad guardados', () => {
    expect(criteriosDeActividad(datos, 7).map((item) => item.id)).toEqual([3])
    const predeterminada = { base: { origen: 'PREDETERMINADA', criterios: [{ id: null, nombre: 'Tareas', tipo: 'TAREAS', peso: 80 }] }, unidades: [] }
    expect(criteriosDeActividad(predeterminada)).toEqual([])
  })

  test('valida igual que el servidor', () => {
    const fila = (nombre, tipo, peso, meta = '') => ({ nombre, tipo, peso, meta })
    expect(validarCriterios([fila('Examen', 'EXAMEN', '60'), fila('Asistencia', 'ASISTENCIA', '40')])).toBe('')
    expect(validarCriterios([fila('Examen', 'EXAMEN', '60')])).toMatch('ahora suman 60')
    expect(validarCriterios([fila('Examen', 'EXAMEN', '50'), fila('exámen', 'EXAMEN', '50')])).toMatch('mismo nombre')
    expect(validarCriterios([fila('Tareas', 'TAREAS', '90'), fila('Participación', 'PARTICIPACION', '10')])).toMatch('meta de participación')
    expect(validarCriterios([fila('Tareas', 'TAREAS', '90'), fila('Participación', 'PARTICIPACION', '10', '5')])).toBe('')
    expect(validarCriterios([fila('Tareas', 'TAREAS', '0'), fila('Examen', 'EXAMEN', '100')])).toMatch('entre 1 y 100')
    expect(validarCriterios([])).toMatch('al menos un criterio')
  })

  test('resume la lista en una línea', () => {
    expect(resumenCriterios(datos.base.criterios)).toBe('Examen 60 % · Asistencia 40 %')
  })

  test('calcula el avance con todas las unidades, no sólo la abierta', () => {
    expect(avanceUnidades([
      { id: 1, status: 'FINALIZADA' },
      { id: 2, status: 'ACTIVA' },
      { id: 3, status: 'PENDIENTE' },
      { id: 4, status: 'FINALIZADA' },
    ])).toEqual({ total: 4, cerradas: 2, porcentaje: 50 })
    expect(avanceUnidades()).toEqual({ total: 0, cerradas: 0, porcentaje: 0 })
  })
})

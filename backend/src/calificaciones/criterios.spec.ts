import { TipoCriterio } from '@prisma/client';
import {
  calcularUnidad,
  construirResolver,
  listaPredeterminada,
  validarListaCriterios,
  type DatosUnidad,
  type ListaCriterios,
} from './criterios';

// Cálculo anterior a los criterios (sin categorías), copiado tal cual para
// comprobar que la lista predeterminada da exactamente los mismos números.
function promedioAnterior(valores: number[]) {
  return valores.length
    ? Number(
        (
          valores.reduce((sum, value) => sum + value, 0) / valores.length
        ).toFixed(2),
      )
    : null;
}
function calificacionAnterior(
  promedioTareas: number | null,
  asistencia: { registradas: number; porcentaje: number },
  ponderacion: { tareas: number; asistencia: number },
) {
  let suma = 0;
  let pesoAplicado = 0;
  if (ponderacion.tareas > 0 && promedioTareas != null) {
    suma += promedioTareas * ponderacion.tareas;
    pesoAplicado += ponderacion.tareas;
  }
  if (ponderacion.asistencia > 0 && asistencia.registradas > 0) {
    suma += asistencia.porcentaje * ponderacion.asistencia;
    pesoAplicado += ponderacion.asistencia;
  }
  return pesoAplicado ? Math.round(suma / pesoAplicado) : null;
}

// Generador determinista para que el caso que falle se pueda repetir.
function aleatorio(semilla: number) {
  let estado = semilla;
  return () => {
    estado = (estado * 1103515245 + 12345) % 2147483648;
    return estado / 2147483648;
  };
}

const datos = (parcial: Partial<DatosUnidad> = {}): DatosUnidad => ({
  actividades: [],
  asistencia: { registradas: 0, porcentaje: 0 },
  participacion: { puntos: 0, sesiones: 0 },
  ...parcial,
});

const lista = (
  criterios: Array<{
    id: number;
    nombre: string;
    tipo: TipoCriterio;
    peso: number;
    meta?: number | null;
  }>,
): ListaCriterios => ({
  origen: 'GRUPO',
  criterios: criterios.map((item) => ({
    clave: `c${item.id}`,
    meta: null,
    virtual: false,
    ...item,
  })),
});

describe('criterios de evaluación', () => {
  it('la lista predeterminada da los mismos números que el cálculo anterior', () => {
    const azar = aleatorio(20261003);
    for (let caso = 0; caso < 2000; caso += 1) {
      const pesoTareas = Math.floor(azar() * 101);
      const entradas = Array.from(
        { length: Math.floor(azar() * 7) },
        (_, indice) => ({
          tareaId: indice + 1,
          categoriaId: azar() < 0.3 ? Math.floor(azar() * 3) + 1 : null,
          calificacion: azar() < 0.2 ? null : Math.round(azar() * 1000) / 10,
        }),
      );
      const registradas = Math.floor(azar() * 5);
      const asistencia = {
        registradas,
        porcentaje: registradas ? Math.round(azar() * 100) : 0,
      };
      const promedio = promedioAnterior(
        entradas
          .map((item) => item.calificacion)
          .filter((valor): valor is number => typeof valor === 'number'),
      );
      const resultado = calcularUnidad(
        listaPredeterminada(pesoTareas, 100 - pesoTareas, 'MATERIA'),
        datos({ actividades: entradas, asistencia }),
      );
      expect(resultado.promedioTareas).toBe(promedio);
      expect(resultado.calificacionCalculada).toBe(
        calificacionAnterior(promedio, asistencia, {
          tareas: pesoTareas,
          asistencia: 100 - pesoTareas,
        }),
      );
      expect(resultado.sinCriterio).toEqual([]);
    }
  });

  it('reparte el peso entre los criterios que ya tienen valor', () => {
    const criterios = lista([
      { id: 1, nombre: 'Examen', tipo: TipoCriterio.EXAMEN, peso: 40 },
      { id: 2, nombre: 'Prácticas', tipo: TipoCriterio.PRACTICAS, peso: 30 },
      { id: 3, nombre: 'Tareas', tipo: TipoCriterio.TAREAS, peso: 20 },
      { id: 4, nombre: 'Asistencia', tipo: TipoCriterio.ASISTENCIA, peso: 10 },
    ]);
    const resultado = calcularUnidad(
      criterios,
      datos({
        actividades: [
          { tareaId: 1, categoriaId: 2, calificacion: 80 },
          { tareaId: 2, categoriaId: 2, calificacion: 100 },
          { tareaId: 3, categoriaId: 3, calificacion: 70 },
          { tareaId: 4, categoriaId: 3, calificacion: null },
          { tareaId: 5, categoriaId: null, calificacion: 0 },
        ],
        asistencia: { registradas: 10, porcentaje: 90 },
      }),
    );
    // Sin examen todavía: (90 × 30 + 70 × 20 + 90 × 10) / 60 = 83.33
    expect(resultado.calificacionCalculada).toBe(83);
    expect(resultado.criterios.map((item) => item.valor)).toEqual([
      null,
      90,
      70,
      90,
    ]);
    expect(resultado.criterios[2]).toEqual(
      expect.objectContaining({ calificadas: 1, total: 2 }),
    );
    // Promedio de actividades: (90 × 30 + 70 × 20) / 50
    expect(resultado.promedioTareas).toBe(82);
    expect(resultado.sinCriterio).toEqual([5]);
  });

  it('un "no presentó" guardado con 0 sí cuenta', () => {
    const criterios = lista([
      { id: 1, nombre: 'Examen', tipo: TipoCriterio.EXAMEN, peso: 50 },
      { id: 2, nombre: 'Tareas', tipo: TipoCriterio.TAREAS, peso: 50 },
    ]);
    const resultado = calcularUnidad(
      criterios,
      datos({
        actividades: [
          { tareaId: 1, categoriaId: 1, calificacion: 0 },
          { tareaId: 2, categoriaId: 2, calificacion: 100 },
        ],
      }),
    );
    expect(resultado.criterios[0].valor).toBe(0);
    expect(resultado.calificacionCalculada).toBe(50);
  });

  it('la participación se mide contra la meta de la unidad, sin pasar de 100', () => {
    const criterios = lista([
      { id: 1, nombre: 'Tareas', tipo: TipoCriterio.TAREAS, peso: 90 },
      {
        id: 2,
        nombre: 'Participación',
        tipo: TipoCriterio.PARTICIPACION,
        peso: 10,
        meta: 5,
      },
    ]);
    const valor = (puntos: number, sesiones = 4) =>
      calcularUnidad(criterios, datos({ participacion: { puntos, sesiones } }))
        .criterios[1];

    expect(valor(3)).toEqual(
      expect.objectContaining({ valor: 60, puntos: 3, total: 5 }),
    );
    expect(valor(9).valor).toBe(100);
    expect(valor(-2).valor).toBe(0);
    // Sin clases en la unidad todavía no hay nada que medir.
    expect(valor(0, 0).valor).toBeNull();
  });

  it('resuelve unidad, luego grupo y luego la predeterminada', () => {
    const fila = (peso: number, grupoId: number, unidadId?: number) => ({
      peso,
      meta: null,
      grupoId,
      ...(unidadId ? { unidadId } : {}),
    });
    const { resolver } = construirResolver(
      { pesoTareas: 80, pesoAsistencia: 20 },
      [{ grupoId: 9, pesoTareas: 70, pesoAsistencia: 30 }],
      [
        {
          id: 1,
          nombre: 'Examen',
          tipo: TipoCriterio.EXAMEN,
          orden: 0,
          pesos: [fila(60, 3)],
          pesosUnidad: [{ ...fila(30, 3, 7), unidadId: 7 }],
        },
        {
          id: 2,
          nombre: 'Proyecto',
          tipo: TipoCriterio.PROYECTO,
          orden: 1,
          pesos: [],
          pesosUnidad: [{ ...fila(50, 3, 7), unidadId: 7 }],
        },
        {
          id: 3,
          nombre: 'Asistencia',
          tipo: TipoCriterio.ASISTENCIA,
          orden: 2,
          pesos: [fila(40, 3)],
          pesosUnidad: [{ ...fila(20, 3, 7), unidadId: 7 }],
        },
      ],
    );

    const unidad = resolver(3, 7);
    expect(unidad.origen).toBe('UNIDAD');
    expect(unidad.criterios.map((item) => [item.nombre, item.peso])).toEqual([
      ['Proyecto', 50],
      ['Examen', 30],
      ['Asistencia', 20],
    ]);
    expect(resolver(3, 8).origen).toBe('GRUPO');
    expect(resolver(3, 8).criterios.map((item) => item.peso)).toEqual([60, 40]);
    expect(resolver(9, 8)).toEqual(
      expect.objectContaining({ origen: 'PREDETERMINADA', legado: 'GRUPO' }),
    );
    expect(resolver(9, 8).criterios.map((item) => item.peso)).toEqual([70, 30]);
    expect(resolver(5).legado).toBe('MATERIA');
    expect(resolver(3, 7)).toBe(unidad);
  });

  describe('validarListaCriterios', () => {
    const item = (
      nombre: string,
      tipo: TipoCriterio,
      peso: number,
      meta?: number | null,
    ) => ({ nombre, tipo, peso, meta });

    it('acepta una lista que suma 100', () => {
      expect(
        validarListaCriterios([
          item('Examen', TipoCriterio.EXAMEN, 40),
          item('Prácticas', TipoCriterio.PRACTICAS, 30),
          item('Asistencia', TipoCriterio.ASISTENCIA, 20),
          item('Participación', TipoCriterio.PARTICIPACION, 10, 5),
        ]),
      ).toBeNull();
    });

    it('rechaza sumas distintas de 100, nombres repetidos y metas fuera de lugar', () => {
      expect(
        validarListaCriterios([item('Examen', TipoCriterio.EXAMEN, 90)]),
      ).toMatch('ahora suman 90');
      expect(
        validarListaCriterios([
          item('Examen', TipoCriterio.EXAMEN, 50),
          item(' exámen ', TipoCriterio.EXAMEN, 50),
        ]),
      ).toMatch('mismo nombre');
      expect(
        validarListaCriterios([
          item('Asistencia', TipoCriterio.ASISTENCIA, 50),
          item('Lista', TipoCriterio.ASISTENCIA, 50),
        ]),
      ).toMatch('asistencia sólo puede aparecer una vez');
      expect(
        validarListaCriterios([
          item('Tareas', TipoCriterio.TAREAS, 90),
          item('Participación', TipoCriterio.PARTICIPACION, 10),
        ]),
      ).toMatch('necesita una meta');
      expect(
        validarListaCriterios([item('Tareas', TipoCriterio.TAREAS, 100, 5)]),
      ).toMatch('Sólo la participación lleva meta');
      expect(validarListaCriterios([])).toMatch('al menos un criterio');
    });
  });
});

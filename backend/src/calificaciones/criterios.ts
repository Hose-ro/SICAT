import { Prisma, TipoCriterio } from '@prisma/client';
import { PrismaService } from '../prisma.service';

type PrismaLike = PrismaService | Prisma.TransactionClient;

/**
 * Criterios de evaluación de una unidad. Cada criterio pesa una parte de la
 * calificación y todos suman 100. Los de actividad (tareas, prácticas,
 * examen…) promedian las actividades que lo llevan; asistencia y participación
 * salen del pase de lista.
 */
export type Criterio = {
  /** Identifica la columna aunque el criterio sea virtual. */
  clave: string;
  id: number | null;
  nombre: string;
  tipo: TipoCriterio;
  peso: number;
  /** Sólo participación: participaciones que valen 100 en la unidad. */
  meta: number | null;
  /** Criterio de la ponderación predeterminada, sin fila en el catálogo. */
  virtual: boolean;
};

export type OrigenCriterios = 'UNIDAD' | 'GRUPO' | 'PREDETERMINADA';

export type ListaCriterios = {
  origen: OrigenCriterios;
  /** En la predeterminada: si tareas/asistencia son del grupo o de la materia. */
  legado?: 'GRUPO' | 'MATERIA';
  criterios: Criterio[];
};

export type ValorCriterio = Criterio & {
  valor: number | null;
  calificadas: number;
  total: number;
  puntos?: number;
};

export type DatosUnidad = {
  actividades: Array<{
    tareaId: number;
    categoriaId: number | null;
    calificacion: number | null | undefined;
  }>;
  asistencia: {
    registradas: number;
    porcentaje: number;
    totalSesiones?: number;
  };
  participacion: { puntos: number; sesiones: number };
};

export const TIPOS_CALCULADOS: ReadonlySet<TipoCriterio> = new Set([
  TipoCriterio.ASISTENCIA,
  TipoCriterio.PARTICIPACION,
]);

export const esCriterioDeActividad = (tipo: TipoCriterio) =>
  !TIPOS_CALCULADOS.has(tipo);

export const MAX_CRITERIOS = 12;
export const META_MAXIMA = 100;

const ORDEN_CALCULADOS: Partial<Record<TipoCriterio, number>> = {
  [TipoCriterio.ASISTENCIA]: 1,
  [TipoCriterio.PARTICIPACION]: 2,
};

/** Las actividades primero, de mayor a menor peso; luego asistencia y participación. */
function ordenarCriterios(criterios: Criterio[]) {
  return [...criterios].sort(
    (a, b) =>
      (ORDEN_CALCULADOS[a.tipo] ?? 0) - (ORDEN_CALCULADOS[b.tipo] ?? 0) ||
      b.peso - a.peso ||
      (a.id ?? 0) - (b.id ?? 0),
  );
}

export function normalizarNombre(nombre: string) {
  return nombre.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Lista predeterminada de un grupo sin criterios propios: todas las
 * actividades por igual más la asistencia, con la ponderación del grupo o, si
 * no tiene, la de la materia. Da los mismos números que antes de los criterios.
 */
export function listaPredeterminada(
  pesoTareas: number,
  pesoAsistencia: number,
  legado: 'GRUPO' | 'MATERIA',
): ListaCriterios {
  return {
    origen: 'PREDETERMINADA',
    legado,
    criterios: [
      {
        clave: 'tareas',
        id: null,
        nombre: 'Tareas',
        tipo: TipoCriterio.TAREAS,
        peso: pesoTareas,
        meta: null,
        virtual: true,
      },
      {
        clave: 'asistencia',
        id: null,
        nombre: 'Asistencia',
        tipo: TipoCriterio.ASISTENCIA,
        peso: pesoAsistencia,
        meta: null,
        virtual: true,
      },
    ],
  };
}

type FilaPeso = { peso: number; meta: number | null };
type ItemCatalogo = {
  id: number;
  nombre: string;
  tipo: TipoCriterio;
  orden: number;
  pesos: Array<FilaPeso & { grupoId: number }>;
  pesosUnidad: Array<FilaPeso & { grupoId: number; unidadId: number }>;
};

const aCriterio = (item: ItemCatalogo, fila: FilaPeso): Criterio => ({
  clave: `c${item.id}`,
  id: item.id,
  nombre: item.nombre,
  tipo: item.tipo,
  peso: fila.peso,
  meta: item.tipo === TipoCriterio.PARTICIPACION ? (fila.meta ?? null) : null,
  virtual: false,
});

/**
 * Carga el catálogo de la materia y devuelve un resolvedor por grupo y unidad:
 * los porcentajes propios de la unidad, si los tiene; si no, la lista del
 * grupo; si el grupo no tiene, la predeterminada.
 */
export async function cargarCriterios(
  prisma: PrismaLike,
  materia: { id: number; pesoTareas: number; pesoAsistencia: number },
) {
  const [ponderaciones, items] = await Promise.all([
    prisma.ponderacionGrupo.findMany({ where: { materiaId: materia.id } }),
    prisma.categoriaEvaluacion.findMany({
      where: { materiaId: materia.id },
      include: {
        pesos: { select: { grupoId: true, peso: true, meta: true } },
        pesosUnidad: {
          select: { grupoId: true, unidadId: true, peso: true, meta: true },
        },
      },
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
    }),
  ]);
  return construirResolver(materia, ponderaciones, items);
}

export function construirResolver(
  materia: { pesoTareas: number; pesoAsistencia: number },
  ponderaciones: Array<{
    grupoId: number;
    pesoTareas: number;
    pesoAsistencia: number;
  }>,
  items: ItemCatalogo[],
) {
  const cache = new Map<string, ListaCriterios>();

  const listaDelGrupo = (grupoId: number): Criterio[] =>
    items.flatMap((item) =>
      item.pesos
        .filter((fila) => fila.grupoId === grupoId)
        .map((fila) => aCriterio(item, fila)),
    );

  const resolver = (
    grupoId?: number | null,
    unidadId?: number | null,
  ): ListaCriterios => {
    const llave = `${grupoId ?? '-'}:${unidadId ?? '-'}`;
    const guardada = cache.get(llave);
    if (guardada) return guardada;

    let lista: ListaCriterios | null = null;
    if (grupoId && unidadId) {
      const propios = items.flatMap((item) =>
        item.pesosUnidad
          .filter(
            (fila) => fila.grupoId === grupoId && fila.unidadId === unidadId,
          )
          .map((fila) => aCriterio(item, fila)),
      );
      if (propios.length) {
        lista = { origen: 'UNIDAD', criterios: ordenarCriterios(propios) };
      }
    }
    if (!lista && grupoId) {
      const delGrupo = listaDelGrupo(grupoId);
      if (delGrupo.length) {
        lista = { origen: 'GRUPO', criterios: ordenarCriterios(delGrupo) };
      }
    }
    if (!lista) {
      const propia = grupoId
        ? ponderaciones.find((item) => item.grupoId === grupoId)
        : undefined;
      lista = listaPredeterminada(
        propia?.pesoTareas ?? materia.pesoTareas,
        propia?.pesoAsistencia ?? materia.pesoAsistencia,
        propia ? 'GRUPO' : 'MATERIA',
      );
    }
    cache.set(llave, lista);
    return lista;
  };

  return {
    resolver,
    catalogo: items.map(({ id, nombre, tipo }) => ({ id, nombre, tipo })),
  };
}

const promedio = (valores: number[]) =>
  valores.length
    ? Number(
        (
          valores.reduce((suma, valor) => suma + valor, 0) / valores.length
        ).toFixed(2),
      )
    : null;

const numericas = (actividades: DatosUnidad['actividades']) =>
  actividades
    .map((item) => item.calificacion)
    .filter((valor): valor is number => typeof valor === 'number');

/**
 * Valor de cada criterio y calificación calculada de un alumno en una unidad.
 * La calificación es el promedio ponderado de los criterios que ya tienen
 * valor (el peso se reparte entre ellos). Lo que no tiene calificación no
 * cuenta como 0; un "no presentó" sí, porque se guarda con 0.
 */
export function calcularUnidad(lista: ListaCriterios, datos: DatosUnidad) {
  const idsActividad = new Set(
    lista.criterios
      .filter(
        (criterio) => !criterio.virtual && esCriterioDeActividad(criterio.tipo),
      )
      .map((criterio) => criterio.id),
  );

  const criterios: ValorCriterio[] = lista.criterios.map((criterio) => {
    if (criterio.tipo === TipoCriterio.ASISTENCIA) {
      return {
        ...criterio,
        valor:
          datos.asistencia.registradas > 0 ? datos.asistencia.porcentaje : null,
        calificadas: datos.asistencia.registradas,
        total: datos.asistencia.totalSesiones ?? datos.asistencia.registradas,
      };
    }
    if (criterio.tipo === TipoCriterio.PARTICIPACION) {
      const meta = criterio.meta && criterio.meta > 0 ? criterio.meta : null;
      const valor =
        meta && datos.participacion.sesiones > 0
          ? Number(
              Math.min(
                100,
                (Math.max(0, datos.participacion.puntos) / meta) * 100,
              ).toFixed(2),
            )
          : null;
      return {
        ...criterio,
        valor,
        calificadas: datos.participacion.sesiones,
        total: meta ?? 0,
        puntos: datos.participacion.puntos,
      };
    }
    const actividades = criterio.virtual
      ? datos.actividades
      : datos.actividades.filter((item) => item.categoriaId === criterio.id);
    const valores = numericas(actividades);
    return {
      ...criterio,
      valor: promedio(valores),
      calificadas: valores.length,
      total: actividades.length,
    };
  });

  let suma = 0;
  let pesoAplicado = 0;
  for (const criterio of criterios) {
    if (criterio.peso > 0 && criterio.valor != null) {
      suma += criterio.valor * criterio.peso;
      pesoAplicado += criterio.peso;
    }
  }

  // Promedio de las actividades, el que usan los reportes: en la predeterminada
  // es el de todas las tareas aunque pesen 0, como antes.
  let promedioTareas: number | null;
  if (lista.origen === 'PREDETERMINADA') {
    promedioTareas =
      criterios.find(
        (criterio) => criterio.virtual && criterio.tipo === TipoCriterio.TAREAS,
      )?.valor ?? null;
  } else {
    const conValor = criterios.filter(
      (criterio) =>
        esCriterioDeActividad(criterio.tipo) &&
        criterio.peso > 0 &&
        criterio.valor != null,
    );
    const pesoActividades = conValor.reduce((s, c) => s + c.peso, 0);
    promedioTareas = pesoActividades
      ? Number(
          (
            conValor.reduce((s, c) => s + (c.valor as number) * c.peso, 0) /
            pesoActividades
          ).toFixed(2),
        )
      : null;
  }

  return {
    criterios,
    promedioTareas,
    calificacionCalculada: pesoAplicado
      ? Math.round(suma / pesoAplicado)
      : null,
    sinCriterio:
      lista.origen === 'PREDETERMINADA'
        ? []
        : datos.actividades
            .filter((item) => !idsActividad.has(item.categoriaId))
            .map((item) => item.tareaId),
  };
}

export type CriterioEntrada = {
  nombre: string;
  tipo: TipoCriterio;
  peso: number;
  meta?: number | null;
};

/** Reglas de una lista de criterios. Devuelve el primer problema o null. */
export function validarListaCriterios(criterios: CriterioEntrada[]) {
  if (!criterios.length) return 'Agrega al menos un criterio';
  if (criterios.length > MAX_CRITERIOS) {
    return `Puedes tener hasta ${MAX_CRITERIOS} criterios`;
  }
  const nombres = criterios.map((item) => normalizarNombre(item.nombre));
  if (nombres.some((nombre) => !nombre)) {
    return 'Cada criterio necesita un nombre';
  }
  if (new Set(nombres).size !== nombres.length) {
    return 'Hay criterios con el mismo nombre';
  }
  for (const tipo of TIPOS_CALCULADOS) {
    if (criterios.filter((item) => item.tipo === tipo).length > 1) {
      return tipo === TipoCriterio.ASISTENCIA
        ? 'La asistencia sólo puede aparecer una vez'
        : 'La participación sólo puede aparecer una vez';
    }
  }
  if (
    criterios.some(
      (item) =>
        !Number.isInteger(item.peso) || item.peso < 1 || item.peso > 100,
    )
  ) {
    return 'Cada criterio pesa entre 1 y 100 %';
  }
  const suma = criterios.reduce((total, item) => total + item.peso, 0);
  if (suma !== 100) {
    return `Los criterios deben sumar 100 % (ahora suman ${suma} %)`;
  }
  for (const item of criterios) {
    const conMeta = item.meta != null;
    if (item.tipo === TipoCriterio.PARTICIPACION) {
      if (
        !conMeta ||
        !Number.isInteger(item.meta) ||
        (item.meta as number) < 1 ||
        (item.meta as number) > META_MAXIMA
      ) {
        return `La participación necesita una meta de 1 a ${META_MAXIMA} participaciones por unidad`;
      }
    } else if (conMeta) {
      return 'Sólo la participación lleva meta';
    }
  }
  return null;
}

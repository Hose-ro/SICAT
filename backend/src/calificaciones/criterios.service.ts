import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoUnidad, Prisma, TipoCriterio } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  asegurarAccesoMateria,
  gruposDelDocenteEnMateria,
} from '../common/materia-ownership';
import {
  TIPOS_CALCULADOS,
  construirResolver,
  normalizarNombre,
  validarListaCriterios,
  type Criterio,
} from './criterios';
import { GuardarCriteriosDto } from './dto/guardar-criterios.dto';

type Actor = { id: number; rol: string };

type ItemCatalogo = Prisma.CategoriaEvaluacionGetPayload<{
  include: { pesos: true; pesosUnidad: true };
}>;

type Fila = {
  categoriaId: number;
  tipo: TipoCriterio;
  peso: number;
  meta: number | null;
};

const vistaCriterio = ({ id, clave, nombre, tipo, peso, meta }: Criterio) => ({
  id,
  clave,
  nombre,
  tipo,
  peso,
  meta,
});

/**
 * Criterios de evaluación de un grupo: la lista de todas las unidades y los
 * porcentajes propios de alguna unidad. El catálogo es de la materia y lo
 * pueden compartir los docentes de varios grupos, así que cambiar el nombre o
 * el tipo de un criterio que otro grupo usa le da a este grupo su propia copia.
 */
@Injectable()
export class CriteriosService {
  constructor(private prisma: PrismaService) {}

  async obtener(actor: Actor, materiaId: number, grupoId: number) {
    await asegurarAccesoMateria(this.prisma, actor, materiaId, grupoId);
    const materia = await this.cargarMateria(materiaId, grupoId);
    const [items, ponderaciones, usos, grupos] = await Promise.all([
      this.prisma.categoriaEvaluacion.findMany({
        where: { materiaId },
        include: { pesos: true, pesosUnidad: true },
        orderBy: [{ orden: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.ponderacionGrupo.findMany({ where: { materiaId } }),
      this.usosEnTareas(this.prisma, materiaId),
      gruposDelDocenteEnMateria(this.prisma, materiaId, actor),
    ]);
    const { resolver } = construirResolver(materia, ponderaciones, items);
    const usadoFuera = this.usadoFuera(grupoId, usos);
    const base = resolver(grupoId);

    return {
      materiaId,
      grupoId,
      base: {
        origen: base.origen === 'GRUPO' ? 'GRUPO' : 'PREDETERMINADA',
        // Un 0 de la predeterminada (p. ej. asistencia 0 %) no es un criterio.
        criterios: base.criterios
          .filter((criterio) => !criterio.virtual || criterio.peso > 0)
          .map(vistaCriterio),
      },
      unidades: materia.unidades.map((unidad) => {
        const lista = resolver(grupoId, unidad.id);
        const personalizada = lista.origen === 'UNIDAD';
        return {
          unidad,
          personalizada,
          criterios: personalizada ? lista.criterios.map(vistaCriterio) : null,
        };
      }),
      catalogo: items.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        tipo: item.tipo,
        compartido: usadoFuera(item),
      })),
      gruposDelDocente: grupos.filter((grupo) => grupo.id !== grupoId),
    };
  }

  async guardar(actor: Actor, dto: GuardarCriteriosDto) {
    const entrada = dto.criterios.map((item) => ({
      id: item.id,
      nombre: item.nombre.trim(),
      tipo: item.tipo,
      peso: item.peso,
      meta: item.meta ?? null,
    }));
    const problema = validarListaCriterios(entrada);
    if (problema) throw new BadRequestException(problema);

    const { materiaId, grupoId } = dto;
    const unidadId = dto.unidadId ?? null;
    await asegurarAccesoMateria(this.prisma, actor, materiaId, grupoId);
    const materia = await this.cargarMateria(materiaId, grupoId);
    if (
      unidadId != null &&
      !materia.unidades.some((unidad) => unidad.id === unidadId)
    ) {
      throw new BadRequestException(
        'La unidad no pertenece a la materia seleccionada',
      );
    }

    const reasignadas = await this.prisma.$transaction(
      async (tx) => {
        const [items, usos, ponderacion] = await Promise.all([
          tx.categoriaEvaluacion.findMany({
            where: { materiaId },
            include: { pesos: true, pesosUnidad: true },
            orderBy: [{ orden: 'asc' }, { id: 'asc' }],
          }),
          this.usosEnTareas(tx, materiaId),
          tx.ponderacionGrupo.findUnique({
            where: { materiaId_grupoId: { materiaId, grupoId } },
          }),
        ]);
        const baseAnterior = items.filter((item) =>
          item.pesos.some((fila) => fila.grupoId === grupoId),
        );
        const teniaBase = baseAnterior.length > 0;
        if (unidadId != null && !teniaBase) {
          throw new ConflictException(
            'Primero guarda los criterios de todas las unidades; después puedes ajustar una unidad',
          );
        }

        const enBase = unidadId == null;
        const usadoFuera = this.usadoFuera(grupoId, usos);
        const tieneTareasEnGrupo = (categoriaId: number) =>
          usos.some(
            (uso) => uso.categoriaId === categoriaId && uso.grupoId === grupoId,
          );
        const porId = new Map(items.map((item) => [item.id, item]));
        const porNombre = new Map(
          items.map((item) => [normalizarNombre(item.nombre), item]),
        );
        const mover: Array<[number, number]> = [];
        const filas: Fila[] = [];

        for (const [indice, item] of entrada.entries()) {
          const actual = item.id ? porId.get(item.id) : undefined;
          if (item.id && !actual) {
            throw new BadRequestException(
              'El criterio no pertenece a la materia seleccionada',
            );
          }
          if (
            actual &&
            actual.tipo !== item.tipo &&
            TIPOS_CALCULADOS.has(item.tipo) &&
            tieneTareasEnGrupo(actual.id)
          ) {
            throw new BadRequestException(
              `«${actual.nombre}» ya tiene actividades; no puede ser asistencia ni participación`,
            );
          }
          const mismoNombre = porNombre.get(normalizarNombre(item.nombre));
          let destino: number;

          if (
            actual &&
            actual.nombre === item.nombre &&
            actual.tipo === item.tipo
          ) {
            destino = actual.id;
          } else if (mismoNombre && mismoNombre.id !== actual?.id) {
            // Ya hay un criterio con ese nombre en la materia: se usa ése.
            if (mismoNombre.tipo !== item.tipo) {
              throw new BadRequestException(
                `Ya existe el criterio «${mismoNombre.nombre}» con otro tipo en esta materia; usa otro nombre`,
              );
            }
            destino = mismoNombre.id;
            if (actual && enBase) mover.push([actual.id, destino]);
          } else if (actual && enBase && !usadoFuera(actual)) {
            // Sólo lo usa este grupo: se edita en su lugar.
            await tx.categoriaEvaluacion.update({
              where: { id: actual.id },
              data: { nombre: item.nombre, tipo: item.tipo },
            });
            destino = actual.id;
          } else {
            // Nuevo, o compartido con otro grupo: este grupo tiene su copia.
            destino = (
              await tx.categoriaEvaluacion.create({
                data: {
                  materiaId,
                  nombre: item.nombre,
                  tipo: item.tipo,
                  orden: indice,
                },
                select: { id: true },
              })
            ).id;
            if (actual && enBase) mover.push([actual.id, destino]);
          }

          if (filas.some((fila) => fila.categoriaId === destino)) {
            throw new BadRequestException('Hay criterios repetidos');
          }
          filas.push({
            categoriaId: destino,
            tipo: item.tipo,
            peso: item.peso,
            meta: item.tipo === TipoCriterio.PARTICIPACION ? item.meta : null,
          });
        }

        let reasignadasTx = 0;
        if (enBase) {
          for (const [de, a] of mover) {
            await this.moverDelGrupo(tx, materiaId, grupoId, de, a);
          }
          if (dto.conservarUnidadesCerradas !== false) {
            await this.congelarUnidadesCerradas(tx, {
              materia,
              grupoId,
              items,
              baseAnterior,
              ponderacion,
              filas,
            });
          }
          await tx.categoriaPesoGrupo.deleteMany({
            where: { grupoId, categoria: { materiaId } },
          });
          await tx.categoriaPesoGrupo.createMany({
            data: filas.map(({ categoriaId, peso, meta }) => ({
              categoriaId,
              grupoId,
              peso,
              meta,
            })),
          });
          // Primera lista propia: lo que el grupo calificaba como "tareas" sin
          // criterio pasa al único criterio de tareas, para que siga contando.
          const deTareas = filas.filter(
            (fila) => fila.tipo === TipoCriterio.TAREAS,
          );
          if (!teniaBase && deTareas.length === 1) {
            reasignadasTx = (
              await tx.tarea.updateMany({
                where: { materiaId, grupoId, categoriaId: null },
                data: { categoriaId: deTareas[0].categoriaId },
              })
            ).count;
          }
        } else {
          await tx.categoriaPesoUnidad.deleteMany({
            where: { grupoId, unidadId, categoria: { materiaId } },
          });
          await tx.categoriaPesoUnidad.createMany({
            data: filas.map(({ categoriaId, peso, meta }) => ({
              categoriaId,
              grupoId,
              unidadId,
              peso,
              meta,
            })),
          });
        }

        await this.borrarHuerfanos(tx, materiaId);
        return reasignadasTx;
      },
      { timeout: 20_000 },
    );

    return { ...(await this.obtener(actor, materiaId, grupoId)), reasignadas };
  }

  /**
   * El grupo vuelve a la ponderación predeterminada (todas las actividades por
   * igual más la asistencia): se borran su lista y los porcentajes propios de
   * cada unidad. Las actividades conservan su criterio por si se vuelve a armar.
   */
  async quitarTodos(actor: Actor, materiaId: number, grupoId: number) {
    await asegurarAccesoMateria(this.prisma, actor, materiaId, grupoId);
    await this.cargarMateria(materiaId, grupoId);
    await this.prisma.$transaction(async (tx) => {
      await tx.categoriaPesoUnidad.deleteMany({
        where: { grupoId, categoria: { materiaId } },
      });
      await tx.categoriaPesoGrupo.deleteMany({
        where: { grupoId, categoria: { materiaId } },
      });
      await this.borrarHuerfanos(tx, materiaId);
    });
    return this.obtener(actor, materiaId, grupoId);
  }

  /** La unidad vuelve a usar los criterios de todas las unidades. */
  async quitarUnidad(
    actor: Actor,
    materiaId: number,
    grupoId: number,
    unidadId: number,
  ) {
    await asegurarAccesoMateria(this.prisma, actor, materiaId, grupoId);
    const materia = await this.cargarMateria(materiaId, grupoId);
    if (!materia.unidades.some((unidad) => unidad.id === unidadId)) {
      throw new BadRequestException(
        'La unidad no pertenece a la materia seleccionada',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.categoriaPesoUnidad.deleteMany({
        where: { grupoId, unidadId, categoria: { materiaId } },
      });
      await this.borrarHuerfanos(tx, materiaId);
    });
    return this.obtener(actor, materiaId, grupoId);
  }

  private async cargarMateria(materiaId: number, grupoId: number) {
    const materia = await this.prisma.materia.findUnique({
      where: { id: materiaId },
      select: {
        id: true,
        pesoTareas: true,
        pesoAsistencia: true,
        grupos: { where: { id: grupoId }, select: { id: true } },
        unidades: {
          select: { id: true, nombre: true, orden: true, status: true },
          orderBy: { orden: 'asc' },
        },
      },
    });
    if (!materia) throw new NotFoundException('Materia no encontrada');
    if (!materia.grupos.length) {
      throw new BadRequestException(
        'El grupo no esta vinculado a la materia seleccionada',
      );
    }
    return materia;
  }

  private usosEnTareas(
    prisma: PrismaService | Prisma.TransactionClient,
    materiaId: number,
  ) {
    return prisma.tarea.groupBy({
      by: ['categoriaId', 'grupoId'],
      where: { materiaId, categoriaId: { not: null } },
      _count: { _all: true },
    });
  }

  /** Lo pesa otro grupo o lo llevan tareas de otro grupo (o de ninguno). */
  private usadoFuera(
    grupoId: number,
    usos: Array<{ categoriaId: number | null; grupoId: number | null }>,
  ) {
    return (item: ItemCatalogo) =>
      item.pesos.some((fila) => fila.grupoId !== grupoId) ||
      item.pesosUnidad.some((fila) => fila.grupoId !== grupoId) ||
      usos.some(
        (uso) => uso.categoriaId === item.id && uso.grupoId !== grupoId,
      );
  }

  /** Las tareas y los porcentajes por unidad de este grupo pasan a otro criterio. */
  private async moverDelGrupo(
    tx: Prisma.TransactionClient,
    materiaId: number,
    grupoId: number,
    de: number,
    a: number,
  ) {
    await tx.tarea.updateMany({
      where: { materiaId, grupoId, categoriaId: de },
      data: { categoriaId: a },
    });
    const ajustes = await tx.categoriaPesoUnidad.findMany({
      where: { categoriaId: de, grupoId },
    });
    for (const ajuste of ajustes) {
      await tx.categoriaPesoUnidad.upsert({
        where: {
          categoriaId_grupoId_unidadId: {
            categoriaId: a,
            grupoId,
            unidadId: ajuste.unidadId,
          },
        },
        create: { ...ajuste, categoriaId: a },
        update: {},
      });
    }
    await tx.categoriaPesoUnidad.deleteMany({
      where: { categoriaId: de, grupoId },
    });
  }

  /**
   * Las unidades finalizadas sin porcentajes propios se califican con la lista
   * que tenían. Antes de cambiarla se copia a cada una, para que una unidad
   * cerrada no cambie de calificación.
   */
  private async congelarUnidadesCerradas(
    tx: Prisma.TransactionClient,
    datos: {
      materia: Awaited<ReturnType<CriteriosService['cargarMateria']>>;
      grupoId: number;
      items: ItemCatalogo[];
      baseAnterior: ItemCatalogo[];
      ponderacion: { pesoTareas: number; pesoAsistencia: number } | null;
      filas: Fila[];
    },
  ) {
    const { materia, grupoId, items } = datos;
    const conAjuste = new Set(
      items.flatMap((item) =>
        item.pesosUnidad
          .filter((fila) => fila.grupoId === grupoId)
          .map((fila) => fila.unidadId),
      ),
    );
    const cerradas = materia.unidades.filter(
      (unidad) =>
        unidad.status === EstadoUnidad.FINALIZADA && !conAjuste.has(unidad.id),
    );
    if (!cerradas.length) return;

    let anterior: Array<{
      categoriaId: number;
      peso: number;
      meta: number | null;
    }>;
    if (datos.baseAnterior.length) {
      anterior = datos.baseAnterior.flatMap((item) =>
        item.pesos
          .filter((fila) => fila.grupoId === grupoId)
          .map((fila) => ({
            categoriaId: item.id,
            peso: fila.peso,
            meta: fila.meta,
          })),
      );
    } else {
      // Venían de la ponderación predeterminada: hace falta un criterio real
      // de tareas (con las actividades sin criterio de esas unidades) y otro
      // de asistencia.
      const pesoTareas = datos.ponderacion?.pesoTareas ?? materia.pesoTareas;
      const pesoAsistencia =
        datos.ponderacion?.pesoAsistencia ?? materia.pesoAsistencia;
      anterior = [];
      if (pesoTareas > 0) {
        const tareasId = await this.criterioPara(
          tx,
          materia.id,
          TipoCriterio.TAREAS,
          'Tareas',
          items,
          datos.filas,
        );
        anterior.push({ categoriaId: tareasId, peso: pesoTareas, meta: null });
        await tx.tarea.updateMany({
          where: {
            materiaId: materia.id,
            grupoId,
            categoriaId: null,
            OR: [
              { unidadId: { in: cerradas.map((unidad) => unidad.id) } },
              {
                unidadId: null,
                unidad: { in: cerradas.map((unidad) => unidad.orden) },
              },
            ],
          },
          data: { categoriaId: tareasId },
        });
      }
      if (pesoAsistencia > 0) {
        const asistenciaId = await this.criterioPara(
          tx,
          materia.id,
          TipoCriterio.ASISTENCIA,
          'Asistencia',
          items,
          datos.filas,
        );
        anterior.push({
          categoriaId: asistenciaId,
          peso: pesoAsistencia,
          meta: null,
        });
      }
    }
    if (!anterior.length) return;
    await tx.categoriaPesoUnidad.createMany({
      data: cerradas.flatMap((unidad) =>
        anterior.map((fila) => ({ ...fila, grupoId, unidadId: unidad.id })),
      ),
      skipDuplicates: true,
    });
  }

  /** Un criterio del tipo pedido: el de la nueva lista, uno del catálogo o uno nuevo. */
  private async criterioPara(
    tx: Prisma.TransactionClient,
    materiaId: number,
    tipo: TipoCriterio,
    nombre: string,
    items: ItemCatalogo[],
    filas: Fila[],
  ) {
    const enLista = filas.find((fila) => fila.tipo === tipo);
    if (enLista) return enLista.categoriaId;
    const delCatalogo =
      items.find(
        (item) =>
          item.tipo === tipo &&
          normalizarNombre(item.nombre) === normalizarNombre(nombre),
      ) ?? items.find((item) => item.tipo === tipo);
    if (delCatalogo) return delCatalogo.id;
    const ocupado = items.some(
      (item) => normalizarNombre(item.nombre) === normalizarNombre(nombre),
    );
    const creado = await tx.categoriaEvaluacion.create({
      data: {
        materiaId,
        nombre: ocupado ? `${nombre} (antes)` : nombre,
        tipo,
        orden: 999,
      },
      select: { id: true },
    });
    return creado.id;
  }

  /** Lo que ya no pesa en ningún grupo ni unidad ni clasifica tareas sobra. */
  private borrarHuerfanos(tx: Prisma.TransactionClient, materiaId: number) {
    return tx.categoriaEvaluacion.deleteMany({
      where: {
        materiaId,
        pesos: { none: {} },
        pesosUnidad: { none: {} },
        tareas: { none: {} },
      },
    });
  }
}

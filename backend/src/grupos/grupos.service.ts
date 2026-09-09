import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Prisma, Rol } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { CreateGrupoDto } from './dto/create-grupo.dto';
import { UpdateGrupoDto } from './dto/update-grupo.dto';
import { hayConflictoHorario } from '../horarios/utils/conflicto-horario.util';
import { HorariosService } from '../horarios/horarios.service';
import { unidadesIniciales } from '../common/unidades.util';
import {
  normalizeControlNumber,
  normalizeEmail,
  normalizeName,
  normalizePhone,
} from '../common/identity-normalization';
import { CrearAlumnoGrupoDto } from './dto/crear-alumno-grupo.dto';
import { ImportarAlumnosGrupoDto } from './dto/importar-alumnos-grupo.dto';
import { CompletarAlumnoGrupoDto } from './dto/completar-alumno-grupo.dto';

const SECCIONES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** El nombre del grupo lo escribe el administrador: se guarda normalizado. */
function normalizarNombreGrupo(nombre: string) {
  return nombre.trim().replace(/\s+/g, ' ').toUpperCase();
}

const INCLUDE_LIST = {
  carrera: { select: { id: true, nombre: true, codigo: true } },
  _count: { select: { alumnos: true, materias: true } },
};

const INCLUDE_DETAIL = {
  carrera: { select: { id: true, nombre: true, codigo: true } },
  alumnos: {
    select: { id: true, nombre: true, numeroControl: true, email: true },
    where: { activo: true },
  },
  materias: {
    select: {
      id: true,
      nombre: true,
      clave: true,
      dias: true,
      horaInicio: true,
      horaFin: true,
      semestre: true,
      docente: { select: { id: true, nombre: true } },
      aula: { select: { id: true, nombre: true } },
    },
  },
};

type GrupoDocentePayload = Prisma.GrupoGetPayload<{
  include: {
    carrera: { select: { id: true; nombre: true; codigo: true } };
    docentes: { select: { id: true } };
    _count: { select: { alumnos: true; materias: true } };
    horarios: {
      select: {
        dias: true;
        horaInicio: true;
        horaFin: true;
        aula: { select: { id: true; nombre: true } };
        materia: {
          select: {
            id: true;
            nombre: true;
            clave: true;
            unidades: {
              select: { id: true; nombre: true; orden: true; status: true };
            };
          };
        };
      };
    };
  };
}>;

@Injectable()
export class GruposService {
  constructor(
    private prisma: PrismaService,
    private horarios: HorariosService,
    private usuarios: UsuariosService,
  ) {}

  // ─── Crear grupo ────────────────────────────────────────────────────────────

  async crearGrupo(dto: CreateGrupoDto) {
    const carrera = await this.prisma.carrera.findUnique({
      where: { id: dto.carreraId },
    });
    if (!carrera) throw new NotFoundException('Carrera no encontrada');

    const nombre = normalizarNombreGrupo(dto.nombre);

    const existe = await this.prisma.grupo.findFirst({
      where: { nombre, periodo: dto.periodo },
    });
    if (existe)
      throw new ConflictException(
        `Ya existe el grupo "${nombre}" en el periodo ${dto.periodo}`,
      );

    const seccion = await this.resolverSeccion(nombre, dto, carrera.nombre);

    // Obtener materias del catálogo de retícula para este semestre/carrera
    const reticulaMaterias = await this.prisma.reticulaMateria.findMany({
      where: { semestre: dto.semestre, carreraId: dto.carreraId, activo: true },
    });

    // Auto-crear Materia records que aún no existan (sin horario ni docente asignados)
    for (const rm of reticulaMaterias) {
      const existente = await this.prisma.materia.findFirst({
        where: { clave: rm.clave, carreraId: dto.carreraId },
      });
      if (!existente) {
        await this.prisma.materia.create({
          data: {
            nombre: rm.nombre,
            clave: rm.clave,
            semestre: rm.semestre,
            carreraId: dto.carreraId,
            horaInicio: '00:00',
            horaFin: '00:00',
            dias: '',
            numUnidades: 3,
            unidades: { create: unidadesIniciales(3) },
          },
        });
      }
    }

    const claves = reticulaMaterias.map((r) => r.clave);
    const secciones = await this.prisma.materia.findMany({
      where: { clave: { in: claves }, carreraId: dto.carreraId },
    });

    return this.prisma.grupo.create({
      data: {
        nombre,
        semestre: dto.semestre,
        seccion,
        carreraId: dto.carreraId,
        periodo: dto.periodo,
        materias: {
          connect: secciones.map((m) => ({ id: m.id })),
        },
      },
      include: INCLUDE_DETAIL,
    });
  }

  /**
   * La sección ya no se captura: se toma de la última letra del nombre
   * (103A → A) y, si esa letra está ocupada o el nombre no termina en letra,
   * se asigna la primera libre de ese semestre, carrera y periodo. Sigue
   * sirviendo para emparejar al alumno que sube su horario.
   */
  private async resolverSeccion(
    nombre: string,
    dto: CreateGrupoDto,
    carreraNombre: string,
  ) {
    const clave = {
      semestre: dto.semestre,
      carreraId: dto.carreraId,
      periodo: dto.periodo,
    };

    if (dto.seccion) {
      await this.ensureSeccionLibre(
        { ...clave, seccion: dto.seccion },
        carreraNombre,
      );
      return dto.seccion;
    }

    const ocupadas = await this.prisma.grupo.findMany({
      where: clave,
      select: { seccion: true },
    });
    const tomadas = new Set(ocupadas.map((grupo) => grupo.seccion));

    // Sólo se interpreta como sección la letra final que sigue a un número,
    // como en 103A; en un nombre como "GRUPO NUEVO" la última letra no lo es.
    const sufijo = /[0-9]([A-Z])$/.exec(nombre)?.[1];
    if (sufijo && !tomadas.has(sufijo)) return sufijo;

    const libre = SECCIONES.find((letra) => !tomadas.has(letra));
    if (!libre) {
      throw new ConflictException(
        `El semestre ${dto.semestre} de ${carreraNombre} ya tiene 26 grupos en el periodo ${dto.periodo}`,
      );
    }
    return libre;
  }

  /**
   * La base sólo admite una sección por semestre, carrera y periodo, aunque el
   * nombre del grupo ahora sea libre.
   */
  private async ensureSeccionLibre(
    clave: {
      semestre: number;
      seccion: string;
      carreraId: number;
      periodo: string;
    },
    carreraNombre: string,
    excluirGrupoId?: number,
  ) {
    const ocupada = await this.prisma.grupo.findFirst({
      where: {
        ...clave,
        ...(excluirGrupoId ? { id: { not: excluirGrupoId } } : {}),
      },
      select: { nombre: true },
    });
    if (ocupada) {
      throw new ConflictException(
        `La sección ${clave.seccion} del semestre ${clave.semestre} de ${carreraNombre} ya la ocupa el grupo "${ocupada.nombre}" en el periodo ${clave.periodo}`,
      );
    }
  }

  // ─── Listar grupos ──────────────────────────────────────────────────────────

  listarGrupos(filtros: {
    carreraId?: number;
    semestre?: number;
    periodo?: string;
  }) {
    return this.prisma.grupo.findMany({
      where: {
        activo: true,
        ...(filtros.carreraId && { carreraId: filtros.carreraId }),
        ...(filtros.semestre && { semestre: filtros.semestre }),
        ...(filtros.periodo && { periodo: filtros.periodo }),
      },
      include: INCLUDE_LIST,
      orderBy: [{ semestre: 'asc' }, { nombre: 'asc' }],
    });
  }

  /**
   * Sólo lo necesario para elegir grupo al programar una clase: sin alumnos ni
   * materias, de modo que el docente no vea más de lo que necesita.
   */
  listarCatalogo(filtros: {
    carreraId?: number;
    semestre?: number;
    periodo?: string;
  }) {
    return this.prisma.grupo.findMany({
      where: {
        activo: true,
        ...(filtros.carreraId && { carreraId: filtros.carreraId }),
        ...(filtros.semestre && { semestre: filtros.semestre }),
        ...(filtros.periodo && { periodo: filtros.periodo }),
      },
      select: {
        id: true,
        nombre: true,
        semestre: true,
        seccion: true,
        periodo: true,
        carreraId: true,
        carrera: { select: { id: true, nombre: true, codigo: true } },
      },
      orderBy: [{ semestre: 'asc' }, { nombre: 'asc' }],
    });
  }

  // ─── Mis grupos (docente) ───────────────────────────────────────────────────

  /**
   * Un grupo llega a "Mis grupos" por dos caminos: porque el docente tiene un
   * horario activo en él o porque lo agregó a mano desde el catálogo. El
   * segundo existe para el docente que todavía no tiene horario cargado y aun
   * así necesita ver a su grupo.
   */
  private gruposDelDocenteWhere(docenteId: number): Prisma.GrupoWhereInput {
    return {
      activo: true,
      OR: [
        { docentes: { some: { id: docenteId } } },
        { horarios: { some: { docenteId, activo: true } } },
      ],
    };
  }

  private incluirParaDocente(docenteId: number) {
    return {
      carrera: { select: { id: true, nombre: true, codigo: true } },
      docentes: { where: { id: docenteId }, select: { id: true } },
      _count: { select: { alumnos: true, materias: true } },
      horarios: {
        where: { docenteId, activo: true },
        select: {
          dias: true,
          horaInicio: true,
          horaFin: true,
          aula: { select: { id: true, nombre: true } },
          materia: {
            select: {
              id: true,
              nombre: true,
              clave: true,
              unidades: {
                orderBy: { orden: 'asc' as const },
                select: { id: true, nombre: true, orden: true, status: true },
              },
            },
          },
        },
      },
    };
  }

  /**
   * `agregado` distingue el grupo que el docente puede quitar de su lista del
   * que viene de su horario, que sólo desaparece si se lo reprograman.
   */
  private formatearParaDocente(grupo: GrupoDocentePayload) {
    const { docentes, horarios, ...resto } = grupo;

    // Una materia puede ocupar varios bloques del horario con el mismo grupo,
    // así que se agrupan bajo la materia en vez de repetirla.
    const porMateria = new Map<
      number,
      {
        id: number;
        nombre: string;
        clave: string;
        unidadActiva: { id: number; nombre: string; orden: number } | null;
        horarios: Array<{
          dias: string;
          horaInicio: string;
          horaFin: string;
          aula: { id: number; nombre: string } | null;
        }>;
      }
    >();

    for (const bloque of horarios) {
      const { unidades, ...materia } = bloque.materia;
      if (!porMateria.has(materia.id)) {
        const activa = unidades.find((unidad) => unidad.status === 'ACTIVA');
        porMateria.set(materia.id, {
          ...materia,
          unidadActiva: activa
            ? { id: activa.id, nombre: activa.nombre, orden: activa.orden }
            : null,
          horarios: [],
        });
      }
      porMateria.get(materia.id)?.horarios.push({
        dias: bloque.dias,
        horaInicio: bloque.horaInicio,
        horaFin: bloque.horaFin,
        aula: bloque.aula,
      });
    }

    const materias = [...porMateria.values()].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es'),
    );
    return { ...resto, agregado: docentes.length > 0, materias };
  }

  async listarGruposDocente(docenteId: number) {
    const grupos = await this.prisma.grupo.findMany({
      where: this.gruposDelDocenteWhere(docenteId),
      include: this.incluirParaDocente(docenteId),
      orderBy: [{ semestre: 'asc' }, { nombre: 'asc' }],
    });
    return grupos.map((grupo) => this.formatearParaDocente(grupo));
  }

  async obtenerGrupoDocente(id: number, docenteId: number) {
    const grupo = await this.prisma.grupo.findFirst({
      where: { ...this.gruposDelDocenteWhere(docenteId), id },
      include: {
        ...this.incluirParaDocente(docenteId),
        alumnos: {
          where: { activo: true },
          select: { id: true, nombre: true, numeroControl: true, email: true },
          orderBy: { nombre: 'asc' },
        },
      },
    });
    if (!grupo) {
      throw new NotFoundException('Grupo no encontrado entre tus grupos');
    }
    const { alumnos, ...resto } = grupo;
    return { ...this.formatearParaDocente(resto), alumnos };
  }

  async agregarGrupoDocente(docenteId: number, grupoId: number) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
      select: { id: true, nombre: true, activo: true },
    });
    if (!grupo || !grupo.activo)
      throw new NotFoundException('Grupo no encontrado');

    const yaEsMio = await this.prisma.grupo.count({
      where: { id: grupoId, docentes: { some: { id: docenteId } } },
    });
    if (yaEsMio) {
      throw new ConflictException(
        `El grupo "${grupo.nombre}" ya está en tus grupos`,
      );
    }

    await this.prisma.grupo.update({
      where: { id: grupoId },
      data: { docentes: { connect: { id: docenteId } } },
    });

    return this.obtenerGrupoDocente(grupoId, docenteId);
  }

  /**
   * Sólo se suelta el vínculo que el docente creó: si el grupo sigue en su
   * horario continúa apareciendo en la lista, porque ahí no lo puso él.
   */
  async quitarGrupoDocente(docenteId: number, grupoId: number) {
    const agregado = await this.prisma.grupo.count({
      where: { id: grupoId, docentes: { some: { id: docenteId } } },
    });
    if (!agregado) {
      throw new NotFoundException('Ese grupo no lo agregaste a tus grupos');
    }

    await this.prisma.grupo.update({
      where: { id: grupoId },
      data: { docentes: { disconnect: { id: docenteId } } },
    });
    return { ok: true };
  }

  // ─── Alumnos de mis grupos (docente) ────────────────────────────────────────

  private async asegurarGrupoDelDocente(grupoId: number, docenteId: number) {
    const grupo = await this.prisma.grupo.findFirst({
      where: { ...this.gruposDelDocenteWhere(docenteId), id: grupoId },
      select: { id: true, nombre: true, carreraId: true, semestre: true },
    });
    if (!grupo) {
      throw new NotFoundException('Grupo no encontrado entre tus grupos');
    }
    return grupo;
  }

  /**
   * Alumnos de la carrera del grupo que todavía no están en él. Se devuelve
   * también el grupo actual de cada uno para que el docente vea por qué no
   * puede agregar a los que ya tienen uno.
   */
  async buscarAlumnosParaGrupo(
    grupoId: number,
    docenteId: number,
    busqueda?: string,
  ) {
    const grupo = await this.asegurarGrupoDelDocente(grupoId, docenteId);
    const texto = busqueda?.trim();

    return this.prisma.usuario.findMany({
      where: {
        rol: Rol.ALUMNO,
        activo: true,
        carreraId: grupo.carreraId,
        AND: [
          // `NOT: { grupoId }` dejaría fuera a los que no tienen grupo, que
          // son justo los que el docente puede agregar.
          { OR: [{ grupoId: null }, { grupoId: { not: grupoId } }] },
          ...(texto
            ? [
                {
                  OR: [
                    {
                      nombre: { contains: texto, mode: 'insensitive' as const },
                    },
                    {
                      numeroControl: {
                        contains: texto,
                        mode: 'insensitive' as const,
                      },
                    },
                  ],
                },
              ]
            : []),
        ],
      },
      select: {
        id: true,
        nombre: true,
        numeroControl: true,
        semestre: true,
        grupo: { select: { id: true, nombre: true } },
      },
      orderBy: { nombre: 'asc' },
      take: 50,
    });
  }

  async agregarAlumnosAMiGrupo(
    grupoId: number,
    docenteId: number,
    alumnoIds: number[],
  ) {
    await this.asegurarGrupoDelDocente(grupoId, docenteId);
    await this.asignarAlumnos(grupoId, alumnoIds);
    return this.obtenerGrupoDocente(grupoId, docenteId);
  }

  /** Da de alta la cuenta y la deja en el grupo, con su carrera y semestre. */
  async crearAlumnoEnMiGrupo(
    grupoId: number,
    docenteId: number,
    dto: CrearAlumnoGrupoDto,
  ) {
    const grupo = await this.asegurarGrupoDelDocente(grupoId, docenteId);

    const alumno = await this.usuarios.create({
      nombre: dto.nombre,
      numeroControl: dto.numeroControl,
      password: dto.password,
      email: dto.email,
      telefono: dto.telefono,
      carreraId: grupo.carreraId,
      semestre: grupo.semestre,
      rol: Rol.ALUMNO,
    });

    await this.prisma.usuario.update({
      where: { id: alumno.id },
      data: { grupoId },
    });

    return alumno;
  }

  /**
   * Alta masiva desde la lista que el docente sube (Excel/CSV). Igual que la
   * importación por materia, sólo el nombre es obligatorio y quien ya existe
   * se vincula en lugar de duplicarse; lo que cambia es el destino: aquí el
   * alumno queda en el grupo.
   */
  async importarAlumnosAMiGrupo(
    grupoId: number,
    docenteId: number,
    dto: ImportarAlumnosGrupoDto,
  ) {
    const grupo = await this.asegurarGrupoDelDocente(grupoId, docenteId);

    const resultado = {
      creados: 0,
      vinculados: 0,
      yaEnGrupo: 0,
      errores: [] as { nombre: string; motivo: string }[],
    };

    for (const fila of dto.alumnos) {
      const nombre = normalizeName(fila.nombre ?? '');
      if (!nombre) {
        resultado.errores.push({ nombre: fila.nombre, motivo: 'Nombre vacío' });
        continue;
      }
      const numeroControl = fila.numeroControl
        ? normalizeControlNumber(fila.numeroControl)
        : undefined;
      const email = fila.email ? normalizeEmail(fila.email) : undefined;
      const telefono = fila.telefono
        ? normalizePhone(fila.telefono)
        : undefined;

      try {
        const existente =
          numeroControl || email
            ? await this.prisma.usuario.findFirst({
                where: {
                  OR: [
                    numeroControl
                      ? {
                          numeroControl: {
                            equals: numeroControl,
                            mode: 'insensitive' as const,
                          },
                        }
                      : undefined,
                    email
                      ? {
                          email: {
                            equals: email,
                            mode: 'insensitive' as const,
                          },
                        }
                      : undefined,
                  ].filter(
                    (clausula): clausula is NonNullable<typeof clausula> =>
                      Boolean(clausula),
                  ),
                },
                select: {
                  id: true,
                  rol: true,
                  grupoId: true,
                  carreraId: true,
                  grupo: { select: { nombre: true } },
                },
              })
            : null;

        if (existente) {
          if (existente.rol !== Rol.ALUMNO) {
            resultado.errores.push({
              nombre,
              motivo:
                'Ese número de control o correo ya pertenece a un usuario que no es alumno',
            });
            continue;
          }
          if (existente.grupoId === grupoId) {
            resultado.yaEnGrupo += 1;
            continue;
          }
          if (existente.grupoId) {
            resultado.errores.push({
              nombre,
              motivo: `Ya está en el grupo ${existente.grupo?.nombre ?? existente.grupoId}`,
            });
            continue;
          }
          if (existente.carreraId !== grupo.carreraId) {
            resultado.errores.push({
              nombre,
              motivo: 'Pertenece a otra carrera',
            });
            continue;
          }

          await this.prisma.usuario.update({
            where: { id: existente.id },
            data: { grupoId },
          });
          resultado.vinculados += 1;
          continue;
        }

        // Sin cuenta previa: se crea con una contraseña aleatoria, igual que
        // en la importación por materia, y el alumno la restablece después.
        const hash = await bcrypt.hash(randomBytes(24).toString('hex'), 12);
        await this.prisma.usuario.create({
          data: {
            nombre,
            numeroControl,
            email,
            telefono,
            password: hash,
            rol: Rol.ALUMNO,
            carreraId: grupo.carreraId,
            semestre: grupo.semestre,
            grupoId,
          },
          select: { id: true },
        });
        resultado.creados += 1;
      } catch {
        resultado.errores.push({
          nombre,
          motivo: 'No se pudo registrar (dato duplicado o inválido)',
        });
      }
    }

    return resultado;
  }

  /** Quita al alumno de mi grupo sin tocar su cuenta: queda sin grupo. */
  async quitarAlumnoDeMiGrupo(
    grupoId: number,
    docenteId: number,
    alumnoId: number,
  ) {
    await this.asegurarGrupoDelDocente(grupoId, docenteId);

    const alumno = await this.prisma.usuario.findUnique({
      where: { id: alumnoId },
    });
    if (!alumno || alumno.grupoId !== grupoId) {
      throw new NotFoundException('El alumno no pertenece a este grupo');
    }

    await this.prisma.usuario.update({
      where: { id: alumnoId },
      data: { grupoId: null },
    });
    return { ok: true };
  }

  /**
   * Quita de golpe a varios alumnos del grupo. Se ignora en silencio a quien
   * ya no esté en el grupo: la lista del docente pudo cambiar entre que
   * seleccionó y confirmó, y eso no es motivo para tumbar la operación
   * completa.
   */
  async quitarAlumnosDeMiGrupo(
    grupoId: number,
    docenteId: number,
    alumnoIds: number[],
  ) {
    await this.asegurarGrupoDelDocente(grupoId, docenteId);

    const ids = [...new Set(alumnoIds)];
    if (ids.length === 0) return { quitados: 0 };

    const { count } = await this.prisma.usuario.updateMany({
      where: { id: { in: ids }, grupoId, rol: Rol.ALUMNO },
      data: { grupoId: null },
    });
    return { quitados: count };
  }

  /**
   * Completa o corrige los datos de un alumno de mi grupo (por ejemplo uno
   * importado sólo con el nombre). Sólo alcanza a quien ya está en el grupo,
   * igual que el resto de las acciones de este bloque.
   */
  async actualizarAlumnoDeMiGrupo(
    grupoId: number,
    docenteId: number,
    alumnoId: number,
    dto: CompletarAlumnoGrupoDto,
  ) {
    await this.asegurarGrupoDelDocente(grupoId, docenteId);

    const alumno = await this.prisma.usuario.findUnique({
      where: { id: alumnoId },
    });
    if (!alumno || alumno.grupoId !== grupoId) {
      throw new NotFoundException('El alumno no pertenece a este grupo');
    }

    const nombre = dto.nombre ? normalizeName(dto.nombre) : undefined;
    const numeroControl = dto.numeroControl
      ? normalizeControlNumber(dto.numeroControl)
      : undefined;
    const email = dto.email ? normalizeEmail(dto.email) : undefined;
    const telefono = dto.telefono ? normalizePhone(dto.telefono) : undefined;

    if (numeroControl || email) {
      const conflicto = await this.prisma.usuario.findFirst({
        where: {
          id: { not: alumnoId },
          OR: [
            numeroControl
              ? {
                  numeroControl: {
                    equals: numeroControl,
                    mode: 'insensitive' as const,
                  },
                }
              : undefined,
            email
              ? { email: { equals: email, mode: 'insensitive' as const } }
              : undefined,
          ].filter((clausula): clausula is NonNullable<typeof clausula> =>
            Boolean(clausula),
          ),
        },
        select: { id: true },
      });
      if (conflicto) {
        throw new ConflictException(
          'Ese número de control o correo ya pertenece a otro usuario',
        );
      }
    }

    const password = dto.password
      ? await bcrypt.hash(dto.password, 12)
      : undefined;

    return this.prisma.usuario.update({
      where: { id: alumnoId },
      data: {
        nombre,
        numeroControl,
        email,
        telefono,
        password,
        tokenVersion: password ? { increment: 1 } : undefined,
      },
      select: {
        id: true,
        nombre: true,
        numeroControl: true,
        email: true,
        telefono: true,
      },
    });
  }

  // ─── Detalle de grupo ───────────────────────────────────────────────────────

  async obtenerGrupo(id: number) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id },
      include: INCLUDE_DETAIL,
    });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    return grupo;
  }

  // ─── Editar grupo ───────────────────────────────────────────────────────────

  async editarGrupo(id: number, dto: UpdateGrupoDto) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id },
      include: { carrera: true },
    });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');

    const nuevoNombre = dto.nombre
      ? normalizarNombreGrupo(dto.nombre)
      : grupo.nombre;
    const nuevaSeccion = dto.seccion ?? grupo.seccion;
    const nuevoPeriodo = dto.periodo ?? grupo.periodo;

    if (nuevoNombre !== grupo.nombre || nuevoPeriodo !== grupo.periodo) {
      const existe = await this.prisma.grupo.findFirst({
        where: { nombre: nuevoNombre, periodo: nuevoPeriodo, id: { not: id } },
      });
      if (existe) {
        throw new ConflictException(
          `Ya existe el grupo "${nuevoNombre}" en el periodo ${nuevoPeriodo}`,
        );
      }
    }

    if (nuevaSeccion !== grupo.seccion || nuevoPeriodo !== grupo.periodo) {
      await this.ensureSeccionLibre(
        {
          semestre: grupo.semestre,
          seccion: nuevaSeccion,
          carreraId: grupo.carreraId,
          periodo: nuevoPeriodo,
        },
        grupo.carrera.nombre,
        id,
      );
    }

    return this.prisma.grupo.update({
      where: { id },
      data: {
        ...(dto.nombre && { nombre: nuevoNombre }),
        ...(dto.seccion && { seccion: dto.seccion }),
        ...(dto.periodo && { periodo: dto.periodo }),
      },
      include: INCLUDE_DETAIL,
    });
  }

  // ─── Eliminar grupo (soft delete) ──────────────────────────────────────────

  async eliminarGrupo(id: number) {
    const grupo = await this.prisma.grupo.findUnique({ where: { id } });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    return this.prisma.grupo.update({ where: { id }, data: { activo: false } });
  }

  // ─── Eliminar grupo (definitivo) ───────────────────────────────────────────

  /**
   * Borra el grupo y sus bloques de horario, que sólo existen para él. Los
   * alumnos quedan sin grupo y el historial académico se conserva a nivel de
   * materia: sesiones de clase, tareas, calificaciones e importaciones sólo
   * pierden la referencia al grupo.
   */
  async eliminarGrupoDefinitivo(id: number) {
    const grupo = await this.prisma.grupo.findUnique({ where: { id } });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');

    return this.prisma.$transaction(async (tx) => {
      const alumnos = await tx.usuario.updateMany({
        where: { grupoId: id },
        data: { grupoId: null },
      });
      const horarios = await tx.horarioMateria.deleteMany({
        where: { grupoId: id },
      });
      const sesiones = await tx.claseSesion.updateMany({
        where: { grupoId: id },
        data: { grupoId: null },
      });
      const tareas = await tx.tarea.updateMany({
        where: { grupoId: id },
        data: { grupoId: null },
      });
      const calificaciones = await tx.calificacionUnidad.updateMany({
        where: { grupoId: id },
        data: { grupoId: null },
      });
      const importaciones = await tx.importacionHorario.updateMany({
        where: { grupoId: id },
        data: { grupoId: null },
      });
      const eliminado = await tx.grupo.delete({ where: { id } });

      return {
        ...eliminado,
        horariosEliminados: horarios.count,
        liberados: {
          alumnos: alumnos.count,
          sesiones: sesiones.count,
          tareas: tareas.count,
          calificaciones: calificaciones.count,
          importaciones: importaciones.count,
        },
      };
    });
  }

  /**
   * Borrado definitivo en lote: reusa eliminarGrupoDefinitivo por cada id,
   * uno por uno, para que un id inválido no tumbe a los demás.
   */
  async eliminarGruposDefinitivo(ids: number[]) {
    const unicos = [...new Set(ids)];
    const errores: { id: number; motivo: string }[] = [];
    let eliminados = 0;
    for (const id of unicos) {
      try {
        await this.eliminarGrupoDefinitivo(id);
        eliminados += 1;
      } catch (error) {
        errores.push({
          id,
          motivo:
            error instanceof Error ? error.message : 'No se pudo eliminar',
        });
      }
    }
    return { eliminados, errores };
  }

  // ─── Asignar alumnos ────────────────────────────────────────────────────────

  async asignarAlumnos(grupoId: number, alumnoIds: number[]) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
    });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');

    const alumnos = await this.prisma.usuario.findMany({
      where: { id: { in: alumnoIds } },
    });

    const noAlumnos = alumnos.filter((a) => a.rol !== 'ALUMNO');
    if (noAlumnos.length > 0) {
      throw new BadRequestException(
        `Los siguientes usuarios no tienen rol ALUMNO: ${noAlumnos.map((a) => a.nombre).join(', ')}`,
      );
    }

    const deOtraCarrera = alumnos.filter(
      (a) => a.carreraId !== grupo.carreraId,
    );
    if (deOtraCarrera.length > 0) {
      throw new BadRequestException(
        `Los siguientes alumnos no pertenecen a la carrera del grupo: ${deOtraCarrera.map((a) => a.nombre).join(', ')}`,
      );
    }

    const yaEnOtroGrupo = alumnos.filter(
      (a) => a.grupoId !== null && a.grupoId !== grupoId,
    );
    if (yaEnOtroGrupo.length > 0) {
      throw new ConflictException(
        `Los siguientes alumnos ya están en otro grupo: ${yaEnOtroGrupo.map((a) => a.nombre).join(', ')}`,
      );
    }

    await this.prisma.usuario.updateMany({
      where: { id: { in: alumnoIds } },
      data: { grupoId },
    });

    return this.obtenerGrupo(grupoId);
  }

  // ─── Quitar alumno ──────────────────────────────────────────────────────────

  async quitarAlumno(grupoId: number, alumnoId: number) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
    });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');

    const alumno = await this.prisma.usuario.findUnique({
      where: { id: alumnoId },
    });
    if (!alumno || alumno.grupoId !== grupoId) {
      throw new NotFoundException('El alumno no pertenece a este grupo');
    }

    await this.prisma.usuario.update({
      where: { id: alumnoId },
      data: { grupoId: null },
    });
    return this.obtenerGrupo(grupoId);
  }

  // ─── Listar alumnos del grupo ───────────────────────────────────────────────

  async getAlumnos(grupoId: number) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
      include: {
        alumnos: {
          select: { id: true, nombre: true, numeroControl: true, email: true },
          where: { activo: true },
        },
      },
    });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    return grupo.alumnos;
  }

  // ─── Agregar materias ───────────────────────────────────────────────────────

  async agregarMaterias(grupoId: number, materiaIds: number[]) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
      include: { materias: true },
    });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');

    const materias = await this.prisma.materia.findMany({
      where: { id: { in: materiaIds } },
    });
    if (materias.length !== materiaIds.length) {
      throw new BadRequestException('Una o más materias no fueron encontradas');
    }

    // El grupo cursa un semestre concreto. Sólo se revisan las materias que
    // llegan en esta petición: las ya asignadas se conservan como estén.
    const deOtroSemestre = materias.filter(
      (materia) =>
        materia.semestre != null && materia.semestre !== grupo.semestre,
    );
    if (deOtroSemestre.length) {
      throw new BadRequestException(
        `El grupo ${grupo.nombre} es de ${grupo.semestre}° semestre y estas materias no lo son: ${deOtroSemestre
          .map((materia) => `${materia.nombre} (${materia.semestre}°)`)
          .join(', ')}.`,
      );
    }

    // Validar conflictos de horario con las materias ya asignadas al grupo
    for (const nueva of materias) {
      for (const existente of grupo.materias) {
        if (
          nueva.id !== existente.id &&
          hayConflictoHorario(nueva, existente)
        ) {
          throw new ConflictException(
            `Conflicto de horario: "${nueva.nombre}" (${nueva.dias} ${nueva.horaInicio}-${nueva.horaFin}) ` +
              `choca con "${existente.nombre}" (${existente.dias} ${existente.horaInicio}-${existente.horaFin})`,
          );
        }
      }
    }

    return this.prisma.grupo.update({
      where: { id: grupoId },
      data: { materias: { connect: materiaIds.map((id) => ({ id })) } },
      include: INCLUDE_DETAIL,
    });
  }

  // ─── Quitar materia ─────────────────────────────────────────────────────────

  async quitarMateria(grupoId: number, materiaId: number) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
      include: { materias: { where: { id: materiaId }, select: { id: true } } },
    });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    if (grupo.materias.length === 0) {
      throw new NotFoundException('La materia no pertenece a este grupo');
    }

    return this.prisma.grupo.update({
      where: { id: grupoId },
      data: { materias: { disconnect: { id: materiaId } } },
      include: INCLUDE_DETAIL,
    });
  }

  // ─── Listar materias del grupo ──────────────────────────────────────────────

  async getMaterias(grupoId: number) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
      include: {
        materias: {
          select: {
            id: true,
            nombre: true,
            clave: true,
            dias: true,
            horaInicio: true,
            horaFin: true,
            semestre: true,
            docente: { select: { id: true, nombre: true } },
            aula: { select: { id: true, nombre: true } },
          },
        },
      },
    });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    return grupo.materias;
  }

  // ─── Horario del grupo ──────────────────────────────────────────────────────

  async obtenerHorario(grupoId: number) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
      include: {
        carrera: { select: { id: true, nombre: true } },
        materias: {
          include: {
            docente: { select: { id: true, nombre: true } },
            aula: { select: { id: true, nombre: true } },
          },
          orderBy: { horaInicio: 'asc' },
        },
      },
    });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    return grupo;
  }

  // ─── Estado de la retícula para un grupo ───────────────────────────────────
  // Devuelve las materias de la retícula del semestre/carrera del grupo,
  // cada una con estado: ASIGNADA | DISPONIBLE | FALTANTE

  async asignarAula(
    grupoId: number,
    aulaId: number | null,
    horarioId?: number,
  ) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
    });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');

    return this.horarios.asignarAulaGrupo(grupoId, aulaId, horarioId);
  }

  async getReticulaStatus(grupoId: number) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
      include: { materias: { select: { id: true, clave: true } } },
    });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');

    const reticulaMaterias = await this.prisma.reticulaMateria.findMany({
      where: {
        semestre: grupo.semestre,
        carreraId: grupo.carreraId,
        activo: true,
      },
      orderBy: { nombre: 'asc' },
    });

    const clavesEnGrupo = new Set(grupo.materias.map((m) => m.clave));
    const idsEnGrupo = new Set(grupo.materias.map((m) => m.id));

    const result = await Promise.all(
      reticulaMaterias.map(async (rm) => {
        const materia = await this.prisma.materia.findFirst({
          where: { clave: rm.clave, carreraId: grupo.carreraId },
          select: {
            id: true,
            nombre: true,
            clave: true,
            horaInicio: true,
            horaFin: true,
            dias: true,
            docenteId: true,
          },
        });
        let estado: 'ASIGNADA' | 'DISPONIBLE' | 'FALTANTE' = 'FALTANTE';
        if (materia) {
          estado = idsEnGrupo.has(materia.id) ? 'ASIGNADA' : 'DISPONIBLE';
        }
        return {
          reticulaId: rm.id,
          clave: rm.clave,
          nombre: rm.nombre,
          semestre: rm.semestre,
          horasTeoria: rm.horasTeoria,
          horasPractica: rm.horasPractica,
          creditos: rm.creditos,
          estado,
          materiaId: materia?.id ?? null,
        };
      }),
    );

    return result;
  }

  // ─── Validar conflicto de grupo (usado por módulo de horarios) ──────────────

  async validarConflictoGrupo(materiaId: number): Promise<void> {
    const materia = await this.prisma.materia.findUnique({
      where: { id: materiaId },
      include: {
        grupos: {
          include: {
            materias: { where: { id: { not: materiaId } } },
          },
        },
      },
    });
    if (!materia) return;

    for (const grupo of materia.grupos) {
      for (const otraMateria of grupo.materias) {
        if (hayConflictoHorario(materia, otraMateria)) {
          throw new ConflictException(
            `Conflicto de grupo: el grupo "${grupo.nombre}" ya tiene "${otraMateria.nombre}" ` +
              `(${otraMateria.dias} ${otraMateria.horaInicio}-${otraMateria.horaFin})`,
          );
        }
      }
    }
  }
}

import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { SolicitarInscripcionDto } from './dto/solicitar-inscripcion.dto';
import { InscribirAlumnosDto } from './dto/inscribir-alumnos.dto';
import { CrearAlumnoInscripcionDto } from './dto/crear-alumno-inscripcion.dto';
import { ImportarAlumnosDto } from './dto/importar-alumnos.dto';
import { CompletarAlumnoDto } from './dto/completar-alumno.dto';
import { Rol, TipoNotificacion } from '@prisma/client';
import { normalizeAcademicPeriod } from '../common/periodo.util';
import {
  ActorMateria,
  asegurarAccesoMateria,
  materiasDelDocenteWhere,
} from '../common/materia-ownership';
import {
  normalizeName,
  normalizeEmail,
  normalizeControlNumber,
  normalizePhone,
} from '../common/identity-normalization';

@Injectable()
export class InscripcionesService {
  constructor(
    private prisma: PrismaService,
    private notificaciones: NotificacionesService,
    private usuarios: UsuariosService,
  ) {}

  async solicitar(alumnoId: number, dto: SolicitarInscripcionDto) {
    const periodo = normalizeAcademicPeriod(dto.periodo);
    const existe = await this.prisma.inscripcion.findUnique({
      where: {
        alumnoId_materiaId_periodo: {
          alumnoId,
          materiaId: dto.materiaId,
          periodo,
        },
      },
    });
    if (existe)
      throw new ConflictException(
        'Ya existe una solicitud para esta materia en este periodo',
      );

    const materia = await this.prisma.materia.findUnique({
      where: { id: dto.materiaId },
      include: { docente: true },
    });
    if (!materia) throw new NotFoundException('Materia no encontrada');

    const inscripcion = await this.prisma.inscripcion.create({
      data: { alumnoId, materiaId: dto.materiaId, periodo },
    });

    const alumno = await this.prisma.usuario.findUnique({
      where: { id: alumnoId },
    });

    if (materia.docenteId) {
      await this.notificaciones.crear({
        usuarioId: materia.docenteId,
        tipo: TipoNotificacion.SOLICITUD_MATERIA,
        titulo: 'Nueva solicitud de inscripción',
        mensaje: `${alumno?.nombre ?? 'Un alumno'} solicita inscribirse a ${materia.nombre}`,
        referenciaId: inscripcion.id,
        referenciaTipo: 'Solicitud',
      });
    }

    return inscripcion;
  }

  async obtenerMisSolicitudes(alumnoId: number) {
    return this.prisma.inscripcion.findMany({
      where: { alumnoId },
      include: { materia: { include: { docente: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async obtenerPendientes(docenteId: number) {
    return this.prisma.inscripcion.findMany({
      // La materia puede ser suya por asignación directa o por horario activo.
      where: {
        estado: 'PENDIENTE',
        materia: materiasDelDocenteWhere(docenteId),
      },
      include: { alumno: true, materia: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async aceptar(id: number, docenteId: number) {
    const inscripcion = await this.prisma.inscripcion.findUnique({
      where: { id },
      include: { materia: true },
    });
    if (!inscripcion) throw new NotFoundException('Inscripción no encontrada');
    await asegurarAccesoMateria(
      this.prisma,
      { id: docenteId, rol: 'DOCENTE' },
      inscripcion.materiaId,
    );
    if (inscripcion.estado !== 'PENDIENTE')
      throw new ConflictException('La solicitud ya fue procesada');

    const updated = await this.prisma.inscripcion.update({
      where: { id },
      data: { estado: 'ACEPTADA' },
    });

    await this.notificaciones.crear({
      usuarioId: inscripcion.alumnoId,
      tipo: TipoNotificacion.SOLICITUD_ACEPTADA,
      titulo: 'Inscripción aceptada',
      mensaje: `Tu inscripción a ${inscripcion.materia.nombre} fue aceptada`,
      referenciaId: id,
      referenciaTipo: 'Solicitud',
    });

    return updated;
  }

  async rechazar(id: number, docenteId: number) {
    const inscripcion = await this.prisma.inscripcion.findUnique({
      where: { id },
      include: { materia: true },
    });
    if (!inscripcion) throw new NotFoundException('Inscripción no encontrada');
    await asegurarAccesoMateria(
      this.prisma,
      { id: docenteId, rol: 'DOCENTE' },
      inscripcion.materiaId,
    );
    if (inscripcion.estado !== 'PENDIENTE')
      throw new ConflictException('La solicitud ya fue procesada');

    const updated = await this.prisma.inscripcion.update({
      where: { id },
      data: { estado: 'RECHAZADA' },
    });

    await this.notificaciones.crear({
      usuarioId: inscripcion.alumnoId,
      tipo: TipoNotificacion.SOLICITUD_RECHAZADA,
      titulo: 'Inscripción rechazada',
      mensaje: `Tu inscripción a ${inscripcion.materia.nombre} fue rechazada`,
      referenciaId: id,
      referenciaTipo: 'Solicitud',
    });

    return updated;
  }

  async obtenerAlumnosMateria(materiaId: number, actor: ActorMateria) {
    await asegurarAccesoMateria(this.prisma, actor, materiaId);

    return this.prisma.inscripcion.findMany({
      where: { materiaId, estado: 'ACEPTADA' },
      include: { alumno: true, grupo: { select: { id: true, nombre: true } } },
      orderBy: { alumno: { nombre: 'asc' } },
    });
  }

  /**
   * Alumnos activos de la carrera de la materia que aún no están inscritos.
   * Evita abrir el listado completo de usuarios a los docentes.
   */
  async buscarAlumnosDisponibles(
    materiaId: number,
    actor: ActorMateria,
    busqueda?: string,
  ) {
    await asegurarAccesoMateria(this.prisma, actor, materiaId);

    const materia = await this.prisma.materia.findUnique({
      where: { id: materiaId },
      select: { carreraId: true },
    });
    if (!materia) throw new NotFoundException('Materia no encontrada');

    const inscritos = await this.prisma.inscripcion.findMany({
      where: { materiaId, estado: 'ACEPTADA' },
      select: { alumnoId: true },
    });

    const texto = busqueda?.trim();
    return this.prisma.usuario.findMany({
      where: {
        rol: Rol.ALUMNO,
        activo: true,
        id: { notIn: inscritos.map((item) => item.alumnoId) },
        ...(materia.carreraId ? { carreraId: materia.carreraId } : {}),
        ...(texto
          ? {
              OR: [
                { nombre: { contains: texto, mode: 'insensitive' } },
                { numeroControl: { contains: texto, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        nombre: true,
        numeroControl: true,
        semestre: true,
        sexo: true,
        grupoId: true,
        grupo: { select: { id: true, nombre: true } },
      },
      orderBy: { nombre: 'asc' },
      take: 50,
    });
  }

  /**
   * Inscribe alumnos existentes en la materia del docente. Reactiva las
   * solicitudes rechazadas y omite a quien ya estaba inscrito, para que
   * repetir la acción no falle.
   */
  async inscribirAlumnos(
    materiaId: number,
    dto: InscribirAlumnosDto,
    actor: ActorMateria,
  ) {
    await asegurarAccesoMateria(this.prisma, actor, materiaId, dto.grupoId);

    const materia = await this.prisma.materia.findUnique({
      where: { id: materiaId },
      select: { id: true, nombre: true },
    });
    if (!materia) throw new NotFoundException('Materia no encontrada');

    const alumnos = await this.prisma.usuario.findMany({
      where: { id: { in: dto.alumnoIds }, rol: Rol.ALUMNO, activo: true },
      select: { id: true, nombre: true },
    });
    if (alumnos.length !== dto.alumnoIds.length) {
      throw new BadRequestException(
        'Uno o más alumnos no existen, no están activos o no tienen rol ALUMNO',
      );
    }

    const periodo = normalizeAcademicPeriod();
    const resultado = { inscritos: 0, reactivados: 0, yaInscritos: 0 };

    for (const alumno of alumnos) {
      const existente = await this.prisma.inscripcion.findUnique({
        where: {
          alumnoId_materiaId_periodo: {
            alumnoId: alumno.id,
            materiaId,
            periodo,
          },
        },
        select: { id: true, estado: true },
      });

      if (existente?.estado === 'ACEPTADA') {
        resultado.yaInscritos += 1;
        continue;
      }

      if (existente) {
        await this.prisma.inscripcion.update({
          where: { id: existente.id },
          data: { estado: 'ACEPTADA', grupoId: dto.grupoId ?? null },
        });
        resultado.reactivados += 1;
      } else {
        await this.prisma.inscripcion.create({
          data: {
            alumnoId: alumno.id,
            materiaId,
            periodo,
            estado: 'ACEPTADA',
            grupoId: dto.grupoId ?? null,
          },
        });
        resultado.inscritos += 1;
      }

      await this.notificaciones.crear({
        usuarioId: alumno.id,
        tipo: TipoNotificacion.INSCRIPCION_ACEPTADA,
        titulo: 'Te inscribieron a una materia',
        mensaje: `Ya formas parte de ${materia.nombre}.`,
        referenciaId: materiaId,
        referenciaTipo: 'Materia',
      });
    }

    return resultado;
  }

  /**
   * Da de alta la cuenta del alumno y lo inscribe en la misma operación. La
   * cuenta se crea con el servicio de usuarios, que ya valida los datos del
   * alumno y cifra la contraseña.
   */
  async crearAlumnoEInscribir(
    materiaId: number,
    dto: CrearAlumnoInscripcionDto,
    actor: ActorMateria,
  ) {
    await asegurarAccesoMateria(this.prisma, actor, materiaId, dto.grupoId);

    const materia = await this.prisma.materia.findUnique({
      where: { id: materiaId },
      select: { id: true, carreraId: true, semestre: true },
    });
    if (!materia) throw new NotFoundException('Materia no encontrada');

    const grupo = dto.grupoId
      ? await this.prisma.grupo.findUnique({
          where: { id: dto.grupoId },
          select: { id: true, carreraId: true, semestre: true },
        })
      : null;

    const carreraId = dto.carreraId ?? grupo?.carreraId ?? materia.carreraId;
    const semestre = dto.semestre ?? grupo?.semestre ?? materia.semestre;
    if (!carreraId || !semestre) {
      throw new BadRequestException(
        'Indica la carrera y el semestre del alumno: la materia no los tiene definidos',
      );
    }

    const alumno = await this.usuarios.create({
      nombre: dto.nombre,
      numeroControl: dto.numeroControl,
      password: dto.password,
      email: dto.email,
      telefono: dto.telefono,
      carreraId,
      semestre,
      rol: Rol.ALUMNO,
    });

    await this.inscribirAlumnos(
      materiaId,
      { alumnoIds: [alumno.id], grupoId: dto.grupoId },
      actor,
    );

    return alumno;
  }

  /**
   * Alta masiva desde un archivo (Excel/CSV) que el docente sube con la lista
   * del grupo. El único dato obligatorio por fila es el nombre: si el archivo
   * no trae número de control, correo o teléfono, el alumno queda dado de
   * alta con esos campos vacíos para completarlos después desde el padrón.
   * Si el número de control o correo ya pertenece a un alumno existente, se
   * le inscribe en lugar de crear una cuenta duplicada.
   */
  async importarAlumnos(
    materiaId: number,
    dto: ImportarAlumnosDto,
    actor: ActorMateria,
  ) {
    await asegurarAccesoMateria(this.prisma, actor, materiaId, dto.grupoId);

    const materia = await this.prisma.materia.findUnique({
      where: { id: materiaId },
      select: { id: true, nombre: true, carreraId: true, semestre: true },
    });
    if (!materia) throw new NotFoundException('Materia no encontrada');

    const grupo = dto.grupoId
      ? await this.prisma.grupo.findUnique({
          where: { id: dto.grupoId },
          select: { id: true, carreraId: true, semestre: true },
        })
      : null;

    const carreraId = grupo?.carreraId ?? materia.carreraId;
    const semestre = grupo?.semestre ?? materia.semestre;
    if (!carreraId || !semestre) {
      throw new BadRequestException(
        'Indica el grupo del alumno: la materia no tiene carrera o semestre definidos',
      );
    }

    const periodo = normalizeAcademicPeriod();
    const resultado = {
      creados: 0,
      vinculados: 0,
      yaInscritos: 0,
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
                select: { id: true, rol: true },
              })
            : null;

        let alumnoId: number;
        if (existente) {
          if (existente.rol !== Rol.ALUMNO) {
            resultado.errores.push({
              nombre,
              motivo:
                'Ese número de control o correo ya pertenece a un usuario que no es alumno',
            });
            continue;
          }
          alumnoId = existente.id;
          resultado.vinculados += 1;
        } else {
          const password = randomBytes(24).toString('hex');
          const hash = await bcrypt.hash(password, 12);
          const creado = await this.prisma.usuario.create({
            data: {
              nombre,
              numeroControl,
              email,
              telefono,
              password: hash,
              rol: Rol.ALUMNO,
              carreraId,
              semestre,
            },
            select: { id: true },
          });
          alumnoId = creado.id;
          resultado.creados += 1;
        }

        const yaInscrito = await this.prisma.inscripcion.findUnique({
          where: {
            alumnoId_materiaId_periodo: { alumnoId, materiaId, periodo },
          },
          select: { id: true, estado: true },
        });
        if (yaInscrito?.estado === 'ACEPTADA') {
          resultado.yaInscritos += 1;
        } else if (yaInscrito) {
          await this.prisma.inscripcion.update({
            where: { id: yaInscrito.id },
            data: { estado: 'ACEPTADA', grupoId: dto.grupoId ?? null },
          });
        } else {
          await this.prisma.inscripcion.create({
            data: {
              alumnoId,
              materiaId,
              periodo,
              estado: 'ACEPTADA',
              grupoId: dto.grupoId ?? null,
            },
          });
        }
      } catch {
        resultado.errores.push({
          nombre,
          motivo: 'No se pudo registrar (dato duplicado o inválido)',
        });
      }
    }

    return resultado;
  }

  /**
   * Completa o corrige los datos de un alumno del padrón de la materia (por
   * ejemplo, uno importado sólo con el nombre). Sólo puede tocar alumnos que
   * ya están inscritos en una materia del docente, para no abrir edición
   * sobre cualquier usuario del sistema.
   */
  async completarDatosAlumno(
    materiaId: number,
    alumnoId: number,
    dto: CompletarAlumnoDto,
    actor: ActorMateria,
  ) {
    await asegurarAccesoMateria(this.prisma, actor, materiaId);

    const inscripcion = await this.prisma.inscripcion.findFirst({
      where: { materiaId, alumnoId, estado: { not: 'RECHAZADA' } },
      select: { id: true },
    });
    if (!inscripcion) {
      throw new NotFoundException('El alumno no está inscrito en esta materia');
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
        sexo: dto.sexo,
        password,
        tokenVersion: password ? { increment: 1 } : undefined,
      },
      select: {
        id: true,
        nombre: true,
        numeroControl: true,
        email: true,
        telefono: true,
        sexo: true,
      },
    });
  }

  /** Retira al alumno del padrón de la materia sin tocar su cuenta. */
  async darDeBaja(materiaId: number, alumnoId: number, actor: ActorMateria) {
    await asegurarAccesoMateria(this.prisma, actor, materiaId);

    const inscripciones = await this.prisma.inscripcion.findMany({
      where: { materiaId, alumnoId, estado: { not: 'RECHAZADA' } },
      select: { id: true },
    });
    if (inscripciones.length === 0) {
      throw new NotFoundException('El alumno no está inscrito en esta materia');
    }

    await this.prisma.inscripcion.updateMany({
      where: { id: { in: inscripciones.map((item) => item.id) } },
      data: { estado: 'RECHAZADA' },
    });

    return { dadosDeBaja: inscripciones.length };
  }

  async obtenerMisMaterias(alumnoId: number, periodo?: string) {
    const periodoNormalizado = normalizeAcademicPeriod(periodo);
    return this.prisma.inscripcion.findMany({
      where: {
        alumnoId,
        estado: 'ACEPTADA',
        periodo: periodoNormalizado,
      },
      include: { materia: { include: { docente: true } } },
    });
  }
}

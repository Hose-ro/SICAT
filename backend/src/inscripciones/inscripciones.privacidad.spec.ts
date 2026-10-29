import { PrismaService } from '../prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { InscripcionesService } from './inscripciones.service';

// Relaciones de estos modelos que apuntan a Usuario.
const RELACIONES_USUARIO = new Set(['alumno', 'docente', 'usuario']);
const PROHIBIDOS = [
  'password',
  'tokenVersion',
  'failedLoginAttempts',
  'lockedUntil',
];

/**
 * Recorre los argumentos de una consulta de Prisma y devuelve las rutas donde
 * un Usuario viaja completo (`true` o sin `select`) o con campos sensibles.
 */
function usuariosExpuestos(args: unknown, ruta = ''): string[] {
  if (!args || typeof args !== 'object') return [];
  const hallazgos: string[] = [];
  for (const [clave, valor] of Object.entries(
    args as Record<string, unknown>,
  )) {
    if (clave === 'where' || clave === 'orderBy' || clave === 'data') continue;
    const aqui = ruta ? `${ruta}.${clave}` : clave;
    if (RELACIONES_USUARIO.has(clave)) {
      const select = (valor as { select?: Record<string, unknown> })?.select;
      if (valor === true || !select) hallazgos.push(`${aqui} sin select`);
      else
        PROHIBIDOS.filter((campo) => select[campo]).forEach((campo) =>
          hallazgos.push(`${aqui}.${campo}`),
        );
    }
    hallazgos.push(...usuariosExpuestos(valor, aqui));
  }
  return hallazgos;
}

/** Argumentos de la n-ésima llamada a un mock de Prisma. */
const argsDe = (fn: jest.Mock, n = 0): unknown =>
  (fn.mock.calls as unknown[][])[n][0];

describe('InscripcionesService no devuelve datos sensibles de Usuario', () => {
  const inscripcionFindMany = jest.fn().mockResolvedValue([]);
  const inscripcionFindUnique = jest.fn().mockResolvedValue(null);
  const inscripcionCreate = jest.fn().mockResolvedValue({ id: 1 });
  const materiaFindUnique = jest
    .fn()
    .mockResolvedValue({ id: 4, nombre: 'Redes', docenteId: 7 });
  const usuarioFindUnique = jest
    .fn()
    .mockResolvedValue({ nombre: 'Ana López' });

  const prisma = {
    materia: {
      count: jest.fn().mockResolvedValue(1),
      findUnique: materiaFindUnique,
    },
    horarioMateria: { count: jest.fn().mockResolvedValue(1) },
    usuario: { findUnique: usuarioFindUnique },
    inscripcion: {
      findMany: inscripcionFindMany,
      findUnique: inscripcionFindUnique,
      create: inscripcionCreate,
    },
  } as unknown as PrismaService;
  const notificaciones = {
    crear: jest.fn(),
  } as unknown as NotificacionesService;
  const service = new InscripcionesService(
    prisma,
    notificaciones,
    {} as UsuariosService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('detecta un Usuario completo (la prueba de la prueba)', () => {
    expect(usuariosExpuestos({ include: { alumno: true } })).toEqual([
      'include.alumno sin select',
    ]);
    expect(
      usuariosExpuestos({
        include: {
          materia: { include: { docente: { select: { password: true } } } },
        },
      }),
    ).toEqual(['include.materia.include.docente.password']);
    expect(usuariosExpuestos({ where: { alumno: { grupoId: 1 } } })).toEqual(
      [],
    );
  });

  it('las solicitudes pendientes del docente no traen el hash del alumno', async () => {
    await service.obtenerPendientes(7);
    expect(usuariosExpuestos(argsDe(inscripcionFindMany))).toEqual([]);
  });

  it('las solicitudes y materias del alumno no traen el hash del docente', async () => {
    await service.obtenerMisSolicitudes(20);
    await service.obtenerMisMaterias(20);
    for (const [args] of inscripcionFindMany.mock.calls)
      expect(usuariosExpuestos(args)).toEqual([]);
  });

  it('la lista de alumnos de una materia no trae hashes', async () => {
    await service.obtenerAlumnosMateria(4, { id: 7, rol: 'DOCENTE' } as never);
    expect(usuariosExpuestos(argsDe(inscripcionFindMany))).toEqual([]);
  });

  it('solicitar inscripción sólo lee el nombre del alumno', async () => {
    await service.solicitar(20, { materiaId: 4, periodo: '2026-B' } as never);
    expect((argsDe(usuarioFindUnique) as { select: unknown }).select).toEqual({
      nombre: true,
    });
    expect(usuariosExpuestos(argsDe(materiaFindUnique))).toEqual([]);
  });
});

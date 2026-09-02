import { PrismaClient, Rol } from '@prisma/client';

const prisma = new PrismaClient();

const ISC = {
  nombre: 'Ingeniería en Sistemas Computacionales',
  codigo: '06',
  plan: 'ISIC-2010-224',
};

interface MateriaReticula {
  nombre: string;
  clave: string;
  semestre: number;
  ht: number;
  hp: number;
  cr: number;
}

const RETICULA_ISC: MateriaReticula[] = [
  // Semestre 1
  { nombre: 'Cálculo Diferencial', clave: 'ACF-0901', semestre: 1, ht: 3, hp: 2, cr: 5 },
  { nombre: 'Fundamentos de Programación', clave: 'AED-1285', semestre: 1, ht: 2, hp: 3, cr: 5 },
  { nombre: 'Taller de Ética', clave: 'ACA-0907', semestre: 1, ht: 0, hp: 4, cr: 4 },
  { nombre: 'Matemáticas Discretas', clave: 'AEF-1041', semestre: 1, ht: 3, hp: 2, cr: 5 },
  { nombre: 'Taller de Administración', clave: 'SCH-1024', semestre: 1, ht: 1, hp: 3, cr: 4 },
  { nombre: 'Fundamentos de Investigación', clave: 'ACC-0906', semestre: 1, ht: 2, hp: 2, cr: 4 },
  { nombre: 'Actividades Complementarias', clave: 'ISC-AC-01', semestre: 1, ht: 0, hp: 0, cr: 1 },

  // Semestre 2
  { nombre: 'Cálculo Integral', clave: 'ACF-0902', semestre: 2, ht: 3, hp: 2, cr: 5 },
  { nombre: 'Programación Orientada a Objetos', clave: 'AED-1286', semestre: 2, ht: 2, hp: 3, cr: 5 },
  { nombre: 'Contabilidad Financiera', clave: 'AEC-1008', semestre: 2, ht: 2, hp: 2, cr: 4 },
  { nombre: 'Química', clave: 'AEC-1058', semestre: 2, ht: 2, hp: 2, cr: 4 },
  { nombre: 'Álgebra Lineal', clave: 'ACF-0903', semestre: 2, ht: 3, hp: 2, cr: 5 },
  { nombre: 'Probabilidad y Estadística', clave: 'AEF-1052', semestre: 2, ht: 3, hp: 2, cr: 5 },
  { nombre: 'Actividades Complementarias', clave: 'ISC-AC-02', semestre: 2, ht: 0, hp: 0, cr: 1 },

  // Semestre 3
  { nombre: 'Cálculo Vectorial', clave: 'ACF-0904', semestre: 3, ht: 3, hp: 2, cr: 5 },
  { nombre: 'Estructura de Datos', clave: 'AED-1026', semestre: 3, ht: 2, hp: 3, cr: 5 },
  { nombre: 'Cultura Empresarial', clave: 'SCC-1005', semestre: 3, ht: 2, hp: 2, cr: 4 },
  { nombre: 'Investigación de Operaciones', clave: 'SCC-1013', semestre: 3, ht: 2, hp: 2, cr: 4 },
  { nombre: 'Sistemas Operativos', clave: 'AEC-1061', semestre: 3, ht: 2, hp: 2, cr: 4 },
  { nombre: 'Física General', clave: 'SCF-1006', semestre: 3, ht: 3, hp: 2, cr: 5 },
  { nombre: 'Desarrollo Sustentable', clave: 'ACD-0908', semestre: 3, ht: 2, hp: 3, cr: 5 },

  // Semestre 4
  { nombre: 'Ecuaciones Diferenciales', clave: 'ACF-0905', semestre: 4, ht: 3, hp: 2, cr: 5 },
  { nombre: 'Métodos Numéricos', clave: 'SCC-1017', semestre: 4, ht: 2, hp: 2, cr: 4 },
  { nombre: 'Tópicos Avanzados de Programación', clave: 'SCD-1027', semestre: 4, ht: 2, hp: 3, cr: 5 },
  { nombre: 'Fundamentos de Base de Datos', clave: 'AEF-1031', semestre: 4, ht: 3, hp: 2, cr: 5 },
  { nombre: 'Taller de Sistemas Operativos', clave: 'SCA-1026', semestre: 4, ht: 0, hp: 4, cr: 4 },
  { nombre: 'Principios Eléctricos y Aplicaciones Digitales', clave: 'SCD-1018', semestre: 4, ht: 2, hp: 3, cr: 5 },
  { nombre: 'Fundamento de Telecomunicaciones', clave: 'AEC-1034', semestre: 4, ht: 2, hp: 2, cr: 4 },

  // Semestre 5
  { nombre: 'Lenguajes y Autómatas I', clave: 'SCD-1015', semestre: 5, ht: 2, hp: 3, cr: 5 },
  { nombre: 'Redes de Computadoras', clave: 'SCD-1021', semestre: 5, ht: 2, hp: 3, cr: 5 },
  { nombre: 'Taller de Base de Datos', clave: 'SCA-1025', semestre: 5, ht: 0, hp: 4, cr: 4 },
  { nombre: 'Simulación', clave: 'SCD-1022', semestre: 5, ht: 2, hp: 3, cr: 5 },
  { nombre: 'Fundamentos de Ingeniería de Software', clave: 'SCC-1007', semestre: 5, ht: 2, hp: 2, cr: 4 },
  { nombre: 'Arquitectura de Computadoras', clave: 'SCD-1003', semestre: 5, ht: 2, hp: 3, cr: 5 },
  { nombre: 'Graficación', clave: 'SCC-1010', semestre: 5, ht: 2, hp: 2, cr: 4 },

  // Semestre 6
  { nombre: 'Lenguajes y Autómatas II', clave: 'SCD-1016', semestre: 6, ht: 2, hp: 3, cr: 5 },
  { nombre: 'Conmutación y Enrutamiento en Redes de Datos', clave: 'SCD-1004', semestre: 6, ht: 2, hp: 3, cr: 5 },
  { nombre: 'Administración de Base de Datos', clave: 'SCB-1001', semestre: 6, ht: 1, hp: 4, cr: 5 },
  { nombre: 'Taller de Investigación I', clave: 'ACA-0909', semestre: 6, ht: 0, hp: 4, cr: 4 },
  { nombre: 'Ingeniería de Software', clave: 'SCD-1011', semestre: 6, ht: 2, hp: 3, cr: 5 },
  { nombre: 'Lenguajes de Interfaz', clave: 'SCC-1014', semestre: 6, ht: 2, hp: 2, cr: 4 },
  { nombre: 'Seguridad en Redes', clave: 'RSD-2401', semestre: 6, ht: 2, hp: 3, cr: 5 },

  // Semestre 7
  { nombre: 'Administración de Redes', clave: 'SCA-1002', semestre: 7, ht: 0, hp: 4, cr: 4 },
  { nombre: 'Taller de Investigación II', clave: 'ACA-0910', semestre: 7, ht: 0, hp: 4, cr: 4 },
  { nombre: 'Gestión de Proyectos de Software', clave: 'SCG-1009', semestre: 7, ht: 3, hp: 3, cr: 6 },
  { nombre: 'Sistemas Programables', clave: 'SCC-1023', semestre: 7, ht: 2, hp: 2, cr: 4 },
  { nombre: 'Programación Web', clave: 'AEB-1055', semestre: 7, ht: 1, hp: 4, cr: 5 },
  { nombre: 'Servicio Social', clave: 'SSS-2014', semestre: 7, ht: 0, hp: 0, cr: 10 },

  // Semestre 8
  { nombre: 'Programación Lógica y Funcional', clave: 'SCC-1019', semestre: 8, ht: 2, hp: 2, cr: 4 },
  { nombre: 'Inteligencia Artificial', clave: 'SCC-1012', semestre: 8, ht: 2, hp: 2, cr: 4 },
  { nombre: 'Frameworks para Desarrollo Web', clave: 'RSB-2405', semestre: 8, ht: 1, hp: 4, cr: 5 },
  { nombre: 'Software Libre y Herramientas para Cómputo', clave: 'RSD-2402', semestre: 8, ht: 2, hp: 3, cr: 5 },
  { nombre: 'Programación Móvil', clave: 'RSB-2403', semestre: 8, ht: 1, hp: 4, cr: 5 },
  { nombre: 'Comercio Electrónico', clave: 'RSD-2404', semestre: 8, ht: 2, hp: 3, cr: 5 },

  // Requisitos fuera del mapa principal
  { nombre: 'Actividades Complementarias', clave: 'ISC-AC-03', semestre: 9, ht: 0, hp: 0, cr: 3 },
  { nombre: 'Residencia Profesional', clave: 'RSC-2010', semestre: 9, ht: 0, hp: 0, cr: 10 },
];

async function limpiarCatalogoAcademico(iscId: number) {
  await prisma.usuario.updateMany({
    where: { grupoId: { not: null } },
    data: { grupoId: null },
  });

  await prisma.usuario.updateMany({
    where: { carreraId: { not: iscId }, rol: Rol.ALUMNO },
    data: { carreraId: iscId },
  });

  await prisma.usuario.updateMany({
    where: { carreraId: { not: iscId }, rol: { in: [Rol.ADMIN, Rol.DOCENTE] } },
    data: { carreraId: null },
  });

  const ejecutarLimpieza = async (descripcion: string, accion: () => Promise<unknown>) => {
    try {
      await accion();
    } catch (error: any) {
      if (error?.code === 'P2021') {
        console.warn(`⚠️  Se omitió ${descripcion}: la tabla no existe en esta base.`);
        return;
      }
      throw error;
    }
  };

  await ejecutarLimpieza('EntregaArchivo', () => prisma.entregaArchivo.deleteMany());
  await ejecutarLimpieza('TareaArchivo', () => prisma.tareaArchivo.deleteMany());
  await ejecutarLimpieza('EntregaTarea', () => prisma.entregaTarea.deleteMany());
  await ejecutarLimpieza('Asistencia', () => prisma.asistencia.deleteMany());
  await ejecutarLimpieza('Tarea', () => prisma.tarea.deleteMany());
  await ejecutarLimpieza('ClaseSesion', () => prisma.claseSesion.deleteMany());
  await ejecutarLimpieza('HorarioMateria', () => prisma.horarioMateria.deleteMany());
  await ejecutarLimpieza('Inscripcion', () => prisma.inscripcion.deleteMany());
  await ejecutarLimpieza('Unidad', () => prisma.unidad.deleteMany());
  await ejecutarLimpieza('Materia', () => prisma.materia.deleteMany());
  await ejecutarLimpieza('Grupo', () => prisma.grupo.deleteMany());
  await ejecutarLimpieza('ReticulaMateria', () => prisma.reticulaMateria.deleteMany());
}

async function main() {
  console.log('Sincronizando catálogo para ISC únicamente...\n');

  let carrera = await prisma.carrera.findFirst({
    where: {
      OR: [
        { codigo: ISC.codigo },
        { nombre: { contains: 'Sistemas Computacionales', mode: 'insensitive' } },
      ],
    },
  });

  if (!carrera) {
    carrera = await prisma.carrera.create({
      data: {
        nombre: ISC.nombre,
        codigo: ISC.codigo,
        planEstudios: ISC.plan,
      },
    });
  }

  carrera = await prisma.carrera.update({
    where: { id: carrera.id },
    data: {
      nombre: ISC.nombre,
      codigo: ISC.codigo,
      planEstudios: ISC.plan,
    },
  });

  await limpiarCatalogoAcademico(carrera.id);

  await prisma.carrera.deleteMany({
    where: { id: { not: carrera.id } },
  });

  await prisma.reticulaMateria.createMany({
    data: RETICULA_ISC.map((materia) => ({
      nombre: materia.nombre,
      clave: materia.clave,
      semestre: materia.semestre,
      carreraId: carrera.id,
      horasTeoria: materia.ht,
      horasPractica: materia.hp,
      creditos: materia.cr,
      activo: true,
    })),
  });

  console.log(`✅ Carrera conservada: ${ISC.nombre} (${ISC.codigo})`);
  console.log(`✅ Materias en retícula cargadas: ${RETICULA_ISC.length}`);
  console.log('✅ Materias operativas, grupos y catálogos dependientes limpiados');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

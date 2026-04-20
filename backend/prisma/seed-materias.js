const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const carrera = await prisma.carrera.findFirst({
    where: {
      OR: [
        { codigo: '06' },
        { nombre: { contains: 'Sistemas Computacionales', mode: 'insensitive' } },
      ],
    },
  });

  if (!carrera) {
    console.error('❌ No existe la carrera de Ingeniería en Sistemas Computacionales.');
    console.error('   Ejecuta primero: npm run seed:reticula-full');
    return;
  }

  const docentes = await prisma.usuario.findMany({
    where: { rol: 'DOCENTE', activo: true },
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  if (docentes.length === 0) {
    console.error('❌ No hay docentes activos. Ejecuta el seed principal primero.');
    return;
  }

  const reticula = await prisma.reticulaMateria.findMany({
    where: {
      carreraId: carrera.id,
      activo: true,
      NOT: {
        AND: [{ horasTeoria: 0 }, { horasPractica: 0 }],
      },
    },
    orderBy: [{ semestre: 'asc' }, { createdAt: 'asc' }, { nombre: 'asc' }],
  });

  if (reticula.length === 0) {
    console.error('❌ No hay materias en la retícula de ISC.');
    console.error('   Ejecuta primero: npm run seed:reticula-full');
    return;
  }

  let total = 0;
  let omitidas = 0;
  let docenteIdx = 0;

  for (const item of reticula) {
    const docente = docentes[docenteIdx % docentes.length];
    docenteIdx += 1;

    try {
      const materia = await prisma.materia.create({
        data: {
          nombre: item.nombre,
          clave: item.clave,
          horaInicio: '',
          horaFin: '',
          dias: '',
          numUnidades: 3,
          docenteId: docente.id,
          carreraId: carrera.id,
          semestre: item.semestre,
        },
      });

      for (let unidad = 1; unidad <= 3; unidad += 1) {
        await prisma.unidad.create({
          data: { nombre: `Unidad ${unidad}`, orden: unidad, materiaId: materia.id },
        });
      }

      console.log(`✅ S${item.semestre} ${item.clave} — ${item.nombre}`);
      total += 1;
    } catch (e) {
      if (e.code === 'P2002') {
        console.log(`⚠️  Ya existe: ${item.clave}`);
        omitidas += 1;
      } else {
        console.log(`❌ Error en ${item.clave}: ${e.message}`);
      }
    }
  }

  console.log(`\n✅ Seed completado: ${total} materias creadas, ${omitidas} omitidas.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

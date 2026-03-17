const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const NOMBRES = [
  'Carlos', 'María', 'José', 'Ana', 'Luis', 'Laura', 'Miguel', 'Sofía',
  'Fernando', 'Gabriela', 'Ricardo', 'Daniela', 'Pedro', 'Valentina',
  'Andrés', 'Camila', 'Diego', 'Isabella', 'Jorge', 'Alejandra',
  'Raúl', 'Paola', 'Sergio', 'Mariana', 'Eduardo', 'Natalia',
  'Roberto', 'Andrea', 'Héctor', 'Patricia',
];

const APELLIDOS = [
  'García', 'Hernández', 'López', 'Martínez', 'González', 'Rodríguez',
  'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Rivera',
  'Gómez', 'Díaz', 'Cruz', 'Morales', 'Reyes', 'Gutiérrez',
  'Ortiz', 'Castillo', 'Ramos', 'Vargas', 'Mendoza', 'Jiménez',
];

const NOMBRES_ACADEMIAS = [
  { nombre: 'Ciencias Básicas', descripcion: 'Matemáticas, física y química' },
  { nombre: 'Sistemas Computacionales', descripcion: 'Programación, redes y bases de datos' },
  { nombre: 'Electrónica', descripcion: 'Electrónica y circuitos' },
  { nombre: 'Gestión Empresarial', descripcion: 'Administración y economía' },
  { nombre: 'Ciencias Económico-Administrativas', descripcion: 'Finanzas y contabilidad' },
  { nombre: 'Energías Renovables', descripcion: 'Energía solar, eólica y sustentabilidad' },
  { nombre: 'Industrial', descripcion: 'Ingeniería industrial y manufactura' },
  { nombre: 'Informática', descripcion: 'Tecnologías de información' },
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function numControl() {
  const y = 20 + Math.floor(Math.random() * 6); // 20-25
  const letter = 'QWERTYUIOPASDFGHJKLZXCVBNM'[Math.floor(Math.random() * 26)];
  const num = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `${y}5${letter}${num}`;
}

async function main() {
  const hash = await bcrypt.hash('123456', 10);

  // Crear academias si no existen
  let academias = await prisma.academia.findMany();
  if (academias.length === 0) {
    for (const a of NOMBRES_ACADEMIAS) {
      await prisma.academia.create({ data: a });
    }
    academias = await prisma.academia.findMany();
    console.log(`✅ Creadas ${academias.length} academias`);
  }

  // Check if carreras exist, create some if not
  let carreras = await prisma.carrera.findMany();
  if (carreras.length === 0) {
    const datosCarreras = [
      { nombre: 'Ingeniería en Sistemas Computacionales', codigo: 'ISC' },
      { nombre: 'Ingeniería Industrial',                  codigo: 'II'  },
      { nombre: 'Ingeniería Electrónica',                 codigo: 'IE'  },
      { nombre: 'Ingeniería Mecánica',                    codigo: 'IM'  },
      { nombre: 'Licenciatura en Administración',         codigo: 'LA'  },
    ];
    for (const data of datosCarreras) {
      await prisma.carrera.create({ data });
    }
    carreras = await prisma.carrera.findMany();
    console.log(`✅ Creadas ${carreras.length} carreras`);
  }

  // Create 6 docentes
  const docentes = [];
  const usedNames = new Set();
  for (let i = 0; i < 6; i++) {
    let nombre;
    do {
      nombre = `${pick(NOMBRES)} ${pick(APELLIDOS)} ${pick(APELLIDOS)}`;
    } while (usedNames.has(nombre));
    usedNames.add(nombre);

    const username = nombre.toLowerCase().split(' ').slice(0, 2).join('.').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    try {
      const academiaAsignada = pick(academias);
      const doc = await prisma.usuario.create({
        data: {
          nombre,
          username,
          password: hash,
          rol: 'DOCENTE',
          telefono: `614${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`,
          activo: true,
          academias: { connect: [{ id: academiaAsignada.id }] },
        },
      });
      docentes.push(doc);
      console.log(`👨‍🏫 Docente: ${nombre} (${username})`);
    } catch (e) {
      console.log(`⚠️  Skipped docente ${nombre}: ${e.message}`);
    }
  }

  // Create 20 alumnos
  for (let i = 0; i < 20; i++) {
    let nombre;
    do {
      nombre = `${pick(NOMBRES)} ${pick(APELLIDOS)} ${pick(APELLIDOS)}`;
    } while (usedNames.has(nombre));
    usedNames.add(nombre);

    const nc = numControl();
    const carrera = pick(carreras);
    const semestre = Math.floor(Math.random() * 8) + 1;

    try {
      await prisma.usuario.create({
        data: {
          nombre,
          numeroControl: nc,
          password: hash,
          rol: 'ALUMNO',
          semestre,
          carreraId: carrera.id,
          telefono: `614${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`,
          activo: true,
        },
      });
      console.log(`🎒 Alumno: ${nombre} (${nc}) — ${carrera.nombre} S${semestre}`);
    } catch (e) {
      console.log(`⚠️  Skipped alumno ${nombre}: ${e.message}`);
    }
  }

  console.log('\n✅ Seed completado. Todos con contraseña: 123456');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

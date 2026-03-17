const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// carreraId => prefijo de clave
const CARRERAS = [
  { id: 1,  sigla: 'ISC' },
  { id: 2,  sigla: 'II'  },
  { id: 3,  sigla: 'INF' },
  { id: 4,  sigla: 'IEL' },
  { id: 6,  sigla: 'IP'  },
  { id: 8,  sigla: 'CP'  },
  { id: 9,  sigla: 'IGE' },
  { id: 10, sigla: 'IER' },
  { id: 11, sigla: 'IAS' },
  { id: 12, sigla: 'MVZ' },
];

// Materias por semestre para cada carrera
const PLAN = {
  ISC: [
    ['Cálculo Diferencial','Física General','Fundamentos de Programación','Matemáticas Discretas','Taller de Ética'],
    ['Cálculo Integral','Física Aplicada','Programación Orientada a Objetos','Contabilidad Financiera','Taller de Investigación I'],
    ['Cálculo Vectorial','Estructura de Datos','Probabilidad y Estadística','Electricidad y Magnetismo','Cultura Empresarial'],
    ['Ecuaciones Diferenciales','Fundamentos de Bases de Datos','Arquitectura de Computadoras','Sistemas Operativos','Investigación de Operaciones'],
    ['Métodos Numéricos','Bases de Datos Avanzadas','Redes de Computadoras','Lenguajes y Autómatas I','Ingeniería de Software'],
    ['Simulación','Programación Web','Administración de Redes','Lenguajes y Autómatas II','Sistemas Distribuidos'],
    ['Inteligencia Artificial','Programación Móvil','Seguridad Informática','Tópicos Avanzados de BD','Gestión de Proyectos de TI'],
    ['Cómputo en la Nube','Desarrollo de Emprendedores','Seminario de Titulación'],
  ],
  II: [
    ['Cálculo Diferencial','Física General','Química Industrial','Fundamentos de Manufactura','Taller de Ética'],
    ['Cálculo Integral','Física Aplicada','Contabilidad Financiera','Dibujo Industrial','Taller de Investigación I'],
    ['Cálculo Vectorial','Probabilidad y Estadística','Ingeniería de Métodos','Ciencia de Materiales','Cultura Empresarial'],
    ['Investigación de Operaciones','Control Estadístico de Calidad','Administración de Operaciones','Termodinámica','Economía'],
    ['Simulación','Planeación y Diseño de Planta','Seguridad e Higiene','Gestión de la Cadena de Suministro','Ingeniería Económica'],
    ['Sistemas de Manufactura','Ergonomía','Gestión de Proyectos','Automatización Industrial','Taller de Investigación II'],
    ['Sistemas de Gestión de Calidad','Logística','Mantenimiento Industrial','Mercadotecnia','Desarrollo de Emprendedores'],
    ['Manufactura Esbelta','Formulación y Evaluación de Proyectos','Seminario de Titulación'],
  ],
  INF: [
    ['Cálculo Diferencial','Física General','Introducción a la Informática','Matemáticas Discretas','Taller de Ética'],
    ['Cálculo Integral','Programación Estructurada','Contabilidad Financiera','Álgebra Lineal','Taller de Investigación I'],
    ['Estructura de Datos','Probabilidad y Estadística','Sistemas Operativos','Fundamentos de Bases de Datos','Cultura Empresarial'],
    ['Redes de Computadoras','Bases de Datos Relacionales','Ingeniería de Software','Arquitectura de Computadoras','Investigación de Operaciones'],
    ['Programación Web','Administración de Redes','Seguridad Informática','Análisis y Diseño de Sistemas','Ingeniería Económica'],
    ['Desarrollo de Aplicaciones Web','Minería de Datos','Sistemas Distribuidos','Administración de Proyectos TI','Taller de Investigación II'],
    ['Inteligencia Artificial','Big Data','Auditoría de Sistemas','Cómputo en la Nube','Desarrollo de Emprendedores'],
    ['Transformación Digital','Formulación y Evaluación de Proyectos','Seminario de Titulación'],
  ],
  IEL: [
    ['Cálculo Diferencial','Física General','Fundamentos de Electrónica','Matemáticas Discretas','Taller de Ética'],
    ['Cálculo Integral','Física Aplicada','Circuitos Eléctricos I','Programación Estructurada','Taller de Investigación I'],
    ['Cálculo Vectorial','Circuitos Eléctricos II','Electrónica Analógica I','Probabilidad y Estadística','Cultura Empresarial'],
    ['Ecuaciones Diferenciales','Electrónica Analógica II','Electrónica Digital I','Electromagnetismo','Investigación de Operaciones'],
    ['Señales y Sistemas','Electrónica Digital II','Microcontroladores','Comunicaciones I','Ingeniería Económica'],
    ['Procesamiento Digital de Señales','Comunicaciones II','Sistemas de Control','Instrumentación','Taller de Investigación II'],
    ['Robótica','Redes Inalámbricas','Diseño de Sistemas Embebidos','Administración de Proyectos','Desarrollo de Emprendedores'],
    ['IoT e Industria 4.0','Energías Renovables','Seminario de Titulación'],
  ],
  IP: [
    ['Cálculo Diferencial','Física General','Química General','Geología Básica','Taller de Ética'],
    ['Cálculo Integral','Física Aplicada','Química Orgánica','Termodinámica I','Taller de Investigación I'],
    ['Cálculo Vectorial','Mecánica de Fluidos','Termodinámica II','Geología del Petróleo','Cultura Empresarial'],
    ['Ecuaciones Diferenciales','Transferencia de Calor','Yacimientos de Hidrocarburos I','Perforación I','Investigación de Operaciones'],
    ['Métodos Numéricos','Yacimientos de Hidrocarburos II','Perforación II','Producción de Petróleo I','Ingeniería Económica'],
    ['Simulación de Yacimientos','Producción de Petróleo II','Refinación del Petróleo','Ductos y Transporte','Taller de Investigación II'],
    ['Gestión de Proyectos Petroleros','Seguridad e Higiene Industrial','Legislación Petrolera','Impacto Ambiental','Desarrollo de Emprendedores'],
    ['Evaluación de Proyectos Petroleros','Formulación y Evaluación de Proyectos','Seminario de Titulación'],
  ],
  CP: [
    ['Fundamentos de Contabilidad','Matemáticas Financieras','Introducción a la Economía','Derecho Empresarial','Taller de Ética'],
    ['Contabilidad Financiera I','Estadística','Microeconomía','Derecho Mercantil','Taller de Investigación I'],
    ['Contabilidad Financiera II','Costos y Presupuestos','Macroeconomía','Derecho Fiscal I','Cultura Empresarial'],
    ['Contabilidad Administrativa','Auditoría I','Finanzas I','Derecho Fiscal II','Investigación de Operaciones'],
    ['Contabilidad de Sociedades','Auditoría II','Finanzas II','Presupuestos Empresariales','Ingeniería Económica'],
    ['Contabilidad Gubernamental','Auditoría Fiscal','Administración Financiera','Comercio Internacional','Taller de Investigación II'],
    ['Dictamen Fiscal','Planeación Fiscal','Finanzas Corporativas','Consultoría Contable','Desarrollo de Emprendedores'],
    ['Responsabilidad Social Empresarial','Formulación y Evaluación de Proyectos','Seminario de Titulación'],
  ],
  IGE: [
    ['Fundamentos de Administración','Matemáticas','Contabilidad Básica','Introducción a la Economía','Taller de Ética'],
    ['Proceso Administrativo','Matemáticas Financieras','Contabilidad Financiera','Derecho Empresarial','Taller de Investigación I'],
    ['Comportamiento Organizacional','Estadística','Costos y Presupuestos','Microeconomía','Cultura Empresarial'],
    ['Administración de Recursos Humanos','Investigación de Mercados','Contabilidad Administrativa','Macroeconomía','Informática Administrativa'],
    ['Administración de Operaciones','Mercadotecnia','Administración Financiera','Derecho Laboral','Investigación de Operaciones'],
    ['Gestión de la Calidad','Comercio Internacional','Logística Empresarial','Auditoría Administrativa','Taller de Investigación II'],
    ['Planeación Estratégica','Negocios Internacionales','Finanzas Corporativas','Consultoría Empresarial','Desarrollo de Emprendedores'],
    ['Responsabilidad Social Empresarial','Formulación y Evaluación de Proyectos','Seminario de Titulación'],
  ],
  IER: [
    ['Cálculo Diferencial','Física General','Química General','Introducción a Energías Renovables','Taller de Ética'],
    ['Cálculo Integral','Física Aplicada','Termodinámica I','Ecología y Medio Ambiente','Taller de Investigación I'],
    ['Cálculo Vectorial','Mecánica de Fluidos','Termodinámica II','Probabilidad y Estadística','Cultura Empresarial'],
    ['Ecuaciones Diferenciales','Electrotecnia','Energía Solar Fotovoltaica','Energía Solar Térmica','Investigación de Operaciones'],
    ['Energía Eólica','Energía Hidráulica','Bioenergía','Sistemas de Almacenamiento','Ingeniería Económica'],
    ['Eficiencia Energética','Redes Eléctricas Inteligentes','Impacto Ambiental','Gestión de Proyectos','Taller de Investigación II'],
    ['Microrredes y Generación Distribuida','Movilidad Eléctrica','Legislación Energética','Auditoría Energética','Desarrollo de Emprendedores'],
    ['Proyectos de Energía Renovable','Formulación y Evaluación de Proyectos','Seminario de Titulación'],
  ],
  IAS: [
    ['Cálculo Diferencial','Química General','Biología Celular','Introducción a la Agronomía','Taller de Ética'],
    ['Cálculo Integral','Física Aplicada','Bioquímica','Edafología','Taller de Investigación I'],
    ['Estadística Aplicada','Fisiología Vegetal','Microbiología Agrícola','Climatología','Cultura Empresarial'],
    ['Fitotecnia','Nutrición Vegetal','Manejo Integrado de Plagas','Riego y Drenaje','Investigación de Operaciones'],
    ['Biotecnología Agrícola','Horticultura','Fruticultura','Agricultura de Precisión','Ingeniería Económica'],
    ['Agricultura Orgánica','Acuicultura Sustentable','Gestión de Recursos Hídricos','Agroecología','Taller de Investigación II'],
    ['Innovación Agrícola','Cadenas de Valor Agroalimentarias','Legislación Agraria','Emprendimiento Rural','Desarrollo de Emprendedores'],
    ['Proyectos de Innovación Agrícola','Formulación y Evaluación de Proyectos','Seminario de Titulación'],
  ],
  MVZ: [
    ['Biología Celular y Molecular','Química General','Física Aplicada','Matemáticas','Taller de Ética'],
    ['Anatomía Veterinaria I','Bioquímica','Histología y Embriología','Estadística','Taller de Investigación I'],
    ['Anatomía Veterinaria II','Fisiología Veterinaria I','Microbiología Veterinaria','Parasitología','Cultura Empresarial'],
    ['Fisiología Veterinaria II','Patología General','Farmacología Veterinaria','Nutrición Animal','Investigación de Operaciones'],
    ['Medicina y Cirugía en Pequeñas Especies I','Clínica de Bovinos','Reproducción Animal','Epidemiología','Ingeniería Económica'],
    ['Medicina y Cirugía en Pequeñas Especies II','Clínica de Equinos','Salud Pública Veterinaria','Tecnología de Alimentos','Taller de Investigación II'],
    ['Medicina y Cirugía en Pequeñas Especies III','Producción Animal','Medicina Preventiva','Legislación Veterinaria','Desarrollo de Emprendedores'],
    ['Medicina Forense Veterinaria','Formulación y Evaluación de Proyectos','Seminario de Titulación'],
  ],
};

const HORARIOS = [
  { horaInicio: '07:00', horaFin: '08:00', dias: 'Lunes,Miércoles,Viernes' },
  { horaInicio: '08:00', horaFin: '10:00', dias: 'Martes,Jueves' },
  { horaInicio: '10:00', horaFin: '11:00', dias: 'Lunes,Miércoles,Viernes' },
  { horaInicio: '11:00', horaFin: '13:00', dias: 'Martes,Jueves' },
  { horaInicio: '13:00', horaFin: '15:00', dias: 'Lunes,Miércoles' },
];

async function main() {
  const docentes = await prisma.usuario.findMany({
    where: { rol: 'DOCENTE', activo: true },
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  if (docentes.length === 0) {
    console.error('❌ No hay docentes. Ejecuta el seed principal primero.');
    return;
  }

  let total = 0;
  let omitidas = 0;
  let docenteIdx = 0;

  for (const { id: carreraId, sigla } of CARRERAS) {
    const plan = PLAN[sigla];
    console.log(`\n📚 ${sigla} (carreraId: ${carreraId})`);

    for (let sem = 1; sem <= plan.length; sem++) {
      const materiasSem = plan[sem - 1];
      for (let i = 0; i < materiasSem.length; i++) {
        const nombre = materiasSem[i];
        const clave = `${sigla}-${sem}${String(i + 1).padStart(2, '0')}`;
        const horario = HORARIOS[i % HORARIOS.length];
        const docente = docentes[docenteIdx % docentes.length];
        docenteIdx++;

        try {
          const materia = await prisma.materia.create({
            data: {
              nombre,
              clave,
              horaInicio: horario.horaInicio,
              horaFin: horario.horaFin,
              dias: horario.dias,
              numUnidades: 3,
              docenteId: docente.id,
              carreraId,
              semestre: sem,
            },
          });

          for (let u = 1; u <= 3; u++) {
            await prisma.unidad.create({
              data: { nombre: `Unidad ${u}`, orden: u, materiaId: materia.id },
            });
          }

          console.log(`  ✅ S${sem} ${clave} — ${nombre}`);
          total++;
        } catch (e) {
          if (e.code === 'P2002') {
            console.log(`  ⚠️  Ya existe: ${clave}`);
            omitidas++;
          } else {
            console.log(`  ❌ Error en ${clave}: ${e.message}`);
          }
        }
      }
    }
  }

  console.log(`\n✅ Seed completado: ${total} materias creadas, ${omitidas} omitidas.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

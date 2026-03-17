import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MateriaReticula {
  nombre: string;
  clave: string;
  semestre: number;
  ht: number;
  hp: number;
  cr: number;
}

const CARRERAS = [
  { nombre: "Contador Publico",                              codigo: "01", plan: "COPU-2010-205" },
  { nombre: "Ingeniera en Energias Renovables",              codigo: "02", plan: "IENR-2010-217" },
  { nombre: "Electr",                                        codigo: "03", plan: "IELC-2010-211" },
  { nombre: "Ingenieria en Gestion Empresarial",             codigo: "04", plan: "IGEM-2009-201" },
  { nombre: "Innovacion Agricola",                           codigo: "05", plan: "IIAS-2010-221" },
  { nombre: "Sistemas Computacionales",                      codigo: "06", plan: "ISIC-2010-224" },
  { nombre: "Industrial",                                    codigo: "07", plan: "IIND-2010-227" },
  { nombre: "Ingenieria Informatica",                        codigo: "08", plan: "IINF-2010-220" },
  { nombre: "Ingenieria Petrolera",                          codigo: "09", plan: "IPET-2010-231" },
  { nombre: "Medicina Veterinaria y Zootecnia",              codigo: "10", plan: null },
];

const RETICULAS: Record<string, MateriaReticula[]> = {

// ── CONTADOR PÚBLICO (COPU-2010-205) – Código "01" ──────────────────────────
"01": [
  // Semestre 1
  { nombre: "Introducción a la Contabilidad Financiera", clave: "CPM-1030", semestre: 1, ht: 2, hp: 4, cr: 6 },
  { nombre: "Administración", clave: "CPC-1001", semestre: 1, ht: 2, hp: 2, cr: 4 },
  { nombre: "Álgebra Lineal", clave: "ACF-0903", semestre: 1, ht: 3, hp: 2, cr: 5 },
  { nombre: "Fundamentos de Derecho", clave: "CPC-1025", semestre: 1, ht: 2, hp: 2, cr: 4 },
  { nombre: "Desarrollo Humano", clave: "CPC-1018", semestre: 1, ht: 2, hp: 2, cr: 4 },
  { nombre: "Fundamentos de Investigación", clave: "ACC-0906", semestre: 1, ht: 2, hp: 2, cr: 4 },
  { nombre: "Comunicación Humana", clave: "CPC-1009", semestre: 1, ht: 2, hp: 2, cr: 4 },
  // Semestre 2
  { nombre: "Contabilidad Financiera I", clave: "CPM-1012", semestre: 2, ht: 2, hp: 4, cr: 6 },
  { nombre: "Taller de Ética", clave: "ACA-0907", semestre: 2, ht: 0, hp: 4, cr: 4 },
  { nombre: "Cálculo Diferencial e Integral", clave: "CPD-1008", semestre: 2, ht: 2, hp: 3, cr: 5 },
  { nombre: "Derecho Mercantil", clave: "CPC-1016", semestre: 2, ht: 2, hp: 2, cr: 4 },
  { nombre: "Dinámica Social", clave: "CPC-1019", semestre: 2, ht: 2, hp: 2, cr: 4 },
  { nombre: "Estadística Administrativa I", clave: "CPC-1022", semestre: 2, ht: 2, hp: 2, cr: 4 },
  { nombre: "Taller de Informática I", clave: "CPC-1040", semestre: 2, ht: 2, hp: 2, cr: 4 },
  // Semestre 3
  { nombre: "Contabilidad Financiera II", clave: "CPM-1013", semestre: 3, ht: 2, hp: 4, cr: 6 },
  { nombre: "Mercadotecnia", clave: "CPC-1033", semestre: 3, ht: 2, hp: 2, cr: 4 },
  { nombre: "Matemáticas Financieras", clave: "CPC-1032", semestre: 3, ht: 2, hp: 2, cr: 4 },
  { nombre: "Derecho Laboral y Seguridad Social", clave: "CPC-1015", semestre: 3, ht: 2, hp: 2, cr: 4 },
  { nombre: "Gestión del Talento Humano", clave: "CPC-1026", semestre: 3, ht: 2, hp: 2, cr: 4 },
  { nombre: "Estadística Administrativa II", clave: "CPC-1023", semestre: 3, ht: 2, hp: 2, cr: 4 },
  { nombre: "Desarrollo Sustentable", clave: "ACD-0908", semestre: 3, ht: 2, hp: 3, cr: 5 },
  // Semestre 4
  { nombre: "Contabilidad de Sociedades", clave: "CPD-1011", semestre: 4, ht: 2, hp: 3, cr: 5 },
  { nombre: "Sistemas de Costos Históricos", clave: "CPD-1038", semestre: 4, ht: 2, hp: 3, cr: 5 },
  { nombre: "Microeconomía", clave: "CPC-1034", semestre: 4, ht: 2, hp: 2, cr: 4 },
  { nombre: "Derecho Tributario", clave: "CPC-1017", semestre: 4, ht: 2, hp: 2, cr: 4 },
  { nombre: "Análisis e Interpretación de Estados Financieros", clave: "CPC-1005", semestre: 4, ht: 2, hp: 2, cr: 4 },
  { nombre: "Taller de Investigación I", clave: "ACA-0909", semestre: 4, ht: 0, hp: 4, cr: 4 },
  { nombre: "Administración de la Producción y de las Operaciones", clave: "CPC-1003", semestre: 4, ht: 2, hp: 2, cr: 4 },
  // Semestre 5
  { nombre: "Contabilidad Avanzada", clave: "CPD-1010", semestre: 5, ht: 2, hp: 3, cr: 5 },
  { nombre: "Sistemas de Costos Predeterminados", clave: "CPD-1039", semestre: 5, ht: 2, hp: 3, cr: 5 },
  { nombre: "Macroeconomía", clave: "CPC-1031", semestre: 5, ht: 2, hp: 2, cr: 4 },
  { nombre: "Impuestos Personas Morales", clave: "CPJ-1028", semestre: 5, ht: 4, hp: 2, cr: 6 },
  { nombre: "Fundamentos de Auditoría", clave: "CPC-1024", semestre: 5, ht: 2, hp: 2, cr: 4 },
  { nombre: "Taller de Investigación II", clave: "ACA-0910", semestre: 5, ht: 0, hp: 4, cr: 4 },
  { nombre: "Planeación Financiera", clave: "CPC-1036", semestre: 5, ht: 2, hp: 2, cr: 4 },
  // Semestre 6
  { nombre: "Contabilidad Internacional", clave: "CPD-1014", semestre: 6, ht: 2, hp: 3, cr: 5 },
  { nombre: "Gestión y Toma de Decisiones", clave: "CPF-1027", semestre: 6, ht: 3, hp: 2, cr: 5 },
  { nombre: "Administración Estratégica", clave: "CPC-1002", semestre: 6, ht: 2, hp: 2, cr: 4 },
  { nombre: "Impuestos Personas Físicas", clave: "CPJ-1029", semestre: 6, ht: 4, hp: 2, cr: 6 },
  { nombre: "Auditoría para Efectos Financieros", clave: "CPD-1006", semestre: 6, ht: 2, hp: 3, cr: 5 },
  { nombre: "Economía Internacional", clave: "CPC-1020", semestre: 6, ht: 2, hp: 2, cr: 4 },
  { nombre: "Alternativas de Inversión y Financiamiento", clave: "CPC-1004", semestre: 6, ht: 2, hp: 2, cr: 4 },
  // Semestre 7
  { nombre: "Seminario de Contaduría", clave: "CPO-1037", semestre: 7, ht: 0, hp: 3, cr: 3 },
  { nombre: "Elaboración y Evaluación de Proyectos de Inversión", clave: "CPH-1021", semestre: 7, ht: 1, hp: 3, cr: 4 },
  { nombre: "Otros Impuestos y Contribuciones", clave: "CPJ-1035", semestre: 7, ht: 4, hp: 2, cr: 6 },
  { nombre: "Auditoría para Efectos Fiscales", clave: "CPD-1007", semestre: 7, ht: 2, hp: 3, cr: 5 },
  { nombre: "Taller de Informática II", clave: "CPA-1041", semestre: 7, ht: 0, hp: 4, cr: 4 },
],

// ── ING. ENERGÍAS RENOVABLES (IENR-2010-217) – Código "02" ──────────────────
"02": [
  // Semestre 1
  { nombre: "Química", clave: "ERF-1024", semestre: 1, ht: 3, hp: 2, cr: 5 },
  { nombre: "Programación", clave: "ERC-1023", semestre: 1, ht: 2, hp: 2, cr: 4 },
  { nombre: "Cálculo Diferencial", clave: "ACF-0901", semestre: 1, ht: 3, hp: 2, cr: 5 },
  { nombre: "Fundamentos de Investigación", clave: "ACC-0906", semestre: 1, ht: 2, hp: 2, cr: 4 },
  { nombre: "Dibujo", clave: "ERA-1008", semestre: 1, ht: 0, hp: 4, cr: 4 },
  { nombre: "Fuentes Renovables de Energía", clave: "ERF-1013", semestre: 1, ht: 3, hp: 2, cr: 5 },
  // Semestre 2
  { nombre: "Bioquímica", clave: "ERF-1004", semestre: 2, ht: 3, hp: 2, cr: 5 },
  { nombre: "Electromagnetismo", clave: "AEF-1020", semestre: 2, ht: 3, hp: 2, cr: 5 },
  { nombre: "Álgebra Lineal", clave: "ACF-0903", semestre: 2, ht: 3, hp: 2, cr: 5 },
  { nombre: "Cálculo Integral", clave: "ACF-0902", semestre: 2, ht: 3, hp: 2, cr: 5 },
  { nombre: "Taller de Ética", clave: "ACA-0907", semestre: 2, ht: 0, hp: 4, cr: 4 },
  { nombre: "Estadística y Diseño de Experimentos", clave: "ERF-1010", semestre: 2, ht: 3, hp: 2, cr: 5 },
  // Semestre 3
  { nombre: "Microbiología", clave: "ERF-1021", semestre: 3, ht: 3, hp: 2, cr: 5 },
  { nombre: "Taller de Sistemas de Información Geográfica", clave: "ERF-1030", semestre: 3, ht: 3, hp: 2, cr: 5 },
  { nombre: "Tecnología e Ingeniería de Materiales", clave: "ERF-1031", semestre: 3, ht: 3, hp: 2, cr: 5 },
  { nombre: "Estática y Dinámica", clave: "ERF-1011", semestre: 3, ht: 3, hp: 2, cr: 5 },
  { nombre: "Cálculo Vectorial", clave: "ACF-0904", semestre: 3, ht: 3, hp: 2, cr: 5 },
  { nombre: "Metrología Mecánica y Eléctrica", clave: "ERF-1020", semestre: 3, ht: 3, hp: 2, cr: 5 },
  // Semestre 4
  { nombre: "Resistencia de Materiales", clave: "ERF-1026", semestre: 4, ht: 3, hp: 2, cr: 5 },
  { nombre: "Termodinámica", clave: "ERF-1032", semestre: 4, ht: 3, hp: 2, cr: 5 },
  { nombre: "Comportamiento Humano en las Organizaciones", clave: "ERI-1007", semestre: 4, ht: 4, hp: 0, cr: 4 },
  { nombre: "Óptica y Semiconductores", clave: "ERF-1022", semestre: 4, ht: 3, hp: 2, cr: 5 },
  { nombre: "Ecuaciones Diferenciales", clave: "ACF-0905", semestre: 4, ht: 3, hp: 2, cr: 5 },
  { nombre: "Circuitos Eléctricos I", clave: "ERF-1005", semestre: 4, ht: 3, hp: 2, cr: 5 },
  // Semestre 5
  { nombre: "Biocombustibles", clave: "ERF-1003", semestre: 5, ht: 3, hp: 2, cr: 5 },
  { nombre: "Marco Jurídico en Gestión Energética", clave: "ERO-1018", semestre: 5, ht: 0, hp: 3, cr: 3 },
  { nombre: "Desarrollo Sustentable", clave: "ACD-0908", semestre: 5, ht: 2, hp: 3, cr: 5 },
  { nombre: "Mecánica de Fluidos", clave: "ERF-1019", semestre: 5, ht: 3, hp: 2, cr: 5 },
  { nombre: "Transferencia de Calor", clave: "ERF-1033", semestre: 5, ht: 3, hp: 2, cr: 5 },
  { nombre: "Circuitos Eléctricos II", clave: "ERF-1006", semestre: 5, ht: 3, hp: 2, cr: 5 },
  // Semestre 6
  { nombre: "Taller de Investigación I", clave: "ACA-0909", semestre: 6, ht: 0, hp: 4, cr: 4 },
  { nombre: "Máquinas Eléctricas", clave: "ERF-1016", semestre: 6, ht: 3, hp: 2, cr: 5 },
  { nombre: "Máquinas Hidráulicas", clave: "ERF-1017", semestre: 6, ht: 3, hp: 2, cr: 5 },
  { nombre: "Refrigeración y Aire Acondicionado", clave: "ERF-1025", semestre: 6, ht: 3, hp: 2, cr: 5 },
  { nombre: "Instalaciones Eléctricas e Iluminación", clave: "ERF-1015", semestre: 6, ht: 3, hp: 2, cr: 5 },
  { nombre: "Sistemas Térmicos", clave: "ERF-1029", semestre: 6, ht: 3, hp: 2, cr: 5 },
  // Semestre 7
  { nombre: "Sistemas Solares Fotovoltaicos y Térmicos", clave: "ERD-1028", semestre: 7, ht: 2, hp: 3, cr: 5 },
  { nombre: "Simulación de Sistemas de Energías Renovables", clave: "ERC-1027", semestre: 7, ht: 2, hp: 2, cr: 4 },
  { nombre: "Instrumentación", clave: "AEF-1038", semestre: 7, ht: 3, hp: 2, cr: 5 },
  { nombre: "Energía Eólica", clave: "ERF-1009", semestre: 7, ht: 3, hp: 2, cr: 5 },
  { nombre: "Taller de Investigación II", clave: "ACA-0910", semestre: 7, ht: 0, hp: 4, cr: 4 },
  // Semestre 8
  { nombre: "Formulación y Evaluación de Proyectos de Energías Renovables", clave: "ERC-1012", semestre: 8, ht: 2, hp: 2, cr: 4 },
  { nombre: "Administración y Técnicas de Conservación", clave: "ERI-1001", semestre: 8, ht: 4, hp: 0, cr: 4 },
  { nombre: "Auditoría Energética", clave: "ERO-1002", semestre: 8, ht: 0, hp: 3, cr: 3 },
  { nombre: "Gestión de Empresas de Energías Renovables", clave: "ERC-1014", semestre: 8, ht: 2, hp: 2, cr: 4 },
],

// ── ING. ELECTRÓNICA (IELC-2010-211) – Código "03" ──────────────────────────
"03": [
  // Semestre 1
  { nombre: "Cálculo Diferencial", clave: "ACF-0901", semestre: 1, ht: 3, hp: 2, cr: 5 },
  { nombre: "Mecánica Clásica", clave: "AEF-1042", semestre: 1, ht: 3, hp: 2, cr: 5 },
  { nombre: "Química", clave: "AEC-1058", semestre: 1, ht: 2, hp: 2, cr: 4 },
  { nombre: "Taller de Ética", clave: "ACA-0907", semestre: 1, ht: 0, hp: 4, cr: 4 },
  { nombre: "Fundamentos de Investigación", clave: "ACC-0906", semestre: 1, ht: 2, hp: 2, cr: 4 },
  { nombre: "Comunicación Humana", clave: "AEQ-1387", semestre: 1, ht: 1, hp: 2, cr: 3 },
  // Semestre 2
  { nombre: "Cálculo Integral", clave: "ACF-0902", semestre: 2, ht: 3, hp: 2, cr: 5 },
  { nombre: "Probabilidad y Estadística", clave: "AEE-1051", semestre: 2, ht: 3, hp: 1, cr: 4 },
  { nombre: "Desarrollo Sustentable", clave: "ACD-0908", semestre: 2, ht: 2, hp: 3, cr: 5 },
  { nombre: "Mediciones Eléctricas", clave: "ETD-1021", semestre: 2, ht: 2, hp: 3, cr: 5 },
  { nombre: "Tópicos Selectos de Física", clave: "ETF-1027", semestre: 2, ht: 3, hp: 2, cr: 5 },
  { nombre: "Desarrollo Humano", clave: "ETQ-1009", semestre: 2, ht: 1, hp: 2, cr: 3 },
  { nombre: "Álgebra Lineal", clave: "ACF-0903", semestre: 2, ht: 3, hp: 2, cr: 5 },
  // Semestre 3
  { nombre: "Cálculo Vectorial", clave: "ACF-0904", semestre: 3, ht: 3, hp: 2, cr: 5 },
  { nombre: "Electromagnetismo", clave: "AEF-1020", semestre: 3, ht: 3, hp: 2, cr: 5 },
  { nombre: "Física de Semiconductores", clave: "ETF-1017", semestre: 3, ht: 3, hp: 2, cr: 5 },
  { nombre: "Programación Estructurada", clave: "ETD-1024", semestre: 3, ht: 2, hp: 3, cr: 5 },
  { nombre: "Diseño Digital", clave: "ETF-1014", semestre: 3, ht: 3, hp: 2, cr: 5 },
  { nombre: "Marco Legal de la Empresa", clave: "ETP-1020", semestre: 3, ht: 3, hp: 0, cr: 3 },
  // Semestre 4
  { nombre: "Ecuaciones Diferenciales", clave: "ACF-0905", semestre: 4, ht: 3, hp: 2, cr: 5 },
  { nombre: "Circuitos Eléctricos I", clave: "ETF-1004", semestre: 4, ht: 3, hp: 2, cr: 5 },
  { nombre: "Análisis Numérico", clave: "ETF-1003", semestre: 4, ht: 3, hp: 2, cr: 5 },
  { nombre: "Programación Visual", clave: "ETD-1025", semestre: 4, ht: 2, hp: 3, cr: 5 },
  { nombre: "Diseño Digital con VHDL", clave: "ETF-1015", semestre: 4, ht: 3, hp: 2, cr: 5 },
  { nombre: "Administración Gerencial", clave: "ETR-1001", semestre: 4, ht: 2, hp: 1, cr: 3 },
  // Semestre 5
  { nombre: "Circuitos Eléctricos II", clave: "ETF-1005", semestre: 5, ht: 3, hp: 2, cr: 5 },
  { nombre: "Diodos y Transistores", clave: "ETF-1012", semestre: 5, ht: 3, hp: 2, cr: 5 },
  { nombre: "Teoría Electromagnética", clave: "ETF-1026", semestre: 5, ht: 3, hp: 2, cr: 5 },
  { nombre: "Máquinas Eléctricas", clave: "AEF-1040", semestre: 5, ht: 3, hp: 2, cr: 5 },
  { nombre: "Desarrollo Profesional", clave: "AEO-1388", semestre: 5, ht: 0, hp: 3, cr: 3 },
  { nombre: "Instrumentación", clave: "AEF-1038", semestre: 5, ht: 3, hp: 2, cr: 5 },
  { nombre: "Fundamentos Financieros", clave: "ETP-1018", semestre: 5, ht: 3, hp: 0, cr: 3 },
  // Semestre 6
  { nombre: "Control I", clave: "AEF-1009", semestre: 6, ht: 3, hp: 2, cr: 5 },
  { nombre: "Diseño con Transistores", clave: "ETF-1013", semestre: 6, ht: 3, hp: 2, cr: 5 },
  { nombre: "Microcontroladores", clave: "ETD-1022", semestre: 6, ht: 2, hp: 3, cr: 5 },
  { nombre: "Amplificadores Operacionales", clave: "ETF-1002", semestre: 6, ht: 3, hp: 2, cr: 5 },
  { nombre: "Taller de Investigación I", clave: "ACA-0909", semestre: 6, ht: 0, hp: 4, cr: 4 },
  { nombre: "Electrónica de Potencia", clave: "ETF-1016", semestre: 6, ht: 3, hp: 2, cr: 5 },
  { nombre: "Desarrollo y Evaluación de Proyectos", clave: "AEO-1389", semestre: 6, ht: 0, hp: 3, cr: 3 },
  // Semestre 7
  { nombre: "Control II", clave: "AEF-1010", semestre: 7, ht: 3, hp: 2, cr: 5 },
  { nombre: "Optoelectrónica", clave: "ETF-1023", semestre: 7, ht: 3, hp: 2, cr: 5 },
  { nombre: "Introducción a las Telecomunicaciones", clave: "ETF-1019", semestre: 7, ht: 3, hp: 2, cr: 5 },
  { nombre: "Taller de Investigación II", clave: "ACA-0910", semestre: 7, ht: 0, hp: 4, cr: 4 },
  { nombre: "Control Digital", clave: "ETF-1007", semestre: 7, ht: 3, hp: 2, cr: 5 },
  { nombre: "Controladores Lógicos Programables", clave: "ETF-1008", semestre: 7, ht: 3, hp: 2, cr: 5 },
  // Semestre 8
  { nombre: "Medición e Instrumentación Virtual", clave: "IND-1802", semestre: 8, ht: 2, hp: 3, cr: 5 },
  { nombre: "Automatización", clave: "IND-1803", semestre: 8, ht: 2, hp: 3, cr: 5 },
  { nombre: "Inteligencia Artificial Difusa", clave: "INF-1806", semestre: 8, ht: 3, hp: 2, cr: 5 },
  { nombre: "Instrumentación Industrial", clave: "INF-1804", semestre: 8, ht: 3, hp: 2, cr: 5 },
  // Semestre 9
  { nombre: "Control de Procesos I", clave: "INF-1801", semestre: 9, ht: 3, hp: 2, cr: 5 },
  { nombre: "Control de Procesos II", clave: "INF-1805", semestre: 9, ht: 3, hp: 2, cr: 5 },
],

// ── ING. GESTIÓN EMPRESARIAL (IGEM-2009-201) – Código "04" ──────────────────
"04": [
  // Semestre 1
  { nombre: "Fundamentos de Investigación", clave: "ACC-0906", semestre: 1, ht: 2, hp: 2, cr: 4 },
  { nombre: "Cálculo Diferencial", clave: "ACF-0901", semestre: 1, ht: 3, hp: 2, cr: 5 },
  { nombre: "Desarrollo Humano", clave: "GEC-0905", semestre: 1, ht: 2, hp: 2, cr: 4 },
  { nombre: "Fundamentos de Gestión Empresarial", clave: "AEF-1074", semestre: 1, ht: 3, hp: 2, cr: 5 },
  { nombre: "Fundamentos de Física", clave: "GEC-0909", semestre: 1, ht: 2, hp: 2, cr: 4 },
  { nombre: "Fundamentos de Química", clave: "GEF-0910", semestre: 1, ht: 3, hp: 2, cr: 5 },
  // Semestre 2
  { nombre: "Software de Aplicación Ejecutivo", clave: "AEB-1082", semestre: 2, ht: 1, hp: 4, cr: 5 },
  { nombre: "Cálculo Integral", clave: "ACF-0902", semestre: 2, ht: 3, hp: 2, cr: 5 },
  { nombre: "Contabilidad Orientada a los Negocios", clave: "GED-0903", semestre: 2, ht: 2, hp: 3, cr: 5 },
  { nombre: "Dinámica Social", clave: "AEC-1014", semestre: 2, ht: 2, hp: 2, cr: 4 },
  { nombre: "Taller de Ética", clave: "ACA-0907", semestre: 2, ht: 0, hp: 4, cr: 4 },
  { nombre: "Legislación Laboral", clave: "GEE-0918", semestre: 2, ht: 3, hp: 1, cr: 4 },
  // Semestre 3
  { nombre: "Marco Legal de las Organizaciones", clave: "AEC-1078", semestre: 3, ht: 2, hp: 2, cr: 4 },
  { nombre: "Probabilidad y Estadística Descriptiva", clave: "GED-0921", semestre: 3, ht: 2, hp: 3, cr: 5 },
  { nombre: "Costos Empresariales", clave: "GED-0904", semestre: 3, ht: 2, hp: 3, cr: 5 },
  { nombre: "Habilidades Directivas I", clave: "GEC-0913", semestre: 3, ht: 2, hp: 2, cr: 4 },
  { nombre: "Economía Empresarial", clave: "AEF-1071", semestre: 3, ht: 3, hp: 2, cr: 5 },
  { nombre: "Álgebra Lineal", clave: "ACF-0903", semestre: 3, ht: 3, hp: 2, cr: 5 },
  // Semestre 4
  { nombre: "Ingeniería Económica", clave: "GEF-0916", semestre: 4, ht: 3, hp: 2, cr: 5 },
  { nombre: "Estadística Inferencial I", clave: "GEG-0907", semestre: 4, ht: 3, hp: 3, cr: 6 },
  { nombre: "Instrumentos de Presupuestación Empresarial", clave: "GED-0917", semestre: 4, ht: 2, hp: 3, cr: 5 },
  { nombre: "Habilidades Directivas II", clave: "GEC-0914", semestre: 4, ht: 2, hp: 2, cr: 4 },
  { nombre: "Entorno Macroeconómico", clave: "GEF-0906", semestre: 4, ht: 3, hp: 2, cr: 5 },
  { nombre: "Investigación de Operaciones", clave: "AEF-1076", semestre: 4, ht: 3, hp: 2, cr: 5 },
  // Semestre 5
  { nombre: "Finanzas en las Organizaciones", clave: "AEF-1073", semestre: 5, ht: 3, hp: 2, cr: 5 },
  { nombre: "Estadística Inferencial II", clave: "GEG-0908", semestre: 5, ht: 3, hp: 3, cr: 6 },
  { nombre: "Ingeniería de Procesos", clave: "GEF-0915", semestre: 5, ht: 3, hp: 2, cr: 5 },
  { nombre: "Gestión del Capital Humano", clave: "AEG-1075", semestre: 5, ht: 3, hp: 3, cr: 6 },
  { nombre: "Taller de Investigación I", clave: "ACA-0909", semestre: 5, ht: 0, hp: 4, cr: 4 },
  { nombre: "Mercadotecnia", clave: "GEF-0919", semestre: 5, ht: 3, hp: 2, cr: 5 },
  // Semestre 6
  { nombre: "Administración de la Salud y Seguridad Ocupacional", clave: "GEF-0901", semestre: 6, ht: 3, hp: 2, cr: 5 },
  { nombre: "El Emprendedor y la Innovación", clave: "AED-1072", semestre: 6, ht: 2, hp: 3, cr: 5 },
  { nombre: "Gestión de la Producción I", clave: "GEC-0911", semestre: 6, ht: 2, hp: 2, cr: 4 },
  { nombre: "Diseño Organizacional", clave: "AED-1015", semestre: 6, ht: 2, hp: 3, cr: 5 },
  { nombre: "Taller de Investigación II", clave: "ACA-0910", semestre: 6, ht: 0, hp: 4, cr: 4 },
  { nombre: "Sistemas de Información de Mercadotecnia", clave: "GED-0922", semestre: 6, ht: 2, hp: 3, cr: 5 },
  // Semestre 7
  { nombre: "Calidad Aplicada a la Gestión Empresarial", clave: "AED-1069", semestre: 7, ht: 2, hp: 3, cr: 5 },
  { nombre: "Plan de Negocios", clave: "GED-0920", semestre: 7, ht: 2, hp: 3, cr: 5 },
  { nombre: "Gestión de la Producción II", clave: "GEC-0912", semestre: 7, ht: 2, hp: 2, cr: 4 },
  { nombre: "Gestión Estratégica", clave: "AED-1035", semestre: 7, ht: 2, hp: 3, cr: 5 },
  { nombre: "Desarrollo Sustentable", clave: "ACD-0908", semestre: 7, ht: 2, hp: 3, cr: 5 },
  { nombre: "Mercadotecnia Electrónica", clave: "AEB-1045", semestre: 7, ht: 1, hp: 4, cr: 5 },
  { nombre: "Cadena de Suministros", clave: "GEF-0902", semestre: 7, ht: 3, hp: 2, cr: 5 },
],

// ── ING. INNOVACIÓN AGRÍCOLA SUSTENTABLE (IIAS-2010-221) – Código "05" ──────
"05": [
  // Semestre 1
  { nombre: "Álgebra Lineal", clave: "ACF-0903", semestre: 1, ht: 3, hp: 2, cr: 5 },
  { nombre: "Química", clave: "AEF-1056", semestre: 1, ht: 3, hp: 2, cr: 5 },
  { nombre: "Taller de Elementos de Mecánica de Sólidos", clave: "ASQ-1023", semestre: 1, ht: 1, hp: 2, cr: 3 },
  { nombre: "Biología", clave: "ASF-1004", semestre: 1, ht: 3, hp: 2, cr: 5 },
  { nombre: "Tecnologías de la Información y las Comunicaciones", clave: "AEQ-1064", semestre: 1, ht: 1, hp: 2, cr: 3 },
  { nombre: "Taller de Ética", clave: "ACA-0907", semestre: 1, ht: 0, hp: 4, cr: 4 },
  { nombre: "Fundamentos de Investigación", clave: "ACC-0906", semestre: 1, ht: 2, hp: 2, cr: 4 },
  // Semestre 2
  { nombre: "Cálculo Diferencial", clave: "ACF-0901", semestre: 2, ht: 3, hp: 2, cr: 5 },
  { nombre: "Química Analítica", clave: "ASF-1019", semestre: 2, ht: 3, hp: 2, cr: 5 },
  { nombre: "Edafología", clave: "AEF-1019", semestre: 2, ht: 3, hp: 2, cr: 5 },
  { nombre: "Elementos de Termodinámica", clave: "ASF-1009", semestre: 2, ht: 3, hp: 2, cr: 5 },
  { nombre: "Botánica Aplicada", clave: "ASF-1006", semestre: 2, ht: 3, hp: 2, cr: 5 },
  { nombre: "Estadística", clave: "ASF-1010", semestre: 2, ht: 3, hp: 2, cr: 5 },
  // Semestre 3
  { nombre: "Cálculo Integral", clave: "ACF-0902", semestre: 3, ht: 3, hp: 2, cr: 5 },
  { nombre: "Ecología", clave: "AEF-1017", semestre: 3, ht: 3, hp: 2, cr: 5 },
  { nombre: "Diseño Agrícola Asistido por Computadora", clave: "ASQ-1008", semestre: 3, ht: 1, hp: 2, cr: 3 },
  { nombre: "Bioquímica", clave: "AED-1006", semestre: 3, ht: 2, hp: 3, cr: 5 },
  { nombre: "Principios de Electromecánica", clave: "ASF-1018", semestre: 3, ht: 3, hp: 2, cr: 5 },
  { nombre: "Topografía", clave: "AEM-1066", semestre: 3, ht: 2, hp: 4, cr: 6 },
  { nombre: "Métodos Estadísticos", clave: "ASF-1015", semestre: 3, ht: 3, hp: 2, cr: 5 },
  { nombre: "Desarrollo Sustentable", clave: "ACD-0908", semestre: 3, ht: 2, hp: 3, cr: 5 },
  // Semestre 4
  { nombre: "Hidráulica", clave: "AEF-1036", semestre: 4, ht: 3, hp: 2, cr: 5 },
  { nombre: "Agroclimatología", clave: "AEF-1001", semestre: 4, ht: 3, hp: 2, cr: 5 },
  { nombre: "Diseños Experimentales", clave: "AEF-1016", semestre: 4, ht: 3, hp: 2, cr: 5 },
  { nombre: "Fisiología Vegetal", clave: "ASF-1012", semestre: 4, ht: 3, hp: 2, cr: 5 },
  { nombre: "Microbiología", clave: "AEF-1049", semestre: 4, ht: 3, hp: 2, cr: 5 },
  { nombre: "Base de Datos y Sistemas de Información Geográfica", clave: "ASC-1003", semestre: 4, ht: 2, hp: 2, cr: 4 },
  // Semestre 5
  { nombre: "Biología Molecular", clave: "ASF-1005", semestre: 5, ht: 3, hp: 2, cr: 5 },
  { nombre: "Nutrición Vegetal", clave: "ASF-1016", semestre: 5, ht: 3, hp: 2, cr: 5 },
  { nombre: "Sistemas de Producción Agrícola", clave: "ASD-1020", semestre: 5, ht: 2, hp: 3, cr: 5 },
  { nombre: "Entomología", clave: "AED-1023", semestre: 5, ht: 2, hp: 3, cr: 5 },
  { nombre: "Fitopatología", clave: "AEJ-1028", semestre: 5, ht: 4, hp: 2, cr: 6 },
  { nombre: "Sistemas de Riego Superficial", clave: "ASF-1022", semestre: 5, ht: 3, hp: 2, cr: 5 },
  { nombre: "Taller de Investigación I", clave: "ACA-0909", semestre: 5, ht: 0, hp: 4, cr: 4 },
  // Semestre 6
  { nombre: "Desarrollo Comunitario", clave: "ASD-1007", semestre: 6, ht: 2, hp: 3, cr: 5 },
  { nombre: "Sistemas de Riego Presurizado", clave: "ASF-1021", semestre: 6, ht: 3, hp: 2, cr: 5 },
  { nombre: "Agroecología", clave: "AED-1002", semestre: 6, ht: 2, hp: 3, cr: 5 },
  { nombre: "Olericultura", clave: "ASF-1017", semestre: 6, ht: 3, hp: 2, cr: 5 },
  { nombre: "Introducción a la Agricultura Protegida", clave: "ASF-1014", semestre: 6, ht: 3, hp: 2, cr: 5 },
  // Semestre 7
  { nombre: "Agronegocios I", clave: "ASD-1001", semestre: 7, ht: 2, hp: 3, cr: 5 },
  { nombre: "Inocuidad Alimentaria y Bioseguridad", clave: "ASC-1013", semestre: 7, ht: 2, hp: 2, cr: 4 },
  { nombre: "Fertirrigación", clave: "ASF-1011", semestre: 7, ht: 3, hp: 2, cr: 5 },
  { nombre: "Taller de Investigación II", clave: "ACA-0910", semestre: 7, ht: 0, hp: 4, cr: 4 },
  // Semestre 8
  { nombre: "Agronegocios II", clave: "ASD-1002", semestre: 8, ht: 2, hp: 3, cr: 5 },
],

// ── ING. SISTEMAS COMPUTACIONALES (ISIC-2010-224) – Código "06" ─────────────
"06": [
  // Semestre 1
  { nombre: "Cálculo Diferencial", clave: "ACF-0901", semestre: 1, ht: 3, hp: 2, cr: 5 },
  { nombre: "Fundamentos de Programación", clave: "AED-1285", semestre: 1, ht: 2, hp: 3, cr: 5 },
  { nombre: "Taller de Ética", clave: "ACA-0907", semestre: 1, ht: 0, hp: 4, cr: 4 },
  { nombre: "Matemáticas Discretas", clave: "AEF-1041", semestre: 1, ht: 3, hp: 2, cr: 5 },
  { nombre: "Taller de Administración", clave: "SCH-1024", semestre: 1, ht: 1, hp: 3, cr: 4 },
  { nombre: "Fundamentos de Investigación", clave: "ACC-0906", semestre: 1, ht: 2, hp: 2, cr: 4 },
  // Semestre 2
  { nombre: "Cálculo Integral", clave: "ACF-0902", semestre: 2, ht: 3, hp: 2, cr: 5 },
  { nombre: "Programación Orientada a Objetos", clave: "AED-1286", semestre: 2, ht: 2, hp: 3, cr: 5 },
  { nombre: "Contabilidad Financiera", clave: "AEC-1008", semestre: 2, ht: 2, hp: 2, cr: 4 },
  { nombre: "Química", clave: "AEC-1058", semestre: 2, ht: 2, hp: 2, cr: 4 },
  { nombre: "Álgebra Lineal", clave: "ACF-0903", semestre: 2, ht: 3, hp: 2, cr: 5 },
  { nombre: "Probabilidad y Estadística", clave: "AEF-1052", semestre: 2, ht: 3, hp: 2, cr: 5 },
  // Semestre 3
  { nombre: "Cálculo Vectorial", clave: "ACF-0904", semestre: 3, ht: 3, hp: 2, cr: 5 },
  { nombre: "Estructura de Datos", clave: "AED-1026", semestre: 3, ht: 2, hp: 3, cr: 5 },
  { nombre: "Cultura Empresarial", clave: "SCC-1005", semestre: 3, ht: 2, hp: 2, cr: 4 },
  { nombre: "Investigación de Operaciones", clave: "SCC-1013", semestre: 3, ht: 2, hp: 2, cr: 4 },
  { nombre: "Desarrollo Sustentable", clave: "ACD-0908", semestre: 3, ht: 2, hp: 3, cr: 5 },
  { nombre: "Física General", clave: "SCF-1006", semestre: 3, ht: 3, hp: 2, cr: 5 },
  // Semestre 4
  { nombre: "Ecuaciones Diferenciales", clave: "ACF-0905", semestre: 4, ht: 3, hp: 2, cr: 5 },
  { nombre: "Métodos Numéricos", clave: "SCC-1017", semestre: 4, ht: 2, hp: 2, cr: 4 },
  { nombre: "Tópicos Avanzados de Programación", clave: "SCD-1027", semestre: 4, ht: 2, hp: 3, cr: 5 },
  { nombre: "Fundamentos de Base de Datos", clave: "AEF-1031", semestre: 4, ht: 3, hp: 2, cr: 5 },
  { nombre: "Simulación", clave: "SCD-1022", semestre: 4, ht: 2, hp: 3, cr: 5 },
  { nombre: "Principios Eléctricos y Aplicaciones Digitales", clave: "SCD-1018", semestre: 4, ht: 2, hp: 3, cr: 5 },
  // Semestre 5
  { nombre: "Graficación", clave: "SCC-1010", semestre: 5, ht: 2, hp: 2, cr: 4 },
  { nombre: "Fundamentos de Telecomunicaciones", clave: "AEC-1034", semestre: 5, ht: 2, hp: 2, cr: 4 },
  { nombre: "Sistemas Operativos", clave: "AEC-1061", semestre: 5, ht: 2, hp: 2, cr: 4 },
  { nombre: "Taller de Base de Datos", clave: "SCA-1025", semestre: 5, ht: 0, hp: 4, cr: 4 },
  { nombre: "Fundamentos de Ingeniería de Software", clave: "SCC-1007", semestre: 5, ht: 2, hp: 2, cr: 4 },
  { nombre: "Arquitectura de Computadoras", clave: "SCD-1003", semestre: 5, ht: 2, hp: 3, cr: 5 },
  // Semestre 6
  { nombre: "Lenguajes y Autómatas I", clave: "SCD-1015", semestre: 6, ht: 2, hp: 3, cr: 5 },
  { nombre: "Redes de Computadoras", clave: "SCD-1021", semestre: 6, ht: 2, hp: 3, cr: 5 },
  { nombre: "Taller de Sistemas Operativos", clave: "SCA-1026", semestre: 6, ht: 0, hp: 4, cr: 4 },
  { nombre: "Administración de Base de Datos", clave: "SCB-1001", semestre: 6, ht: 1, hp: 4, cr: 5 },
  { nombre: "Ingeniería de Software", clave: "SCD-1011", semestre: 6, ht: 2, hp: 3, cr: 5 },
  { nombre: "Lenguajes de Interfaz", clave: "SCC-1014", semestre: 6, ht: 2, hp: 2, cr: 4 },
  // Semestre 7
  { nombre: "Lenguajes y Autómatas II", clave: "SCD-1016", semestre: 7, ht: 2, hp: 3, cr: 5 },
  { nombre: "Conmutación y Enrutamiento en Redes de Datos", clave: "SCD-1004", semestre: 7, ht: 2, hp: 3, cr: 5 },
  { nombre: "Taller de Investigación I", clave: "ACA-0909", semestre: 7, ht: 0, hp: 4, cr: 4 },
  { nombre: "Gestión de Proyectos de Software", clave: "SCG-1009", semestre: 7, ht: 3, hp: 3, cr: 6 },
  { nombre: "Sistemas Programables", clave: "SCC-1023", semestre: 7, ht: 2, hp: 2, cr: 4 },
  // Semestre 8
  { nombre: "Programación Lógica y Funcional", clave: "SCC-1019", semestre: 8, ht: 2, hp: 2, cr: 4 },
  { nombre: "Administración de Redes", clave: "SCA-1002", semestre: 8, ht: 0, hp: 4, cr: 4 },
  { nombre: "Taller de Investigación II", clave: "ACA-0910", semestre: 8, ht: 0, hp: 4, cr: 4 },
  { nombre: "Programación Web", clave: "AEB-1055", semestre: 8, ht: 1, hp: 4, cr: 5 },
  // Semestre 9
  { nombre: "Inteligencia Artificial", clave: "SCC-1012", semestre: 9, ht: 2, hp: 2, cr: 4 },
],

// ── ING. INDUSTRIAL (IIND-2010-227) – Código "07" ───────────────────────────
"07": [
  // Semestre 1
  { nombre: "Fundamentos de Investigación", clave: "ACC-0906", semestre: 1, ht: 2, hp: 2, cr: 4 },
  { nombre: "Taller de Ética", clave: "ACA-0907", semestre: 1, ht: 0, hp: 4, cr: 4 },
  { nombre: "Cálculo Diferencial", clave: "ACF-0901", semestre: 1, ht: 3, hp: 2, cr: 5 },
  { nombre: "Taller de Herramientas Intelectuales", clave: "INH-1029", semestre: 1, ht: 1, hp: 3, cr: 4 },
  { nombre: "Química", clave: "INC-1025", semestre: 1, ht: 2, hp: 2, cr: 4 },
  { nombre: "Dibujo Industrial", clave: "INN-1008", semestre: 1, ht: 0, hp: 6, cr: 6 },
  // Semestre 2
  { nombre: "Electricidad y Electrónica Industrial", clave: "INC-1009", semestre: 2, ht: 2, hp: 2, cr: 4 },
  { nombre: "Propiedad de los Materiales", clave: "INC-1024", semestre: 2, ht: 2, hp: 2, cr: 4 },
  { nombre: "Cálculo Integral", clave: "ACF-0902", semestre: 2, ht: 3, hp: 2, cr: 5 },
  { nombre: "Taller de Liderazgo", clave: "INC-1030", semestre: 2, ht: 2, hp: 2, cr: 4 },
  { nombre: "Probabilidad y Estadística", clave: "AEC-1053", semestre: 2, ht: 2, hp: 2, cr: 4 },
  { nombre: "Análisis de la Realidad Nacional", clave: "INQ-1006", semestre: 2, ht: 1, hp: 2, cr: 3 },
  { nombre: "Ingeniería de Sistemas", clave: "INR-1017", semestre: 2, ht: 2, hp: 1, cr: 3 },
  // Semestre 3
  { nombre: "Metrología y Normalización", clave: "AEC-1048", semestre: 3, ht: 2, hp: 2, cr: 4 },
  { nombre: "Álgebra Lineal", clave: "ACF-0903", semestre: 3, ht: 3, hp: 2, cr: 5 },
  { nombre: "Cálculo Vectorial", clave: "ACF-0904", semestre: 3, ht: 3, hp: 2, cr: 5 },
  { nombre: "Economía", clave: "AEC-1018", semestre: 3, ht: 2, hp: 2, cr: 4 },
  { nombre: "Estadística Inferencial I", clave: "AEF-1024", semestre: 3, ht: 3, hp: 2, cr: 5 },
  { nombre: "Estudio del Trabajo I", clave: "INJ-1011", semestre: 3, ht: 4, hp: 2, cr: 6 },
  { nombre: "Desarrollo Sustentable", clave: "ACD-0908", semestre: 3, ht: 2, hp: 3, cr: 5 },
  // Semestre 4
  { nombre: "Procesos de Fabricación", clave: "INC-1023", semestre: 4, ht: 2, hp: 2, cr: 4 },
  { nombre: "Física", clave: "INC-1013", semestre: 4, ht: 2, hp: 2, cr: 4 },
  { nombre: "Algoritmos y Lenguajes de Programación", clave: "INC-1005", semestre: 4, ht: 2, hp: 2, cr: 4 },
  { nombre: "Investigación de Operaciones I", clave: "INC-1018", semestre: 4, ht: 2, hp: 2, cr: 4 },
  { nombre: "Estadística Inferencial II", clave: "AEF-1025", semestre: 4, ht: 3, hp: 2, cr: 5 },
  { nombre: "Estudio del Trabajo II", clave: "INJ-1012", semestre: 4, ht: 4, hp: 2, cr: 6 },
  { nombre: "Gestión de Costos", clave: "AEC-1392", semestre: 4, ht: 2, hp: 2, cr: 4 },
  // Semestre 5
  { nombre: "Administración de Proyectos", clave: "INR-1003", semestre: 5, ht: 2, hp: 1, cr: 3 },
  { nombre: "Ingeniería Económica", clave: "AEC-1037", semestre: 5, ht: 2, hp: 2, cr: 4 },
  { nombre: "Administración de las Operaciones I", clave: "INC-1001", semestre: 5, ht: 2, hp: 2, cr: 4 },
  { nombre: "Investigación de Operaciones II", clave: "INC-1019", semestre: 5, ht: 2, hp: 2, cr: 4 },
  { nombre: "Control Estadístico de la Calidad", clave: "INF-1007", semestre: 5, ht: 3, hp: 2, cr: 5 },
  { nombre: "Ergonomía", clave: "INF-1010", semestre: 5, ht: 2, hp: 2, cr: 4 },
  { nombre: "Higiene y Seguridad Industrial", clave: "INF-1016", semestre: 5, ht: 3, hp: 2, cr: 5 },
  // Semestre 6
  { nombre: "Taller de Investigación I", clave: "ACA-0909", semestre: 6, ht: 0, hp: 4, cr: 4 },
  { nombre: "Planeación Financiera", clave: "INC-1021", semestre: 6, ht: 2, hp: 2, cr: 4 },
  { nombre: "Administración de las Operaciones II", clave: "INC-1002", semestre: 6, ht: 2, hp: 2, cr: 4 },
  { nombre: "Simulación", clave: "INC-1027", semestre: 6, ht: 2, hp: 2, cr: 4 },
  { nombre: "Administración del Mantenimiento", clave: "INC-1004", semestre: 6, ht: 2, hp: 2, cr: 4 },
  { nombre: "Mercadotecnia", clave: "AED-1044", semestre: 6, ht: 1, hp: 3, cr: 4 },
  { nombre: "Sistemas de Manufactura", clave: "INF-1028", semestre: 6, ht: 3, hp: 2, cr: 5 },
  { nombre: "Seis Sigma", clave: "MAG-2101", semestre: 6, ht: 3, hp: 3, cr: 6 },
  // Semestre 7
  { nombre: "Taller de Investigación II", clave: "ACA-0910", semestre: 7, ht: 0, hp: 4, cr: 4 },
  { nombre: "Relaciones Industriales", clave: "INC-1026", semestre: 7, ht: 2, hp: 2, cr: 4 },
  { nombre: "Planeación y Diseño de Instalaciones", clave: "INC-1022", semestre: 7, ht: 2, hp: 2, cr: 4 },
  { nombre: "Manufactura 4.0", clave: "MAM-2103", semestre: 7, ht: 2, hp: 4, cr: 6 },
  { nombre: "Logística y Cadenas de Suministros", clave: "INH-1020", semestre: 7, ht: 1, hp: 3, cr: 4 },
  { nombre: "Gestión de los Sistemas de Calidad", clave: "INC-1015", semestre: 7, ht: 2, hp: 2, cr: 4 },
  { nombre: "Manufactura Esbelta", clave: "MAB-2102", semestre: 7, ht: 1, hp: 4, cr: 5 },
  // Semestre 8
  { nombre: "Formulación y Evaluación de Proyectos", clave: "AED-1030", semestre: 8, ht: 2, hp: 3, cr: 5 },
  { nombre: "Taller CAD", clave: "MAV-2104", semestre: 8, ht: 0, hp: 5, cr: 5 },
  { nombre: "Gestión Avanzada de Manufactura", clave: "MAF-2105", semestre: 8, ht: 3, hp: 2, cr: 5 },
  { nombre: "Ingeniería y Tecnología Automatizada", clave: "MAT-2106", semestre: 8, ht: 1, hp: 3, cr: 4 },
],

// ── ING. INFORMÁTICA (IINF-2010-220) – Código "08" ──────────────────────────
"08": [
  // Semestre 1
  { nombre: "Administración para Informática", clave: "IFE-1004", semestre: 1, ht: 3, hp: 1, cr: 4 },
  { nombre: "Fundamentos de Investigación", clave: "ACC-0906", semestre: 1, ht: 2, hp: 2, cr: 4 },
  { nombre: "Fundamentos de Programación", clave: "AEF-1032", semestre: 1, ht: 3, hp: 2, cr: 5 },
  { nombre: "Taller de Ética", clave: "ACA-0907", semestre: 1, ht: 0, hp: 4, cr: 4 },
  { nombre: "Cálculo Diferencial", clave: "ACF-0901", semestre: 1, ht: 3, hp: 2, cr: 5 },
  { nombre: "Desarrollo Sustentable", clave: "ACD-0908", semestre: 1, ht: 2, hp: 3, cr: 5 },
  // Semestre 2
  { nombre: "Administración de los Recursos y Función Informática", clave: "IFC-1001", semestre: 2, ht: 2, hp: 2, cr: 4 },
  { nombre: "Física para Informática", clave: "IFD-1013", semestre: 2, ht: 2, hp: 3, cr: 5 },
  { nombre: "Programación Orientada a Objetos", clave: "AEB-1054", semestre: 2, ht: 1, hp: 4, cr: 5 },
  { nombre: "Contabilidad Financiera", clave: "AEC-1008", semestre: 2, ht: 2, hp: 2, cr: 4 },
  { nombre: "Cálculo Integral", clave: "ACF-0902", semestre: 2, ht: 3, hp: 2, cr: 5 },
  { nombre: "Matemáticas Discretas", clave: "AEF-1041", semestre: 2, ht: 3, hp: 2, cr: 5 },
  // Semestre 3
  { nombre: "Fundamentos de Sistemas de Información", clave: "IFE-1015", semestre: 3, ht: 3, hp: 1, cr: 4 },
  { nombre: "Sistemas Electrónicos para Informática", clave: "IFC-1022", semestre: 3, ht: 2, hp: 2, cr: 4 },
  { nombre: "Estructura de Datos", clave: "AED-1026", semestre: 3, ht: 2, hp: 3, cr: 5 },
  { nombre: "Costos Empresariales", clave: "IFC-1009", semestre: 3, ht: 2, hp: 2, cr: 4 },
  { nombre: "Álgebra Lineal", clave: "ACF-0903", semestre: 3, ht: 3, hp: 2, cr: 5 },
  { nombre: "Probabilidad y Estadística", clave: "AEF-1052", semestre: 3, ht: 3, hp: 2, cr: 5 },
  // Semestre 4
  { nombre: "Taller de Investigación I", clave: "ACA-0909", semestre: 4, ht: 0, hp: 4, cr: 4 },
  { nombre: "Arquitectura de Computadoras", clave: "IFD-1006", semestre: 4, ht: 2, hp: 3, cr: 5 },
  { nombre: "Administración y Organización de Datos", clave: "IFF-1003", semestre: 4, ht: 3, hp: 2, cr: 5 },
  { nombre: "Fundamentos de Telecomunicaciones", clave: "AEC-1034", semestre: 4, ht: 2, hp: 2, cr: 4 },
  { nombre: "Sistemas Operativos I", clave: "AEC-1061", semestre: 4, ht: 2, hp: 2, cr: 4 },
  { nombre: "Investigación de Operaciones", clave: "IFF-1018", semestre: 4, ht: 3, hp: 2, cr: 5 },
  // Semestre 5
  { nombre: "Análisis y Modelado de Sistemas de Información", clave: "IFF-1005", semestre: 5, ht: 3, hp: 2, cr: 5 },
  { nombre: "Tecnologías e Interfaces de Computadoras", clave: "IFC-1025", semestre: 5, ht: 2, hp: 2, cr: 4 },
  { nombre: "Fundamentos de Base de Datos", clave: "AEF-1031", semestre: 5, ht: 3, hp: 2, cr: 5 },
  { nombre: "Redes de Computadoras", clave: "IFD-1020", semestre: 5, ht: 2, hp: 3, cr: 5 },
  { nombre: "Sistemas Operativos II", clave: "AED-1062", semestre: 5, ht: 2, hp: 3, cr: 5 },
  { nombre: "Taller de Legislación Informática", clave: "IFR-1024", semestre: 5, ht: 2, hp: 1, cr: 3 },
  // Semestre 6
  { nombre: "Desarrollo e Implementación de Sistemas de Información", clave: "IFD-1011", semestre: 6, ht: 2, hp: 3, cr: 5 },
  { nombre: "Auditoría en Informática", clave: "IFH-1007", semestre: 6, ht: 1, hp: 3, cr: 4 },
  { nombre: "Taller de Base de Datos", clave: "AEA-1063", semestre: 6, ht: 0, hp: 4, cr: 4 },
  { nombre: "Interconectividad de Redes", clave: "IFM-1017", semestre: 6, ht: 2, hp: 4, cr: 6 },
  { nombre: "Desarrollo de Aplicaciones Web", clave: "IFD-1010", semestre: 6, ht: 2, hp: 3, cr: 5 },
  { nombre: "Taller de Investigación II", clave: "ACA-0910", semestre: 6, ht: 0, hp: 4, cr: 4 },
  // Semestre 7
  { nombre: "Calidad en los Sistemas de Información", clave: "IFC-1008", semestre: 7, ht: 2, hp: 2, cr: 4 },
  { nombre: "Fundamentos de Gestión de Servicios de TI", clave: "IFE-1014", semestre: 7, ht: 3, hp: 1, cr: 4 },
  { nombre: "Tópicos de Base de Datos", clave: "IFF-1026", semestre: 7, ht: 3, hp: 2, cr: 5 },
  { nombre: "Administración de Servidores", clave: "IFH-1002", semestre: 7, ht: 1, hp: 3, cr: 4 },
  { nombre: "Programación en Ambiente Cliente/Servidor", clave: "IFF-1019", semestre: 7, ht: 3, hp: 2, cr: 5 },
  // Semestre 8
  { nombre: "Taller de Emprendedores", clave: "IFD-1023", semestre: 8, ht: 2, hp: 3, cr: 5 },
  { nombre: "Estrategias de Gestión de Servicios de TI", clave: "IFF-1012", semestre: 8, ht: 3, hp: 2, cr: 5 },
  { nombre: "Inteligencia de Negocios", clave: "IFF-1016", semestre: 8, ht: 3, hp: 2, cr: 5 },
  { nombre: "Desarrollo de Aplicaciones para Dispositivos Móviles", clave: "AEB-1011", semestre: 8, ht: 1, hp: 4, cr: 5 },
  { nombre: "Seguridad Informática", clave: "IFC-1021", semestre: 8, ht: 2, hp: 2, cr: 4 },
],

// ── ING. PETROLERA (IPET-2010-231) – Código "09" ────────────────────────────
"09": [
  // Semestre 1
  { nombre: "Química Inorgánica", clave: "PEG-1025", semestre: 1, ht: 3, hp: 3, cr: 6 },
  { nombre: "Geología Petrolera", clave: "PED-1015", semestre: 1, ht: 2, hp: 3, cr: 5 },
  { nombre: "Computación para Ingeniería Petrolera", clave: "PED-1006", semestre: 1, ht: 2, hp: 3, cr: 5 },
  { nombre: "Taller de Ética", clave: "ACA-0907", semestre: 1, ht: 0, hp: 4, cr: 4 },
  { nombre: "Fundamentos de Investigación", clave: "ACC-0906", semestre: 1, ht: 2, hp: 2, cr: 4 },
  { nombre: "Cálculo Diferencial", clave: "ACF-0901", semestre: 1, ht: 3, hp: 2, cr: 5 },
  // Semestre 2
  { nombre: "Química Orgánica", clave: "PEG-1026", semestre: 2, ht: 3, hp: 3, cr: 6 },
  { nombre: "Cálculo Integral", clave: "ACF-0902", semestre: 2, ht: 3, hp: 2, cr: 5 },
  { nombre: "Álgebra Lineal", clave: "ACF-0903", semestre: 2, ht: 3, hp: 2, cr: 5 },
  { nombre: "Geología de Yacimientos", clave: "PED-1014", semestre: 2, ht: 2, hp: 3, cr: 5 },
  { nombre: "Estática", clave: "PED-1011", semestre: 2, ht: 2, hp: 3, cr: 5 },
  { nombre: "Economía", clave: "PEQ-1009", semestre: 2, ht: 1, hp: 2, cr: 3 },
  // Semestre 3
  { nombre: "Análisis Numérico", clave: "PEC-1004", semestre: 3, ht: 2, hp: 2, cr: 4 },
  { nombre: "Geología de Explotación del Petróleo", clave: "PED-1013", semestre: 3, ht: 2, hp: 3, cr: 5 },
  { nombre: "Dinámica", clave: "PED-1008", semestre: 3, ht: 2, hp: 3, cr: 5 },
  { nombre: "Cálculo Vectorial", clave: "ACF-0904", semestre: 3, ht: 3, hp: 2, cr: 5 },
  { nombre: "Administración", clave: "PEQ-1001", semestre: 3, ht: 1, hp: 2, cr: 3 },
  { nombre: "Termodinámica", clave: "PED-1031", semestre: 3, ht: 2, hp: 3, cr: 5 },
  // Semestre 4
  { nombre: "Probabilidad y Estadística Aplicada al Campo Petrolero", clave: "PEC-1022", semestre: 4, ht: 2, hp: 2, cr: 4 },
  { nombre: "Administración de la Seguridad y Protección Ambiental", clave: "PED-1002", semestre: 4, ht: 2, hp: 3, cr: 5 },
  { nombre: "Electricidad y Magnetismo", clave: "PED-1010", semestre: 4, ht: 2, hp: 3, cr: 5 },
  { nombre: "Mecánica de Fluidos", clave: "PED-1019", semestre: 4, ht: 2, hp: 3, cr: 5 },
  { nombre: "Ecuaciones Diferenciales", clave: "ACF-0905", semestre: 4, ht: 3, hp: 2, cr: 5 },
  { nombre: "Desarrollo Sustentable", clave: "ACD-0908", semestre: 4, ht: 2, hp: 3, cr: 5 },
  // Semestre 5
  { nombre: "Métodos Eléctricos", clave: "PED-1020", semestre: 5, ht: 2, hp: 3, cr: 5 },
  { nombre: "Calidad en la Industria Petrolera", clave: "PEA-1005", semestre: 5, ht: 0, hp: 4, cr: 4 },
  { nombre: "Análisis e Interpretación de Planos y Diseño de Ingeniería", clave: "PEA-1003", semestre: 5, ht: 0, hp: 4, cr: 4 },
  { nombre: "Propiedades de los Fluidos Petroleros", clave: "PED-1024", semestre: 5, ht: 2, hp: 3, cr: 5 },
  { nombre: "Petrofísica y Registro de Pozos", clave: "PED-1021", semestre: 5, ht: 2, hp: 3, cr: 5 },
  { nombre: "Taller de Investigación I", clave: "ACA-0909", semestre: 5, ht: 0, hp: 4, cr: 4 },
  // Semestre 6
  { nombre: "Flujo Multifásico en Tuberías", clave: "PED-1012", semestre: 6, ht: 2, hp: 3, cr: 5 },
  { nombre: "Sistemas de Bombeo en la Industria Petrolera", clave: "PED-1029", semestre: 6, ht: 2, hp: 3, cr: 5 },
  { nombre: "Legislación de la Industria Petrolera", clave: "PEQ-1018", semestre: 6, ht: 1, hp: 2, cr: 3 },
  { nombre: "Productividad de Pozos", clave: "PEA-1023", semestre: 6, ht: 0, hp: 4, cr: 4 },
  { nombre: "Instrumentación", clave: "AEF-1038", semestre: 6, ht: 3, hp: 2, cr: 5 },
  { nombre: "Hidráulica", clave: "PED-1016", semestre: 6, ht: 2, hp: 3, cr: 5 },
  // Semestre 7
  { nombre: "Ingeniería de Perforación de Pozos", clave: "PED-1017", semestre: 7, ht: 2, hp: 3, cr: 5 },
  { nombre: "Taller de Investigación II", clave: "ACA-0910", semestre: 7, ht: 0, hp: 4, cr: 4 },
  { nombre: "Conducción y Manejo de Hidrocarburos", clave: "PED-1007", semestre: 7, ht: 2, hp: 3, cr: 5 },
  // Semestre 8
  { nombre: "Formulación y Evaluación de Proyectos", clave: "AEF-1029", semestre: 8, ht: 3, hp: 2, cr: 5 },
  { nombre: "Terminación y Mantenimiento de Pozos", clave: "PED-1030", semestre: 8, ht: 2, hp: 3, cr: 5 },
  { nombre: "Recuperación Secundaria y Mejorada", clave: "PED-1027", semestre: 8, ht: 2, hp: 3, cr: 5 },
  { nombre: "Sistemas Artificiales", clave: "PED-1028", semestre: 8, ht: 2, hp: 3, cr: 5 },
],

}; // FIN DE RETICULAS


async function main() {
  console.log('Iniciando seed de retículas...\n');

  // 1. Resetear todos los códigos a valores temporales (evita conflictos de unicidad al reasignar)
  const todasCarreras = await prisma.carrera.findMany();
  for (const c of todasCarreras) {
    await prisma.carrera.update({
      where: { id: c.id },
      data: { codigo: `_${c.id}` },
    });
  }

  // 2. Actualizar códigos y planes de carreras
  for (const carrera of CARRERAS) {
    const existente = await prisma.carrera.findFirst({
      where: { nombre: { contains: carrera.nombre, mode: 'insensitive' } },
    });
    if (existente) {
      await prisma.carrera.update({
        where: { id: existente.id },
        data: { codigo: carrera.codigo, planEstudios: carrera.plan },
      });
      console.log(`✅ Carrera "${existente.nombre}" → código ${carrera.codigo}`);
    } else {
      console.warn(`⚠️  Carrera "${carrera.nombre}" no encontrada en BD, saltando...`);
    }
  }

  console.log('\n--- Insertando materias de retícula ---\n');

  // 2. Insertar materias de retícula
  let totalInsertadas = 0;
  for (const [codigoCarrera, materias] of Object.entries(RETICULAS)) {
    const carrera = await prisma.carrera.findFirst({
      where: { codigo: codigoCarrera },
    });

    if (!carrera) {
      console.warn(`⚠️  Carrera código "${codigoCarrera}" no encontrada, saltando ${materias.length} materias`);
      continue;
    }

    for (const m of materias) {
      await prisma.reticulaMateria.upsert({
        where: { clave_carreraId: { clave: m.clave, carreraId: carrera.id } },
        update: {
          nombre: m.nombre,
          semestre: m.semestre,
          horasTeoria: m.ht,
          horasPractica: m.hp,
          creditos: m.cr,
        },
        create: {
          nombre: m.nombre,
          clave: m.clave,
          semestre: m.semestre,
          carreraId: carrera.id,
          horasTeoria: m.ht,
          horasPractica: m.hp,
          creditos: m.cr,
        },
      });
    }

    totalInsertadas += materias.length;
    console.log(`✅ ${carrera.nombre}: ${materias.length} materias`);
  }

  console.log(`\n=== Total: ${totalInsertadas} materias insertadas/actualizadas ===`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

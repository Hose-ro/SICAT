import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { extname } from 'node:path';

export interface MateriaReticulaImportada {
  nombre: string;
  clave: string;
  semestre: number;
  horasTeoria: number;
  horasPractica: number;
  creditos: number;
}

type RawRow = Record<string, unknown>;

const MAX_MATERIAS = 1000;

const COLUMN_ALIASES = {
  nombre: ['nombre', 'materia', 'asignatura', 'nombremateria'],
  clave: ['clave', 'codigo', 'codigomateria', 'clavemateria'],
  semestre: ['semestre', 'sem'],
  horasTeoria: ['horasteoria', 'teoria', 'ht'],
  horasPractica: ['horaspractica', 'practica', 'hp'],
  creditos: ['creditos', 'credito', 'cr', 'satca'],
} as const;

function scalarString(value: unknown) {
  if (value === null || value === undefined) return '';
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  return '';
}

function normalizeKey(value: unknown) {
  return scalarString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function cellValue(value: unknown): unknown {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return value;

  const cell = value as {
    text?: string;
    result?: unknown;
    richText?: Array<{ text?: string }>;
  };
  if (typeof cell.text === 'string') return cell.text;
  if (cell.result !== undefined) return cell.result;
  if (Array.isArray(cell.richText)) {
    return cell.richText.map((part) => part.text ?? '').join('');
  }
  return '';
}

function findColumn(row: RawRow, aliases: readonly string[]) {
  const normalized = new Map(
    Object.entries(row).map(([key, value]) => [normalizeKey(key), value]),
  );
  for (const alias of aliases) {
    if (normalized.has(alias)) return normalized.get(alias);
  }
  return undefined;
}

function requiredText(value: unknown, field: string, rowNumber: number) {
  const parsed = scalarString(value).trim();
  if (!parsed) {
    throw new BadRequestException(`La fila ${rowNumber} no contiene ${field}`);
  }
  return parsed;
}

function integer(
  value: unknown,
  field: string,
  rowNumber: number,
  min: number,
  max: number,
) {
  const normalized = typeof value === 'string' ? value.trim() : value;
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new BadRequestException(
      `La fila ${rowNumber} tiene ${field} inválido; debe ser un entero entre ${min} y ${max}`,
    );
  }
  return parsed;
}

function validateRows(rows: RawRow[]): MateriaReticulaImportada[] {
  if (rows.length === 0) {
    throw new BadRequestException(
      'La retícula no contiene materias. Revisa el formato del archivo',
    );
  }
  if (rows.length > MAX_MATERIAS) {
    throw new BadRequestException(
      `La retícula no puede contener más de ${MAX_MATERIAS} materias`,
    );
  }

  const claves = new Set<string>();
  return rows.map((row, index) => {
    const rowNumber = index + 2;
    const nombre = requiredText(
      findColumn(row, COLUMN_ALIASES.nombre),
      'el nombre de la materia',
      rowNumber,
    );
    const clave = requiredText(
      findColumn(row, COLUMN_ALIASES.clave),
      'la clave de la materia',
      rowNumber,
    ).toUpperCase();

    if (nombre.length > 160) {
      throw new BadRequestException(
        `La fila ${rowNumber} tiene un nombre de materia demasiado largo`,
      );
    }
    if (clave.length > 40 || !/^[A-Z0-9][A-Z0-9._-]*$/.test(clave)) {
      throw new BadRequestException(
        `La fila ${rowNumber} tiene una clave de materia inválida`,
      );
    }

    if (claves.has(clave)) {
      throw new BadRequestException(
        `La clave ${clave} está repetida en la retícula`,
      );
    }
    claves.add(clave);

    return {
      nombre,
      clave,
      semestre: integer(
        findColumn(row, COLUMN_ALIASES.semestre),
        'el semestre',
        rowNumber,
        1,
        12,
      ),
      horasTeoria: integer(
        findColumn(row, COLUMN_ALIASES.horasTeoria),
        'las horas de teoría',
        rowNumber,
        0,
        20,
      ),
      horasPractica: integer(
        findColumn(row, COLUMN_ALIASES.horasPractica),
        'las horas de práctica',
        rowNumber,
        0,
        20,
      ),
      creditos: integer(
        findColumn(row, COLUMN_ALIASES.creditos),
        'los créditos',
        rowNumber,
        0,
        50,
      ),
    };
  });
}

function headerScore(row: unknown[]) {
  const keys = new Set(row.map(normalizeKey));
  const aliasGroups: ReadonlyArray<readonly string[]> = [
    COLUMN_ALIASES.nombre,
    COLUMN_ALIASES.clave,
    COLUMN_ALIASES.semestre,
    COLUMN_ALIASES.horasTeoria,
    COLUMN_ALIASES.horasPractica,
    COLUMN_ALIASES.creditos,
  ];
  return aliasGroups.filter((aliases) =>
    aliases.some((alias) => keys.has(alias)),
  ).length;
}

function rowsFromMatrix(matrix: unknown[][]): RawRow[] {
  const headerIndex = matrix.findIndex((row) => headerScore(row) >= 3);
  if (headerIndex === -1) {
    throw new BadRequestException(
      'No se encontraron las columnas nombre, clave y semestre en la retícula',
    );
  }

  const headers = matrix[headerIndex].map((value) =>
    scalarString(value).trim(),
  );
  return matrix
    .slice(headerIndex + 1)
    .filter((row) => row.some((value) => scalarString(value).trim()))
    .map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, row[index]])),
    );
}

function countDelimiter(line: string, delimiter: string) {
  let count = 0;
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"') quoted = !quoted;
    if (!quoted && line[index] === delimiter) count += 1;
  }
  return count;
}

function parseDelimited(content: string): unknown[][] {
  const firstLine = content.split(/\r?\n/).find((line) => line.trim()) ?? '';
  const delimiter =
    countDelimiter(firstLine, ';') > countDelimiter(firstLine, ',') ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (quoted) {
      if (char === '"' && content[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field.trim());
      field = '';
    } else if (char === '\n') {
      row.push(field.trim().replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field.trim().replace(/\r$/, ''));
    rows.push(row);
  }
  return rows;
}

function parseJson(content: string): RawRow[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new BadRequestException('El archivo JSON de retícula no es válido');
  }

  const rows = Array.isArray(parsed)
    ? parsed
    : (parsed as { materias?: unknown })?.materias;
  if (!Array.isArray(rows) || rows.some((row) => typeof row !== 'object')) {
    throw new BadRequestException(
      'El JSON debe ser una lista de materias o contener una propiedad "materias"',
    );
  }
  return rows as RawRow[];
}

function parseMarkdown(content: string, carreraCodigo: string): RawRow[] {
  const rows: RawRow[] = [];
  let currentCareer: string | null = null;
  let semestre = 0;
  let foundCareerMarkers = false;
  const expectedCode = carreraCodigo.trim().toUpperCase();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    const careerMatch = /c[oó]digo:\s*["']?([A-Za-z0-9._-]+)/i.exec(line);
    if (careerMatch) {
      foundCareerMarkers = true;
      currentCareer = careerMatch[1].toUpperCase();
      continue;
    }
    const semesterMatch = /(?:\*\*|#+\s*)?semestre\s+(\d+)/i.exec(line);
    if (semesterMatch) {
      semestre = Number(semesterMatch[1]);
      continue;
    }
    const itemMatch =
      /^-\s+(.+?)\s*\|\s*([A-Za-z0-9._-]+)\s*\|\s*(\d+)\s*-\s*(\d+)\s*-\s*(\d+)/.exec(
        line,
      );
    if (
      itemMatch &&
      semestre &&
      (!foundCareerMarkers || currentCareer === expectedCode)
    ) {
      rows.push({
        nombre: itemMatch[1],
        clave: itemMatch[2],
        semestre,
        horasTeoria: itemMatch[3],
        horasPractica: itemMatch[4],
        creditos: itemMatch[5],
      });
    }
  }

  if (rows.length > 0) return rows;

  const table = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && line.endsWith('|'))
    .filter((line) => !/^\|[\s:|-]+\|$/.test(line))
    .map((line) =>
      line
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim()),
    );
  if (table.length > 0) return rowsFromMatrix(table);

  if (foundCareerMarkers) {
    throw new BadRequestException(
      `La retícula no contiene materias para el código de carrera ${expectedCode}`,
    );
  }
  throw new BadRequestException(
    'No se pudo reconocer la estructura del archivo Markdown',
  );
}

async function parseXlsx(buffer: Buffer): Promise<RawRow[]> {
  const workbook = new ExcelJS.Workbook();
  const workbookBuffer = Uint8Array.from(buffer).buffer;
  await workbook.xlsx.load(workbookBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new BadRequestException('El archivo Excel no contiene hojas');
  }

  const matrix: unknown[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    matrix.push(values.map(cellValue));
  });
  return rowsFromMatrix(matrix);
}

export async function parseReticulaFile(
  file: Express.Multer.File,
  carreraCodigo: string,
): Promise<MateriaReticulaImportada[]> {
  const extension = extname(file.originalname).toLowerCase();
  let rows: RawRow[];

  try {
    if (extension === '.xlsx') {
      rows = await parseXlsx(file.buffer);
    } else {
      const content = file.buffer.toString('utf8').replace(/^\uFEFF/, '');
      if (extension === '.csv') rows = rowsFromMatrix(parseDelimited(content));
      else if (extension === '.json') rows = parseJson(content);
      else if (extension === '.md')
        rows = parseMarkdown(content, carreraCodigo);
      else {
        throw new BadRequestException(
          'La retícula debe ser un archivo XLSX, CSV, JSON o Markdown',
        );
      }
    }
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException(
      'No se pudo leer la retícula. Verifica que el archivo no esté dañado',
    );
  }

  return validateRows(rows);
}

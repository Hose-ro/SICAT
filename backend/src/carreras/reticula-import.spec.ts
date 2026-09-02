import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { parseReticulaFile } from './reticula-import';

function upload(name: string, content: Buffer): Express.Multer.File {
  return {
    originalname: name,
    buffer: content,
  } as Express.Multer.File;
}

describe('parseReticulaFile', () => {
  it('carga una retícula CSV con encabezados abreviados', async () => {
    const file = upload(
      'reticula.csv',
      Buffer.from(
        [
          'Materia,Clave,Semestre,HT,HP,CR',
          'Cálculo Diferencial,ACF-2301,1,3,2,5',
          'Programación Web,AEB-1055,7,1,4,5',
        ].join('\n'),
      ),
    );

    await expect(parseReticulaFile(file, 'ISC')).resolves.toEqual([
      {
        nombre: 'Cálculo Diferencial',
        clave: 'ACF-2301',
        semestre: 1,
        horasTeoria: 3,
        horasPractica: 2,
        creditos: 5,
      },
      {
        nombre: 'Programación Web',
        clave: 'AEB-1055',
        semestre: 7,
        horasTeoria: 1,
        horasPractica: 4,
        creditos: 5,
      },
    ]);
  });

  it('carga la primera hoja de una retícula XLSX', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Retícula');
    sheet.addRow([
      'nombre',
      'clave',
      'semestre',
      'horasTeoria',
      'horasPractica',
      'creditos',
    ]);
    sheet.addRow(['Bases de Datos', 'AEF-1031', 4, 3, 2, 5]);
    const content = await workbook.xlsx.writeBuffer();

    const result = await parseReticulaFile(
      upload('reticula.xlsx', Buffer.from(content)),
      'ISC',
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({ clave: 'AEF-1031', semestre: 4 }),
    );
  });

  it('rechaza claves repetidas antes de guardar la carrera', async () => {
    const file = upload(
      'reticula.json',
      Buffer.from(
        JSON.stringify([
          {
            nombre: 'Materia uno',
            clave: 'ABC-01',
            semestre: 1,
            horasTeoria: 2,
            horasPractica: 2,
            creditos: 4,
          },
          {
            nombre: 'Materia dos',
            clave: 'abc-01',
            semestre: 2,
            horasTeoria: 2,
            horasPractica: 2,
            creditos: 4,
          },
        ]),
      ),
    );

    await expect(parseReticulaFile(file, 'ISC')).rejects.toThrow(
      'La clave ABC-01 está repetida',
    );
  });

  it('rechaza materias con semestre fuera de rango', async () => {
    const file = upload(
      'reticula.csv',
      Buffer.from(
        'nombre,clave,semestre,horasTeoria,horasPractica,creditos\nMateria,ABC-01,13,2,2,4',
      ),
    );

    await expect(parseReticulaFile(file, 'ISC')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('selecciona del Markdown sólo la carrera cuyo código se crea', async () => {
    const file = upload(
      'reticula.md',
      Buffer.from(`
#### Sistemas, Código: "ISC"
**Semestre 1:**
- Programación | ISC-01 | 2-3-5
#### Industrial, Código: "II"
**Semestre 1:**
- Procesos | II-01 | 3-2-5
      `),
    );

    await expect(parseReticulaFile(file, 'ISC')).resolves.toEqual([
      expect.objectContaining({ clave: 'ISC-01' }),
    ]);
  });
});

import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  InputValidationPipe,
  validateQueryShape,
} from './input-validation.pipe';
import { OptionalEnumPipe } from './optional-enum.pipe';
import { UpdateTareaDto } from '../../tareas/dto/update-tarea.dto';
import { CrearTareaDto } from '../../tareas/dto/crear-tarea.dto';
import { PublicStudentRegisterDto } from '../../auth/dto/public-student-register.dto';
import { PasarListaDto } from '../../asistencias/dto/pasar-lista.dto';
import { JustificarFaltaDto } from '../../asistencias/dto/justificar-falta.dto';
import { DescargarEntregasDto } from '../../tareas/dto/acciones-entrega.dto';
import { DevolverEntregaDto } from '../../tareas/dto/devolver-entrega.dto';
import { AdminUpdateUserDto } from '../../usuarios/dto/admin-update-user.dto';
import { TareasController } from '../../tareas/tareas.controller';

let accepted = 0;
@Controller()
class ValidationProbeController {
  @Patch('tareas/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTareaDto) {
    accepted++;
    return { id, ...dto };
  }

  @Post('registro')
  register(@Body() dto: PublicStudentRegisterDto) {
    accepted++;
    return { nombre: dto.nombre, carreraId: dto.carreraId };
  }

  @Post('asistencias')
  attendance(@Body() dto: PasarListaDto) {
    accepted++;
    return dto;
  }

  @Post('justificacion')
  justify(@Body() dto: JustificarFaltaDto) {
    accepted++;
    return dto;
  }

  @Get('consulta')
  query(
    @Query('materiaId') materiaId?: string,
    @Query('fecha') fecha?: string,
    @Query('take') take?: string,
    @Query('activo') activo?: string,
    @Query('pesoTareas') peso?: string,
    @Query('estado', new OptionalEnumPipe(['PUBLICADA'])) estado?: string,
  ) {
    accepted++;
    return { materiaId, fecha, take, activo, peso, estado };
  }
}

describe('backend input contracts over HTTP', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ValidationProbeController],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new InputValidationPipe());
    app.use(validateQueryShape);
    await app.init();
  });
  beforeEach(() => {
    accepted = 0;
  });
  afterAll(async () => {
    await app.close();
  });

  it.each([
    { titulo: '   ' },
    { titulo: null },
    { titulo: 123 },
    { titulo: 'a'.repeat(161) },
    { grupoId: -1 },
    { grupoId: true },
    { grupoId: [] },
    { grupoId: '0x10' },
    { grupoId: '1junk' },
    { grupoId: ' ' },
    { grupoId: 2147483648 },
    { permiteReenvio: 'anything' },
    { permiteReenvio: 1 },
    { permiteReenvio: null },
    { fechaLimite: '2026-02-30' },
    { horaLimite: '25:60' },
    { estado: 'FAKE' },
    { docenteId: 999 },
    { activa: true },
  ])('rejects a forged task edit before the handler: %j', async (body) => {
    await request(app.getHttpServer())
      .patch('/tareas/1')
      .send(body)
      .expect(400);
    expect(accepted).toBe(0);
  });

  it('accepts valid partial edits with multipart-style numeric and boolean values', async () => {
    const result = await request(app.getHttpServer())
      .patch('/tareas/1')
      .send({ titulo: 'Actividad', grupoId: '2', permiteReenvio: 'false' })
      .expect(200);
    expect(result.body).toEqual({
      id: 1,
      titulo: 'Actividad',
      grupoId: 2,
      permiteReenvio: false,
    });
  });

  it.each(['0', '-1', '1junk', '1.5', '2147483648'])(
    'rejects route identifier %s',
    async (id) => {
      await request(app.getHttpServer())
        .patch(`/tareas/${id}`)
        .send({ titulo: 'Actividad' })
        .expect(400);
      expect(accepted).toBe(0);
    },
  );

  it.each([
    'materiaId=1junk',
    'materiaId=-1',
    'materiaId=1&materiaId=2',
    'materiaId[x]=1',
    'fecha=2026-02-30',
    'take=101',
    'take=0',
    'activo=yes',
    'pesoTareas=NaN',
    'pesoTareas=101',
    'estado=INVALIDO',
  ])('rejects invalid query %s', async (query) => {
    await request(app.getHttpServer()).get(`/consulta?${query}`).expect(400);
    expect(accepted).toBe(0);
  });

  it('accepts valid filters', async () => {
    await request(app.getHttpServer())
      .get(
        '/consulta?materiaId=2&fecha=2026-09-08&take=20&activo=false&pesoTareas=80&estado=PUBLICADA',
      )
      .expect(200);
  });

  const student = {
    nombre: 'Ana Lopez',
    numeroControl: '225Q0103',
    password: 'valid-password',
    carreraId: '2',
    semestre: '4',
  };
  it.each([
    { rol: 'ADMIN' },
    { usarHorarioExistente: 'invalid' },
    { carreraId: true },
    { password: 'é'.repeat(40) },
  ])('rejects forged registration fields %j', async (extra) => {
    await request(app.getHttpServer())
      .post('/registro')
      .send({ ...student, ...extra })
      .expect(400);
    expect(accepted).toBe(0);
  });
  it('accepts valid registration', async () => {
    await request(app.getHttpServer())
      .post('/registro')
      .send(student)
      .expect(201);
  });

  it.each([
    [{ alumnoId: 0, estado: 'ASISTENCIA' }],
    [{ alumnoId: 1, estado: 'INVALIDO' }],
    [{ alumnoId: 1, estado: 'ASISTENCIA', extra: true }],
    [
      { alumnoId: 1, estado: 'ASISTENCIA' },
      { alumnoId: 1, estado: 'FALTA' },
    ],
  ])('validates nested attendance rows', async (...registros) => {
    await request(app.getHttpServer())
      .post('/asistencias')
      .send({ claseSesionId: 1, registros })
      .expect(400);
    expect(accepted).toBe(0);
  });
  it('accepts valid attendance', async () => {
    await request(app.getHttpServer())
      .post('/asistencias')
      .send({
        claseSesionId: 1,
        registros: [{ alumnoId: 1, estado: 'ASISTENCIA' }],
      })
      .expect(201);
  });
  it.each([null, {}, '', '   ', 'a'.repeat(5001)])(
    'rejects invalid justification',
    async (justificacion) => {
      await request(app.getHttpServer())
        .post('/justificacion')
        .send({ justificacion })
        .expect(400);
    },
  );

  it('the actual task edit endpoint uses a runtime DTO', () => {
    const params = Reflect.getMetadata(
      'design:paramtypes',
      TareasController.prototype,
      'editar',
    ) as unknown[];
    expect(params).toContain(UpdateTareaDto);
  });
});

describe('additional DTO contracts', () => {
  const pipe = new InputValidationPipe();
  const validate = (value: unknown, metatype: new () => object) =>
    pipe.transform(value, { type: 'body', metatype });
  it('requires task creation fields even though edits are partial', async () => {
    await expect(
      validate({ titulo: 'Actividad' }, CrearTareaDto),
    ).rejects.toThrow();
  });
  it('preserves explicit null for nullable user fields but rejects null names and coerced IDs', async () => {
    await expect(
      validate({ carreraId: null, email: null }, AdminUpdateUserDto),
    ).resolves.toMatchObject({ carreraId: null, email: null });
    await expect(
      validate({ nombre: null }, AdminUpdateUserDto),
    ).rejects.toThrow();
    await expect(
      validate({ carreraId: true }, AdminUpdateUserDto),
    ).rejects.toThrow();
  });
  it('validates download selections', async () => {
    for (const entregaIds of [
      [1, 1],
      [-1],
      ['bad'],
      '1,2',
      Array.from({ length: 501 }, (_, i) => i + 1),
    ]) {
      await expect(
        validate({ entregaIds }, DescargarEntregasDto),
      ).rejects.toThrow();
    }
    await expect(
      validate({ entregaIds: [1, 2] }, DescargarEntregasDto),
    ).resolves.toMatchObject({ entregaIds: [1, 2] });
  });
  it('retains and validates the correction flag instead of stripping it', async () => {
    await expect(
      validate({ permiteCorreccion: false }, DevolverEntregaDto),
    ).resolves.toMatchObject({ permiteCorreccion: false });
    await expect(
      validate({ permiteCorreccion: 'invalid' }, DevolverEntregaDto),
    ).rejects.toThrow();
  });
});

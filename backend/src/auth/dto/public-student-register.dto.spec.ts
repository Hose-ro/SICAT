import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { PublicStudentRegisterDto } from './public-student-register.dto';

describe('PublicStudentRegisterDto', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const metadata = {
    type: 'body' as const,
    metatype: PublicStudentRegisterDto,
  };

  it('normaliza el registro y elimina propiedades fuera del contrato público', async () => {
    const result = (await pipe.transform(
      {
        nombre: '  Ana   López  ',
        numeroControl: '225q0325',
        email: ' ANA@EXAMPLE.COM ',
        telefono: '(288) 123-4567',
        password: 'password-seguro',
        carreraId: '2',
        semestre: '4',
        rol: 'ADMIN',
      },
      metadata,
    )) as PublicStudentRegisterDto;

    expect(result).toEqual({
      nombre: 'Ana López',
      numeroControl: '225Q0325',
      email: 'ana@example.com',
      telefono: '2881234567',
      password: 'password-seguro',
      carreraId: 2,
      semestre: 4,
    });
  });

  it('rechaza un registro sin identidad académica completa', async () => {
    await expect(
      pipe.transform(
        {
          nombre: 'Ana López',
          numeroControl: 'formato-invalido',
          email: 'correo-invalido',
          password: 'corta',
        },
        metadata,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('acepta registro sin correo para el modo de acceso institucional', async () => {
    const result = (await pipe.transform(
      {
        nombre: 'Luis Pérez',
        numeroControl: '225Q0326',
        password: 'password-seguro',
        carreraId: '2',
        semestre: '4',
      },
      metadata,
    )) as PublicStudentRegisterDto;

    expect(result.email).toBeUndefined();
    expect(result.numeroControl).toBe('225Q0326');
  });
});

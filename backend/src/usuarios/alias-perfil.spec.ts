import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { UsuariosService } from './usuarios.service';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';

describe('alias opcional del docente', () => {
  function servicio(rol = 'DOCENTE') {
    const tx = { usuario: {
      findUnique: jest.fn().mockResolvedValue({ email: 'docente@example.com', rol }),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ id: 2, nombre: 'Nombre completo', alias: 'Profe Edgar' }),
    } };
    const prisma = { $transaction: (fn: (client: typeof tx) => unknown) => fn(tx) };
    return { tx, service: new UsuariosService(prisma as never, { get: jest.fn() } as unknown as ConfigService) };
  }
  it('guarda el alias recortado sin sustituir el nombre', async () => {
    const { tx, service } = servicio();
    await service.updateOwnProfile(2, { alias: '  Profe Edgar  ' });
    expect(tx.usuario.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ alias: 'Profe Edgar', nombre: undefined }) }));
  });
  it('permite quitar el alias y omitirlo al actualizar otros datos', async () => {
    const { tx, service } = servicio();
    await service.updateOwnProfile(2, { alias: null });
    expect(tx.usuario.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ alias: null }) }));
    await service.updateOwnProfile(2, { alias: '   ' });
    expect(tx.usuario.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ alias: null }) }));
    await service.updateOwnProfile(2, { nombre: 'Edgar Lopez' });
    expect(tx.usuario.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ alias: undefined, nombre: 'Edgar Lopez' }) }));
  });
  it('impide editar un alias desde un rol distinto a docente', async () => {
    const { tx, service } = servicio('ALUMNO');
    await expect(service.updateOwnProfile(2, { alias: 'Alumno' })).rejects.toThrow('disponible para docentes');
    expect(tx.usuario.update).not.toHaveBeenCalled();
  });
  it('valida tipo, longitud, limpieza y eliminación en el DTO', async () => {
    for (const alias of [undefined, null, '', '   ', 'Profe Edgar']) {
      expect(await validate(plainToInstance(UpdateOwnProfileDto, { alias }))).toHaveLength(0);
    }
    for (const alias of [123, 'x'.repeat(61)]) {
      expect((await validate(plainToInstance(UpdateOwnProfileDto, { alias }))).length).toBeGreaterThan(0);
    }
    expect(plainToInstance(UpdateOwnProfileDto, { alias: '   ' }).alias).toBeNull();
    expect(plainToInstance(UpdateOwnProfileDto, { alias: '  Profe  ' }).alias).toBe('Profe');
  });
});

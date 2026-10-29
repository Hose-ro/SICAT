import { validate } from 'class-validator';
import { getCurrentAcademicPeriod } from '../common/periodo.util';
import { SupervisionService } from './supervision.service';
import { TelefonoDocenteDto } from './dto/telefono-docente.dto';

describe('teléfono faltante del docente', () => {
  const query = { carreraId: 1, periodo: getCurrentAcademicPeriod() };
  function contexto() {
    const prisma = { usuario: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    const service = new SupervisionService(prisma as never, {} as never);
    const alcance = jest.spyOn(service as any, 'alcance').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'gruposDelPeriodo').mockResolvedValue([{ id: 20 }]);
    jest.spyOn(service as any, 'ofertas').mockResolvedValue([{ docentes: [{ id: 37 }] }]);
    return { prisma, service, alcance };
  }
  it('completa solo un teléfono ausente de un docente de la carrera', async () => {
    const { prisma, service, alcance } = contexto();
    await expect(service.agregarTelefonoDocente(1, query, 37, '+524421234567')).resolves.toEqual({ id: 37, telefono: '+524421234567' });
    expect(alcance).toHaveBeenCalledWith(1, 1);
    expect(prisma.usuario.updateMany).toHaveBeenCalledWith({ where: { id: 37, activo: true, OR: [{ telefono: null }, { telefono: '' }] }, data: { telefono: '+524421234567' } });
  });
  it('rechaza una carrera no asignada sin modificar datos', async () => {
    const { prisma, service, alcance } = contexto();
    alcance.mockRejectedValue(new Error('Carrera fuera de tu alcance'));
    await expect(service.agregarTelefonoDocente(1, query, 37, '+524421234567')).rejects.toThrow('Carrera fuera de tu alcance');
    expect(prisma.usuario.updateMany).not.toHaveBeenCalled();
  });
  it('rechaza un docente ajeno a la oferta de esa carrera', async () => {
    const { prisma, service } = contexto();
    await expect(service.agregarTelefonoDocente(1, query, 99, '+524421234567')).rejects.toThrow('Docente fuera de tu alcance');
    expect(prisma.usuario.updateMany).not.toHaveBeenCalled();
  });
  it('no sobrescribe un teléfono ya registrado ni una actualización concurrente', async () => {
    const { prisma, service } = contexto();
    prisma.usuario.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.agregarTelefonoDocente(1, query, 37, '+524421234567')).rejects.toThrow('ya tiene un teléfono registrado');
  });
  it('rechaza periodos históricos y números incompletos', async () => {
    const { prisma, service } = contexto();
    await expect(service.agregarTelefonoDocente(1, { ...query, periodo: '2020-A' }, 37, '+524421234567')).rejects.toThrow('solo consulta');
    await expect(service.agregarTelefonoDocente(1, query, 37, '44212')).rejects.toThrow('10 dígitos');
    expect(prisma.usuario.updateMany).not.toHaveBeenCalled();
  });
  it('valida el formato del cuerpo de la petición', async () => {
    const dto = new TelefonoDocenteDto();
    dto.telefono = '+524421234567';
    expect(await validate(dto)).toHaveLength(0);
    dto.telefono = '+14421234567';
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
});

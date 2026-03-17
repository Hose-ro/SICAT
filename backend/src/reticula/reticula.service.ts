import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { GenerarSeccionesDto } from './dto/generar-secciones.dto';

@Injectable()
export class ReticulaService {
  constructor(private prisma: PrismaService) {}

  async obtenerPorCarrera(carreraId: number, semestre?: number) {
    const carrera = await this.prisma.carrera.findUnique({ where: { id: carreraId } });
    if (!carrera) throw new NotFoundException('Carrera no encontrada');

    const where: any = { carreraId, activo: true };
    if (semestre) where.semestre = semestre;

    const materias = await this.prisma.reticulaMateria.findMany({
      where,
      orderBy: [{ semestre: 'asc' }, { nombre: 'asc' }],
    });

    if (semestre) return materias;

    // Agrupar por semestre
    const porSemestre: Record<number, typeof materias> = {};
    materias.forEach((m) => {
      if (!porSemestre[m.semestre]) porSemestre[m.semestre] = [];
      porSemestre[m.semestre].push(m);
    });
    return porSemestre;
  }

  async generarSecciones(dto: GenerarSeccionesDto) {
    const carrera = await this.prisma.carrera.findUnique({ where: { id: dto.carreraId } });
    if (!carrera) throw new NotFoundException('Carrera no encontrada');

    const reticula = await this.prisma.reticulaMateria.findMany({
      where: { carreraId: dto.carreraId, semestre: dto.semestre, activo: true },
    });

    let creadas = 0;

    for (const materia of reticula) {
      const existe = await this.prisma.materia.findUnique({ where: { clave: materia.clave } });
      if (!existe) {
        await this.prisma.materia.create({
          data: {
            nombre: materia.nombre,
            clave: materia.clave,
            semestre: materia.semestre,
            carreraId: dto.carreraId,
            descripcion: null,
            horaInicio: '00:00',
            horaFin: '00:00',
            dias: '',
            docenteId: null,
            aulaId: null,
            numUnidades: 3,
          },
        });
        creadas += 1;
      }
    }
    return {
      totalReticula: reticula.length,
      seccionesCreadas: creadas,
      mensaje:
        creadas === reticula.length
          ? `Se crearon ${creadas} secciones para el semestre ${dto.semestre}`
          : `Se actualizaron/omitireron ${reticula.length - creadas} materias existentes y se crearon ${creadas}`,
    };
  }
}

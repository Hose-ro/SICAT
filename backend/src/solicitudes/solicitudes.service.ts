import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/**
 * SolicitudesService is kept as a stub.
 * Functionality has been absorbed into InscripcionesService.
 */
@Injectable()
export class SolicitudesService {
  constructor(private prisma: PrismaService) {}
}

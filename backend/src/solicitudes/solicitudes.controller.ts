import { Controller } from '@nestjs/common';
import { SolicitudesService } from './solicitudes.service';

/**
 * SolicitudesController is kept as a stub.
 * Functionality has been absorbed into InscripcionesController.
 */
@Controller('solicitudes')
export class SolicitudesController {
  constructor(private solicitudes: SolicitudesService) {}
}

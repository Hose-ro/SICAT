import { Module } from '@nestjs/common';
import { GruposController } from './grupos.controller';
import { GruposService } from './grupos.service';
import { HorariosModule } from '../horarios/horarios.module';
import { UsuariosModule } from '../usuarios/usuarios.module';

@Module({
  imports: [HorariosModule, UsuariosModule],
  controllers: [GruposController],
  providers: [GruposService],
  exports: [GruposService],
})
export class GruposModule {}

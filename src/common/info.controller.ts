import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { isPersistent, isPostgres, isServerless } from './database';

@ApiTags('sistema')
@Controller('info')
export class InfoController {
  /** Estado de la instalación. `persistent: false` = modo demo (los datos se reinician). */
  @Get()
  info() {
    return {
      persistent: isPersistent(),
      database: isPostgres() ? 'postgres' : 'sqlite',
      serverless: isServerless(),
    };
  }
}

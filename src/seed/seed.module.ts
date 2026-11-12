import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { SeedService } from './seed.service';

@Module({
  imports: [AlertsModule],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}

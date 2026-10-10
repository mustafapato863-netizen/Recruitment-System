import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { VacancyCoreModule } from '../vacancy-core/vacancy-core.module';
import { AdminOverrideController } from './admin-override.controller';
import { AdminOverrideService } from './admin-override.service';

@Module({
  imports: [DatabaseModule, VacancyCoreModule],
  controllers: [AdminOverrideController],
  providers: [AdminOverrideService],
})
export class AdminOverrideModule {}

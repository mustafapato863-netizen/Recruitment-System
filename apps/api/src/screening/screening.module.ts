import { Module } from '@nestjs/common';
import { ScreeningController } from './screening.controller';
import { ScreeningService } from './screening.service';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';
import { AccessControlModule } from '../access-control/access-control.module';

@Module({
  imports: [DatabaseModule, CommonModule, AccessControlModule],
  controllers: [ScreeningController],
  providers: [ScreeningService],
  exports: [ScreeningService],
})
export class ScreeningModule {}

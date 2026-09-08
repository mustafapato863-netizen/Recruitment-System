import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { DatabaseModule } from '../database/database.module';
import { AccessControlModule } from '../access-control/access-control.module';

@Module({
  imports: [DatabaseModule, AccessControlModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}

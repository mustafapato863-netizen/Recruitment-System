import { Module } from '@nestjs/common';
import { AccessControlService } from './access-control.service';
import { AccessControlController } from './access-control.controller';
import { DatabaseModule } from '../database/database.module';
import { AccessExportController } from './export/access-export.controller';
import { AccessExportService } from './export/access-export.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AccessControlController, AccessExportController],
  providers: [AccessControlService, AccessExportService],
  exports: [AccessControlService],
})
export class AccessControlModule {}

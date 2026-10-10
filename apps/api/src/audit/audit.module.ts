import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController, AuditSearchController } from './audit.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [AuditController, AuditSearchController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}

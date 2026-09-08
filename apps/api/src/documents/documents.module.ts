import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { DocumentScannerService } from './document-scanner.service';
import { DocumentStorageService } from './document-storage.service';
import { AccessControlModule } from '../access-control/access-control.module';

@Module({
  imports: [DatabaseModule, AuditModule, AccessControlModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentScannerService, DocumentStorageService],
  exports: [DocumentsService, DocumentScannerService, DocumentStorageService],
})
export class DocumentsModule {}

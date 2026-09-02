import { Module } from '@nestjs/common';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { BulkImportService } from './bulk-import.service';
import { CandidateBulkImportController, MasterDataBulkImportController, VacancyRequestBulkImportController } from './bulk-import.controller';
import { DatabaseModule } from '../database/database.module';
import { VacancyCoreModule } from '../vacancy-core/vacancy-core.module';
import { MasterDataModule } from '../master-data/master-data.module';

@Module({
  imports: [DatabaseModule, VacancyCoreModule, MasterDataModule],
  controllers: [ImportController, CandidateBulkImportController, VacancyRequestBulkImportController, MasterDataBulkImportController],
  providers: [ImportService, BulkImportService],
})
export class ImportModule {}

import { Module } from '@nestjs/common';
import { MasterDataService } from './master-data.service';
import { OrganizationsController } from './organizations.controller';
import { BranchesController } from './branches.controller';
import { PositionsController } from './positions.controller';
import { MasterDataCatalogController } from './master-data-catalog.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [
    OrganizationsController,
    BranchesController,
    PositionsController,
    MasterDataCatalogController,
  ],
  providers: [MasterDataService],
  exports: [MasterDataService],
})
export class MasterDataModule {}

import { Module } from '@nestjs/common';
import { MasterDataService } from './master-data.service';
import { OrganizationsController } from './organizations.controller';
import { LegalEntitiesController } from './legal-entities.controller';
import { BranchesController } from './branches.controller';
import { PositionsController } from './positions.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [
    OrganizationsController,
    LegalEntitiesController,
    BranchesController,
    PositionsController,
  ],
  providers: [MasterDataService],
})
export class MasterDataModule {}

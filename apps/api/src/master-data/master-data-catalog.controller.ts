import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { MasterDataBatchDto } from './master-data.dto';
import { MasterDataService } from './master-data.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';
import type { AuthUser } from '@recruitflow/contracts';

@UseGuards(JwtAuthGuard)
@Controller('master-data/catalog')
export class MasterDataCatalogController {
  constructor(private readonly masterDataService: MasterDataService) {}

  @Get(':category')
  @RequirePermissions('MASTER_DATA_VIEW')
  list(@CurrentUser() user: AuthUser, @Param('category') category: string) {
    return this.masterDataService.listCatalog(user.organizationId, category);
  }

  @Post(':category/batch')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('MASTER_DATA_BATCH_SAVE')
  save(
    @CurrentUser() user: AuthUser,
    @Param('category') category: string,
    @Body() body: MasterDataBatchDto,
  ) {
    return this.masterDataService.saveCatalogBatch(user.organizationId, category, body.rows);
  }

  @Delete(':category/:id')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('MASTER_DATA_VALUE_DELETE')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('category') category: string,
    @Param('id') id: string,
  ) {
    return this.masterDataService.deleteCatalogValue(user.organizationId, category, id);
  }
}

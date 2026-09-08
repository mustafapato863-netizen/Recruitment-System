import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { OffersService } from './offers.service';
import {
  CreateOfferDto,
  CreateOfferRevisionDto,
  OfferDecisionDto,
  UpdateOfferStatusDto,
} from './offers.dto';
import { UserPermissionsService } from '../common/user-permissions.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantScopedGuard } from '../common/guards/tenant-scoped.guard';
import { TenantResource } from '../common/decorators/tenant-resource.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';
import type { AuthUser } from '@recruitflow/contracts';

@UseGuards(JwtAuthGuard)
@Controller('offers')
export class OffersController {
  constructor(
    private readonly offersService: OffersService,
    private readonly userPermissions: UserPermissionsService,
  ) {}

  private async compensationDisclosure(user: AuthUser) {
    return {
      viewSalary: await this.userPermissions.hasPermission(user.userId, user.organizationId, 'VIEW_CURRENT_SALARY'),
    };
  }

  @Get()
  @RequirePermissions('APPLICATION_VIEW')
  async getOffers(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('candidateId') candidateId?: string,
  ) {
    const query: { status?: string; search?: string; candidateId?: string } = {};
    if (status !== undefined) query.status = status;
    if (search !== undefined) query.search = search;
    if (candidateId !== undefined) query.candidateId = candidateId;
    return this.offersService.getOffers(user, query, await this.compensationDisclosure(user));
  }

  @Get('approvals/inbox')
  @RequirePermissions('APPROVE_OFFERS')
  async getApprovalInbox(@CurrentUser() user: AuthUser) {
    return this.offersService.getApprovalInbox(user, await this.compensationDisclosure(user));
  }

  @Get(':id')
  @RequirePermissions('APPLICATION_VIEW')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'offer', param: 'id' })
  async getOfferById(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.offersService.getOfferById(user, id, await this.compensationDisclosure(user));
  }

  @Post()
  @RequirePermissions('APPLICATION_MOVE_STAGE')
  @AuditAction('OFFER_CREATE')
  createOffer(@CurrentUser() user: AuthUser, @Body() dto: CreateOfferDto) {
    return this.offersService.createOffer(user, dto);
  }

  @Post(':id/revisions')
  @RequirePermissions('APPLICATION_MOVE_STAGE')
  @AuditAction('OFFER_REVISION_CREATE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'offer', param: 'id' })
  createOfferRevision(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateOfferRevisionDto,
  ) {
    return this.offersService.createOfferRevision(user, id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('APPLICATION_MOVE_STAGE')
  @AuditAction('OFFER_STATUS_UPDATE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'offer', param: 'id' })
  updateOfferStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOfferStatusDto,
  ) {
    return this.offersService.updateOfferStatus(user, id, dto);
  }

  @Post('approvals/:approvalId/decide')
  @RequirePermissions('APPROVE_OFFERS')
  @AuditAction('OFFER_APPROVAL_DECIDE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'offerApproval', param: 'approvalId' })
  submitDecision(
    @CurrentUser() user: AuthUser,
    @Param('approvalId', ParseUUIDPipe) approvalId: string,
    @Body() dto: OfferDecisionDto,
  ) {
    return this.offersService.submitDecision(user, approvalId, dto);
  }
}

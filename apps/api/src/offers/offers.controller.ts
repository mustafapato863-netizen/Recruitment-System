import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { OffersService } from './offers.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '@recruitflow/contracts';
import {
  CreateOfferDto,
  CreateOfferRevisionDto,
  OfferDecisionDto,
  UpdateOfferStatusDto,
} from './offers.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';

@UseGuards(JwtAuthGuard)
@Controller('offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Get()
  @RequirePermissions('APPLICATION_VIEW')
  getOffers(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const query: { status?: string; search?: string } = {};
    if (status !== undefined) query.status = status;
    if (search !== undefined) query.search = search;
    return this.offersService.getOffers(user, query);
  }

  @Get('approvals/inbox')
  @RequirePermissions('APPROVE_OFFERS')
  getApprovalInbox(@CurrentUser() user: AuthUser) {
    return this.offersService.getApprovalInbox(user);
  }

  @Get(':id')
  @RequirePermissions('APPLICATION_VIEW')
  getOfferById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.offersService.getOfferById(user, id);
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
  createOfferRevision(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateOfferRevisionDto,
  ) {
    return this.offersService.createOfferRevision(user, id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('APPLICATION_MOVE_STAGE')
  @AuditAction('OFFER_STATUS_UPDATE')
  updateOfferStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateOfferStatusDto,
  ) {
    return this.offersService.updateOfferStatus(user, id, dto);
  }

  @Post('approvals/:approvalId/decide')
  @RequirePermissions('APPROVE_OFFERS')
  @AuditAction('OFFER_APPROVAL_DECIDE')
  submitDecision(
    @CurrentUser() user: AuthUser,
    @Param('approvalId') approvalId: string,
    @Body() dto: OfferDecisionDto,
  ) {
    return this.offersService.submitDecision(user, approvalId, dto);
  }
}

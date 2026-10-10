import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Put, UseGuards } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';
import type { AuthUser } from '@recruitflow/contracts';
// Runtime service imports must remain value imports for Nest DI metadata reflection.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { ApplicationFileService } from './application-file.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';

export class FollowUpDto {
  /** YYYY-MM-DD, or null to clear. */
  @ValidateIf((_o, v) => v !== null) @IsString() followUpDate!: string | null;
}
export class JoiningCheckDto {
  @IsBoolean() verified!: boolean;
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsUUID() documentId?: string | null;
}

@UseGuards(JwtAuthGuard)
@Controller('applications')
export class ApplicationFileController {
  constructor(private readonly file: ApplicationFileService) {}

  @Patch(':id/follow-up')
  @RequirePermissions('APPLICATION_VIEW')
  @AuditAction('APPLICATION_FOLLOW_UP_SET')
  setFollowUp(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: FollowUpDto) {
    return this.file.setFollowUp(user, id, dto.followUpDate ?? null);
  }

  @Get(':id/joining-checks')
  @RequirePermissions('APPLICATION_VIEW')
  joiningChecks(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.file.listJoiningChecks(user, id);
  }

  @Put(':id/joining-checks/:type')
  @RequirePermissions('APPLICATION_MOVE_STAGE')
  @AuditAction('JOINING_CHECK_SET')
  setJoiningCheck(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('type') type: string, @Body() dto: JoiningCheckDto) {
    return this.file.setJoiningCheck(user, id, type, dto);
  }

  @Get(':id/documents')
  @RequirePermissions('APPLICATION_VIEW')
  documents(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.file.listDocuments(user, id);
  }
}

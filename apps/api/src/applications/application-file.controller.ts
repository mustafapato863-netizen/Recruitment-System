import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { IsBoolean, IsDateString, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';
import type { AuthUser } from '@recruitflow/contracts';
// Runtime service imports must remain value imports for Nest DI metadata reflection.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { ApplicationFileService } from './application-file.service';
import { MessageAttemptsService } from './message-attempts.service';
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
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsDateString() expiryDate?: string | null;
}
export class SendMessageDto {
  @IsUUID() templateId!: string;
}
export class RequestDocumentDto {
  @IsString() @MinLength(2) @MaxLength(60) documentType!: string;
}

@UseGuards(JwtAuthGuard)
@Controller('applications')
export class ApplicationFileController {
  constructor(
    private readonly file: ApplicationFileService,
    private readonly messages: MessageAttemptsService,
  ) {}

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

  @Get(':id/document-history')
  @RequirePermissions('APPLICATION_VIEW')
  documentHistory(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.file.documentHistory(user, id);
  }

  @Post(':id/document-requests')
  @RequirePermissions('APPLICATION_VIEW')
  @AuditAction('DOCUMENT_REQUEST')
  requestDocument(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RequestDocumentDto) {
    return this.file.requestDocument(user, id, dto.documentType);
  }

  @Get(':id/messages')
  @RequirePermissions('APPLICATION_VIEW')
  messagesList(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.messages.list(user, id);
  }

  @Post(':id/messages')
  @RequirePermissions('APPLICATION_VIEW')
  @AuditAction('MESSAGE_SEND')
  sendMessage(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SendMessageDto) {
    return this.messages.send(user, id, dto.templateId);
  }

  @Post(':id/messages/:attemptId/retry')
  @RequirePermissions('APPLICATION_VIEW')
  @AuditAction('MESSAGE_RETRY')
  retryMessage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
  ) {
    return this.messages.retry(user, id, attemptId);
  }
}

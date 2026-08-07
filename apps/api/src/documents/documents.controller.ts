import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
// DTO classes must remain runtime imports for Nest metadata reflection.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { DocumentsService } from './documents.service';
import { UploadCandidateDocumentDto } from './documents.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';
import type { AuthUser } from '@recruitflow/contracts';

@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get('candidate/:candidateId')
  @RequirePermissions('CANDIDATE_VIEW')
  listCandidateDocuments(
    @CurrentUser() user: AuthUser,
    @Param('candidateId') candidateId: string,
  ) {
    return this.documentsService.listCandidateDocuments(user.organizationId, candidateId);
  }

  @Get(':id')
  @RequirePermissions('CANDIDATE_VIEW')
  getDocument(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.documentsService.getDocument(user.organizationId, id);
  }

  @Post()
  @RequirePermissions('CANDIDATE_EDIT')
  @AuditAction('DOCUMENT_UPLOAD')
  createDocument(
    @CurrentUser() user: AuthUser,
    @Body() body: UploadCandidateDocumentDto,
  ) {
    return this.documentsService.createDocument(
      user.organizationId,
      user.userId,
      body,
    );
  }
}

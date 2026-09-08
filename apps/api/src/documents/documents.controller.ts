import {
  Body,
  Controller,
  Get,
  Header,
  Query,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { FileInterceptor } from '@nestjs/platform-express';
import { TenantScopedGuard } from '../common/guards/tenant-scoped.guard';
import { TenantResource } from '../common/decorators/tenant-resource.decorator';
// DTO classes must remain runtime imports for Nest metadata reflection.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { DocumentsService } from './documents.service';
import {
  ArchiveCandidateDocumentDto,
  UpdateDocumentRetentionDto,
  UploadCandidateDocumentDto,
  UploadCandidateFileDto,
} from './documents.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';
import { fileInvalid } from '../common/errors/api-error';
import type { AuthUser } from '@recruitflow/contracts';

type UploadedCandidateFile = { buffer: Buffer; originalname: string; mimetype: string; size: number };

function requireCandidateFile(file: UploadedCandidateFile | undefined): UploadedCandidateFile {
  if (!file?.buffer?.length) throw fileInvalid('Attach a CV file in the file field.');
  return file;
}

@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get('candidate/:candidateId')
  @RequirePermissions('CANDIDATE_VIEW')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'candidate', param: 'candidateId' })
  listCandidateDocuments(
    @CurrentUser() user: AuthUser,
    @Param('candidateId', ParseUUIDPipe) candidateId: string,
  ) {
    return this.documentsService.listCandidateDocuments(user.organizationId, candidateId, user);
  }

  @Get('cv-bank')
  @RequirePermissions('CANDIDATE_VIEW')
  listCvBank(
    @CurrentUser() user: AuthUser,
    @Query('search') search = '',
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '25',
  ) {
    return this.documentsService.listCvBank(user.organizationId, search, Number(page), Number(pageSize), user);
  }

  @Get('cv-bank/manifest.xlsx')
  @RequirePermissions('CANDIDATE_VIEW', 'DOWNLOAD_DOCUMENTS')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="recruitflow-cv-bank-manifest.xlsx"')
  exportCvManifest(@CurrentUser() user: AuthUser) {
    return this.documentsService.exportCvManifest(user.organizationId, user);
  }

  @Get('cv-bank/backup-manifest.xlsx')
  @RequirePermissions('CANDIDATE_VIEW', 'DOWNLOAD_DOCUMENTS')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="recruitflow-cv-bank-backup-manifest.xlsx"')
  exportCvBackupManifest(@CurrentUser() user: AuthUser) {
    return this.documentsService.exportCvManifest(user.organizationId, user);
  }

  @Get('cv-bank/backup-status')
  @RequirePermissions('CANDIDATE_VIEW')
  getBackupStatus(@CurrentUser() user: AuthUser) {
    return this.documentsService.getBackupStatus(user.organizationId, user);
  }

  @Get(':id')
  @RequirePermissions('CANDIDATE_VIEW')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'candidateDocument', param: 'id' })
  getDocument(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.getDocument(user.organizationId, id, user);
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
      user,
    );
  }

  @Post('upload')
  @RequirePermissions('CANDIDATE_EDIT')
  @AuditAction('CV_FILE_UPLOAD')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadFile(
    @CurrentUser() user: AuthUser,
    @Body() body: UploadCandidateFileDto,
    @UploadedFile() uploadedFile: UploadedCandidateFile | undefined,
  ) {
    return this.documentsService.uploadFile(user.organizationId, user.userId, body, requireCandidateFile(uploadedFile), user);
  }

  @Patch(':id/retention')
  @RequirePermissions('CANDIDATE_EDIT')
  @AuditAction('DOCUMENT_RETENTION_UPDATE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'candidateDocument', param: 'id' })
  updateRetention(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateDocumentRetentionDto,
  ) {
    return this.documentsService.updateRetention(user.organizationId, user.userId, id, body, user);
  }

  @Post(':id/archive')
  @RequirePermissions('CANDIDATE_EDIT')
  @AuditAction('DOCUMENT_ARCHIVE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'candidateDocument', param: 'id' })
  archiveDocument(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ArchiveCandidateDocumentDto,
  ) {
    return this.documentsService.archiveDocument(user.organizationId, user.userId, id, body, user);
  }

  @Post(':id/restore')
  @RequirePermissions('CANDIDATE_EDIT')
  @AuditAction('DOCUMENT_RESTORE')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'candidateDocument', param: 'id' })
  restoreDocument(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.restoreDocument(user.organizationId, user.userId, id, user);
  }

  @Get(':id/download')
  @RequirePermissions('CANDIDATE_VIEW', 'DOWNLOAD_DOCUMENTS')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'candidateDocument', param: 'id' })
  async downloadFile(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const file = await this.documentsService.getFile(user.organizationId, id, user);
    return new StreamableFile(createReadStream(file.path), {
      type: file.mimeType,
      disposition: `attachment; filename="${file.fileName.replace(/"/g, '')}"`,
    });
  }
}

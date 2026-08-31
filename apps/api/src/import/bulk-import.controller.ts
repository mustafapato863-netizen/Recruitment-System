import {
  Controller,
  DefaultValuePipe,
  Get,
  Header,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { BulkImportService } from './bulk-import.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantScopedGuard } from '../common/guards/tenant-scoped.guard';
import { TenantResource } from '../common/decorators/tenant-resource.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';
import { fileInvalid, importInvalid } from '../common/errors/api-error';
import type { AuthUser, BulkImportDataset } from '@recruitflow/contracts';

type UploadedWorkbook = { buffer: Buffer; originalname: string };
const WORKBOOK_UPLOAD_OPTIONS = { limits: { fileSize: 25 * 1024 * 1024 } };

function requireWorkbook(file: UploadedWorkbook | undefined): UploadedWorkbook {
  if (!file?.buffer?.length) throw fileInvalid('Attach an Excel or CSV workbook in the file field.');
  return file;
}

@UseGuards(JwtAuthGuard)
@Controller('imports/candidates')
export class CandidateBulkImportController {
  private readonly dataset: BulkImportDataset = 'candidates';

  constructor(private readonly bulkImportService: BulkImportService) {}

  @Get('template')
  @RequirePermissions('CANDIDATE_VIEW')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="recruitflow-candidates-template.xlsx"')
  template() {
    return this.bulkImportService.template(this.dataset);
  }

  @Post('inspect')
  @RequirePermissions('CANDIDATE_CREATE')
  @UseInterceptors(FileInterceptor('file', WORKBOOK_UPLOAD_OPTIONS))
  inspect(@UploadedFile() uploadedFile: UploadedWorkbook) {
    const file = requireWorkbook(uploadedFile);
    return this.bulkImportService.inspect(this.dataset, file.buffer, file.originalname);
  }

  @Post('upload')
  @RequirePermissions('CANDIDATE_CREATE')
  @AuditAction('CANDIDATE_BULK_IMPORT_UPLOAD')
  @UseInterceptors(FileInterceptor('file', WORKBOOK_UPLOAD_OPTIONS))
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() uploadedFile: UploadedWorkbook,
    @Query('sheetName') sheetName?: string,
  ) {
    const file = requireWorkbook(uploadedFile);
    return this.bulkImportService.createJob(user.organizationId, user.userId, this.dataset, file.buffer, file.originalname, sheetName);
  }

  @Get('jobs')
  @RequirePermissions('CANDIDATE_VIEW')
  listJobs(
    @CurrentUser() user: AuthUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize = 20,
  ) {
    return this.bulkImportService.listJobs(user.organizationId, this.dataset, page, pageSize);
  }

  @Get('jobs/:jobId')
  @RequirePermissions('CANDIDATE_VIEW')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'candidateImportJob', param: 'jobId' })
  getSummary(@CurrentUser() user: AuthUser, @Param('jobId', ParseUUIDPipe) jobId: string) {
    return this.bulkImportService.getSummary(user.organizationId, this.dataset, jobId);
  }

  @Get('jobs/:jobId/rows')
  @RequirePermissions('CANDIDATE_VIEW')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'candidateImportJob', param: 'jobId' })
  getRows(
    @CurrentUser() user: AuthUser,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('pageSize', new DefaultValuePipe(50), ParseIntPipe) pageSize = 50,
  ) {
    return this.bulkImportService.getRows(user.organizationId, this.dataset, jobId, page, pageSize);
  }

  @Post('jobs/:jobId/rows/:rowId/decision/:decision')
  @RequirePermissions('CANDIDATE_EDIT')
  @AuditAction('CANDIDATE_BULK_IMPORT_DECISION')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'candidateImportJob', param: 'jobId' })
  saveDecision(
    @CurrentUser() user: AuthUser,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Param('rowId', ParseUUIDPipe) rowId: string,
    @Param('decision') decision: 'Import' | 'Skip' | 'Update',
  ) {
    return this.bulkImportService.saveDecision(user.organizationId, this.dataset, jobId, rowId, decision);
  }

  @Post('jobs/:jobId/confirm')
  @RequirePermissions('CANDIDATE_CREATE')
  @AuditAction('CANDIDATE_BULK_IMPORT_CONFIRM')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'candidateImportJob', param: 'jobId' })
  confirm(@CurrentUser() user: AuthUser, @Param('jobId', ParseUUIDPipe) jobId: string) {
    return this.bulkImportService.confirm(user.organizationId, user.userId, this.dataset, jobId);
  }

  @Get('jobs/:jobId/error-report')
  @RequirePermissions('CANDIDATE_VIEW')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="recruitflow-import-errors.xlsx"')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'candidateImportJob', param: 'jobId' })
  async getErrorReport(@CurrentUser() user: AuthUser, @Param('jobId', ParseUUIDPipe) jobId: string) {
    return new StreamableFile(await this.bulkImportService.getErrorReport(user.organizationId, this.dataset, jobId));
  }
}

@UseGuards(JwtAuthGuard)
@Controller('imports/vacancy-requests')
export class VacancyRequestBulkImportController {
  private readonly dataset: BulkImportDataset = 'vacancy-requests';

  constructor(private readonly bulkImportService: BulkImportService) {}

  @Get('template')
  @RequirePermissions('VACANCY_REQUEST_VIEW')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="recruitflow-vacancy-requests-template.xlsx"')
  template() {
    return this.bulkImportService.template(this.dataset);
  }

  @Post('inspect')
  @RequirePermissions('VACANCY_REQUEST_CREATE')
  @UseInterceptors(FileInterceptor('file', WORKBOOK_UPLOAD_OPTIONS))
  inspect(@UploadedFile() uploadedFile: UploadedWorkbook) {
    const file = requireWorkbook(uploadedFile);
    return this.bulkImportService.inspect(this.dataset, file.buffer, file.originalname);
  }

  @Post('upload')
  @RequirePermissions('VACANCY_REQUEST_CREATE')
  @AuditAction('VACANCY_REQUEST_BULK_IMPORT_UPLOAD')
  @UseInterceptors(FileInterceptor('file', WORKBOOK_UPLOAD_OPTIONS))
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() uploadedFile: UploadedWorkbook,
    @Query('sheetName') sheetName?: string,
  ) {
    const file = requireWorkbook(uploadedFile);
    return this.bulkImportService.createJob(user.organizationId, user.userId, this.dataset, file.buffer, file.originalname, sheetName);
  }

  @Get('jobs')
  @RequirePermissions('VACANCY_REQUEST_VIEW')
  listJobs(
    @CurrentUser() user: AuthUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize = 20,
  ) {
    return this.bulkImportService.listJobs(user.organizationId, this.dataset, page, pageSize);
  }

  @Get('jobs/:jobId')
  @RequirePermissions('VACANCY_REQUEST_VIEW')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'candidateImportJob', param: 'jobId' })
  getSummary(@CurrentUser() user: AuthUser, @Param('jobId', ParseUUIDPipe) jobId: string) {
    return this.bulkImportService.getSummary(user.organizationId, this.dataset, jobId);
  }

  @Get('jobs/:jobId/rows')
  @RequirePermissions('VACANCY_REQUEST_VIEW')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'candidateImportJob', param: 'jobId' })
  getRows(
    @CurrentUser() user: AuthUser,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('pageSize', new DefaultValuePipe(50), ParseIntPipe) pageSize = 50,
  ) {
    return this.bulkImportService.getRows(user.organizationId, this.dataset, jobId, page, pageSize);
  }

  @Post('jobs/:jobId/rows/:rowId/decision/:decision')
  @RequirePermissions('VACANCY_REQUEST_CREATE')
  @AuditAction('VACANCY_REQUEST_BULK_IMPORT_DECISION')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'candidateImportJob', param: 'jobId' })
  saveDecision(
    @CurrentUser() user: AuthUser,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Param('rowId', ParseUUIDPipe) rowId: string,
    @Param('decision') decision: 'Import' | 'Skip' | 'Update',
  ) {
    return this.bulkImportService.saveDecision(user.organizationId, this.dataset, jobId, rowId, decision);
  }

  @Post('jobs/:jobId/confirm')
  @RequirePermissions('VACANCY_REQUEST_CREATE')
  @AuditAction('VACANCY_REQUEST_BULK_IMPORT_CONFIRM')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'candidateImportJob', param: 'jobId' })
  confirm(@CurrentUser() user: AuthUser, @Param('jobId', ParseUUIDPipe) jobId: string) {
    return this.bulkImportService.confirm(user.organizationId, user.userId, this.dataset, jobId);
  }

  @Get('jobs/:jobId/error-report')
  @RequirePermissions('VACANCY_REQUEST_VIEW')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="recruitflow-import-errors.xlsx"')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'candidateImportJob', param: 'jobId' })
  async getErrorReport(@CurrentUser() user: AuthUser, @Param('jobId', ParseUUIDPipe) jobId: string) {
    return new StreamableFile(await this.bulkImportService.getErrorReport(user.organizationId, this.dataset, jobId));
  }
}

@UseGuards(JwtAuthGuard)
@Controller('imports/master-data')
export class MasterDataBulkImportController {
  constructor(private readonly bulkImportService: BulkImportService) {}

  private dataset(value: string): Extract<BulkImportDataset, 'legal-entities' | 'branches' | 'positions'> {
    if (value !== 'legal-entities' && value !== 'branches' && value !== 'positions') {
      throw importInvalid('Master-data dataset must be legal-entities, branches, or positions.');
    }
    return value;
  }

  @Get(':dataset/template')
  @RequirePermissions('MASTER_DATA_VIEW')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="recruitflow-master-data-template.xlsx"')
  template(@Param('dataset') dataset: string) {
    return this.bulkImportService.template(this.dataset(dataset));
  }

  @Post(':dataset/inspect')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @UseInterceptors(FileInterceptor('file', WORKBOOK_UPLOAD_OPTIONS))
  inspect(@Param('dataset') dataset: string, @UploadedFile() uploadedFile: UploadedWorkbook) {
    const file = requireWorkbook(uploadedFile);
    return this.bulkImportService.inspect(this.dataset(dataset), file.buffer, file.originalname);
  }

  @Post(':dataset/upload')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('MASTER_DATA_BULK_IMPORT_UPLOAD')
  @UseInterceptors(FileInterceptor('file', WORKBOOK_UPLOAD_OPTIONS))
  upload(
    @CurrentUser() user: AuthUser,
    @Param('dataset') dataset: string,
    @UploadedFile() uploadedFile: UploadedWorkbook,
    @Query('sheetName') sheetName?: string,
  ) {
    const file = requireWorkbook(uploadedFile);
    return this.bulkImportService.createJob(user.organizationId, user.userId, this.dataset(dataset), file.buffer, file.originalname, sheetName);
  }

  @Get(':dataset/jobs')
  @RequirePermissions('MASTER_DATA_VIEW')
  listJobs(
    @CurrentUser() user: AuthUser,
    @Param('dataset') dataset: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize = 20,
  ) {
    return this.bulkImportService.listJobs(user.organizationId, this.dataset(dataset), page, pageSize);
  }

  @Get(':dataset/jobs/:jobId')
  @RequirePermissions('MASTER_DATA_VIEW')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'candidateImportJob', param: 'jobId' })
  getSummary(@CurrentUser() user: AuthUser, @Param('dataset') dataset: string, @Param('jobId', ParseUUIDPipe) jobId: string) {
    return this.bulkImportService.getSummary(user.organizationId, this.dataset(dataset), jobId);
  }

  @Get(':dataset/jobs/:jobId/rows')
  @RequirePermissions('MASTER_DATA_VIEW')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'candidateImportJob', param: 'jobId' })
  getRows(
    @CurrentUser() user: AuthUser,
    @Param('dataset') dataset: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('pageSize', new DefaultValuePipe(50), ParseIntPipe) pageSize = 50,
  ) {
    return this.bulkImportService.getRows(user.organizationId, this.dataset(dataset), jobId, page, pageSize);
  }

  @Post(':dataset/jobs/:jobId/rows/:rowId/decision/:decision')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('MASTER_DATA_BULK_IMPORT_DECISION')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'candidateImportJob', param: 'jobId' })
  saveDecision(
    @CurrentUser() user: AuthUser,
    @Param('dataset') dataset: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Param('rowId', ParseUUIDPipe) rowId: string,
    @Param('decision') decision: 'Import' | 'Skip' | 'Update',
  ) {
    return this.bulkImportService.saveDecision(user.organizationId, this.dataset(dataset), jobId, rowId, decision);
  }

  @Post(':dataset/jobs/:jobId/confirm')
  @RequirePermissions('MASTER_DATA_MANAGE')
  @AuditAction('MASTER_DATA_BULK_IMPORT_CONFIRM')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'candidateImportJob', param: 'jobId' })
  confirm(@CurrentUser() user: AuthUser, @Param('dataset') dataset: string, @Param('jobId', ParseUUIDPipe) jobId: string) {
    return this.bulkImportService.confirm(user.organizationId, user.userId, this.dataset(dataset), jobId);
  }

  @Get(':dataset/jobs/:jobId/error-report')
  @RequirePermissions('MASTER_DATA_VIEW')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="recruitflow-master-data-import-errors.xlsx"')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'candidateImportJob', param: 'jobId' })
  async getErrorReport(@CurrentUser() user: AuthUser, @Param('dataset') dataset: string, @Param('jobId', ParseUUIDPipe) jobId: string) {
    return new StreamableFile(await this.bulkImportService.getErrorReport(user.organizationId, this.dataset(dataset), jobId));
  }
}

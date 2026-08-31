import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import * as XLSX from 'xlsx';
import type { Prisma } from '@recruitflow/database';
import type {
  BulkImportDataset,
  BulkImportInspectResult,
  BulkImportRowItem,
  BulkImportSheetInfo,
  ImportJobSummary,
} from '@recruitflow/contracts';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
import { ImportService } from './import.service';
import { VacancyCoreService } from '../vacancy-core/vacancy-core.service';
import { MasterDataService } from '../master-data/master-data.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { CreateVacancyRequestDto } from '../vacancy-core/vacancy-core.dto';
import type { CreateBranchDto, CreateLegalEntityDto, CreatePositionDto } from '../master-data/master-data.dto';
import { fileInvalid, fileTooLarge, importInvalid } from '../common/errors/api-error';

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_ROWS = 25_000;

type RawRow = Record<string, unknown>;
type Dataset = BulkImportDataset;

type ColumnDefinition = {
  key: string;
  header: string;
  aliases: string[];
  required?: boolean;
  requiredGroup?: string;
};

const DATASET_COLUMNS: Record<Dataset, ColumnDefinition[]> = {
  candidates: [
    { key: 'firstName', header: 'First Name', aliases: ['first name', 'firstname', 'given name'], required: true },
    { key: 'lastName', header: 'Last Name', aliases: ['last name', 'lastname', 'family name', 'surname'], required: true },
    { key: 'email', header: 'Email', aliases: ['email address', 'candidate email'], required: true },
    { key: 'phone', header: 'Phone', aliases: ['phone number', 'mobile', 'mobile number'] },
    { key: 'currentTitle', header: 'Current Title', aliases: ['title', 'job title', 'current role'] },
    { key: 'currentCompany', header: 'Current Company', aliases: ['company', 'employer', 'current employer'] },
    { key: 'skills', header: 'Skills', aliases: ['skill', 'core skills', 'technical skills'] },
    { key: 'experienceYears', header: 'Experience Years', aliases: ['experience', 'years experience', 'years of experience'] },
    { key: 'location', header: 'Location', aliases: ['city', 'current location'] },
    { key: 'certifications', header: 'Certifications', aliases: ['certification', 'certificates'] },
    { key: 'languages', header: 'Languages', aliases: ['language'] },
    { key: 'education', header: 'Education', aliases: ['degree', 'qualification'] },
    { key: 'availability', header: 'Availability', aliases: ['notice period', 'joining availability'] },
    { key: 'source', header: 'Source', aliases: ['candidate source', 'channel'] },
    { key: 'status', header: 'Status', aliases: ['candidate status'] },
    { key: 'summary', header: 'Summary', aliases: ['bio', 'profile summary'] },
  ],
  'vacancy-requests': [
    { key: 'positionCode', header: 'Position Code', aliases: ['position code', 'job code'] },
    { key: 'positionTitle', header: 'Position Title', aliases: ['position title', 'job title', 'role'] },
    { key: 'branchCode', header: 'Branch Code', aliases: ['branch code', 'location code'] },
    { key: 'branchName', header: 'Branch Name', aliases: ['branch name', 'branch', 'location'] },
    { key: 'legalEntityCode', header: 'Legal Entity Code', aliases: ['legal entity code', 'entity code'] },
    { key: 'legalEntityName', header: 'Legal Entity Name', aliases: ['legal entity name', 'legal entity', 'entity'] },
    { key: 'requesterEmail', header: 'Requester Email', aliases: ['requester', 'requester email', 'hiring manager email'] },
    { key: 'requestedHeadcount', header: 'Requested Headcount', aliases: ['headcount', 'quantity', 'number of hires'], required: true },
    { key: 'employmentType', header: 'Employment Type', aliases: ['employment', 'contract type'] },
    { key: 'reason', header: 'Reason', aliases: ['hiring reason'] },
    { key: 'budgetStatus', header: 'Budget Status', aliases: ['budget', 'budgeted'] },
    { key: 'criticality', header: 'Criticality', aliases: ['priority', 'urgency'] },
    { key: 'targetStartDate', header: 'Target Start Date', aliases: ['start date', 'target date', 'joining date'] },
    { key: 'requiredSkills', header: 'Required Skills', aliases: ['skills', 'must have skills'] },
    { key: 'minExperienceYears', header: 'Minimum Experience Years', aliases: ['minimum experience', 'min experience', 'experience years'] },
    { key: 'location', header: 'Work Location', aliases: ['work location', 'city'] },
    { key: 'externalVacancyCode', header: 'External Vacancy Code', aliases: ['vacancy code', 'opening code', 'requisition code'] },
    { key: 'justification', header: 'Justification', aliases: ['description', 'notes', 'comments'] },
  ],
  'legal-entities': [
    { key: 'code', header: 'Code', aliases: ['legal entity code', 'entity code'] },
    { key: 'name', header: 'Name', aliases: ['legal entity name', 'entity name'], required: true },
    { key: 'status', header: 'Status', aliases: ['entity status'] },
  ],
  branches: [
    { key: 'legalEntityCode', header: 'Legal Entity Code', aliases: ['entity code', 'legal entity'] , requiredGroup: 'legalEntity' },
    { key: 'legalEntityName', header: 'Legal Entity Name', aliases: ['entity name'], requiredGroup: 'legalEntity' },
    { key: 'code', header: 'Code', aliases: ['branch code', 'location code'] },
    { key: 'name', header: 'Name', aliases: ['branch name', 'location name'], required: true },
    { key: 'city', header: 'City', aliases: ['location', 'town'] },
    { key: 'status', header: 'Status', aliases: ['branch status'] },
  ],
  positions: [
    { key: 'code', header: 'Code', aliases: ['position code', 'job code'] },
    { key: 'title', header: 'Title', aliases: ['position title', 'job title', 'role'], required: true },
    { key: 'description', header: 'Description', aliases: ['details', 'notes'] },
    { key: 'legalEntityCode', header: 'Legal Entity Code', aliases: ['entity code', 'legal entity'] },
    { key: 'legalEntityName', header: 'Legal Entity Name', aliases: ['entity name'] },
    { key: 'status', header: 'Status', aliases: ['position status'] },
  ],
};

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scalar(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value);
}

function text(value: unknown): string {
  const valueAsScalar = scalar(value);
  return valueAsScalar === null ? '' : String(valueAsScalar).trim();
}

function list(value: unknown): string[] {
  return text(value)
    .split(/[,;|\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function integer(value: unknown): number | null {
  const parsed = Number(text(value));
  return Number.isInteger(parsed) ? parsed : null;
}

function dateOnly(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function fileFormat(fileName: string): 'xlsx' | 'xls' | 'csv' {
  const extension = fileName.toLowerCase().split('.').pop();
  if (extension === 'xlsx' || extension === 'xls' || extension === 'csv') return extension;
  throw fileInvalid('Only .xlsx, .xls, and .csv files are supported.');
}

function assertNoFormulas(sheet: XLSX.WorkSheet): void {
  for (const address of Object.keys(sheet)) {
    if (address.startsWith('!')) continue;
    const cell = sheet[address] as XLSX.CellObject | undefined;
    if (cell?.f) {
      throw importInvalid('Formula cells are not accepted. Paste values only before importing.');
    }
  }
}

@Injectable()
export class BulkImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly importService: ImportService,
    private readonly vacancyCoreService: VacancyCoreService,
    private readonly masterDataService: MasterDataService,
  ) {}

  getDatasetDefinition(dataset: Dataset): ColumnDefinition[] {
    const definition = DATASET_COLUMNS[dataset];
    if (!definition) throw importInvalid(`Unsupported import dataset: ${dataset}.`);
    return definition;
  }

  private parseWorkbook(buffer: Buffer, fileName: string, sheetName?: string): {
    workbook: XLSX.WorkBook;
    sheet: XLSX.WorkSheet;
    selectedSheet: string;
    headers: string[];
    rows: RawRow[];
    format: 'xlsx' | 'xls' | 'csv';
  } {
    if (buffer.length === 0) throw fileInvalid('The uploaded workbook is empty.');
    if (buffer.length > MAX_FILE_SIZE) throw fileTooLarge('The workbook must be 25 MB or smaller.');

    const format = fileFormat(fileName);
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, cellFormula: true });
    if (workbook.SheetNames.length === 0) throw importInvalid('The workbook does not contain a worksheet.');

    const selectedSheet = sheetName && workbook.SheetNames.includes(sheetName)
      ? sheetName
      : workbook.SheetNames[0];
    if (!selectedSheet) throw importInvalid('The workbook does not contain a selectable worksheet.');
    if (sheetName && !workbook.SheetNames.includes(sheetName)) {
      throw importInvalid(`Worksheet ${sheetName} was not found in the workbook.`);
    }

    const sheet = workbook.Sheets[selectedSheet];
    if (!sheet) throw importInvalid(`Worksheet ${selectedSheet} could not be read.`);
    assertNoFormulas(sheet);
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, blankrows: false, raw: true });
    const headerRow = Array.isArray(matrix[0]) ? matrix[0] : [];
    const headers = headerRow.map((value) => text(value)).filter(Boolean);
    if (headers.length === 0) throw importInvalid('The selected worksheet has no header row.');
    if (new Set(headers.map(normalizeHeader)).size !== headers.length) {
      throw importInvalid('The selected worksheet contains duplicate column headers.');
    }

    const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: null, blankrows: false, raw: true });
    if (rows.length > MAX_ROWS) throw importInvalid(`The workbook cannot contain more than ${MAX_ROWS.toLocaleString()} data rows.`);
    return { workbook, sheet, selectedSheet, headers, rows, format };
  }

  inspect(dataset: Dataset, buffer: Buffer, fileName: string, sheetName?: string): BulkImportInspectResult {
    const parsed = this.parseWorkbook(buffer, fileName, sheetName);
    const columns = this.getDatasetDefinition(dataset);
    const normalizedHeaders = new Set(parsed.headers.map(normalizeHeader));
    const warnings: string[] = [];
    const hasRequired = columns.filter((column) => column.required).every((column) =>
      column.aliases.some((alias) => normalizedHeaders.has(normalizeHeader(alias))) ||
      normalizedHeaders.has(normalizeHeader(column.header)),
    );
    if (!hasRequired) warnings.push('One or more required columns are missing. The upload will remain in review until corrected.');
    const requiredGroups = new Set(columns.map((column) => column.requiredGroup).filter((group): group is string => Boolean(group)));
    for (const group of requiredGroups) {
      const members = columns.filter((column) => column.requiredGroup === group);
      const present = members.some((column) => normalizedHeaders.has(normalizeHeader(column.header)) || column.aliases.some((alias) => normalizedHeaders.has(normalizeHeader(alias))));
      if (!present) warnings.push(`One of the required ${group} columns must be provided.`);
    }
    if (parsed.workbook.SheetNames.length > 1) warnings.push('This workbook has multiple worksheets. Re-upload with the intended worksheet selected.');

    const sheets: BulkImportSheetInfo[] = parsed.workbook.SheetNames.map((name) => {
      const sheet = parsed.workbook.Sheets[name];
      if (!sheet) return { name, headers: [], rowCount: 0 };
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, blankrows: false, raw: true });
      const headers = Array.isArray(matrix[0]) ? matrix[0].map((value) => text(value)).filter(Boolean) : [];
      return { name, headers, rowCount: Math.max(0, matrix.length - 1) };
    });

    return {
      fileName,
      fileSize: buffer.length,
      sheets,
      dataset,
      requiredColumns: [
        ...columns.filter((column) => column.required).map((column) => column.header),
        ...[...requiredGroups].map((group) => `${columns.filter((column) => column.requiredGroup === group).map((column) => column.header).join(' or ')}`),
      ],
      optionalColumns: columns.filter((column) => !column.required).map((column) => column.header),
      warnings,
    };
  }

  private mapRows(dataset: Dataset, rows: RawRow[], headers: string[]): RawRow[] {
    const columns = this.getDatasetDefinition(dataset);
    const headerLookup = new Map<string, string>();
    headers.forEach((header) => headerLookup.set(normalizeHeader(header), header));

    return rows.map((row) => {
      const canonical: RawRow = {};
      for (const column of columns) {
        const sourceHeader = [column.header, ...column.aliases]
          .map(normalizeHeader)
          .map((candidate) => headerLookup.get(candidate))
          .find(Boolean);
        const value = sourceHeader ? row[sourceHeader] : null;
        if (['skills', 'certifications', 'languages', 'requiredSkills'].includes(column.key)) canonical[column.key] = list(value);
        else if (['experienceYears', 'minExperienceYears', 'requestedHeadcount'].includes(column.key)) canonical[column.key] = integer(value);
        else if (column.key === 'targetStartDate') canonical[column.key] = dateOnly(value);
        else canonical[column.key] = text(value) || null;
      }
      return canonical;
    });
  }

  private async validateCandidateRows(organizationId: string, rows: RawRow[]): Promise<{ rows: RawRow[]; counts: { valid: number; invalid: number; duplicate: number } }> {
    const emails = rows.map((row) => text(row.email).toLowerCase()).filter(Boolean);
    const existing = emails.length === 0 ? [] : await this.prisma.candidate.findMany({
      where: { organizationId, email: { in: emails, mode: 'insensitive' } },
      select: { email: true },
    });
    const existingEmails = new Set(existing.map((candidate) => candidate.email.toLowerCase()));
    const seen = new Set<string>();
    const counts = { valid: 0, invalid: 0, duplicate: 0 };

    const mapped = rows.map((row, index) => {
      const email = text(row.email).toLowerCase();
      let result: 'Valid' | 'Invalid' | 'Duplicate' = 'Valid';
      let details: string | null = null;
      if (!text(row.firstName) || !text(row.lastName)) {
        result = 'Invalid';
        details = 'First Name and Last Name are required.';
      } else if (!/^\S+@\S+\.\S+$/.test(email)) {
        result = 'Invalid';
        details = 'A valid Email is required.';
      } else if (existingEmails.has(email) || seen.has(email)) {
        result = 'Duplicate';
        details = existingEmails.has(email) ? 'Email already exists in this organization.' : 'Email appears more than once in this workbook.';
      }
      if (email) seen.add(email);
      if (result === 'Valid') counts.valid++;
      if (result === 'Invalid') counts.invalid++;
      if (result === 'Duplicate') counts.duplicate++;
      return { ...row, __rowNumber: index + 2, __result: result, __details: details };
    });
    return { rows: mapped, counts };
  }

  private async validateVacancyRows(organizationId: string, uploaderId: string, rows: RawRow[]): Promise<{ rows: RawRow[]; counts: { valid: number; invalid: number; duplicate: number } }> {
    const [branches, positions, legalEntities, users, existingVacancies, existingRequests] = await Promise.all([
      this.prisma.branch.findMany({ where: { organizationId, status: 'Active' }, select: { id: true, code: true, name: true, legalEntityId: true } }),
      this.prisma.position.findMany({ where: { organizationId, status: 'Active' }, select: { id: true, code: true, title: true } }),
      this.prisma.legalEntity.findMany({ where: { organizationId, status: 'Active' }, select: { id: true, code: true, name: true } }),
      this.prisma.user.findMany({ where: { organizationId, status: 'Active' }, select: { id: true, emailNormalized: true } }),
      this.prisma.vacancy.findMany({ where: { organizationId }, select: { vacancyCode: true } }),
      this.prisma.vacancyRequest.findMany({ where: { organizationId }, select: { requestCode: true } }),
    ]);
    const by = (value: string) => value.trim().toLowerCase();
    const branchByCode = new Map(branches.map((item) => [by(item.code), item]));
    const branchByName = new Map(branches.map((item) => [by(item.name), item]));
    const positionByCode = new Map(positions.map((item) => [by(item.code), item]));
    const positionByTitle = new Map(positions.map((item) => [by(item.title), item]));
    const entityByCode = new Map(legalEntities.map((item) => [by(item.code), item]));
    const entityByName = new Map(legalEntities.map((item) => [by(item.name), item]));
    const userByEmail = new Map(users.map((item) => [by(item.emailNormalized), item]));
    const existingCodes = new Set([
      ...existingVacancies.map((item) => by(item.vacancyCode)),
      ...existingRequests.map((item) => by(item.requestCode)),
    ]);
    const seenCodes = new Set<string>();
    const counts = { valid: 0, invalid: 0, duplicate: 0 };

    const mapped = rows.map((row, index) => {
      const position = positionByCode.get(by(text(row.positionCode))) ?? positionByTitle.get(by(text(row.positionTitle)));
      const branch = branchByCode.get(by(text(row.branchCode))) ?? branchByName.get(by(text(row.branchName)));
      const entity = entityByCode.get(by(text(row.legalEntityCode))) ?? entityByName.get(by(text(row.legalEntityName)));
      const requester = userByEmail.get(by(text(row.requesterEmail))) ?? users.find((user) => user.id === uploaderId);
      const externalCode = by(text(row.externalVacancyCode));
      let result: 'Valid' | 'Invalid' | 'Duplicate' = 'Valid';
      let details: string | null = null;

      if (!position) { result = 'Invalid'; details = 'Position Code or Position Title could not be resolved to an active position.'; }
      else if (!branch) { result = 'Invalid'; details = 'Branch Code or Branch Name could not be resolved to an active branch.'; }
      else if (!row.requestedHeadcount || Number(row.requestedHeadcount) < 1) { result = 'Invalid'; details = 'Requested Headcount must be a positive whole number.'; }
      else if (row.targetStartDate && !dateOnly(row.targetStartDate)) { result = 'Invalid'; details = 'Target Start Date is invalid.'; }
      else if (entity && entity.id !== branch.legalEntityId) { result = 'Invalid'; details = 'The selected branch does not belong to the selected legal entity.'; }
      else if (externalCode && (existingCodes.has(externalCode) || seenCodes.has(externalCode))) {
        result = 'Duplicate';
        details = 'External Vacancy Code already exists or appears more than once in this workbook.';
      }

      if (externalCode) seenCodes.add(externalCode);
      const resolved = {
        ...row,
        positionId: position?.id ?? null,
        branchId: branch?.id ?? null,
        legalEntityId: entity?.id ?? branch?.legalEntityId ?? null,
        requesterId: requester?.id ?? null,
        __rowNumber: index + 2,
        __result: result,
        __details: details,
      };
      if (result === 'Valid') counts.valid++;
      if (result === 'Invalid') counts.invalid++;
      if (result === 'Duplicate') counts.duplicate++;
      return resolved;
    });
    return { rows: mapped, counts };
  }

  private async validateMasterDataRows(organizationId: string, dataset: Extract<Dataset, 'legal-entities' | 'branches' | 'positions'>, rows: RawRow[]): Promise<{ rows: RawRow[]; counts: { valid: number; invalid: number; duplicate: number } }> {
    const [legalEntities, branches, positions] = await Promise.all([
      this.prisma.legalEntity.findMany({ where: { organizationId }, select: { id: true, code: true, name: true, status: true } }),
      this.prisma.branch.findMany({ where: { organizationId }, select: { id: true, legalEntityId: true, code: true, name: true, status: true } }),
      this.prisma.position.findMany({ where: { organizationId }, select: { id: true, legalEntityId: true, code: true, title: true, status: true } }),
    ]);
    const key = (value: unknown) => text(value).trim().toLowerCase();
    const allowedStatuses = new Set(['active', 'inactive', 'archived']);
    const entityByCode = new Map(legalEntities.map((item) => [key(item.code), item]));
    const entityByName = new Map(legalEntities.map((item) => [key(item.name), item]));
    const branchByKey = new Map(branches.map((item) => [`${item.legalEntityId}:${key(item.code)}`, item]));
    const branchByNameKey = new Map(branches.map((item) => [`${item.legalEntityId}:${key(item.name)}`, item]));
    const positionByCode = new Map(positions.map((item) => [key(item.code), item]));
    const positionByTitle = new Map(positions.map((item) => [`${item.legalEntityId ?? ''}:${key(item.title)}`, item]));
    const seen = new Set<string>();
    const counts = { valid: 0, invalid: 0, duplicate: 0 };

    const mapped = rows.map((row, index) => {
      let result: string = 'Valid';
      let details: string | null = null;
      let existingId: string | null = null;
      let resolvedLegalEntityId: string | null = null;
      const status = key(row.status) || 'active';
      const displayStatus = text(row.status) || 'Active';
      const setInvalid = (message: string) => { result = 'Invalid'; details = message; };

      if (!allowedStatuses.has(status)) setInvalid('Status must be Active, Inactive, or Archived.');

      if (dataset === 'legal-entities') {
        const code = key(row.code);
        const name = key(row.name);
        if (!name) setInvalid('Name is required.');
        const existing = code ? entityByCode.get(code) : entityByName.get(name);
        const duplicateKey = code ? `code:${code}` : `name:${name}`;
        if (result !== 'Invalid' && existing) {
          result = 'Duplicate';
          existingId = existing.id;
          details = 'A legal entity with this code or name already exists in this organization.';
        } else if (result !== 'Invalid' && seen.has(duplicateKey)) {
          result = 'Duplicate';
          details = 'This legal entity appears more than once in the workbook.';
        } else if (result !== 'Invalid' && !code) {
          result = 'Warning';
          details = 'Code will be generated automatically when this row is imported.';
        }
        if (result !== 'Invalid') seen.add(duplicateKey);
      } else {
        const inputEntityCode = key(row.legalEntityCode);
        const inputEntityName = key(row.legalEntityName);
        const entityByInputCode = inputEntityCode ? entityByCode.get(inputEntityCode) : undefined;
        const entityByInputName = inputEntityName ? entityByName.get(inputEntityName) : undefined;
        if (dataset === 'branches' && !inputEntityCode && !inputEntityName) setInvalid('Legal Entity Code or Legal Entity Name is required.');
        if (entityByInputCode && entityByInputName && entityByInputCode.id !== entityByInputName.id) setInvalid('Legal Entity Code and Legal Entity Name refer to different legal entities.');
        const entity = entityByInputCode ?? entityByInputName;
        if (result !== 'Invalid' && (inputEntityCode || inputEntityName) && !entity) setInvalid('The legal entity could not be resolved in this organization.');
        resolvedLegalEntityId = entity?.id ?? null;

        if (dataset === 'branches') {
          const name = key(row.name);
          const code = key(row.code);
          if (result !== 'Invalid' && !name) setInvalid('Name is required.');
          if (result !== 'Invalid' && entity) {
            const existing = (code ? branchByKey.get(`${entity.id}:${code}`) : undefined) ?? branchByNameKey.get(`${entity.id}:${name}`);
            const duplicateKey = `${entity.id}:${code ? `code:${code}` : `name:${name}`}`;
            if (existing) {
              result = 'Duplicate';
              existingId = existing.id;
              details = 'A branch with this code or name already exists for the selected legal entity.';
            } else if (seen.has(duplicateKey)) {
              result = 'Duplicate';
              details = 'This branch appears more than once in the workbook for the selected legal entity.';
            } else if (!code) {
              result = 'Warning';
              details = 'Code will be generated automatically when this row is imported.';
            }
            seen.add(duplicateKey);
          }
        } else {
          const title = key(row.title);
          const code = key(row.code);
          if (result !== 'Invalid' && !title) setInvalid('Title is required.');
          if (result !== 'Invalid') {
            const existing = (code ? positionByCode.get(code) : undefined) ?? positionByTitle.get(`${resolvedLegalEntityId ?? ''}:${title}`);
            const duplicateKey = code ? `code:${code}` : `title:${resolvedLegalEntityId ?? ''}:${title}`;
            if (existing) {
              result = 'Duplicate';
              existingId = existing.id;
              details = 'A position with this code or title already exists in this organization.';
            } else if (seen.has(duplicateKey)) {
              result = 'Duplicate';
              details = 'This position appears more than once in the workbook.';
            } else if (!code) {
              result = 'Warning';
              details = 'Code will be generated automatically when this row is imported.';
            }
            seen.add(duplicateKey);
          }
        }
      }

      const resolved = {
        ...row,
        status: displayStatus,
        masterExistingId: existingId,
        masterLegalEntityId: resolvedLegalEntityId,
        __rowNumber: index + 2,
        __result: result,
        __details: details,
      };
      if (result === 'Valid' || result === 'Warning') counts.valid++;
      if (result === 'Invalid') counts.invalid++;
      if (result === 'Duplicate') counts.duplicate++;
      return resolved;
    });
    return { rows: mapped, counts };
  }

  async createJob(
    organizationId: string,
    userId: string,
    dataset: Dataset,
    buffer: Buffer,
    fileName: string,
    sheetName?: string,
  ): Promise<{ jobId: string; summary: ImportJobSummary; inspect: BulkImportInspectResult }> {
    const parsed = this.parseWorkbook(buffer, fileName, sheetName);
    const inspected = this.inspect(dataset, buffer, fileName, sheetName);
    const mapped = this.mapRows(dataset, parsed.rows, parsed.headers);
    const checked = dataset === 'candidates'
      ? await this.validateCandidateRows(organizationId, mapped)
      : dataset === 'vacancy-requests'
        ? await this.validateVacancyRows(organizationId, userId, mapped)
        : await this.validateMasterDataRows(organizationId, dataset, mapped);

    const rowData = checked.rows.map((row) => {
      const result = String(row.__result);
      const details = row.__details ? String(row.__details) : null;
      const rawData = Object.fromEntries(Object.entries(row).filter(([key]) => !key.startsWith('__')));
      return {
        rowNumber: Number(row.__rowNumber),
        rawData: rawData as Prisma.InputJsonValue,
        firstName: dataset === 'candidates' ? text(row.firstName) || null : null,
        lastName: dataset === 'candidates' ? text(row.lastName) || null : null,
        email: dataset === 'candidates' ? text(row.email).toLowerCase() || null : null,
        phone: dataset === 'candidates' ? text(row.phone) || null : null,
        result,
        details,
      };
    });
    const format = fileFormat(fileName);
    const job = await this.prisma.candidateImportJob.create({
      data: {
        organizationId,
        uploadedById: userId,
        fileName: fileName.trim().slice(0, 255),
        dataset,
        sourceFormat: format,
        sheetName: parsed.selectedSheet,
        fileSize: buffer.length,
        checksum: createHash('sha256').update(buffer).digest('hex'),
        status: 'Review',
        totalRows: rowData.length,
        validRows: checked.counts.valid,
        invalidRows: checked.counts.invalid,
        duplicateRows: checked.counts.duplicate,
        rows: { createMany: { data: rowData } },
      },
    });
    return {
      jobId: job.id,
      summary: this.toSummary(job),
      inspect: inspected,
    };
  }

  private toSummary(job: {
    id: string;
    fileName: string;
    dataset: string;
    sourceFormat: string;
    sheetName: string | null;
    status: string;
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateRows: number;
    newRows: number;
    updateRows: number;
    createdAt: Date;
  }, unresolvedDuplicateRows?: number): ImportJobSummary {
    return {
      id: job.id,
      fileName: job.fileName,
      dataset: job.dataset,
      sourceFormat: job.sourceFormat,
      sheetName: job.sheetName,
      status: job.status,
      totalRows: job.totalRows,
      validRows: job.validRows,
      invalidRows: job.invalidRows,
      duplicateRows: job.duplicateRows,
      unresolvedDuplicateRows: unresolvedDuplicateRows ?? job.duplicateRows,
      newRows: job.newRows,
      updateRows: job.updateRows,
      createdAt: job.createdAt.toISOString(),
    };
  }

  async listJobs(organizationId: string, dataset: Dataset, page = 1, pageSize = 20) {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));
    const where = { organizationId, dataset };
    const [total, jobs] = await Promise.all([
      this.prisma.candidateImportJob.count({ where }),
      this.prisma.candidateImportJob.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (safePage - 1) * safePageSize, take: safePageSize }),
    ]);
    return { data: jobs.map((job) => this.toSummary(job)), total, page: safePage, pageSize: safePageSize };
  }

  private async getJob(organizationId: string, dataset: Dataset, jobId: string) {
    const job = await this.prisma.candidateImportJob.findFirst({ where: { id: jobId, organizationId, dataset }, include: { rows: true } });
    if (!job) throw new NotFoundException('Import job not found.');
    return job;
  }

  async getSummary(organizationId: string, dataset: Dataset, jobId: string): Promise<ImportJobSummary> {
    const job = await this.getJob(organizationId, dataset, jobId);
    return this.toSummary(job, job.rows.filter((row) => row.result === 'Duplicate' && !row.decision).length);
  }

  async getRows(organizationId: string, dataset: Dataset, jobId: string, page = 1, pageSize = 50): Promise<{ rows: BulkImportRowItem[]; total: number; page: number; pageSize: number }> {
    const job = await this.getJob(organizationId, dataset, jobId);
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));
    const [total, rows] = await Promise.all([
      this.prisma.candidateImportRow.count({ where: { jobId: job.id } }),
      this.prisma.candidateImportRow.findMany({ where: { jobId: job.id }, orderBy: { rowNumber: 'asc' }, skip: (safePage - 1) * safePageSize, take: safePageSize }),
    ]);
    return {
      rows: rows.map((row) => ({ id: row.id, rowNumber: row.rowNumber, data: (row.rawData as Record<string, unknown>) ?? {}, result: row.result as BulkImportRowItem['result'], details: row.details, decision: (row.decision as BulkImportRowItem['decision']) ?? null })),
      total,
      page: safePage,
      pageSize: safePageSize,
    };
  }

  async saveDecision(organizationId: string, dataset: Dataset, jobId: string, rowId: string, decision: 'Import' | 'Skip' | 'Update') {
    const job = await this.getJob(organizationId, dataset, jobId);
    const row = job.rows.find((candidate) => candidate.id === rowId);
    if (!row) throw new NotFoundException('Import row not found.');
    if (row.result !== 'Duplicate') throw importInvalid('A decision is only required for duplicate rows.');
    if (dataset === 'vacancy-requests' && !['Import', 'Skip'].includes(decision)) throw importInvalid('Vacancy duplicate decisions must be Import or Skip.');
    if (dataset === 'candidates' && !['Update', 'Skip', 'Import'].includes(decision)) throw importInvalid('Candidate duplicate decisions must be Update, Import, or Skip.');
    if (['legal-entities', 'branches', 'positions'].includes(dataset)) {
      if (!['Update', 'Skip'].includes(decision)) throw importInvalid('Master-data duplicate decisions must be Update or Skip.');
      if (decision === 'Update' && !(row.rawData as Record<string, unknown>)?.masterExistingId) throw importInvalid('This duplicate has no existing record to update; skip it or correct the workbook.');
    }
    await this.prisma.candidateImportRow.update({ where: { id: row.id }, data: { decision: decision === 'Import' ? 'KeepBoth' : decision } });
    return { success: true };
  }

  async confirm(organizationId: string, userId: string, dataset: Dataset, jobId: string) {
    if (dataset === 'candidates') return this.importService.confirmJob(organizationId, jobId);
    if (dataset === 'legal-entities' || dataset === 'branches' || dataset === 'positions') {
      return this.confirmMasterData(organizationId, dataset, jobId);
    }
    const job = await this.getJob(organizationId, dataset, jobId);
    if (job.status !== 'Review') throw importInvalid(`Import job cannot be confirmed from ${job.status}.`);
    if (job.rows.some((row) => row.result === 'Duplicate' && !row.decision)) throw importInvalid('Resolve all duplicate rows before confirming.');

    const locked = await this.prisma.candidateImportJob.updateMany({ where: { id: job.id, organizationId, dataset, status: 'Review' }, data: { status: 'Processing' } });
    if (locked.count !== 1) throw importInvalid('Import job is already being processed.');

    let imported = 0;
    let failed = 0;
    for (const row of job.rows) {
      if (row.result === 'Invalid' || (row.result === 'Duplicate' && row.decision === 'Skip')) continue;
      const raw = (row.rawData as Record<string, unknown>) ?? {};
      try {
        const request: CreateVacancyRequestDto = {
          branchId: String(raw.branchId),
          positionId: String(raw.positionId),
          legalEntityId: raw.legalEntityId ? String(raw.legalEntityId) : null,
          requesterId: raw.requesterId ? String(raw.requesterId) : userId,
          requestedHeadcount: Number(raw.requestedHeadcount),
          employmentType: raw.employmentType ? String(raw.employmentType) : null,
          reason: raw.reason ? String(raw.reason) : null,
          budgetStatus: raw.budgetStatus ? String(raw.budgetStatus) : null,
          criticality: raw.criticality ? String(raw.criticality) : null,
          targetStartDate: raw.targetStartDate ? String(raw.targetStartDate) : null,
          justification: [raw.externalVacancyCode ? `External vacancy code: ${String(raw.externalVacancyCode)}` : '', raw.justification ? String(raw.justification) : '']
            .filter(Boolean)
            .join('\n') || null,
        };
        const created = await this.vacancyCoreService.createRequest(organizationId, userId, request);
        await this.prisma.candidateImportRow.update({ where: { id: row.id }, data: { details: `Draft vacancy request ${created.requestCode} created.` } });
        imported++;
      } catch (error) {
        failed++;
        const message = error instanceof Error ? error.message : 'Unable to create vacancy request.';
        await this.prisma.candidateImportRow.update({ where: { id: row.id }, data: { result: 'Invalid', details: message.slice(0, 2000) } });
      }
    }
    const status = failed > 0 ? 'Completed with errors' : 'Confirmed';
    const updated = await this.prisma.candidateImportJob.update({ where: { id: job.id }, data: { status, newRows: imported, updateRows: 0, invalidRows: job.invalidRows + failed } });
    return { success: failed === 0, status: updated.status, newRows: imported, failedRows: failed };
  }

  private async confirmMasterData(
    organizationId: string,
    dataset: Extract<Dataset, 'legal-entities' | 'branches' | 'positions'>,
    jobId: string,
  ) {
    const job = await this.getJob(organizationId, dataset, jobId);
    if (job.status !== 'Review') throw importInvalid(`Import job cannot be confirmed from ${job.status}.`);
    if (job.rows.some((row) => row.result === 'Duplicate' && !row.decision)) throw importInvalid('Resolve all duplicate rows before confirming.');

    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.candidateImportJob.updateMany({ where: { id: job.id, organizationId, dataset, status: 'Review' }, data: { status: 'Processing' } });
      if (locked.count !== 1) throw importInvalid('Import job is already being processed.');
      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const row of job.rows) {
        if (row.result === 'Invalid' || (row.result === 'Duplicate' && row.decision === 'Skip')) {
          skipped++;
          await tx.candidateImportRow.update({ where: { id: row.id }, data: { details: row.result === 'Invalid' ? row.details : 'Skipped by recruiter.' } });
          continue;
        }
        const raw = (row.rawData as Record<string, unknown>) ?? {};
        const status = text(raw.status) || 'Active';
        const existingId = raw.masterExistingId ? String(raw.masterExistingId) : null;
        if (dataset === 'legal-entities') {
          if (existingId && row.result === 'Duplicate' && row.decision === 'Update') {
            await tx.legalEntity.update({ where: { id: existingId }, data: { name: String(raw.name), status } });
            updated++;
            await tx.candidateImportRow.update({ where: { id: row.id }, data: { details: `Legal entity ${existingId} updated by recruiter.` } });
          } else {
            const data: CreateLegalEntityDto = { name: String(raw.name) };
            if (raw.code) data.code = String(raw.code);
            const entity = await this.masterDataService.createLegalEntityInTransaction(tx, organizationId, data);
            if (status !== 'Active') await tx.legalEntity.update({ where: { id: entity.id }, data: { status } });
            created++;
            await tx.candidateImportRow.update({ where: { id: row.id }, data: { details: `Legal entity ${entity.code} created.` } });
          }
        } else if (dataset === 'branches') {
          const legalEntityId = raw.masterLegalEntityId ? String(raw.masterLegalEntityId) : '';
          if (existingId && row.result === 'Duplicate' && row.decision === 'Update') {
            await tx.branch.update({ where: { id: existingId }, data: { name: String(raw.name), city: raw.city ? String(raw.city) : null, status } });
            updated++;
            await tx.candidateImportRow.update({ where: { id: row.id }, data: { details: `Branch ${existingId} updated by recruiter.` } });
          } else {
            const data: CreateBranchDto = { legalEntityId, name: String(raw.name) };
            if (raw.code) data.code = String(raw.code);
            if (raw.city) data.city = String(raw.city);
            const branch = await this.masterDataService.createBranchInTransaction(tx, organizationId, data);
            if (status !== 'Active') await tx.branch.update({ where: { id: branch.id }, data: { status } });
            created++;
            await tx.candidateImportRow.update({ where: { id: row.id }, data: { details: `Branch ${branch.code} created.` } });
          }
        } else {
          const legalEntityId = raw.masterLegalEntityId ? String(raw.masterLegalEntityId) : undefined;
          if (existingId && row.result === 'Duplicate' && row.decision === 'Update') {
            await tx.position.update({ where: { id: existingId }, data: { title: String(raw.title), description: raw.description ? String(raw.description) : null, legalEntityId: legalEntityId ?? null, status } });
            updated++;
            await tx.candidateImportRow.update({ where: { id: row.id }, data: { details: `Position ${existingId} updated by recruiter.` } });
          } else {
            const data: CreatePositionDto = { title: String(raw.title) };
            if (raw.code) data.code = String(raw.code);
            if (raw.description) data.description = String(raw.description);
            if (legalEntityId) data.legalEntityId = legalEntityId;
            const position = await this.masterDataService.createPositionInTransaction(tx, organizationId, data);
            if (status !== 'Active') await tx.position.update({ where: { id: position.id }, data: { status } });
            created++;
            await tx.candidateImportRow.update({ where: { id: row.id }, data: { details: `Position ${position.code} created.` } });
          }
        }
      }

      const updatedJob = await tx.candidateImportJob.update({ where: { id: job.id }, data: { status: 'Confirmed', newRows: created, updateRows: updated } });
      return { success: true, status: updatedJob.status, newRows: created, updateRows: updated, skippedRows: skipped };
    });
  }

  async getErrorReport(organizationId: string, dataset: Dataset, jobId: string): Promise<Buffer> {
    await this.getJob(organizationId, dataset, jobId);
    const rows = await this.prisma.candidateImportRow.findMany({ where: { jobId, result: { in: ['Invalid', 'Duplicate'] } }, orderBy: { rowNumber: 'asc' } });
    const columns = ['Row', 'Result', 'Details', ...this.getDatasetDefinition(dataset).map((column) => column.header)];
    const data = rows.map((row) => {
      const raw = (row.rawData as Record<string, unknown>) ?? {};
      return [row.rowNumber, row.result, row.details ?? '', ...this.getDatasetDefinition(dataset).map((column) => Array.isArray(raw[column.key]) ? (raw[column.key] as unknown[]).join(', ') : raw[column.key] ?? '')];
    });
    const sheet = XLSX.utils.aoa_to_sheet([columns, ...data]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Import Errors');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  template(dataset: Dataset): Buffer {
    const columns = this.getDatasetDefinition(dataset);
    const rows = [columns.map((column) => column.header), columns.map((column) => column.required ? '' : '')];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    const sheetName = dataset === 'candidates'
      ? 'Candidates'
      : dataset === 'vacancy-requests'
        ? 'Vacancy Requests'
        : dataset === 'legal-entities'
          ? 'Legal Entities'
          : dataset === 'branches' ? 'Branches' : 'Positions';
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }
}

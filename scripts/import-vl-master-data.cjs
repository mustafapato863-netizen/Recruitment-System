#!/usr/bin/env node
/*
 * Import the authoritative Departments and Job Titles from VL.xlsx.
 *
 * This command is intentionally dry-run by default. It reads the Rowdata
 * sheet, normalizes invisible whitespace,
 * de-duplicates case-insensitively, and preserves existing records.
 *
 * Examples:
 *   node scripts/import-vl-master-data.cjs --workbook "D:\\Manpower\\VL.xlsx"
 *   node scripts/import-vl-master-data.cjs --organization-id <uuid> --apply
 *   node scripts/import-vl-master-data.cjs --organization-id <uuid> --include-uae --apply
 *   node scripts/import-vl-master-data.cjs --organization-id <uuid> --include-hiring --apply
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require(path.join(process.cwd(), 'database/node_modules/dotenv'));
const XLSX = require(path.join(process.cwd(), 'apps/api/node_modules/xlsx'));
const { PrismaClient } = require(path.join(process.cwd(), 'database/generated/client'));

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
function valueFor(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

const workbookPath = valueFor('--workbook') || process.env.VL_WORKBOOK_PATH || 'D:\\Manpower\\VL.xlsx';
const organizationIdArg = valueFor('--organization-id') || process.env.DEFAULT_ORGANIZATION_ID;
const apply = hasFlag('--apply');
const includeUae = hasFlag('--include-uae') || hasFlag('--include-uae-vl');
const includeHiring = hasFlag('--include-hiring');

function normalizeText(value) {
  return String(value ?? '')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function key(value) {
  return normalizeText(value).toLocaleLowerCase('en-US');
}

function field(row, expectedName) {
  const expected = key(expectedName);
  const actual = Object.keys(row).find((candidate) => key(candidate) === expected);
  return actual ? row[actual] : null;
}

const ALIASES = new Map([
  ['anesthesia', 'Anesthesia'],
  ['dental', 'Dental'],
  ['facility', 'Facility'],
  ['customer service', 'Customer Service'],
  ['supply chain', 'Supply Chain'],
  ['legal advaisor', 'Legal Advisor'],
  ['senior it network adminstrator', 'Senior IT Network Administrator'],
  ['laundary helper', 'Laundry Helper'],
  ['pharamcy clerk', 'Pharmacy Clerk'],
  ['digital marketing manager', 'Digital Marketing Manager'],
]);

function canonical(value) {
  const normalized = normalizeText(value);
  return ALIASES.get(key(normalized)) || normalized;
}

function slug(value) {
  return key(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36) || 'position';
}

function objectMetadata(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
}

function sameJson(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function readSourceRows() {
  if (!fs.existsSync(workbookPath)) throw new Error(`Workbook not found: ${workbookPath}`);
  const workbook = XLSX.readFile(workbookPath, { cellDates: true });
  const requestedSheets = ['Rowdata'];
  if (includeUae) requestedSheets.push('UAE VL ');
  if (includeHiring) requestedSheets.push('Sheet1', 'Quality KPIs', 'UAE MP');
  const sheets = requestedSheets
    .map((requested) => workbook.SheetNames.find((name) => name.trim().toLowerCase() === requested.trim().toLowerCase()))
    .filter((name, index, all) => name && all.indexOf(name) === index);
  if (sheets.length === 0) throw new Error('The workbook does not contain the required Rowdata sheet.');

  const records = [];
  for (const sheetName of sheets) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, blankrows: false, raw: true });
    rows.forEach((row, index) => {
      const title = canonical(field(row, 'Position'));
      const department = canonical(field(row, 'Department Name') || field(row, 'Department'));
      if (!title || title === '#REF!' || title.toLowerCase() === 'position') return;
      if (!department || department === '#REF!') return;
      records.push({
        title,
        department,
        level: normalizeText(field(row, 'Level')) || null,
        entity: normalizeText(field(row, 'Entity')) || null,
        type: normalizeText(field(row, 'Type')) || null,
        status: normalizeText(field(row, 'Status')) || null,
        sheetName,
        sourceRow: index + 2,
      });
    });
  }

  const byTitle = new Map();
  for (const record of records) {
    const titleKey = key(record.title);
    const existing = byTitle.get(titleKey);
    if (!existing) {
      byTitle.set(titleKey, { ...record, sheets: [{ sheet: record.sheetName, row: record.sourceRow }] });
      continue;
    }
    existing.sheets.push({ sheet: record.sheetName, row: record.sourceRow });
    if (!existing.department && record.department) existing.department = record.department;
    if (!existing.level && record.level) existing.level = record.level;
    if (!existing.entity && record.entity) existing.entity = record.entity;
  }

  const titleRecords = Array.from(byTitle.values()).sort((a, b) => a.title.localeCompare(b.title));
  const departments = Array.from(new Map(titleRecords.map((record) => [key(record.department), record.department])).values())
    .sort((a, b) => a.localeCompare(b));
  return { sheets, titleRecords, departments };
}

function printPlan(plan) {
  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    workbook: workbookPath,
    sheets: plan.sheets,
    departments: plan.departments.length,
    jobTitles: plan.titleRecords.length,
    sampleDepartments: plan.departments.slice(0, 10),
    sampleJobTitles: plan.titleRecords.slice(0, 10).map((record) => record.title),
    note: apply ? 'Existing records are preserved; only missing or source metadata is updated.' : 'No database changes were made. Add --apply to write these records.',
  }, null, 2));
}

async function resolveOrganizationId(prisma) {
  if (organizationIdArg) return organizationIdArg;
  const organizations = await prisma.organization.findMany({ where: { status: 'Active' }, select: { id: true, code: true, name: true } });
  if (organizations.length !== 1) {
    throw new Error(`Pass --organization-id. Found ${organizations.length} active organizations.`);
  }
  return organizations[0].id;
}

async function applyPlan(prisma, plan, organizationId) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`vl-master-data:${organizationId}`}))`;
    const [existingDepartments, existingPositions] = await Promise.all([
      tx.masterDataValue.findMany({ where: { organizationId, category: 'departments' } }),
      tx.position.findMany({ where: { organizationId }, select: { id: true, code: true, title: true, metadata: true, status: true } }),
    ]);
    const departmentByKey = new Map(existingDepartments.map((record) => [key(record.name), record]));
    const positionByKey = new Map(existingPositions.map((record) => [key(record.title), record]));
    const positionCodes = new Set(existingPositions.map((record) => record.code));
    let nextCode = existingPositions.reduce((max, record) => {
      const match = String(record.code).match(/^VL-(\d+)$/i);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    const counts = { departmentsCreated: 0, departmentsUpdated: 0, positionsCreated: 0, positionsUpdated: 0 };

    for (const department of plan.departments) {
      const existing = departmentByKey.get(key(department));
      if (existing) {
        const metadata = { ...objectMetadata(existing.metadata), sourceFile: path.basename(workbookPath), sourceSheets: plan.sheets };
        if (existing.status !== 'Active' || !sameJson(existing.metadata, metadata)) {
          await tx.masterDataValue.update({ where: { id: existing.id }, data: { status: 'Active', metadata, version: { increment: 1 } } });
          counts.departmentsUpdated += 1;
        }
      } else {
        const code = `DEP-${slug(department).toUpperCase().slice(0, 70)}`;
        const created = await tx.masterDataValue.create({ data: {
          id: crypto.randomUUID(), organizationId, category: 'departments', code, name: department,
          metadata: { sourceFile: path.basename(workbookPath), sourceSheets: plan.sheets }, status: 'Active',
        } });
        departmentByKey.set(key(department), created);
        counts.departmentsCreated += 1;
      }
    }

    for (const record of plan.titleRecords) {
      const existing = positionByKey.get(key(record.title));
      const sourceMetadata = {
        sourceFile: path.basename(workbookPath),
        sourceSheets: record.sheets,
        departmentName: record.department,
        departmentId: departmentByKey.get(key(record.department))?.id || null,
        level: record.level,
        entity: record.entity,
        sourceStatus: record.status,
        sourceType: record.type,
      };
      if (existing) {
        const metadata = { ...objectMetadata(existing.metadata), ...sourceMetadata };
        if (existing.status !== 'Active' || !sameJson(existing.metadata, metadata)) {
          await tx.position.update({ where: { id: existing.id }, data: { status: 'Active', metadata, version: { increment: 1 } } });
          counts.positionsUpdated += 1;
        }
        continue;
      }
      let code;
      do {
        nextCode += 1;
        code = `VL-${String(nextCode).padStart(4, '0')}`;
      } while (positionCodes.has(code));
      positionCodes.add(code);
      const created = await tx.position.create({ data: {
        id: crypto.randomUUID(), organizationId, code, title: record.title,
        description: null, metadata: sourceMetadata, status: 'Active',
      } });
      positionByKey.set(key(record.title), created);
      counts.positionsCreated += 1;
    }
    return counts;
  });
}

async function main() {
  const plan = readSourceRows();
  const prisma = new PrismaClient();
  try {
    if (!apply) {
      printPlan(plan);
      return;
    }
    const organizationId = await resolveOrganizationId(prisma);
    const counts = await applyPlan(prisma, plan, organizationId);
    console.log(JSON.stringify({ ...counts, organizationId, workbook: workbookPath }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

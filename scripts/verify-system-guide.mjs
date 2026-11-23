import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const GUIDE_DIR = join(ROOT, 'docs', 'system-guide');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const errors = [];

// 1. Verify expected guide files exist
const expectedFiles = [
  'README.md',
  '01-workspaces-roles-and-rbac.md',
  '02-end-to-end-hiring-workflows-and-gates.md',
  '03-frontend-routes-pages-and-drawers.md',
  '04-backend-api-modules-and-contracts.md',
  '05-database-schema-and-workers.md',
  '06-operations-ci-and-release.md',
  'ai-assistant/SYSTEM_PROMPT.md',
  'ai-assistant/KNOWLEDGE_BASE_INDEX.md',
  'ai-assistant/KNOWLEDGE_CHUNKS.jsonl',
  'ai-assistant/ROLE_PLAYBOOKS_AND_FAQ.md',
  'ai-assistant/ASSISTANT_EVAL_CASES.md',
];
for (const rel of expectedFiles) {
  if (!existsSync(join(GUIDE_DIR, rel))) errors.push(`Missing required guide file: docs/system-guide/${rel}`);
}

// 2. Verify all 64 SCREEN_ROUTES appear in 03-frontend-routes-pages-and-drawers.md
const screenRegistry = readFileSync(join(ROOT, 'apps/web/src/v2/screenRegistry.ts'), 'utf8');
const routeMatches = [...screenRegistry.matchAll(/'(\/[^']*|\*)'/g)].map((m) => m[1]);
const frontendDoc = readFileSync(join(GUIDE_DIR, '03-frontend-routes-pages-and-drawers.md'), 'utf8');
for (const route of routeMatches) {
  if (!frontendDoc.includes(`\`${route}\``)) {
    errors.push(`Missing frontend route in 03-frontend-routes-pages-and-drawers.md: ${route}`);
  }
}

// 3. Verify all API modules & controller classes appear in 04-backend-api-modules-and-contracts.md
const apiDoc = readFileSync(join(GUIDE_DIR, '04-backend-api-modules-and-contracts.md'), 'utf8');
const apiModules = readdirSync(join(ROOT, 'apps/api/src'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);
for (const mod of apiModules) {
  if (!apiDoc.includes(mod)) {
    errors.push(`Missing API module name in 04-backend-api-modules-and-contracts.md: ${mod}`);
  }
}
const controllerFiles = walk(join(ROOT, 'apps/api/src')).filter((f) => f.endsWith('.controller.ts'));
for (const file of controllerFiles) {
  const src = readFileSync(file, 'utf8');
  for (const match of src.matchAll(/export class (\w+Controller)/g)) {
    if (!apiDoc.includes(match[1])) {
      errors.push(`Missing controller class in 04-backend-api-modules-and-contracts.md: ${match[1]}`);
    }
  }
}

// 4. Verify all Prisma models & worker functions appear in 05-database-schema-and-workers.md
const dbDoc = readFileSync(join(GUIDE_DIR, '05-database-schema-and-workers.md'), 'utf8');
const schemaSrc = readFileSync(join(ROOT, 'database/prisma/schema.prisma'), 'utf8');
const models = [...schemaSrc.matchAll(/^model\s+(\w+)\s+\{/gm)].map((m) => m[1]);
for (const model of models) {
  if (!dbDoc.includes(`\`${model}\``)) {
    errors.push(`Missing Prisma model in 05-database-schema-and-workers.md: ${model}`);
  }
}
for (const workerFn of [
  'sweepStaleApplicants',
  'sweepConsentExpiry',
  'sweepDueDateReminders',
  'expireOverdueOffers',
  'sweepScorecardReminders',
  'outbox-crypto.ts',
]) {
  if (!dbDoc.includes(workerFn)) {
    errors.push(`Missing worker module/function in 05-database-schema-and-workers.md: ${workerFn}`);
  }
}

// 5. Verify KNOWLEDGE_CHUNKS.jsonl structure & unique IDs
const jsonlPath = join(GUIDE_DIR, 'ai-assistant/KNOWLEDGE_CHUNKS.jsonl');
const lines = readFileSync(jsonlPath, 'utf8').split(/\r?\n/).filter((l) => l.trim());
const seenIds = new Set();
const requiredKeys = ['id', 'topic', 'title', 'audience', 'seats', 'routes', 'api', 'models', 'error_codes', 'summary'];
if (lines.length < 10) errors.push(`Expected >= 10 JSONL chunks, found ${lines.length}`);
lines.forEach((line, idx) => {
  try {
    const obj = JSON.parse(line);
    for (const key of requiredKeys) {
      if (!(key in obj)) errors.push(`KNOWLEDGE_CHUNKS.jsonl line ${idx + 1} missing key "${key}"`);
    }
    if (seenIds.has(obj.id)) errors.push(`Duplicate JSONL id "${obj.id}" on line ${idx + 1}`);
    seenIds.add(obj.id);
  } catch (err) {
    errors.push(`Invalid JSON on KNOWLEDGE_CHUNKS.jsonl line ${idx + 1}: ${err.message}`);
  }
});

// 6. Verify all relative markdown links across docs/system-guide/
for (const mdFile of walk(GUIDE_DIR).filter((f) => f.endsWith('.md'))) {
  const md = readFileSync(mdFile, 'utf8');
  for (const m of md.matchAll(/\[[^\]]+\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
    const target = m[1].trim();
    if (!target || /^(https?:|mailto:|file:)/.test(target)) continue;
    const resolved = resolve(dirname(mdFile), target);
    if (!existsSync(resolved)) {
      errors.push(`Broken link "${target}" in ${mdFile.slice(ROOT.length + 1)}`);
    }
  }
}

if (errors.length > 0) {
  console.error('System guide verification FAILED:');
  for (const e of errors) console.error(' - ' + e);
  process.exit(1);
}

console.log(
  `System guide verified cleanly: ${expectedFiles.length} guide files, ${routeMatches.length} routes, ` +
    `${apiModules.length} API modules (${controllerFiles.length} controller files), ${models.length} Prisma models, ` +
    `and ${lines.length} valid KNOWLEDGE_CHUNKS.jsonl records.`,
);

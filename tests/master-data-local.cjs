// Local-only regression for the Excel-style Master Data catalog API.
const assert = require('node:assert/strict');
const { PrismaClient } = require('../database/generated/client');
process.loadEnvFile('.env');

const prisma = new PrismaClient();
const base = process.env.RECRUITFLOW_API_URL || 'http://localhost:3000/api/v1';
let createdId;
let createdPositionId;

async function main() {
  const login = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.RECRUITFLOW_TEST_EMAIL || 'admin@me.com', password: process.env.RECRUITFLOW_TEST_PASSWORD || 'Admin@123456' }),
  });
  assert.equal(login.status, 200, await login.clone().text());
  const cookie = login.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
  const branchesCatalog = await fetch(`${base}/master-data/catalog/branches`, {
    headers: { Cookie: cookie },
  });
  assert.equal(branchesCatalog.status, 200, await branchesCatalog.clone().text());
  assert.ok(Array.isArray(await branchesCatalog.json()), 'Branches catalog should return an array');

  const invalidCatalog = await fetch(`${base}/master-data/catalog/not-a-catalog`, {
    headers: { Cookie: cookie },
  });
  assert.equal(invalidCatalog.status, 400, await invalidCatalog.clone().text());

  const source = `QA Source ${Date.now()}`;
  const create = await fetch(`${base}/master-data/catalog/candidate-sources/batch`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows: [{ name: source, code: `QA-${Date.now()}`, metadata: { type: 'Referral' }, status: 'Active' }] }),
  });
  assert.equal(create.status, 201, await create.clone().text());
  const created = await create.json();
  const row = created.data.find((item) => item.name === source);
  assert.ok(row, 'Created catalog row was not returned');
  assert.equal(row.metadata?.type, 'Referral', 'Metadata was not persisted on create');
  createdId = row.id;
  const update = await fetch(`${base}/master-data/catalog/candidate-sources/batch`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows: [{ id: row.id, expectedVersion: row.version, name: source, code: row.code, metadata: { type: 'Agency' }, status: 'Inactive' }] }),
  });
  assert.equal(update.status, 201, await update.clone().text());
  const updated = await update.json();
  assert.equal(updated.data.find((item) => item.id === row.id)?.metadata?.type, 'Agency', 'Metadata was not persisted on update');
  const stale = await fetch(`${base}/master-data/catalog/candidate-sources/batch`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows: [{ id: row.id, expectedVersion: row.version, name: source, code: row.code, status: 'Active' }] }),
  });
  assert.equal(stale.status, 409, await stale.clone().text());
  const title = `QA Position ${Date.now()}`;
  const position = await fetch(`${base}/positions`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, metadata: { level: 'Senior', suggestedSkills: 'SQL, Excel' } }),
  });
  assert.equal(position.status, 201, await position.clone().text());
  const positionRecord = await position.json();
  createdPositionId = positionRecord.id;
  const catalog = await fetch(`${base}/master-data/catalog/job-titles`, { headers: { Cookie: cookie } });
  assert.equal(catalog.status, 200, await catalog.clone().text());
  const catalogRows = await catalog.json();
  const catalogPosition = catalogRows.find((item) => item.id === createdPositionId);
  assert.equal(catalogPosition?.metadata?.level, 'Senior', 'Position metadata was not returned');
  assert.equal(catalogPosition?.metadata?.suggestedSkills, 'SQL, Excel', 'Position metadata was not returned');
  console.log('PASS: Master Data batch create, versioned update, and stale-write conflict');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (createdId) await prisma.masterDataValue.delete({ where: { id: createdId } }).catch(() => undefined);
  if (createdPositionId) await prisma.position.delete({ where: { id: createdPositionId } }).catch(() => undefined);
  await prisma.$disconnect();
});

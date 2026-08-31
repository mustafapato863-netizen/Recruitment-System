const { PrismaClient } = require('@recruitflow/database');
const http = require('http');
const assert = require('assert');
const { spawn } = require('child_process');
require('dotenv').config();

const prisma = new PrismaClient();
let API_PORT = 3010; // Use a different port to avoid conflict if dev server is running
let apiProcess;
let adminToken;
let recruiterToken;
let orgAId;
let orgBId;
let testEnv;

async function setup() {
  console.log('--- Setting up M1-G5 Master Data Test Fixtures ---');

  // Get the two organizations from seed
  const orgs = await prisma.organization.findMany({ take: 2, orderBy: { code: 'asc' } });
  orgAId = orgs[0].id;
  orgBId = orgs[1].id;

  const admin = await prisma.user.findFirst({ where: { email: 'ahmed.mahmoud@recruitflow.local' } });
  const recruiter = await prisma.user.findFirst({ where: { email: 'sarah.ahmed@recruitflow.local' } });
  const orgBAdmin = await prisma.user.findFirst({ where: { email: 'tarek.kamal@acme-health.local' } });

  // Since we are blackbox testing against the API, we need real tokens.
  // We'll just hit the login endpoint after the API starts.

  console.log(`Using existing API server on port 3000...`);
  API_PORT = 3000;
  return Promise.resolve();
}

async function apiRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: API_PORT,
      path: `/api/v1${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function login(email, password) {
  const res = await apiRequest('POST', '/auth/login', { email, password });
  assert.strictEqual(res.status, 200, `Login failed for ${email}`);
  
  // Extract access_token from cookies
  const cookies = res.headers['set-cookie'];
  const accessCookie = cookies.find(c => c.startsWith('access_token='));
  const token = accessCookie.split(';')[0].split('=')[1];
  return token;
}

async function runTests() {
  console.log('\n--- Logging in test users ---');
  adminToken = await login('ahmed.mahmoud@recruitflow.local', 'Password123!');
  recruiterToken = await login('sarah.ahmed@recruitflow.local', 'Password123!');
  const orgBAdminToken = await login('tarek.kamal@acme-health.local', 'Password123!');
  
  console.log('Tokens acquired. Starting test cases...\n');
  let passed = 0;
  let failed = 0;
  let createdEntities = [];
  let createdBranches = [];
  let createdPositions = [];

  function assertEqual(actual, expected, msg) {
    if (actual !== expected) {
      throw new Error(`${msg}: expected ${expected}, got ${actual}`);
    }
  }

  function assertMatch(actual, regex, msg) {
    if (!regex.test(actual)) {
      throw new Error(`${msg}: expected ${actual} to match ${regex}`);
    }
  }

  async function test(name, fn) {
    process.stdout.write(`- ${name}... `);
    try {
      await fn();
      console.log('\x1b[32mPASS\x1b[0m');
      passed++;
    } catch (e) {
      console.log('\x1b[31mFAIL\x1b[0m');
      console.error(`  => ${e.message}`);
      failed++;
    }
  }

  // --- Tests ---

  await test('1. Automatic code generation (Legal Entity)', async () => {
    const res = await apiRequest('POST', '/legal-entities', { name: 'Auto Gen LE' }, adminToken);
    assertEqual(res.status, 201, 'Status should be 201');
    assertMatch(res.data.code, /^LE-\d{4}$/, 'Code should match LE-XXXX pattern');
    createdEntities.push(res.data.id);
  });

  await test('2. Explicit code duplicate rejection (Branch)', async () => {
    const leRes = await apiRequest('POST', '/legal-entities', { name: 'Parent LE for Duplicate Test' }, adminToken);
    const leId = leRes.data.id;
    createdEntities.push(leId);

    const res1 = await apiRequest('POST', '/branches', { legalEntityId: leId, code: 'BR-DUP', name: 'Dup Branch 1' }, adminToken);
    assertEqual(res1.status, 201, 'First creation should succeed');
    createdBranches.push(res1.data.id);

    const res2 = await apiRequest('POST', '/branches', { legalEntityId: leId, code: 'BR-DUP', name: 'Dup Branch 2' }, adminToken);
    assertEqual(res2.status, 409, 'Second creation with same code should return 409');
  });

  await test('3. Concurrent creation unique code resolution (Position)', async () => {
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(apiRequest('POST', '/positions', { title: `Concurrent Pos ${i}` }, adminToken));
    }
    const results = await Promise.all(promises);
    const codes = new Set();
    for (const res of results) {
      assertEqual(res.status, 201, 'All creations should succeed');
      codes.add(res.data.code);
      createdPositions.push(res.data.id);
    }
    assertEqual(codes.size, 5, 'Should generate 5 unique codes');
  });

  await test('4. GET :id works for all master data types', async () => {
    const leRes = await apiRequest('GET', `/legal-entities/${createdEntities[0]}`, null, adminToken);
    if (leRes.status !== 200) console.log('GET LE failed:', leRes);
    assertEqual(leRes.status, 200, 'GET legal entity by id should succeed');
    
    const brRes = await apiRequest('GET', `/branches/${createdBranches[0]}`, null, adminToken);
    assertEqual(brRes.status, 200, 'GET branch by id should succeed');

    const posRes = await apiRequest('GET', `/positions/${createdPositions[0]}`, null, adminToken);
    assertEqual(posRes.status, 200, 'GET position by id should succeed');
  });

  await test('5. Cross-tenant access is rejected (404 Not Found)', async () => {
    const leRes = await apiRequest('GET', `/legal-entities/${createdEntities[0]}`, null, orgBAdminToken);
    assertEqual(leRes.status, 404, 'Cross-tenant GET should return 404');

    const archiveRes = await apiRequest('POST', `/branches/${createdBranches[0]}/archive`, null, orgBAdminToken);
    assertEqual(archiveRes.status, 404, 'Cross-tenant archive should return 404');
  });

  await test('6. Role-based access control (RBAC)', async () => {
    // Recruiter has MASTER_DATA_VIEW, but not MASTER_DATA_MANAGE
    const getRes = await apiRequest('GET', `/legal-entities/${createdEntities[0]}`, null, recruiterToken);
    assertEqual(getRes.status, 200, 'Recruiter should be able to view');

    const postRes = await apiRequest('POST', '/positions', { title: 'Unauthorized Pos' }, recruiterToken);
    assertEqual(postRes.status, 403, 'Recruiter should not be able to create');

    const archiveRes = await apiRequest('POST', `/positions/${createdPositions[0]}/archive`, null, recruiterToken);
    assertEqual(archiveRes.status, 403, 'Recruiter should not be able to archive');
  });

  await test('7. Archive and Restore state transitions', async () => {
    const pId = createdPositions[0];
    const archiveRes = await apiRequest('POST', `/positions/${pId}/archive`, null, adminToken);
    assertEqual(archiveRes.status, 201, 'Archive should succeed (returns 201 since it is a POST)');
    assertEqual(archiveRes.data.status, 'Archived', 'Status should be Archived');

    const archiveAgainRes = await apiRequest('POST', `/positions/${pId}/archive`, null, adminToken);
    assertEqual(archiveAgainRes.status, 400, 'Archiving an already archived record should return 400');

    const restoreRes = await apiRequest('POST', `/positions/${pId}/restore`, null, adminToken);
    assertEqual(restoreRes.status, 201, 'Restore should succeed');
    assertEqual(restoreRes.data.status, 'Active', 'Status should be Active');

    const restoreAgainRes = await apiRequest('POST', `/positions/${pId}/restore`, null, adminToken);
    assertEqual(restoreAgainRes.status, 400, 'Restoring an already active record should return 400');
  });

  await test('8. Referenced-record deletion rejection (409 Conflict)', async () => {
    // Branches reference LegalEntities
    const leId = createdEntities[1]; // parent of the branch created in test 2
    const delRes = await apiRequest('DELETE', `/legal-entities/${leId}`, null, adminToken);
    assertEqual(delRes.status, 409, 'Deleting referenced record should return 409');
    assertMatch(delRes.data.message, /referenced by/, 'Error message should mention references');
  });

  await test('9. Unreferenced deletion (200 OK)', async () => {
    const posId = createdPositions[1]; // Standalone position with no vacancies
    const delRes = await apiRequest('DELETE', `/positions/${posId}`, null, adminToken);
    assertEqual(delRes.status, 200, 'Deleting unreferenced position should succeed');

    const getRes = await apiRequest('GET', `/positions/${posId}`, null, adminToken);
    assertEqual(getRes.status, 404, 'Deleted position should return 404');
  });

  await test('10. Invalid input handling (400 Bad Request)', async () => {
    const res = await apiRequest('POST', '/legal-entities', { name: '  ' }, adminToken);
    assertEqual(res.status, 400, 'Empty name should return 400');
  });

    await test('11. Audit log records actions accurately', async () => {
      // Need a slight delay because interceptor runs asynchronously and the DB might take a few ms
      await new Promise(r => setTimeout(r, 50));
      
      const adminUser = await prisma.user.findFirst({ where: { email: 'ahmed.mahmoud@recruitflow.local' } });
      const auditLogs = await prisma.auditLog.findMany({
        where: { organizationId: adminUser.organizationId, action: 'POSITION_CREATE' },
        orderBy: { createdAt: 'desc' }
      });
      
      assertEqual(auditLogs.length > 0, true, 'Should find POSITION_CREATE audit log');
      assertEqual(auditLogs[0].result, 'SUCCESS', 'Audit log result should be SUCCESS');
    });

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  
  // Cleanup
  console.log('Cleaning up master data...');
  for (const id of createdPositions) await prisma.position.deleteMany({ where: { id } });
  for (const id of createdBranches) await prisma.branch.deleteMany({ where: { id } });
  for (const id of createdEntities) await prisma.legalEntity.deleteMany({ where: { id } });
  
  if (failed > 0) process.exit(1);
}

setup()
  .then(runTests)
  .catch(console.error)
  .finally(() => {
    if (apiProcess) apiProcess.kill();
    prisma.$disconnect();
  });

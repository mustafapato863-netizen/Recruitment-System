const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 3055;
const BASE_URL = `http://127.0.0.1:${PORT}/api/v1`;

let passed = 0;
let failed = 0;

function assert(condition, message, detail = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message} ${detail ? `— ${detail}` : ''}`);
    failed++;
  }
}

function request(options, body) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: '127.0.0.1', port: PORT, ...options, headers: { ...(options.headers || {}) } };
    let payload = null;
    if (body !== undefined && body !== null) {
      payload = typeof body === 'string' ? body : JSON.stringify(body);
      opts.headers['Content-Type'] = opts.headers['Content-Type'] || 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json || data,
          cookies: res.headers['set-cookie'] || [],
        });
      });
    });
    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await request({ path: '/api/v1/health', method: 'GET' });
      if (res.status === 200) return true;
    } catch (_) {
      // ignore
    }
    await sleep(200);
  }
  return false;
}

async function run() {
  console.log('=== CV INTAKE FULL ENRICHED DATA EXTRACTION & PERSISTENCE TEST ===\n');

  // Spawn isolated test API on PORT 3055
  const apiEntry = path.resolve(__dirname, '../apps/api/dist/apps/api/src/main.js');
  const apiProc = spawn(process.execPath, [apiEntry], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(PORT),
      RECRUITFLOW_API_PORT: String(PORT),
      NODE_ENV: 'test',
    },
    stdio: 'ignore',
  });

  const ready = await waitForServer();
  if (!ready) {
    console.error('Failed to start isolated API test server on port', PORT);
    apiProc.kill();
    process.exit(1);
  }

  try {
    // 1. Login as Admin
    const loginRes = await request({
      path: '/api/v1/auth/login',
      method: 'POST',
    }, {
      email: 'ahmed.mahmoud@recruitflow.local',
      password: 'Password123!',
    });

    assert(loginRes.status === 200, 'Admin login succeeded', `got ${loginRes.status}`);
    const cookies = (loginRes.cookies || []).map(c => c.split(';')[0]).join('; ');
    const authHeader = {
      Cookie: cookies,
    };

    const testEmail = `mustafa.zain.${Date.now()}@example.com`;

    // 2. Upload intake batch with full enriched candidate fields
    const uploadPayload = {
      fileName: 'MUSTAFA_ZAIN_DATA_ANALYST_CV.PDF',
      rows: [
        {
          firstName: 'Mustafa',
          lastName: 'Zain',
          email: testEmail,
          phone: '+20 1111680029',
          currentTitle: 'Data Analyst',
          currentCompany: 'Saudi German Health',
          skills: ['Python', 'SQL', 'Power BI', 'Tableau', 'Excel'],
          experienceYears: 5,
          location: 'Cairo, Egypt',
          education: 'B.Sc. in Computer Science',
          certifications: ['Microsoft Certified: Data Analyst Associate'],
          languages: ['Arabic', 'English'],
          summary: 'Results-driven Data Analyst with 5+ years of experience in data visualization and ETL pipelines.',
        },
      ],
    };

    const uploadRes = await request({
      path: '/api/v1/candidates/import/upload',
      method: 'POST',
      headers: authHeader,
    }, uploadPayload);

    assert(uploadRes.status === 201, 'Upload intake batch returns 201', `got ${uploadRes.status}`);
    const jobId = uploadRes.body?.jobId;
    assert(Boolean(jobId), 'Job ID returned from upload');

    // 3. Inspect Job Rows to verify enriched fields are stored in rawData & returned
    const rowsRes = await request({
      path: `/api/v1/candidates/import/${jobId}/rows`,
      method: 'GET',
      headers: authHeader,
    });

    assert(rowsRes.status === 200, 'Get job rows returns 200', `got ${rowsRes.status}`);
    const firstRow = rowsRes.body?.rows?.[0];
    assert(firstRow?.currentTitle === 'Data Analyst', 'Job row has currentTitle', firstRow?.currentTitle);
    assert(firstRow?.currentCompany === 'Saudi German Health', 'Job row has currentCompany', firstRow?.currentCompany);
    assert(firstRow?.experienceYears === 5, 'Job row has experienceYears', firstRow?.experienceYears);
    assert(Array.isArray(firstRow?.skills) && firstRow.skills.includes('Python'), 'Job row has skills');
    assert(firstRow?.location === 'Cairo, Egypt', 'Job row has location', firstRow?.location);
    assert(firstRow?.education === 'B.Sc. in Computer Science', 'Job row has education', firstRow?.education);
    assert(firstRow?.summary?.includes('Results-driven'), 'Job row has summary', firstRow?.summary);

    // 4. Confirm the Job
    const confirmRes = await request({
      path: `/api/v1/candidates/import/${jobId}/confirm`,
      method: 'POST',
      headers: authHeader,
    });

    assert(confirmRes.status === 201 || confirmRes.status === 200, 'Confirm import returns success', `got ${confirmRes.status}`);
    assert(confirmRes.body?.newRows === 1, '1 new candidate row imported', `newRows: ${confirmRes.body?.newRows}`);

    // 5. Query candidate API to verify persisted fields on the database candidate
    const candidatesRes = await request({
      path: `/api/v1/candidates?search=${encodeURIComponent(testEmail)}`,
      method: 'GET',
      headers: authHeader,
    });

    assert(candidatesRes.status === 200, 'Search candidate returns 200', `got ${candidatesRes.status}`);
    const candidate = candidatesRes.body?.data?.[0];
    assert(Boolean(candidate), 'Candidate created in database');
    assert(candidate?.firstName === 'Mustafa', 'Candidate firstName matches');
    assert(candidate?.lastName === 'Zain', 'Candidate lastName matches');
    assert(candidate?.currentTitle === 'Data Analyst', 'Candidate currentTitle matches', candidate?.currentTitle);
    assert(candidate?.currentCompany === 'Saudi German Health', 'Candidate currentCompany matches', candidate?.currentCompany);
    assert(candidate?.experienceYears === 5, 'Candidate experienceYears matches', candidate?.experienceYears);
    assert(candidate?.location === 'Cairo, Egypt', 'Candidate location matches', candidate?.location);
    assert(Array.isArray(candidate?.skills) && candidate.skills.includes('Python'), 'Candidate skills array persisted');

    console.log('\n============================================================');
    console.log(`CV INTAKE ENRICHED DATA RESULTS: ${passed} PASSED, ${failed} FAILED`);
  } finally {
    apiProc.kill();
  }

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

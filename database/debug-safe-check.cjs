const http = require('http');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const opts = { ...options, headers: { ...(options.headers || {}) } };
    let payload = null;
    if (body !== undefined && body !== null) {
      payload = typeof body === 'string' ? body : JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); } 
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  const loginRes = await request({ hostname: 'localhost', port: 3000, path: '/api/v1/auth/login', method: 'POST' }, { email: 'ahmed.mahmoud@recruitflow.local', password: 'Password123!' });
  const cookie = (loginRes.body?.headers?.['set-cookie'] || (await (async () => {
    const lr2 = await new Promise((resolve) => {
      const req = require('http').request({ hostname: 'localhost', port: 3000, path: '/api/v1/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(JSON.stringify({ email: 'ahmed.mahmoud@recruitflow.local', password: 'Password123!' })) } }, (res) => {
        let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers }));
      });
      req.write(JSON.stringify({ email: 'ahmed.mahmoud@recruitflow.local', password: 'Password123!' }));
      req.end();
    });
    return (lr2.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
  })()));
  
  // Just do a fresh login
  const lr = await new Promise((resolve) => {
    const body = JSON.stringify({ email: 'ahmed.mahmoud@recruitflow.local', password: 'Password123!' });
    const req = http.request({ hostname: 'localhost', port: 3000, path: '/api/v1/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: d }));
    });
    req.write(body);
    req.end();
  });
  const ck = (lr.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
  
  const res = await request({ hostname: 'localhost', port: 3000, path: '/api/v1/candidates', method: 'GET', headers: { Cookie: ck } });
  
  // Check what triggers the "stack" false positive
  const str = JSON.stringify(res.body);
  const leaks = ['prisma', 'SELECT ', 'INSERT ', 'DELETE ', 'UPDATE ', 'stack', 'at async', 'node_modules'];
  for (const l of leaks) {
    if (str.toLowerCase().includes(l.toLowerCase())) {
      const idx = str.toLowerCase().indexOf(l.toLowerCase());
      console.log(`Trigger: "${l}" found at index ${idx}`);
      console.log('Context:', str.slice(Math.max(0, idx-50), idx+100));
    }
  }
}

main().catch(console.error);

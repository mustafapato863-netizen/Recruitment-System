// Local-only regression for creating a role with permissions and role-scoped sidebar visibility.
const assert = require('node:assert/strict');
process.loadEnvFile('.env');

const base = process.env.RECRUITFLOW_API_URL || 'http://localhost:3000/api/v1';
let roleId;

async function main() {
  const login = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.RECRUITFLOW_TEST_EMAIL || 'admin@me.com', password: process.env.RECRUITFLOW_TEST_PASSWORD || 'Admin@123456' }),
  });
  assert.equal(login.status, 200, await login.clone().text());
  const cookie = login.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');

  const [permissionsResponse, navigationResponse] = await Promise.all([
    fetch(`${base}/roles/permissions`, { headers: { Cookie: cookie } }),
    fetch(`${base}/access-control/navigation`, { headers: { Cookie: cookie } }),
  ]);
  assert.equal(permissionsResponse.status, 200, await permissionsResponse.clone().text());
  assert.equal(navigationResponse.status, 200, await navigationResponse.clone().text());
  const permissions = await permissionsResponse.json();
  const navigation = await navigationResponse.json();
  assert.ok(permissions.length > 0, 'Permission catalog should not be empty');
  assert.ok(navigation.length > 0, 'Navigation catalog should not be empty');

  const code = `QA_ROLE_${Date.now()}`;
  const createdResponse = await fetch(`${base}/roles`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, name: 'QA role access' }),
  });
  assert.equal(createdResponse.status, 201, await createdResponse.clone().text());
  const created = await createdResponse.json();
  roleId = created.id;

  const assignment = await fetch(`${base}/roles/${roleId}/permissions/${permissions[0].id}`, {
    method: 'POST',
    headers: { Cookie: cookie },
  });
  assert.equal(assignment.status, 201, await assignment.clone().text());

  const visibility = await fetch(`${base}/access-control/navigation/roles/${encodeURIComponent(code)}`, {
    method: 'PUT',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: navigation.map((item, index) => ({ key: item.key, visible: index === 0 })) }),
  });
  assert.equal(visibility.status, 200, await visibility.clone().text());
  const visibleItems = await visibility.json();
  assert.equal(visibleItems[0].visible, true, 'Role-specific visible page was not returned');
  assert.ok(visibleItems.slice(1).every((item) => item.visible === false), 'Role-specific hidden pages were not persisted');

  const roleResponse = await fetch(`${base}/roles/${roleId}`, { headers: { Cookie: cookie } });
  assert.equal(roleResponse.status, 200, await roleResponse.clone().text());
  const role = await roleResponse.json();
  assert.ok(role.permissions.some((permission) => permission.id === permissions[0].id), 'Selected permission was not assigned');
  console.log('PASS: role creation, permission assignment, and role-scoped sidebar visibility');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (roleId) {
    const login = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: process.env.RECRUITFLOW_TEST_EMAIL || 'admin@me.com', password: process.env.RECRUITFLOW_TEST_PASSWORD || 'Admin@123456' }),
    }).catch(() => null);
    const cookie = login?.headers?.getSetCookie?.().map((value) => value.split(';')[0]).join('; ');
    if (cookie) await fetch(`${base}/roles/${roleId}`, { method: 'DELETE', headers: { Cookie: cookie } }).catch(() => undefined);
  }
});

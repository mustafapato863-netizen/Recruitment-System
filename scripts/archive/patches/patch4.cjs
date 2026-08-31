const fs = require('fs');
let content = fs.readFileSync('UsersRolesPage.tsx', 'utf8');

// Form grid -> grid layout
content = content.replace(/<div className="form-grid">/g, '<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">');
content = content.replace(/<div className="full-field">/g, '<div className="sm:col-span-2">');
// Inline styles
content = content.replace(/<div style=\{\{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'flex-end' \}\}>/g, '<div className="flex gap-2 mt-6 justify-end">');
content = content.replace(/<div style=\{\{ marginBottom: '16px' \}\}>/g, '<div className="mb-4">');

// Active Badge
content = content.replace(/<Badge variant="info">Active<\/Badge>/g, "<Badge variant={role.isActive ? 'success' : 'neutral'}>{role.isActive ? 'Active' : 'Inactive'}</Badge>");

// Add roles state to user form
content = content.replace(/const emptyUserForm = \{ email: '', displayName: '', password: '' \};/, "const emptyUserForm = { email: '', displayName: '', password: '', roles: [] as string[] };");

// Add role selection Select to user form
const userRoleRegex = /<\/div>\s*<\/div>\s*<div className="flex gap-2 mt-6 justify-end">/;
const userRoleReplacement = `</div>
            <div className="sm:col-span-2">
              <FormField id="u-role" label="Assign Role">
                <Select
                  id="u-role"
                  value={userForm.roles[0] || ''}
                  onChange={(e) => setUserForm({ ...userForm, roles: e.target.value ? [e.target.value] : [] })}
                >
                  <option value="">No role</option>
                  {roles.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
                </Select>
              </FormField>
            </div>
          </div>
          <div className="flex gap-2 mt-6 justify-end">`;
content = content.replace(userRoleRegex, userRoleReplacement);

fs.writeFileSync('UsersRolesPage.tsx', content, 'utf8');

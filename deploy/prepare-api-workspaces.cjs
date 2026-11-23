const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
for (const name of ['contracts', 'validation']) {
  const manifest = require(path.join(root, 'packages', name, 'package.json'));
  const output = path.join(root, 'apps/api/dist/packages', name);
  manifest.type = 'commonjs';
  for (const [entry, source] of Object.entries(manifest.exports)) {
    const compiled = source.replace(/\.ts$/, '.js');
    assert.notEqual(compiled, source, `${manifest.name} export ${entry} must point to TypeScript`);
    fs.accessSync(path.join(output, compiled), fs.constants.R_OK);
    manifest.exports[entry] = compiled;
  }
  fs.writeFileSync(path.join(output, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
}

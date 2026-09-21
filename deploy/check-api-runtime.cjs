// Load the compiled API without starting listeners or connecting to the database.
// Run in the final Docker filesystem so workspace links cannot hide missing files.
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const { AppModule } = require(path.join(root, 'apps/api/dist/apps/api/src/app.module.js'));
assert.equal(typeof AppModule, 'function');
const sourceModules = Object.keys(require.cache).filter((file) =>
  file.startsWith(root + path.sep) &&
  !file.includes(`${path.sep}node_modules${path.sep}`) &&
  file.endsWith('.ts'),
);
assert.deepEqual(sourceModules, [], 'Compiled API must not depend on workspace TypeScript sources');
console.log('Compiled API runtime dependencies loaded successfully.');

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

interface RouteParam {
  file: string;
  name: string;
  validated: boolean;
}

function apiSourceDir(): string {
  const fromSpec = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const candidates = [fromSpec];
  let dir = process.cwd();
  for (let depth = 0; depth < 6; depth += 1) {
    candidates.push(path.join(dir, 'apps/api/src'));
    candidates.push(path.join(dir, 'src'));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const found = candidates.find((candidate) => existsSync(path.join(candidate, 'candidates/candidates.controller.ts')));
  if (!found) {
    throw new Error(`API controllers were not found from ${process.cwd()}`);
  }
  return found;
}

function controllersIn(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...controllersIn(full));
    } else if (entry.endsWith('.controller.ts')) {
      files.push(full);
    }
  }
  return files;
}

function routeParams(file: string): RouteParam[] {
  const source = readFileSync(file, 'utf8');
  const found: RouteParam[] = [];
  const pattern = /@Param\(\s*['"]([^'"]+)['"]([\s\S]*?)\)/g;
  for (const match of source.matchAll(pattern)) {
    const name = match[1] ?? '';
    const options = match[2] ?? '';
    found.push({
      file: path.basename(file),
      name,
      validated: options.includes('ParseUUIDPipe'),
    });
  }
  return found;
}

const UUID_PARAM_NAME = /^(?:id|.+Id)$/;

describe('UUID route parameters', () => {
  const params = controllersIn(apiSourceDir()).flatMap(routeParams);
  const uuidParams = params.filter((param) => UUID_PARAM_NAME.test(param.name));

  it('rejects malformed identifiers on every UUID route param, including nested and import ids', () => {
    const missing = uuidParams.filter((param) => !param.validated);
    expect(missing).toEqual([]);
    expect(uuidParams.length).toBeGreaterThan(40);
    expect(params).toEqual(expect.arrayContaining([
      expect.objectContaining({ file: 'candidates.controller.ts', name: 'id', validated: true }),
      expect.objectContaining({ file: 'candidates.controller.ts', name: 'taskId', validated: true }),
      expect.objectContaining({ file: 'applications.controller.ts', name: 'id', validated: true }),
      expect.objectContaining({ file: 'vacancy-requests.controller.ts', name: 'id', validated: true }),
      expect.objectContaining({ file: 'import.controller.ts', name: 'jobId', validated: true }),
      expect.objectContaining({ file: 'import.controller.ts', name: 'rowId', validated: true }),
      expect.objectContaining({ file: 'bulk-import.controller.ts', name: 'jobId', validated: true }),
      expect.objectContaining({ file: 'bulk-import.controller.ts', name: 'rowId', validated: true }),
      expect.objectContaining({ file: 'master-data-catalog.controller.ts', name: 'id', validated: true }),
      expect.objectContaining({ file: 'access-control.controller.ts', name: 'userId', validated: true }),
    ]));
  });
});

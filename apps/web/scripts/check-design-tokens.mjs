import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

const webRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sourceRoots = [
  'src/components/ui',
  'src/layout',
  'src/auth',
  'src/theme',
];
// Keep explicit checks limited to production files that still exist. The old
// design-system showcase was intentionally removed from the product routes.
const explicitFiles = ['src/components/StatusBadge.tsx'];
const sourceExtensions = new Set(['.ts', '.tsx', '.css']);
const literalColor = /#[0-9a-f]{3,8}\b|\b(?:rgb|hsl)a?\s*\(/i;
const paletteUtility = /\b(?:bg|text|border|ring|outline|from|via|to)-(?:white|black|slate|gray|zinc|neutral|stone|red|rose|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink)-\d{2,3}\b/;
const legacyPaletteUtility = new RegExp(paletteUtility.source, 'g');
// Ratchet baseline recorded 2026-09-17: 10,420 legacy palette utilities in
// production code. The gate fails only when the count grows above this
// baseline, so new work must use semantic rf-* utilities while the backlog
// burns down (see docs/design-system/README.md "Legacy palette burn-down").
// Lower this number as migrations land; never raise it without review.
const legacyPaletteBaseline = 10420;
// Grandfathered strict-boundary files: violation line counts recorded
// 2026-09-17 (76 total). New strict-boundary files must be clean, and these
// files must not gain new violations. Migrate them to rf-* tokens per the
// burn-down plan, then remove them from this list.
const grandfatheredStrictFiles = {
  'src/components/ui/BreadcrumbsBar.tsx': 9,
  'src/components/ui/CommandPalette.tsx': 1,
  'src/components/ui/CommentsThread.tsx': 2,
  'src/components/ui/DataTable.tsx': 6,
  'src/components/ui/Drawer.tsx': 3,
  'src/components/ui/notification-alert-dialog.tsx': 39,
  'src/layout/AppShell.tsx': 16,
};


function collectFiles(path) {
  if (statSync(path).isFile()) return sourceExtensions.has(extname(path)) ? [path] : [];
  return readdirSync(path).flatMap((entry) => collectFiles(join(path, entry)));
}

const files = [
  ...sourceRoots.flatMap((path) => collectFiles(resolve(webRoot, path))),
  ...explicitFiles.map((path) => resolve(webRoot, path)),
];
const violations = [];
const grandfatheredWarnings = [];

for (const file of files) {
  const rel = relative(webRoot, file).split(sep).join('/');
  const grandfatheredCount = grandfatheredStrictFiles[rel];
  const hits = [];
  readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
    if (line.includes('design-token-exception')) return;
    if (literalColor.test(line) || paletteUtility.test(line)) {
      hits.push(`${rel}:${index + 1} ${line.trim()}`);
    }
  });
  if (hits.length === 0) continue;
  if (grandfatheredCount !== undefined && hits.length <= grandfatheredCount) {
    grandfatheredWarnings.push(
      `grandfathered ${rel}: ${hits.length}/${grandfatheredCount} recorded violations remaining`,
    );
  } else {
    violations.push(
      ...hits,
      ...(grandfatheredCount === undefined
        ? []
        : [`${rel} exceeds grandfathered count ${grandfatheredCount} with ${hits.length} violations`]),
    );
  }
}

const productionFiles = collectFiles(resolve(webRoot, 'src')).filter((file) => !file.includes('design-system'));
const legacyPaletteCount = productionFiles.reduce((total, file) => {
  const matches = readFileSync(file, 'utf8').match(legacyPaletteUtility);
  return total + (matches?.length ?? 0);
}, 0);

if (legacyPaletteCount > legacyPaletteBaseline) {
  violations.push(
    `Legacy palette utilities grew to ${legacyPaletteCount} (baseline ${legacyPaletteBaseline}). `
      + 'New work must use semantic rf-* utilities; migrate grandfathered files to burn the count down.',
  );
}

if (violations.length > 0) {
  process.stderr.write('Hard-coded colors found in the RecruitFlow design-system boundary:\n');
  process.stderr.write(`${violations.join('\n')}\n`);
  process.stderr.write('Use semantic rf-* utilities or variables from src/styles/tokens.css.\n');
  process.exit(1);
}

for (const warning of grandfatheredWarnings) {
  process.stdout.write(`warning: ${warning}\n`);
}
process.stdout.write(
  `Design-token check passed (${files.length} strict files; ${legacyPaletteCount}/${legacyPaletteBaseline} legacy production utilities; ${grandfatheredWarnings.length} grandfathered strict files).\n`,
);

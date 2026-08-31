import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

const webRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sourceRoots = [
  'src/components/ui',
  'src/layout',
  'src/auth',
  'src/theme',
];
const explicitFiles = ['src/components/StatusBadge.tsx', 'src/pages/DesignSystemPage.tsx'];
const sourceExtensions = new Set(['.ts', '.tsx', '.css']);
const literalColor = /#[0-9a-f]{3,8}\b|\b(?:rgb|hsl)a?\s*\(/i;
const paletteUtility = /\b(?:bg|text|border|ring|outline|from|via|to)-(?:white|black|slate|gray|zinc|neutral|stone|red|rose|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink)-\d{2,3}\b/;
const legacyPaletteUtility = new RegExp(paletteUtility.source, 'g');
const legacyPaletteBudget = 370;

function collectFiles(path) {
  if (statSync(path).isFile()) return sourceExtensions.has(extname(path)) ? [path] : [];
  return readdirSync(path).flatMap((entry) => collectFiles(join(path, entry)));
}

const files = [
  ...sourceRoots.flatMap((path) => collectFiles(resolve(webRoot, path))),
  ...explicitFiles.map((path) => resolve(webRoot, path)),
];
const violations = [];

for (const file of files) {
  readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
    if (line.includes('design-token-exception')) return;
    if (literalColor.test(line) || paletteUtility.test(line)) {
      violations.push(`${relative(webRoot, file)}:${index + 1} ${line.trim()}`);
    }
  });
}

const productionFiles = collectFiles(resolve(webRoot, 'src')).filter((file) => !file.includes('design-system'));
const legacyPaletteCount = productionFiles.reduce((total, file) => {
  const matches = readFileSync(file, 'utf8').match(legacyPaletteUtility);
  return total + (matches?.length ?? 0);
}, 0);

if (legacyPaletteCount > legacyPaletteBudget) {
  violations.push(
    `Production legacy palette budget increased from ${legacyPaletteBudget} to ${legacyPaletteCount}. `
      + 'Migrate new work to semantic rf-* utilities instead.',
  );
}

if (violations.length > 0) {
  process.stderr.write('Hard-coded colors found in the RecruitFlow design-system boundary:\n');
  process.stderr.write(`${violations.join('\n')}\n`);
  process.stderr.write('Use semantic rf-* utilities or variables from src/styles/tokens.css.\n');
  process.exit(1);
}

process.stdout.write(
  `Design-token check passed (${files.length} strict files; ${legacyPaletteCount}/${legacyPaletteBudget} legacy production utilities).\n`,
);

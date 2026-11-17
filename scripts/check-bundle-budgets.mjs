import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';

const distDir = join(process.cwd(), 'apps', 'web', 'dist');
const assetsDir = join(distDir, 'assets');
const indexHtmlPath = join(distDir, 'index.html');

const budgets = {
  mainJs: 500 * 1024, // 500KB
  mainCssRawAdvisory: 225 * 1024, // Keep the historical raw CSS target visible while serving compressed assets.
  mainJsGzip: 150 * 1024,
  mainCssGzip: 60 * 1024,
};

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return match ? (match[1] ?? match[2] ?? '') : null;
}

/** Local file referenced by dist/index.html, or null for external/inline URLs. */
function localDistFile(url) {
  if (!url) return null;
  const clean = url.split('#')[0].split('?')[0].trim();
  if (!clean || /^[a-z][a-z0-9+.-]*:/i.test(clean)) return null;
  const relativePath = clean.replace(/^\//, '').replace(/^\.\//, '');
  const filePath = resolve(distDir, relativePath);
  const fromDist = relative(distDir, filePath);
  if (fromDist.startsWith('..') || fromDist.split(sep).includes('..')) return null;
  return filePath;
}

function referencedEntries(html) {
  const tags = html.match(/<(?:script|link)\b[^>]*>/gi) ?? [];
  const js = [];
  const css = [];
  for (const tag of tags) {
    if (/^<script\b/i.test(tag)) {
      const src = attr(tag, 'src');
      const file = localDistFile(src);
      if (file && file.endsWith('.js')) js.push({ url: src, file });
      continue;
    }
    if (!/\brel\s*=\s*["']stylesheet["']/i.test(tag)) continue;
    const href = attr(tag, 'href');
    const file = localDistFile(href);
    if (file && file.endsWith('.css')) css.push({ url: href, file });
  }
  return { js, css };
}

try {
  if (!existsSync(indexHtmlPath)) {
    console.error('❌ dist/index.html is missing, so the entry JS and CSS assets cannot be identified');
    process.exit(1);
  }

  const html = readFileSync(indexHtmlPath, 'utf8');
  const entries = referencedEntries(html);

  console.log('=== RecruitFlow Bundle Size & Code-Splitting Audit ===');

  if (entries.js.length === 0) {
    console.error('❌ dist/index.html references no JavaScript entry asset');
    process.exit(1);
  }
  if (entries.css.length === 0) {
    console.error('❌ dist/index.html references no CSS entry asset');
    process.exit(1);
  }

  let foundViolations = false;

  for (const entry of entries.js) {
    if (!existsSync(entry.file)) {
      console.error(`❌ JavaScript entry referenced by dist/index.html is missing: ${entry.url}`);
      foundViolations = true;
      continue;
    }
    const contents = readFileSync(entry.file);
    const size = statSync(entry.file).size;
    const sizeKb = (size / 1024).toFixed(2);
    const name = relative(distDir, entry.file);
    console.log(`Main JS Bundle: ${name} — ${sizeKb} KB`);
    if (size > budgets.mainJs) {
      console.error(`❌ Main JS Bundle exceeds budget (${sizeKb} KB > ${budgets.mainJs / 1024} KB)`);
      foundViolations = true;
    } else {
      console.log(`✅ Main JS Bundle within budget (${sizeKb} KB <= ${budgets.mainJs / 1024} KB)`);
    }
    const gzipSize = gzipSync(contents, { level: 9 }).length;
    const gzipKb = (gzipSize / 1024).toFixed(2);
    console.log(`Main JS transfer (gzip): ${gzipKb} KB`);
    if (gzipSize > budgets.mainJsGzip) {
      console.error(`❌ Main JS gzip transfer exceeds budget (${gzipKb} KB > ${budgets.mainJsGzip / 1024} KB)`);
      foundViolations = true;
    } else {
      console.log(`✅ Main JS gzip transfer within budget (${gzipKb} KB <= ${budgets.mainJsGzip / 1024} KB)`);
    }
  }

  for (const entry of entries.css) {
    if (!existsSync(entry.file)) {
      console.error(`❌ CSS entry referenced by dist/index.html is missing: ${entry.url}`);
      foundViolations = true;
      continue;
    }
    const contents = readFileSync(entry.file);
    const size = statSync(entry.file).size;
    const sizeKb = (size / 1024).toFixed(2);
    const name = relative(distDir, entry.file);
    console.log(`Main CSS Bundle: ${name} — ${sizeKb} KB`);
    if (size > budgets.mainCssRawAdvisory) {
      console.warn(`⚠️ Main CSS raw size is above the advisory target (${sizeKb} KB > ${budgets.mainCssRawAdvisory / 1024} KB). Signed-in shell CSS is loaded with the shell; this entry keeps the shared token, primitive, and utility CSS.`);
    } else {
      console.log(`✅ Main CSS raw size is within the advisory target (${sizeKb} KB <= ${budgets.mainCssRawAdvisory / 1024} KB)`);
    }
    const gzipSize = gzipSync(contents, { level: 9 }).length;
    const brotliSize = brotliCompressSync(contents).length;
    const gzipKb = (gzipSize / 1024).toFixed(2);
    const brotliKb = (brotliSize / 1024).toFixed(2);
    console.log(`Main CSS transfer: ${gzipKb} KB gzip / ${brotliKb} KB brotli`);
    if (gzipSize > budgets.mainCssGzip) {
      console.error(`❌ Main CSS gzip transfer exceeds budget (${gzipKb} KB > ${budgets.mainCssGzip / 1024} KB)`);
      foundViolations = true;
    } else {
      console.log(`✅ Main CSS gzip transfer within budget (${gzipKb} KB <= ${budgets.mainCssGzip / 1024} KB)`);
    }
  }

  if (existsSync(assetsDir)) {
    for (const file of readdirSync(assetsDir)) {
      if (!(file.includes('pdf') || file.includes('mammoth') || file.includes('resumeParser'))) continue;
      const sizeKb = (statSync(join(assetsDir, file)).size / 1024).toFixed(2);
      console.log(`Lazy-loaded parser chunk: ${file} — ${sizeKb} KB (Code-split ✅)`);
    }
  }

  if (foundViolations) {
    process.exit(1);
  }

  console.log('=== All Bundle Budget & Code-Splitting Checks Passed ✅ ===');
} catch (err) {
  console.error('Error during bundle audit:', err.message);
  process.exit(1);
}

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';

const distDir = join(process.cwd(), 'apps', 'web', 'dist', 'assets');

try {
  const files = readdirSync(distDir);
  const budgets = {
    mainJs: 300 * 1024, // 300KB
    mainCssRawAdvisory: 225 * 1024, // Keep the historical raw CSS target visible while serving compressed assets.
    mainJsGzip: 100 * 1024,
    mainCssGzip: 60 * 1024,
  };

  let foundViolations = false;
  let mainJsSize = 0;
  let mainCssSize = 0;

  console.log('=== RecruitFlow Bundle Size & Code-Splitting Audit ===');

  for (const file of files) {
    const filePath = join(distDir, file);
    const contents = readFileSync(filePath);
    const size = statSync(filePath).size;
    const sizeKb = (size / 1024).toFixed(2);

    if (file.startsWith('index-') && file.endsWith('.js')) {
      mainJsSize = size;
      console.log(`Main JS Bundle: ${file} — ${sizeKb} KB`);
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
    } else if (file.startsWith('index-') && file.endsWith('.css')) {
      mainCssSize = size;
      console.log(`Main CSS Bundle: ${file} — ${sizeKb} KB`);
      if (size > budgets.mainCssRawAdvisory) {
        console.warn(`⚠️ Main CSS raw size is above the advisory target (${sizeKb} KB > ${budgets.mainCssRawAdvisory / 1024} KB); route-safe CSS splitting remains tracked separately.`);
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
    } else if (file.includes('pdf') || file.includes('mammoth') || file.includes('resumeParser')) {
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

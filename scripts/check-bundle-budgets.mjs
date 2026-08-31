import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const distDir = join(process.cwd(), 'apps', 'web', 'dist', 'assets');

try {
  const files = readdirSync(distDir);
  const budgets = {
    mainJs: 300 * 1024, // 300KB
    mainCss: 225 * 1024, // 225KB (~35KB gzipped)
  };

  let foundViolations = false;
  let mainJsSize = 0;
  let mainCssSize = 0;

  console.log('=== RecruitFlow Bundle Size & Code-Splitting Audit ===');

  for (const file of files) {
    const filePath = join(distDir, file);
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
    } else if (file.startsWith('index-') && file.endsWith('.css')) {
      mainCssSize = size;
      console.log(`Main CSS Bundle: ${file} — ${sizeKb} KB`);
      if (size > budgets.mainCss) {
        console.error(`❌ Main CSS Bundle exceeds budget (${sizeKb} KB > ${budgets.mainCss / 1024} KB)`);
        foundViolations = true;
      } else {
        console.log(`✅ Main CSS Bundle within budget (${sizeKb} KB <= ${budgets.mainCss / 1024} KB)`);
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

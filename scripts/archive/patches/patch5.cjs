const fs = require('fs');
let content = fs.readFileSync('AuditLogPage.tsx', 'utf8');

// Date filter
content = content.replace('const matchesDate = !date || log.createdAt.startsWith(date);', 'const matchesDate = !date || log.createdAt.slice(0, 10) === date;');

// CSV sanitization
const csvRegex = /const csv = rows\.map\(\(row\) => row\.map\(\(value\) => \`"\\$\\{value\.replaceAll\('"', '""'\)\\}"\`\)\.join\(','\)\)\.join\('\\n'\);/;
const csvReplacement = `const csv = rows.map((row) => row.map((value) => {
      let v = String(value).replaceAll('"', '""');
      if (v.startsWith('=') || v.startsWith('+') || v.startsWith('-') || v.startsWith('@')) {
        v = "'" + v;
      }
      return \`"\${v}"\`;
    }).join(',')).join('\\n');`;
content = content.replace(csvRegex, csvReplacement);

fs.writeFileSync('AuditLogPage.tsx', content, 'utf8');

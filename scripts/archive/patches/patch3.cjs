const fs = require('fs');
let content = fs.readFileSync('MasterDataPage.tsx', 'utf8');

content = content.replace("import { Input } from '../components/ui/Input';", "import { Input } from '../components/ui/Input';\nimport { DataToolbar } from '../components/ui/DataToolbar';");

// Add searchTerm state
content = content.replace('const [form, setForm] = useState<FormState>(emptyForm);', "const [form, setForm] = useState<FormState>(emptyForm);\n  const [searchTerm, setSearchTerm] = useState('');");

// Replace the <div style={{ marginBottom: '16px' }}>
content = content.replace(/<div style=\{\{ marginBottom: '16px' \}\}>/g, '<div className="mb-4">');

// Add DataToolbar above ResponsiveDataView
const rdvRegex = /<ResponsiveDataView/;
const rdvReplacement = `<DataToolbar
              search={
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              }
            />
            <ResponsiveDataView`;
content = content.replace(rdvRegex, rdvReplacement);

// Filter rows passed to ResponsiveDataView
content = content.replace(/rows=\{data\}/, 'rows={data.filter(item => !searchTerm || (item.name || item.title || item.code || "").toLowerCase().includes(searchTerm.toLowerCase()))}');

fs.writeFileSync('MasterDataPage.tsx', content, 'utf8');

const fs = require('fs');
let content = fs.readFileSync('CandidateDetailPage.tsx', 'utf8');

// Imports
content = content.replace("import { DataTable, dataTableClasses } from '../components/ui/DataTable';", "import { ResponsiveDataView, type ResponsiveDataColumn } from '../components/ui/ResponsiveDataView';");
content = content.replace("import { DetailSummary } from '../components/ui/DetailSummary';", "import { DetailSummary } from '../components/ui/DetailSummary';\nimport { Avatar } from '../components/ui/Avatar';");

// Hero Section: Avatar
content = content.replace(
  /<div className="w-14 h-14 rounded-2xl bg-rf-action-soft text-rf-action font-black text-xl flex items-center justify-center border border-rf-action-soft shrink-0">\s*\{initials\}\s*<\/div>/g,
  '<Avatar initials={initials} size="lg" />'
);

// Job Applications Table -> ResponsiveDataView
const appsTableRegex = /<DataTable role="region" aria-label="Applications table"[\s\S]*?<\/DataTable>/;
const appsReplacement = `<ResponsiveDataView
                rows={applications}
                columns={[
                  { key: 'vacancy', header: 'Vacancy', priority: 'primary', render: (app) => (<div><div className="font-bold">{app.positionTitle || 'Position not reported'}</div><div className="text-xs text-rf-ink-muted">{app.vacancyCode || app.vacancyId}</div></div>) },
                  { key: 'stage', header: 'Stage', priority: 'secondary', render: (app) => <StatusBadge status={app.stage} /> },
                  { key: 'source', header: 'Source', priority: 'secondary', render: (app) => <span className="font-mono text-[10.5px] text-rf-ink-muted bg-rf-surface-subtle px-2 py-0.5 rounded-md">{app.source || 'Direct'}</span> },
                  { key: 'applied', header: 'Applied', priority: 'secondary', render: (app) => <span className="text-rf-ink-muted font-medium">{new Date(app.createdAt).toLocaleDateString()}</span> },
                  { key: 'action', header: 'Action', priority: 'secondary', render: (app) => <Button variant="secondary" size="sm" asChild><Link to={\`/applications/\${app.id}\`}>View</Link></Button> }
                ]}
                rowKey={(app) => app.id}
                label="Applications table"
              />`;
content = content.replace(appsTableRegex, appsReplacement);

const appsAllTableRegex = /<DataTable role="region" aria-label="Applications history table"[\s\S]*?<\/DataTable>/;
const appsAllReplacement = `<ResponsiveDataView
            rows={applications}
            columns={[
              { key: 'vacancy', header: 'Vacancy', priority: 'primary', render: (app) => (<div><div className="font-bold">{app.positionTitle || 'Position not reported'}</div><div className="text-xs text-rf-ink-muted">{app.vacancyCode || app.vacancyId}</div></div>) },
              { key: 'stage', header: 'Stage', priority: 'secondary', render: (app) => <StatusBadge status={app.stage} /> },
              { key: 'source', header: 'Source', priority: 'secondary', render: (app) => <span className="font-mono text-[10.5px] text-rf-ink-muted bg-rf-surface-subtle px-2 py-0.5 rounded-md">{app.source || 'Direct'}</span> },
              { key: 'applied', header: 'Applied Date', priority: 'secondary', render: (app) => <span className="text-rf-ink-muted font-medium">{new Date(app.createdAt).toLocaleDateString()}</span> },
              { key: 'action', header: 'Action', priority: 'secondary', render: (app) => <Button variant="secondary" size="sm" asChild><Link to={\`/applications/\${app.id}\`}>View details</Link></Button> }
            ]}
            rowKey={(app) => app.id}
            label="Applications history table"
          />`;
content = content.replace(appsAllTableRegex, appsAllReplacement);

// Documents Table
const docsTableRegex = /<DataTable role="region" aria-label="Documents table"[\s\S]*?<\/DataTable>/;
const docsReplacement = `<ResponsiveDataView
            rows={documents}
            columns={[
              { key: 'name', header: 'Document Name', priority: 'primary', render: (doc) => (<div className="flex items-center gap-2.5"><Icon name="file-text" size={16} className="text-rf-action shrink-0" /><div><div className="font-bold">{doc.documentType}</div><div className="text-xs text-rf-ink-muted">{doc.fileName}</div></div></div>) },
              { key: 'type', header: 'Type', priority: 'secondary', render: (doc) => <span className="font-mono text-xs text-rf-ink-muted">{doc.documentType}</span> },
              { key: 'scan', header: 'Scan Status', priority: 'secondary', render: (doc) => <StatusBadge status={doc.scanStatus || 'Active'} /> },
              { key: 'uploaded', header: 'Uploaded', priority: 'secondary', render: (doc) => <span className="text-rf-ink-muted font-medium">{new Date(doc.createdAt).toLocaleDateString()}</span> }
            ]}
            rowKey={(doc) => doc.id}
            label="Documents table"
          />`;
content = content.replace(docsTableRegex, docsReplacement);

// Activity Timeline real API - actually, there is no API call for audit logs right now. "or if there's no such endpoint, render an ActivityTimeline with an empty array and show an Alert tone="info""
const activityRegex = /<ActivityTimeline[\s\S]*?label="Recent candidate activity"[\s\S]*?\/>/;
const activityReplacement = `<Alert tone="info" title="Activity log not available">Activity log is not yet available.</Alert>\n              <ActivityTimeline label="Recent candidate activity" items={[]} />`;
content = content.replace(activityRegex, activityReplacement);

const activityTabRegex = /<ActivityTimeline\s*items=\{\[\s*\{\s*id: 'profile-created'[\s\S]*?\]\}\s*\/>/;
const activityTabReplacement = `<Alert tone="info" title="Activity log not available">Activity log is not yet available.</Alert>\n          <ActivityTimeline items={[]} />`;
content = content.replace(activityTabRegex, activityTabReplacement);

fs.writeFileSync('CandidateDetailPage.tsx', content, 'utf8');

import { useState, type ReactNode } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { PipelineStepper } from '../components/PipelineStepper';
import { StatusBadge } from '../components/StatusBadge';
import { ActivityTimeline } from '../components/ui/ActivityTimeline';
import { Alert } from '../components/ui/Alert';
import { Avatar, AvatarStack } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { BorderGlow } from '../components/ui/BorderGlow';
import { ClickSpark } from '../components/ui/ClickSpark';
import { Card } from '../components/ui/Card';
import { CheckboxField } from '../components/ui/CheckboxField';
import { DataToolbar } from '../components/ui/DataToolbar';
import { DetailSummary } from '../components/ui/DetailSummary';
import { Drawer } from '../components/ui/Drawer';
import { FilterChip } from '../components/ui/FilterChips';
import { FormField } from '../components/ui/FormField';
import { FormSection } from '../components/ui/FormSection';
import { IconButton } from '../components/ui/IconButton';
import { Input } from '../components/ui/Input';
import { MetricCard } from '../components/ui/MetricCard';
import MagicBento, { type MagicBentoItem } from '../components/ui/MagicBento';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { Pagination } from '../components/ui/Pagination';
import { PriorityChip } from '../components/ui/PriorityChip';
import { ProgressBar } from '../components/ui/ProgressBar';
import { ResponsiveDataView, type ResponsiveDataColumn } from '../components/ui/ResponsiveDataView';
import { Scorecard, type Recommendation } from '../components/ui/Scorecard';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Select } from '../components/ui/Select';
import { DetailSkeleton, MetricCardSkeleton, TableSkeleton } from '../components/ui/Skeleton';
import { SpotlightCard } from '../components/ui/SpotlightCard';
import { Tabs } from '../components/ui/Tabs';
import { Textarea } from '../components/ui/Textarea';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { AlertBanner, Toast } from '../components/ui/Toast';
import { TrendLineChart } from '../components/ui/TrendLineChart';
import { TrendBarChart } from '../components/ui/TrendBarChart';
import { DonutChart } from '../components/ui/DonutChart';
import { FunnelChart } from '../components/ui/FunnelChart';
import { Sparkline } from '../components/ui/Sparkline';
import { NotificationAlertDialog } from '../components/ui/notification-alert-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog';

type SectionCategory = 'all' | 'charts' | 'dialogs' | 'motion' | 'primitives' | 'data';

interface DemoCandidate {
  id: string;
  name: string;
  email: string;
  role: string;
  stage: string;
  score: number;
  owner: string;
  ownerInitials: string;
  lastActivity: string;
  status: string;
}

const demoCandidates: DemoCandidate[] = [
  { id: 'candidate-1', name: 'Mariam El-Sayed', email: 'mariam.e@sample.com', role: 'Senior Product Designer', stage: 'Interview', score: 92, owner: 'Ahmed Hassan', ownerInitials: 'AH', lastActivity: '2h ago', status: 'Active' },
  { id: 'candidate-2', name: 'Omar Khalil', email: 'omar.k@sample.com', role: 'Backend Engineer', stage: 'Screening', score: 88, owner: 'Rania Ahmed', ownerInitials: 'RA', lastActivity: '5h ago', status: 'Active' },
  { id: 'candidate-3', name: 'Sarah Williams', email: 'sarah.w@sample.com', role: 'Product Manager', stage: 'Assessment', score: 84, owner: 'Michael Brown', ownerInitials: 'MB', lastActivity: '1d ago', status: 'Active' },
  { id: 'candidate-4', name: 'Michael Brown', email: 'michael.b@sample.com', role: 'DevOps Engineer', stage: 'Offer', score: 95, owner: 'Ahmed Hassan', ownerInitials: 'AH', lastActivity: '2d ago', status: 'Offer extended' },
  { id: 'candidate-5', name: 'David Lee', email: 'david.l@sample.com', role: 'Data Scientist', stage: 'Hired', score: 90, owner: 'Sarah Williams', ownerInitials: 'SW', lastActivity: '3d ago', status: 'Hired' },
];

const demoColumns: ResponsiveDataColumn<DemoCandidate>[] = [
  {
    key: 'candidate',
    header: 'Candidate',
    priority: 'primary',
    render: (row) => (
      <div className="flex min-w-[190px] items-center gap-2.5">
        <Avatar initials={row.name.split(' ').map((part: string) => part[0]).join('')} size="sm" />
        <div className="min-w-0"><strong className="block truncate text-[11.5px] font-semibold text-rf-ink">{row.name}</strong><span className="block truncate text-[9.5px] font-medium text-rf-ink-muted">{row.email}</span></div>
      </div>
    ),
  },
  { key: 'role', header: 'Role', render: (row) => <span className="whitespace-nowrap font-medium">{row.role}</span> },
  { key: 'stage', header: 'Stage', render: (row) => <StatusBadge status={row.stage} /> },
  { key: 'score', header: 'Score', render: (row) => <span className="font-semibold tabular-nums">{row.score}</span> },
  {
    key: 'owner',
    header: 'Owner',
    priority: 'tertiary',
    render: (row) => <div className="flex items-center gap-2 whitespace-nowrap"><Avatar initials={row.ownerInitials} size="sm" /><span>{row.owner}</span></div>,
  },
  { key: 'activity', header: 'Last activity', priority: 'tertiary', render: (row) => <span className="whitespace-nowrap text-rf-ink-muted">{row.lastActivity}</span> },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
];

const tokenSwatches = [
  ['Canvas', '--color-canvas'],
  ['Surface', '--color-surface'],
  ['Selected', '--color-surface-selected'],
  ['Action', '--color-action'],
  ['Success', '--color-success'],
  ['Warning', '--color-warning'],
  ['Danger', '--color-danger'],
  ['Info', '--color-info'],
] as const;

const velocityData = [
  { label: 'Week 1', value: 38 },
  { label: 'Week 2', value: 42 },
  { label: 'Week 3', value: 35 },
  { label: 'Week 4', value: 50 },
  { label: 'Week 5', value: 62 },
  { label: 'Week 6', value: 58 },
  { label: 'Week 7', value: 74 },
  { label: 'Week 8', value: 81 },
];

const monthlyHiresData = [
  { label: 'Mar', value: 42 },
  { label: 'Apr', value: 56 },
  { label: 'May', value: 35 },
  { label: 'Jun', value: 63 },
  { label: 'Jul', value: 82, highlight: true },
  { label: 'Aug', value: 48 },
];

const departmentData = [
  { label: 'Engineering', value: 38, color: '#1769e8' }, /* design-token-exception */
  { label: 'Clinical Ops', value: 24, color: '#24b99a' }, /* design-token-exception */
  { label: 'Product & Design', value: 16, color: '#ffac57' }, /* design-token-exception */
  { label: 'People & Talent', value: 12, color: '#7760e7' }, /* design-token-exception */
  { label: 'Marketing', value: 10, color: '#ef4444' }, /* design-token-exception */
];

const funnelStages = [
  { name: 'Applications', count: 1248, icon: 'cv' as const },
  { name: 'Screened', count: 542, icon: 'users' as const },
  { name: 'Interviews', count: 128, icon: 'calendar' as const },
  { name: 'Offered', count: 32, icon: 'offer' as const },
  { name: 'Hired', count: 18, icon: 'user-check' as const },
];

const showcaseBentoItems: MagicBentoItem[] = [
  {
    label: 'Command Center',
    title: 'Executive Workforce Demand',
    description: 'Real-time visibility into open headcount allocations, workload distribution, and hiring velocity across all business units.',
    value: '24',
    valueSuffix: 'Open Roles',
    badge: 'Live Operations',
    accent: 'var(--color-action)',
  },
  {
    label: 'Talent Intelligence',
    title: 'Candidate Pipeline & Talent Pools',
    description: 'Structured candidate profiles with AI resume parsing, match scoring, and stage movement history.',
    value: '1,248',
    valueSuffix: 'Active Profiles',
    badge: 'Pipeline Ready',
    accent: 'var(--color-info)',
  },
  {
    label: 'Decision Workflow',
    title: 'Approval & Offer Governance',
    description: 'Transparent multi-tier sign-off for vacancy requests, offer letters, and compensation approvals with SLA tracking.',
    value: '6',
    valueSuffix: 'Pending Approvals',
    badge: 'Action Required',
    accent: 'var(--color-warning)',
  },
  {
    label: 'Team Alignment',
    title: 'Role-Based Collaboration Matrix',
    description: 'Seamless coordination between recruiters, hiring managers, and interviewers with contextual evaluation rubrics.',
    value: '100%',
    valueSuffix: 'Role Clarity',
    badge: 'RBAC Governed',
    accent: 'var(--color-purple)',
  },
  {
    label: 'Workflow Engine',
    title: 'Automated Lifecycle Transitions',
    description: 'Enforce compliant transition rules from application screening through interview scheduling to official onboarding.',
    value: '8 Stages',
    valueSuffix: 'Fully Configurable',
    badge: 'Zero Slippage',
    accent: 'var(--color-success)',
  },
  {
    label: 'Compliance & Trust',
    title: 'Enterprise Audit Trail & Isolation',
    description: 'Immutable timeline logging, strict tenant data isolation, and comprehensive activity records for regulatory peace of mind.',
    value: 'SOC 2',
    valueSuffix: 'Audit Ready',
    badge: 'Strict Isolation',
    accent: 'var(--color-cyan)',
  },
];

function CatalogSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rf-ds-catalog__section w-full" aria-labelledby={`catalog-${title.toLowerCase().replaceAll(' ', '-')}`}>
      <SectionHeader
        headingId={`catalog-${title.toLowerCase().replaceAll(' ', '-')}`}
        title={title}
        description={description}
        as="h2"
      />
      {children}
    </section>
  );
}

function TokenSwatch({ name, variable }: { name: string; variable: string }) {
  return (
    <div className="rf-ds-token">
      <span className="rf-ds-token__swatch" style={{ background: `var(${variable})` }} aria-hidden="true" />
      <span><strong>{name}</strong><code>{variable}</code></span>
    </div>
  );
}

export function DesignSystemPage() {
  const [activeCategory, setActiveCategory] = useState<SectionCategory>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTone, setConfirmTone] = useState<'danger' | 'warning' | 'primary'>('danger');
  const [confirmTitle, setConfirmTitle] = useState('Reject offer approval?');
  const [activeTab, setActiveTab] = useState('overview');
  const [currentPage, setCurrentPage] = useState(2);
  const [includeTalentPool, setIncludeTalentPool] = useState(true);
  const [recommendation, setRecommendation] = useState<Recommendation>('hire');
  const [scorecardRatings, setScorecardRatings] = useState<Record<string, number>>({ research: 4, collaboration: 5 });
  const [scorecardSaved, setScorecardSaved] = useState(false);

  const scorecardCategories = [{
    id: 'craft',
    name: 'Role craft',
    isRequired: true,
    criteria: [
      { id: 'research', name: 'Research depth', rating: scorecardRatings.research },
      { id: 'collaboration', name: 'Collaboration', rating: scorecardRatings.collaboration },
    ],
  }];

  const triggerConfirm = (tone: 'danger' | 'warning' | 'primary', title: string) => {
    setConfirmTone(tone);
    setConfirmTitle(title);
    setConfirmOpen(true);
  };

  return (
    <PageFrame
      eyebrow="RecruitFlow Design System · v3.0"
      title="UI Components Showcase"
      description="Production-ready foundations, components, states, and recruiting patterns for dense enterprise workflows."
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          <ThemeToggle showLabel />
        </div>
      }
    >
      <div className="rf-ds-catalog flex flex-col gap-6 sm:gap-8 w-full max-w-full overflow-hidden">
        {/* Responsive Category Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none border-b border-rf-border-subtle">
          {[
            { key: 'all', label: 'Overview' },
            { key: 'primitives', label: 'Foundations & Inputs' },
            { key: 'data', label: 'Data & Workflows' },
            { key: 'charts', label: 'Analytics' },
            { key: 'dialogs', label: 'Feedback & Overlays' },
            { key: 'motion', label: 'Advanced Surfaces' },
          ].map((tab) => (
            <Button
              key={tab.key}
              variant={activeCategory === tab.key ? 'primary' : 'ghost'}
              size="sm"
              className="shrink-0 text-xs"
              onClick={() => setActiveCategory(tab.key as SectionCategory)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
          {[
            ['Components', '128', '+12 this quarter'],
            ['Patterns', '48', '+6 standardized'],
            ['Product pages', '24', '92% coverage'],
            ['Design tokens', '362', 'Semantic first'],
            ['Adoption', '92%', '+8% this quarter'],
          ].map(([label, value, detail]) => (
            <Card key={label} className="min-h-[86px] p-3.5">
              <span className="text-[9.5px] font-semibold text-rf-ink-muted">{label}</span>
              <strong className="mt-2 block text-[21px] font-bold leading-none tracking-[-0.025em] text-rf-ink tabular-nums">{value}</strong>
              <span className="mt-1.5 block text-[9px] font-medium text-rf-ink-muted">{detail}</span>
            </Card>
          ))}
          <Card className="col-span-2 min-h-[86px] p-3.5 md:col-span-1">
            <span className="text-[9.5px] font-semibold text-rf-ink-muted">System status</span>
            <div className="mt-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rf-success" aria-hidden="true" />
              <strong className="text-[11px] font-semibold text-rf-ink">All systems operational</strong>
            </div>
            <span className="mt-1.5 block text-[9px] font-medium text-rf-ink-muted">Updated 2h ago</span>
          </Card>
        </div>

        {/* HERO SPOTLIGHT */}
        <SpotlightCard className="rf-ds-catalog__intro w-full" tone="brand">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-extrabold text-rf-ink">Production-ready by default.</h2>
            <p className="text-xs text-rf-ink-muted leading-relaxed mt-1 max-w-[850px]">
              A calmer, denser component language for operational recruiting: clearer hierarchy, stronger state coverage, restrained surfaces, and accessible interaction patterns.
            </p>
          </div>
          <div className="flex flex-wrap content-start justify-end gap-2 shrink-0">
            <Badge variant="info">Token driven</Badge>
            <Badge variant="success">Keyboard aware</Badge>
            <Badge variant="neutral">Fully Responsive</Badge>
          </div>
        </SpotlightCard>

        {/* ============================================================ */}
        {/* CATEGORY: ANALYTICS & TREND CHARTS */}
        {/* ============================================================ */}
        {(activeCategory === 'all' || activeCategory === 'charts') && (
          <CatalogSection
            title="Analytics & Trend Visualizations"
            description="High-performance SVG charts and sparklines for hiring velocity, conversion funnels, and department allocations."
          >
            <div className="grid gap-4 w-full">
              {/* Funnel Pipeline Chart */}
              <FunnelChart
                title="Recruitment Funnel Pipeline"
                subtitle="End-to-end applicant conversion velocity across stages"
                stages={funnelStages}
              />

              {/* Trend Line & Bar Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <TrendLineChart
                  title="Hiring Velocity Trend"
                  subtitle="Filled roles and speed across the last 8 weeks"
                  data={velocityData}
                  unit=" hires"
                  badgeLabel="Improving"
                  badgeVariant="success"
                />
                <TrendBarChart
                  title="Hires over time"
                  subtitle="Trailing 6 months"
                  data={monthlyHiresData}
                  target={6}
                  badgeLabel="Feb 21 – Aug 20"
                />
              </div>

              {/* Donut Distribution & Sparkline Metric Cards */}
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-4">
                <DonutChart
                  title="Joined Headcount by Department"
                  subtitle="Distribution breakdown across active business units"
                  segments={departmentData}
                  centerLabel="Total Hires"
                  centerValue="100"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                  <MetricCard
                    label="Open Vacancies"
                    value="128"
                    detail="+12% vs last month"
                    tone="action"
                    icon={<Icon name="vacancy" size={16} />}
                    sparkline={[20, 24, 30, 28, 35, 42, 50]}
                    trend={{ value: '12%', isPositive: true }}
                  />
                  <MetricCard
                    label="Active Candidates"
                    value="842"
                    detail="In interview pipeline"
                    tone="info"
                    icon={<Icon name="users" size={16} />}
                    sparkline={[400, 480, 520, 610, 720, 842]}
                    trend={{ value: '8%', isPositive: true }}
                  />
                  <MetricCard
                    label="Offer Acceptance"
                    value="86%"
                    detail="Above 80% target"
                    tone="success"
                    icon={<Icon name="check-circle" size={16} />}
                    sparkline={[72, 75, 78, 82, 80, 86]}
                    trend={{ value: '4%', isPositive: true }}
                  />
                  <MetricCard
                    label="Avg Time to Fill"
                    value="31.4d"
                    detail="3.2 days faster"
                    tone="warning"
                    icon={<Icon name="clock" size={16} />}
                    sparkline={[45, 42, 38, 36, 33, 31.4]}
                    trend={{ value: '9%', isPositive: true }}
                  />
                </div>
              </div>

              {/* Standalone Sparklines Showcase */}
              <Card className="grid gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <div>
                    <h3 className="text-sm font-extrabold text-rf-ink m-0">Standalone Micro Sparklines</h3>
                    <p className="text-xs text-rf-ink-muted m-0 mt-0.5">Embeddable inline trend indicators for tables, cards, and list rows.</p>
                  </div>
                  <Badge variant="info">Micro Visualizations</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                  <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-rf-surface-subtle border border-rf-border-subtle">
                    <span className="text-[11px] font-bold text-rf-ink">Velocity Index</span>
                    <Sparkline data={[12, 18, 15, 22, 28, 25, 34]} color="var(--color-action)" width={120} height={30} />
                  </div>
                  <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-rf-surface-subtle border border-rf-border-subtle">
                    <span className="text-[11px] font-bold text-rf-ink">Offer Quality</span>
                    <Sparkline data={[80, 82, 85, 84, 88, 91, 94]} color="var(--color-success)" width={120} height={30} />
                  </div>
                  <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-rf-surface-subtle border border-rf-border-subtle">
                    <span className="text-[11px] font-bold text-rf-ink">Time-to-Hire</span>
                    <Sparkline data={[42, 38, 35, 32, 30, 28, 26]} color="var(--color-warning)" width={120} height={30} />
                  </div>
                  <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-rf-surface-subtle border border-rf-border-subtle">
                    <span className="text-[11px] font-bold text-rf-ink">SLA Breaches</span>
                    <Sparkline data={[14, 12, 9, 8, 5, 3, 2]} color="var(--color-danger)" width={120} height={30} />
                  </div>
                </div>
              </Card>
            </div>
          </CatalogSection>
        )}

        {/* ============================================================ */}
        {/* CATEGORY: DIALOGS, DRAWERS & OVERLAYS */}
        {/* ============================================================ */}
        {(activeCategory === 'all' || activeCategory === 'dialogs') && (
          <CatalogSection
            title="Dialogs, Drawers & Overlays Hub"
            description="Focus-trapped accessible modals, Radix alert dialogs, contextual slide-over drawers, and confirmation triggers."
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* 1. Notification Alert Dialog & Drawer */}
              <Card className="flex flex-col justify-between p-5 gap-4">
                <div>
                  <div className="w-9 h-9 rounded-xl bg-rf-action-soft text-rf-action flex items-center justify-center mb-3">
                    <Icon name="bell" size={18} />
                  </div>
                  <h3 className="text-sm font-extrabold text-rf-ink m-0">Notification Center</h3>
                  <p className="text-xs text-rf-ink-muted m-0 mt-1">
                    Combined alert dialog trigger with unread badge and interactive slide-over drawer.
                  </p>
                </div>
                <div className="pt-3 border-t border-rf-border-subtle flex justify-start">
                  <NotificationAlertDialog />
                </div>
              </Card>

              {/* 2. Destructive Radix Alert Dialog */}
              <Card className="flex flex-col justify-between p-5 gap-4">
                <div>
                  <div className="w-9 h-9 rounded-xl bg-rf-danger-soft text-rf-danger flex items-center justify-center mb-3">
                    <Icon name="close" size={18} />
                  </div>
                  <h3 className="text-sm font-extrabold text-rf-ink m-0">Radix Alert Dialog</h3>
                  <p className="text-xs text-rf-ink-muted m-0 mt-1">
                    Focus-trapped destructive dialog for permanently deleting records or revoking access.
                  </p>
                </div>
                <div className="pt-3 border-t border-rf-border-subtle">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="danger" size="sm" className="w-full sm:w-auto">
                        <Icon name="close" size={14} />
                        Delete Record
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the candidate record and archive all associated interview notes.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-rf-danger hover:brightness-95">
                          Yes, delete record
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </Card>

              {/* 3. Standard Modal Dialog */}
              <Card className="flex flex-col justify-between p-5 gap-4">
                <div>
                  <div className="w-9 h-9 rounded-xl bg-rf-info-soft text-rf-info flex items-center justify-center mb-3">
                    <Icon name="plus" size={18} />
                  </div>
                  <h3 className="text-sm font-extrabold text-rf-ink m-0">Form Modal Dialog</h3>
                  <p className="text-xs text-rf-ink-muted m-0 mt-1">
                    Full accessible modal overlay for forms, review comments, and multi-step data entry.
                  </p>
                </div>
                <div className="pt-3 border-t border-rf-border-subtle">
                  <Button variant="secondary" size="sm" className="w-full sm:w-auto" onClick={() => setModalOpen(true)}>
                    <Icon name="edit" size={14} />
                    Preview Modal Form
                  </Button>
                </div>
              </Card>

              {/* 4. Contextual Slide-over Drawer */}
              <Card className="flex flex-col justify-between p-5 gap-4">
                <div>
                  <div className="w-9 h-9 rounded-xl bg-rf-purple-soft text-rf-purple flex items-center justify-center mb-3">
                    <Icon name="user" size={18} />
                  </div>
                  <h3 className="text-sm font-extrabold text-rf-ink m-0">Contextual Drawer</h3>
                  <p className="text-xs text-rf-ink-muted m-0 mt-1">
                    Slide-over right panel that keeps the background workspace visible while reviewing facts.
                  </p>
                </div>
                <div className="pt-3 border-t border-rf-border-subtle">
                  <Button variant="secondary" size="sm" className="w-full sm:w-auto" onClick={() => setDrawerOpen(true)}>
                    <Icon name="menu" size={14} />
                    Preview Profile Drawer
                  </Button>
                </div>
              </Card>

              {/* 5. Toned Confirmation Dialogs */}
              <Card className="flex flex-col justify-between p-5 gap-4 md:col-span-2">
                <div>
                  <div className="w-9 h-9 rounded-xl bg-rf-warning-soft text-rf-warning flex items-center justify-center mb-3">
                    <Icon name="alert-triangle" size={18} />
                  </div>
                  <h3 className="text-sm font-extrabold text-rf-ink m-0">Decision Confirmations (Tones &amp; Comments)</h3>
                  <p className="text-xs text-rf-ink-muted m-0 mt-1">
                    Preset confirmation dialogs with required or optional decision justification notes.
                  </p>
                </div>
                <div className="pt-3 border-t border-rf-border-subtle flex flex-wrap items-center gap-2">
                  <Button variant="danger" size="sm" onClick={() => triggerConfirm('danger', 'Reject offer approval?')}>
                    Reject Offer (Danger)
                  </Button>
                  <Button variant="warning" size="sm" onClick={() => triggerConfirm('warning', 'Withdraw candidate application?')}>
                    Withdraw (Warning)
                  </Button>
                  <Button variant="success" size="sm" onClick={() => triggerConfirm('primary', 'Approve and release offer?')}>
                    Approve Offer (Primary)
                  </Button>
                </div>
              </Card>
            </div>

            {/* Semantic Alert Banners */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <Alert tone="info" title="System Notice">
                Recruitment pipelines will synchronize candidate statuses automatically.
              </Alert>
              <Alert tone="success" title="Verification Passed">
                Candidate compliance documents verified and approved.
              </Alert>
              <Alert tone="warning" title="Pending Sign-off">
                Offer requires final sign-off from Department Head before sending.
              </Alert>
              <Alert tone="danger" title="Validation Error">
                Unable to submit request. Headcount budget exceeds branch allocation.
              </Alert>
            </div>
          </CatalogSection>
        )}

        {/* ============================================================ */}
        {/* CATEGORY: MOTION, BORDERGLOW & THEMES */}
        {/* ============================================================ */}
        {(activeCategory === 'all' || activeCategory === 'motion') && (
          <>
            <CatalogSection
              title="MagicBento operational surfaces"
              description="A restrained interactive bento pattern for high-impact summaries. It adapts to the RecruitFlow theme, disables motion on mobile, and respects reduced-motion preferences."
            >
              <MagicBento
                items={showcaseBentoItems}
                textAutoHide={false}
                enableStars
                enableSpotlight
                enableBorderGlow
                enableTilt={false}
                enableMagnetism
                clickEffect
                particleCount={8}
                spotlightRadius={280}
                glowColor="23, 105, 232"
              />
            </CatalogSection>

            {/* INTERACTIVE SURFACE */}
            <CatalogSection
              title="Interactive surface"
              description="A low-noise pointer spotlight and proximity edge glow reserved for optional, high-impact surfaces."
            >
              <ClickSpark sparkColor="var(--color-action)" sparkRadius={24} sparkCount={10}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <BorderGlow
                    edgeSensitivity={30}
                    glowColor="217 91 60"
                    colors={['#1769e8', '#7657e6', '#0799aa']} /* design-token-exception */
                    borderRadius={16}
                    glowRadius={36}
                    backgroundColor="var(--color-surface)"
                  >
                    <div className="p-5 flex flex-col justify-between min-h-[140px]">
                      <div className="flex items-start justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-rf-ink-muted">Open Vacancies</span>
                        <div className="w-8 h-8 rounded-xl bg-rf-action-soft text-rf-action flex items-center justify-center">
                          <Icon name="vacancy" size={16} />
                        </div>
                      </div>
                      <div className="mt-4">
                        <span className="text-[28px] font-black text-rf-ink leading-none block font-rf-heading">24</span>
                        <span className="text-[11px] font-bold text-rf-action uppercase tracking-wider mt-1.5 block">Recruiting Now</span>
                      </div>
                    </div>
                  </BorderGlow>

                  <BorderGlow
                    edgeSensitivity={30}
                    glowColor="40 80 80"
                    colors={['#f59e0b', '#ef4444', '#8b5cf6']} /* design-token-exception */
                    borderRadius={16}
                    glowRadius={36}
                    backgroundColor="var(--color-surface)"
                  >
                    <div className="p-5 flex flex-col justify-between min-h-[140px]">
                      <div className="flex items-start justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-rf-ink-muted">Pending Decisions</span>
                        <div className="w-8 h-8 rounded-xl bg-rf-warning-soft text-rf-warning flex items-center justify-center">
                          <Icon name="alert-triangle" size={16} />
                        </div>
                      </div>
                      <div className="mt-4">
                        <span className="text-[28px] font-black text-rf-ink leading-none block font-rf-heading">6</span>
                        <span className="text-[11px] font-bold text-rf-warning uppercase tracking-wider mt-1.5 block">Needs Review</span>
                      </div>
                    </div>
                  </BorderGlow>
                </div>
              </ClickSpark>
            </CatalogSection>

            {/* THEME AESTHETICS (LIGHT VS DARK) */}
            <CatalogSection
              title="Theme Aesthetics — Light vs Dark Proximity Glow"
              description="Light and dark modes have distinct visual personalities: crisp alpine precision with soft azure glows vs deep obsidian contrast with vivid neon mesh."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Dark Aesthetic Preview */}
                <BorderGlow
                  edgeSensitivity={30}
                  glowColor="265 85 70"
                  backgroundColor="#0e1017" /* design-token-exception */
                  borderRadius={24}
                  glowRadius={42}
                  glowIntensity={1.2}
                  coneSpread={26}
                  animated={true}
                  colors={['#c084fc', '#f472b6', '#38bdf8']} /* design-token-exception */
                >
                  <div className="p-6 sm:p-7 flex flex-col justify-between min-h-[240px]">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-9 h-9 rounded-xl bg-rf-action-soft text-rf-action flex items-center justify-center border border-rf-action/30">
                          <Icon name="sparkles" size={18} />
                        </div>
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-rf-action bg-rf-action-soft px-2 py-0.5 rounded-full border border-rf-action/40">
                          Dark Aesthetic
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-rf-ink tracking-tight m-0">Obsidian &amp; Neon</h3>
                      <p className="text-xs text-rf-ink-muted mt-2 leading-relaxed m-0">
                        Deep obsidian surface with ultraviolet, rose, and cyan spotlight cone that tracks your cursor.
                      </p>
                    </div>
                    <div className="mt-5 flex items-center gap-2">
                      <Badge variant="info">Intro Sweep</Badge>
                      <Badge variant="neutral">High Contrast</Badge>
                    </div>
                  </div>
                </BorderGlow>

                {/* Light Aesthetic Preview */}
                <BorderGlow
                  edgeSensitivity={30}
                  glowColor="217 91 60"
                  backgroundColor="#ffffff" /* design-token-exception */
                  borderRadius={24}
                  glowRadius={36}
                  glowIntensity={0.85}
                  coneSpread={24}
                  animated={false}
                  colors={['#2563eb', '#6366f1', '#06b6d4']} /* design-token-exception */
                >
                  <div className="p-6 sm:p-7 flex flex-col justify-between min-h-[240px]">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-9 h-9 rounded-xl bg-rf-action-soft text-rf-action flex items-center justify-center border border-rf-action/20">
                          <Icon name="sparkles" size={18} />
                        </div>
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-rf-action bg-rf-action-soft px-2 py-0.5 rounded-full border border-rf-action/20">
                          Light Aesthetic
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-rf-ink tracking-tight m-0">Alpine &amp; Azure</h3>
                      <p className="text-xs text-rf-ink-muted mt-2 leading-relaxed m-0">
                        Clean pearl surface with subtle oceanic blue and indigo diffuse edge light for executive clarity.
                      </p>
                    </div>
                    <div className="mt-5 flex items-center gap-2">
                      <Badge variant="info">Subtle Sheen</Badge>
                      <Badge variant="neutral">Diffused Edge</Badge>
                    </div>
                  </div>
                </BorderGlow>

                {/* Live Adaptive Card */}
                <BorderGlow
                  edgeSensitivity={30}
                  borderRadius={24}
                  glowRadius={40}
                  glowIntensity={1.0}
                  coneSpread={25}
                  className="md:col-span-2 lg:col-span-1"
                >
                  <div className="p-6 sm:p-7 flex flex-col justify-between min-h-[240px]">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-9 h-9 rounded-xl bg-rf-success-soft text-rf-success flex items-center justify-center border border-rf-success/20">
                          <Icon name="sun" size={18} />
                        </div>
                        <Badge variant="success">Auto Theme-Aware</Badge>
                      </div>
                      <h3 className="text-lg font-bold text-rf-ink tracking-tight m-0">Dynamic Reactive Card</h3>
                      <p className="text-xs text-rf-ink-muted mt-2 leading-relaxed m-0">
                        This card automatically transitions colors, glow radius, and opacity whenever you toggle themes.
                      </p>
                    </div>
                    <div className="mt-5 pt-3 border-t border-rf-border-subtle flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-rf-ink-muted">Switch mode:</span>
                      <ThemeToggle showLabel />
                    </div>
                  </div>
                </BorderGlow>
              </div>
            </CatalogSection>
          </>
        )}

        {/* ============================================================ */}
        {/* CATEGORY: CORE PRIMITIVES */}
        {/* ============================================================ */}
        {(activeCategory === 'all' || activeCategory === 'primitives') && (
          <>
            {/* FOUNDATION TOKENS */}
            <CatalogSection title="Foundation tokens" description="Semantic variables are the only color, surface, spacing, focus, and motion authority.">
              <Card className="rf-ds-catalog__surface">
                <div className="rf-ds-token-grid">
                  {tokenSwatches.map(([name, variable]) => <TokenSwatch key={variable} name={name} variable={variable} />)}
                </div>
              </Card>
            </CatalogSection>

            {/* ACTIONS & STATUS */}
            <CatalogSection title="Actions and status" description="One dominant action per context, explicit status language, and accessible utility controls.">
              <Card className="rf-ds-catalog__surface grid gap-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="primary">Primary action</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="tertiary">Tertiary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="success">Approve</Button>
                  <Button variant="danger">Reject</Button>
                  <Button variant="warning">Warning</Button>
                  <Button loading loadingLabel="Saving changes">Saving</Button>
                  <Button disabled>Disabled</Button>
                  <IconButton label="Refresh records"><Icon name="refresh-cw" size={16} /></IconButton>
                  <IconButton label="Open more actions"><Icon name="more" size={16} /></IconButton>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="neutral">Draft</Badge>
                  <Badge variant="info">In review</Badge>
                  <Badge variant="success">Approved</Badge>
                  <Badge variant="warning">Attention needed</Badge>
                  <Badge variant="danger">Rejected</Badge>
                  <StatusBadge status="Scheduled" />
                  <PriorityChip level="high" />
                  <PriorityChip level="medium" />
                  <PriorityChip level="low" />
                </div>
              </Card>
            </CatalogSection>

            {/* INPUTS & FORM STRUCTURE */}
            <CatalogSection title="Inputs and form structure" description="Native controls retain browser behavior while labels, help, errors, and grouping stay consistent.">
              <FormSection title="Candidate context" description="Fields expose required status, useful help text, and inline error announcements." actions={<Badge variant="neutral">Draft</Badge>}>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <FormField id="ds-name" label="Candidate name" required hint="Used in the organization directory.">
                    <Input placeholder="Enter a name" />
                  </FormField>
                  <FormField id="ds-search" label="Search input" hint="Supports command and table search patterns.">
                    <Input type="search" placeholder="Search candidates…" />
                  </FormField>
                  <FormField id="ds-stage" label="Workflow stage">
                    <Select defaultValue="Screening"><option>Applied</option><option>Screening</option><option>Interview</option><option>Offer</option></Select>
                  </FormField>
                  <FormField id="ds-readonly" label="Candidate ID" hint="Read-only system value.">
                    <Input value="CAN-2024-1248" readOnly />
                  </FormField>
                  <FormField id="ds-note" label="Decision note" error="Add a reason before saving.">
                    <Textarea placeholder="Add relevant context…" rows={3} />
                  </FormField>
                  <FormField id="ds-success" label="Phone" hint="Validated contact format.">
                    <Input defaultValue="+1 (555) 123-4567" className="border-rf-success focus:border-rf-success focus:ring-rf-success/12" />
                  </FormField>
                  <FormField id="ds-disabled" label="Position" hint="Locked by workflow state.">
                    <Input defaultValue="Frontend Developer" disabled />
                  </FormField>
                  <div className="grid content-end gap-2">
                    <CheckboxField
                      checked={includeTalentPool}
                      label="Keep in talent pool"
                      description="Candidate remains discoverable for future openings."
                      onChange={(event) => setIncludeTalentPool(event.target.checked)}
                    />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-5 border-t border-rf-border-subtle pt-4">
                  <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-rf-ink"><input type="radio" name="employment" defaultChecked className="h-4 w-4 accent-[var(--color-action)]" /> Full-time</label>
                  <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-rf-ink"><input type="radio" name="employment" className="h-4 w-4 accent-[var(--color-action)]" /> Contract</label>
                  <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-rf-ink"><input type="checkbox" defaultChecked className="h-4 w-4 accent-[var(--color-action)]" /> Email notifications</label>
                  <div className="ml-auto flex flex-wrap gap-2"><Badge variant="neutral">Default</Badge><Badge variant="info">Focused</Badge><Badge variant="success">Valid</Badge><Badge variant="danger">Error</Badge><Badge variant="neutral">Disabled</Badge></div>
                </div>
              </FormSection>
            </CatalogSection>
          </>
        )}

        {/* ============================================================ */}
        {/* CATEGORY: DATA & WORKFLOWS */}
        {/* ============================================================ */}
        {(activeCategory === 'all' || activeCategory === 'data') && (
          <>
            {/* NAVIGATION AND DATA CONTROLS */}
            <CatalogSection title="Navigation and data controls" description="Tabs, filter toolbar, responsive data views, and pagination compose without owning business state.">
              <Card className="overflow-hidden p-0 w-full">
                <Tabs
                  ariaLabel="Design system data views"
                  activeKey={activeTab}
                  onChange={setActiveTab}
                  items={[{ key: 'overview', label: 'All candidates', count: 24 }, { key: 'active', label: 'Active', count: 16 }, { key: 'archived', label: 'Archived', count: 8 }]}
                  className="px-4 pt-3 overflow-x-auto"
                />
                <DataToolbar
                  search={<Input aria-label="Search sample candidates" placeholder="Search candidates…" />}
                  filters={<div className="flex items-center gap-2"><Select aria-label="Filter sample stage" defaultValue="All"><option>All stages</option><option>Screening</option><option>Interview</option><option>Offer</option></Select><Button variant="secondary" size="sm" type="button">Filters <Badge variant="neutral">2</Badge></Button></div>}
                  actions={<div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" type="button"><Icon name="list" size={13} />Columns</Button><Button variant="secondary" size="sm" type="button">Save view</Button><Button variant="primary" size="sm" type="button"><Icon name="plus" size={13} />Add candidate</Button></div>}
                  activeFilters={<><FilterChip label="Owner: Design" onRemove={() => undefined} /><FilterChip label="Stage: Active" onRemove={() => undefined} /></>}
                />
                <div className="p-3 sm:p-4 overflow-x-auto">
                  <ResponsiveDataView
                    rows={demoCandidates}
                    columns={demoColumns}
                    rowKey={(r) => r.id}
                    label="Enterprise candidate operations table"
                    selectedRowKeys={['candidate-1']}
                    renderActions={() => <IconButton label="Open row actions"><Icon name="more" size={14} /></IconButton>}
                  />
                </div>
                <div className="p-3 sm:p-4 border-t border-rf-border-subtle">
                  <Pagination currentPage={currentPage} totalPages={25} onPageChange={setCurrentPage} summary="Showing 1-5 of 124 records · 1 selected" />
                </div>
              </Card>
            </CatalogSection>

            {/* PEOPLE & SUMMARIES */}
            <CatalogSection title="People and detail structure" description="Expressive avatars, progress indicators, and compact description lists.">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="grid gap-4">
                  <SectionHeader title="People and ownership" description="Avatars complement—not replace—name text." as="h3" />
                  <div className="flex flex-wrap items-center gap-3">
                    <Avatar initials="ME" size="sm" presence="online" />
                    <Avatar initials="OK" size="md" presence="away" />
                    <Avatar initials="RA" size="lg" presence="offline" />
                    <AvatarStack totalCount={5}><Avatar initials="AH" size="sm" /><Avatar initials="NA" size="sm" /><Avatar initials="SM" size="sm" /></AvatarStack>
                  </div>
                  <ProgressBar label="Joining readiness" description="Documents and approvals complete" value={78} tone="success" />
                </Card>
                <DetailSummary
                  title="Candidate context"
                  description="A structured description list for profile and workflow facts."
                  columns={2}
                  items={[
                    { label: 'Candidate', value: 'Mariam El-Sayed', icon: <Icon name="user" size={14} /> },
                    { label: 'Current stage', value: 'Interview', icon: <Icon name="calendar" size={14} /> },
                    { label: 'Owner', value: 'A. Hassan', icon: <Icon name="users" size={14} /> },
                    { label: 'Status', value: 'Active', icon: <Icon name="check-circle" size={14} /> },
                  ]}
                />
              </div>
            </CatalogSection>

            {/* WORKFLOW PATTERNS */}
            <CatalogSection title="Workflow patterns" description="Timeline, stepper, and scorecard components preserve recruitment context instead of reducing work to generic cards.">
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-4">
                <Card className="grid gap-4">
                  <SectionHeader title="Recruitment activity" description="Events carry time, owner, and semantic state." as="h3" />
                  <ActivityTimeline
                    items={[
                      { id: 'created', title: 'Candidate created', timestamp: 'Today, 09:20', actor: 'M. El-Sayed', actorInitials: 'ME', tone: 'action', description: 'Profile added from referral intake.' },
                      { id: 'feedback', title: 'Scorecard submitted', timestamp: 'Today, 13:10', actor: 'R. Ahmed', actorInitials: 'RA', tone: 'success', description: 'Technical interview feedback is complete.' },
                      { id: 'approval', title: 'Offer approval due', timestamp: 'Tomorrow', tone: 'warning', description: 'HR Director approval is still required.' },
                    ]}
                  />
                </Card>
                <Card className="grid gap-5">
                  <SectionHeader title="Pipeline progression" description="Workflow steps retain clear current and pending states." as="h3" />
                  <PipelineStepper currentStage="Interview" />
                  <Scorecard
                    title="Technical interview"
                    interviewer="R. Ahmed"
                    dueText="Due today"
                    recommendation={recommendation}
                    onRecommendationChange={setRecommendation}
                    categories={scorecardCategories}
                    onRatingChange={(_, criterionId, rating) => setScorecardRatings((current) => ({ ...current, [criterionId]: rating }))}
                    onSubmit={() => setScorecardSaved(true)}
                    submitLabel="Save demo feedback"
                  />
                  {scorecardSaved && <Alert tone="success" title="Demo feedback saved">The scorecard reflects the selected ratings and recommendation.</Alert>}
                </Card>
              </div>
            </CatalogSection>

            {/* FEEDBACK & LOADING STATES */}
            <CatalogSection title="Feedback and loading" description="Loading, empty, error, and success feedback explain what happened and what to do next.">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <PageState kind="loading" title="Loading records" description="Fetching organization-scoped data." />
                <PageState kind="empty" title="No matching records" description="Change the filters or create the first record." />
                <PageState kind="forbidden" title="Permission required" description="Your role cannot access this workflow." />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <MetricCardSkeleton count={2} />
                <DetailSkeleton />
              </div>
              <div className="mt-3">
                <TableSkeleton rows={3} columns={4} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <Toast tone="success" title="Candidate created" message="The directory is up to date." />
                <AlertBanner tone="warning">Two interview scorecards are overdue.</AlertBanner>
              </div>
            </CatalogSection>
          </>
        )}
      </div>

      {/* OVERLAY: MODAL FORM */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Accessible Dialog Form">
        <div className="grid gap-4">
          <p className="m-0 text-xs leading-relaxed text-rf-ink-muted">
            Focus enters the dialog automatically, remains trapped, returns to the trigger button upon close, and Escape closes it cleanly.
          </p>
          <FormField id="dialog-name" label="Candidate Name" required>
            <Input placeholder="e.g. Tariq Al-Mansoor" />
          </FormField>
          <FormField id="dialog-department" label="Department">
            <Select defaultValue="Engineering">
              <option>Engineering</option>
              <option>Product & Design</option>
              <option>People Operations</option>
            </Select>
          </FormField>
          <FormField id="dialog-note" label="Evaluation Notes">
            <Textarea placeholder="Add review notes or interview context…" rows={3} />
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-rf-border-subtle">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setModalOpen(false)}>Save Changes</Button>
          </div>
        </div>
      </Modal>

      {/* OVERLAY: DRAWER QUICK VIEW */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Candidate Quick Profile"
        subtitle="Contextual detail stays beside the current workspace."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDrawerOpen(false)}>Close</Button>
            <Button variant="primary" onClick={() => setDrawerOpen(false)}>Open Full Profile</Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <DetailSummary
            columns={1}
            items={[
              { label: 'Candidate', value: 'Mariam El-Sayed' },
              { label: 'Applied Position', value: 'Senior Product Designer' },
              { label: 'Current Stage', value: 'Technical Interview' },
              { label: 'Assigned Recruiter', value: 'Ahmed Mahmoud' },
              { label: 'Match Score', value: '94% (AI Resume Screen)' },
            ]}
          />
          <div className="p-3.5 rounded-xl bg-rf-surface-subtle border border-rf-border-subtle">
            <span className="text-[11px] font-bold text-rf-ink block mb-2">Stage Progression</span>
            <PipelineStepper currentStage="Interview" />
          </div>
        </div>
      </Drawer>

      {/* OVERLAY: CONFIRMATION DIALOG */}
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => setConfirmOpen(false)}
        title={confirmTitle}
        description="This action will update the workflow state immediately. Please include any required rationale."
        confirmLabel="Confirm Action"
        tone={confirmTone}
        withComment
        commentRequired={confirmTone === 'danger'}
      />
    </PageFrame>
  );
}

export default DesignSystemPage;

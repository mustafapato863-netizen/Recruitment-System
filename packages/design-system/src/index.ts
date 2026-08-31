/**
 * RecruitFlow's portable design-system contract.
 *
 * CSS custom properties in `apps/web/src/styles/tokens.css` remain the runtime
 * source of truth. This object gives workspace packages a stable, serializable
 * description of the same semantic roles without coupling them to Tailwind.
 */
export const designTokens = {
  name: 'RecruitFlow',
  version: '1.0.0',
  colorModes: ['light', 'dark'],
  colors: {
    primary: '#1769e8',
    background: '#f5f8fc',
    surface: '#ffffff',
    text: '#152033',
    muted: '#526076',
    border: '#dfe6f0',
    success: '#0b9b6f',
    warning: '#d97706',
    danger: '#e43e49',
    info: '#0284c7',
  },
  darkColors: {
    primary: '#7c9cff',
    background: '#0b1220',
    surface: '#111c2e',
    text: '#f8fafc',
    muted: '#a9b8ca',
    border: '#33455f',
  },
  cssVariables: {
    canvas: '--color-canvas',
    surface: '--color-surface',
    surfaceSubtle: '--color-surface-subtle',
    surfaceHover: '--color-surface-hover',
    border: '--color-border',
    text: '--color-ink-950',
    textMuted: '--color-ink-500',
    action: '--color-action',
    focusRing: '--focus-ring',
  },
  spacing: [4, 8, 12, 16, 20, 24, 32, 40, 48],
  radius: {
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  motion: {
    instant: 100,
    fast: 150,
    standard: 200,
    slow: 300,
  },
} as const;

export const componentFamilies = {
  actions: ['Button', 'IconButton'],
  dataEntry: ['Input', 'Select', 'Textarea', 'CheckboxField', 'FormField', 'FormSection'],
  navigation: ['Tabs', 'Pagination', 'DataToolbar'],
  feedback: ['Alert', 'Toast', 'PageState', 'Skeleton'],
  surfaces: ['Card', 'MetricCard', 'SpotlightCard', 'SectionHeader'],
  dataDisplay: ['Badge', 'StatusBadge', 'Avatar', 'DataTable', 'ResponsiveDataView', 'DetailSummary', 'ProgressBar'],
  workflow: ['ActivityTimeline', 'PipelineStepper', 'PipelineBoard', 'Scorecard'],
  overlays: ['Modal', 'ConfirmDialog', 'Drawer'],
} as const;

export type DesignTokenContract = typeof designTokens;
export type ComponentFamily = keyof typeof componentFamilies;

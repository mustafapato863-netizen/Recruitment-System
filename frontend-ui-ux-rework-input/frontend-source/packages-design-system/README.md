# RecruitFlow Design System

The runtime token source is [`apps/web/src/styles/tokens.css`](../../apps/web/src/styles/tokens.css). This package provides a portable semantic contract for workspace packages and documentation tools.

The system is intentionally enterprise-oriented: semantic light/dark tokens, compact information density, accessible focus treatment, restrained motion, and reusable component families. It does not provide a second runtime UI library.

## Foundations

- Semantic canvas, surface, border, ink, action, and status color roles in light and dark mode.
- Operational type scale, compact spacing, radius, elevation, z-index, focus, and motion tokens.
- `prefers-reduced-motion` support and 40–44px touch targets where interaction density allows.

## Component families

- Actions: `Button`, `IconButton`
- Data entry: `Input`, `Select`, `Textarea`, `CheckboxField`, `FormField`, `FormSection`
- Navigation and data controls: `Tabs`, `DataToolbar`, `Pagination`, `DataTable`, `ResponsiveDataView`
- Feedback: `Alert`, `Toast`, `PageState`, layout-matched `Skeleton` variants
- Surfaces and display: `Card`, `MetricCard`, `SpotlightCard`, `Avatar`, `Badge`, `StatusBadge`, `DetailSummary`, `ProgressBar`
- Workflow: `ActivityTimeline`, `PipelineStepper`, `PipelineBoard`, `Scorecard`
- Overlays: `Modal`, `ConfirmDialog`, `Drawer`

## Composition rules

- Use `PageFrame` for page-level hierarchy; use `SectionHeader` inside content surfaces.
- Use `FormSection` for related field groups, not a giant unstructured modal.
- Use `DataToolbar` and `Pagination` as state-free layout primitives around an existing data contract.
- Use `PageState` for actionable loading, empty, error, forbidden, and not-found states; use skeletons where the final geometry is already known.
- Reserve `SpotlightCard` and other expressive enhancements for optional, non-critical content. Never make critical recruitment data depend on animation or color alone.

Use the development-only `/__design-system` route in the web app to inspect live component states.

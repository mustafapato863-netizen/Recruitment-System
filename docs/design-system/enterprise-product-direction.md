# RecruitFlow Enterprise Product Design Direction

## Decision

Use one coherent **Enterprise Utility** design system: calm, flat, high-trust, data-literate, and optimized for repeated operational work. This is a product UI direction, not a marketing aesthetic and not a copy of any provider.

## Visual language

- Primary: deep navy for navigation, headings, and high-confidence actions.
- Action: accessible blue for primary actions and links.
- Success: green only for completed/healthy states.
- Warning: amber only for attention, SLA risk, and pending decisions.
- Danger: red only for destructive, blocked, or failed states.
- Surfaces: white and cool neutral backgrounds with visible borders.
- Remove purple-gradient identity, ornamental gradients, excessive circles, and large decorative KPI cards.
- Use shadows only for menus, dialogs, drawers, and elevated temporary surfaces.

## Foundation tokens

| Token family | Direction |
|---|---|
| Typography | Plus Jakarta Sans or an approved self-hosted equivalent; 14-16px body; 12-13px compact metadata; clear numeric tabular treatment |
| Spacing | 8pt base grid; 4px micro spacing only for icon/text relationships |
| Radius | 6px controls, 8px cards/rows, 12px dialogs; avoid pill-shaped containers except statuses/tags |
| Borders | 1px neutral borders as the primary grouping mechanism |
| Density | Comfortable default, Compact option for recruiters, Spacious option for executives |
| Motion | 150-200ms for hover/focus/state feedback; respect reduced motion; no decorative continuous animation |
| Breakpoints | 375, 768, 1024, 1280, 1440; no horizontal overflow at 375px |
| Focus | Visible 2-3px focus ring with sufficient contrast on every keyboard target |

## Core component families

1. Application shell, tenant switcher, breadcrumbs, global search, command palette, account menu.
2. Work queue, task row, approval row, SLA indicator, assignment control, saved view.
3. Data table, filter bar, bulk actions, column preferences, pagination, export policy.
4. KPI tile, chart, drill-down link, dashboard filter, scheduled report state.
5. Candidate profile, timeline, document status, consent banner, duplicate resolution.
6. Opening/requisition header, stage stepper, owner panel, headcount progress, approval timeline.
7. Interview plan, scorecard, debrief, offer approval, joining checklist.
8. Drawer, modal, confirmation, toast, inline error, empty state, skeleton, forbidden state.

## Layout rules

- Every page starts with object/workspace context, one primary action, and a clear next-action summary.
- KPI tiles are secondary to work queues and decision context.
- Tables support search, filters, sorting, bulk actions, column visibility, keyboard navigation, and empty/loading/error/forbidden states.
- Detail pages use a consistent split: identity/context, primary workflow, evidence/timeline, and next actions.
- Sidebars group by user job; notifications and tasks are cross-cutting utilities under My Work.
- Collapse state keeps an accessible label and never turns sign out into an icon-only mystery action.
- Mobile uses stacked cards and drawers; it never forces a desktop table into a clipped viewport.

## Screenshot correction checklist

- Replace the generic “Admin” footer with avatar, full display name, role, organization, and account-menu trigger.
- Make Sign out a clear menu action with a minimum 44px target and confirmation only when policy requires it.
- Add workspace/organization context above primary navigation.
- Move the collapse trigger into the shell header or sidebar rail and label its expanded/collapsed state.
- Use the empty lower rail for meaningful support/help/status affordances or remove the dead space through layout sizing.
- Add visible counts for My Tasks, approvals, and unread notifications without duplicating navigation destinations.

## Accessibility contract

- WCAG AA contrast minimum; status is never conveyed by color alone.
- Semantic headings, labels, tables, dialogs, and landmark regions.
- Keyboard-complete navigation with predictable focus order and focus restoration after drawers/modals.
- 44px minimum touch targets for primary controls.
- Clear inline errors, retry actions, server-error explanations, and unauthorized states.
- Respect `prefers-reduced-motion` and avoid focus loss during route/data transitions.

## Design review gate

Before implementing the first enterprise shell slice, review a static wireframe set for:

- recruiter home,
- hiring-manager home,
- executive insights,
- requisition detail,
- candidate profile,
- application pipeline,
- interview scorecard,
- offer approval,
- mobile navigation,
- account/workspace menu.

No page-level implementation should begin until these screens share the same shell, tokens, component vocabulary, and state matrix.

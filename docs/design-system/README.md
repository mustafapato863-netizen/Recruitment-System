# RecruitFlow design system

## Ownership

- `packages/design-system/src/` is the shared implementation source for tokens and reusable UI primitives.
- `apps/web/` consumes the shared system and owns feature composition.
- `docs/development/FRONTEND_SIMPLE_SYSTEM_PLAN.md` defines the active frontend page and workflow direction.

## Visual direction

RecruitFlow uses a light/dark enterprise workspace: blue primary action, neutral surfaces, compact data tables, clear status badges, role-aware actions, and responsive approval/interview workflows.

## Reference documents

Use `enterprise-visual-identity.md`, `enterprise-product-direction.md`, and the active frontend simple system plan for visual and interaction decisions.

Do not copy prototype CSS into feature pages. Update shared tokens/primitives and then compose them in the relevant feature.

## Legacy palette burn-down

`pnpm --dir apps/web check:design-tokens` enforces a ratchet, not an absolute
zero, because production still carries a large pre-token Tailwind palette:

- Baseline recorded 2026-09-17: **10,420** legacy palette utilities, plus **76**
  grandfathered violation lines in 7 strict-boundary files
  (`BreadcrumbsBar`, `CommandPalette`, `CommentsThread`, `DataTable`,
  `Drawer`, `notification-alert-dialog`, `AppShell`).
- The gate fails on any *increase*: new code must use semantic `rf-*`
  utilities or variables from `apps/web/src/styles/tokens.css`, and
  grandfathered files must not gain violations.
- Burn-down order (highest count first): `notification-alert-dialog.tsx`
  (39), `AppShell.tsx` (16), `BreadcrumbsBar.tsx` (9), then the rest.
- When a migration lands, lower the baseline in
  `apps/web/scripts/check-design-tokens.mjs` and remove the file from the
  grandfather list. Never raise the baseline without review.

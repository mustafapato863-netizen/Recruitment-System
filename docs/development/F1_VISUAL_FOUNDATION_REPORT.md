# F1 Visual Foundation and Scale Reset Report

**Date:** 2026-08-31  
**Status:** Implemented; focused verification passed. Full F0-F3 review remains open.

## Changes

- Added density aliases and semantic page/control tokens in
  `apps/web/src/styles/tokens.css`:
  `--control-height-{compact,default,touch}`, page/card spacing aliases, and
  card/control radii.
- Reduced canonical page max width from 1540px to 1360px and page gutter from
  28px to 24px.
- Reduced authenticated shell baseline sidebar from 248px to 232px, brand
  header from 76px to 64px, and navigation row minimum from 42px to 38px in
  `v2-parity.css`.
- Rebalanced Login in `apps/web/src/auth/LoginPage.tsx`: max width 1180px,
  minimum desktop panel 640px, 40px desktop hero heading, 32px primary heading,
  48px-class controls, smaller radii/padding/gaps, and a 420px form column.
- Added `tooltipLabel` to `TrendBarChart` to resolve an existing Dashboard
  contract mismatch exposed by the web build.
- Removed an unused Dashboard catch binding so lint can pass.

## Verification

- `pnpm --filter web test -- --run src/components/ui/PageState.test.tsx src/components/ui/ResponsiveDataView.test.tsx`: **5/5 passed**.
- `tests/browser/f1_login_scale_smoke.py`: **4/4 passed** for 1440/375 and
  light/dark; no horizontal overflow.
- Post-change Login measurements:
  - desktop h1: 32px, input: 42px rendered, submit: 42px rendered;
  - mobile h1: 28px, input: 39px rendered, submit: 42px rendered;
  - 1440 and 375 scroll width equals viewport width in both themes.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm --filter web build`: passed.

## Follow-up

- Full F0-F3 route/state/theme/accessibility matrix is not closed by this
  focused Login check.
- The design-system token catalog and `components/ui` primitives still need
  final consolidation documentation under F3.


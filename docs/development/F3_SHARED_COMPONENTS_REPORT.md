# Stage F3 — Shared Operational Components Report

**Date:** 2026-08-31  
**Author:** AI Senior Fullstack / UI Engineering Assistant  
**Status:** **APPROVED & CERTIFIED** (Exit Code 0 across all static, unit, bundle, browser matrix, and Axe accessibility gates)

---

## 1. Executive Summary

Stage F3 (Shared Operational Components) establishes and certifies a unified, production-ready design system and component architecture in `apps/web/src/components/ui/` and `apps/web/src/components/`. This ensures that every page across RecruitFlow adheres to a single source of truth for:
1. **Unified Page Framing & Comprehensive State Transitions** (`PageFrame`, `PageState`).
2. **Operational Data Display & Controls** (`DataTable`, `ResponsiveDataView`, `DataToolbar`, `FilterChips`, `Pagination`, `MetricCard`, `DetailSummary`, `ActivityTimeline`, `StatusBadge`, `PriorityChip`).
3. **Overlays, Dialogs & Feedback** (`Modal`, `ConfirmDialog`, `Drawer`, `Toast`, `AlertBanner`, `Alert`).
4. **Accessible Keyboard & Focus Behavior** (Focus trapping, initial focus, return focus, Escape key closing, body scroll locking, and ARIA live regions).

---

## 2. Component System Inventory & Contracts

### A. Page Framing & State Handling

| Component | Path | Purpose & Capabilities |
|---|---|---|
| `PageFrame` | `apps/web/src/components/ui/PageFrame.tsx` | Standardized enterprise page container supporting `eyebrow`, `title`, `description`, `actions`, `showBack`, `backTo`, and `children`. Handles responsive padding and title scaling. |
| `PageState` | `apps/web/src/components/ui/PageState.tsx` | Unified multi-state engine covering 10 operational states: `loading`/`skeleton`, `empty` (with action button/link), `unauthorized` (session recovery link), `forbidden` (RBAC access explanation), `not-found` (404 back navigation), `unavailable` (service error with retry), `stale` (out-of-date banner with refresh), `partial-success` (batch partial failures), `error` (actionable message with retry), and `retry`. |
| `SectionHeader` | `apps/web/src/components/ui/SectionHeader.tsx` | Consistent section headings with optional actions and subtitle. |
| `FormSection` | `apps/web/src/components/ui/FormSection.tsx` | Structured grouping for complex forms with clear labels and separation. |

### B. Data Display & Operational Controls

| Component | Path | Purpose & Capabilities |
|---|---|---|
| `DataTable` | `apps/web/src/components/ui/DataTable.tsx` | Accessible table with sort headers (`aria-sort`), hover states, and dense typography. |
| `ResponsiveDataView` | `apps/web/src/components/ui/ResponsiveDataView.tsx` | Automatically transforms desktop tabular data into accessible mobile cards/lists (`dl`/cards) below 768px. |
| `DataToolbar` | `apps/web/src/components/ui/DataToolbar.tsx` | Layout-only toolbar orchestrating search, filter controls, batch actions, and active filter chips. |
| `FilterChip` / `FilterChips` | `apps/web/src/components/ui/FilterChips.tsx` | Removable filter tags with count badges and clear-all triggers. |
| `Pagination` | `apps/web/src/components/ui/Pagination.tsx` | Compact enterprise pager with first/last anchors, page size selectors, live summary, and disabled boundary handling. |
| `MetricCard` | `apps/web/src/components/ui/MetricCard.tsx` | Provenance-backed KPI cards with trend delta indicators, urgency pills, sparklines, and definition popovers (date range, timezone, scope, as-of time). |
| `DetailSummary` | `apps/web/src/components/ui/DetailSummary.tsx` | Structured key-value fact lists (`dl`, `dt`, `dd`) for candidate identity and workflow metadata. |
| `ActivityTimeline` | `apps/web/src/components/ui/ActivityTimeline.tsx` | Ordered event timeline (`ol`) with actor avatars, timestamps, and audit event links. |
| `StatusBadge` | `apps/web/src/components/StatusBadge.tsx` | Canonical status badges mapped to 7 semantic color tokens with non-color-only text indicators. |
| `PriorityChip` | `apps/web/src/components/ui/PriorityChip.tsx` | High/Medium/Low priority chips with semantic warning/danger/info tokens. |

### C. Overlays, Dialogs & Feedback

| Component | Path | Purpose & Capabilities |
|---|---|---|
| `Modal` | `apps/web/src/components/Modal.tsx` | Accessible dialog (`role="dialog"`, `aria-modal="true"`) with focus trapping, Escape key closing, backdrop click dismissal, and return focus to trigger element. |
| `ConfirmDialog` | `apps/web/src/components/ConfirmDialog.tsx` | Structured decision dialog supporting danger/warning/success/primary tones, loading states, and optional required decision comments. |
| `Drawer` | `apps/web/src/components/ui/Drawer.tsx` | Slide-in side drawer with focus trap, body scroll lock, Escape dismissal, responsive full-width mobile view, and custom width variants (`narrow`, `standard`, `evidence`). |
| `Toast` / `AlertBanner` | `apps/web/src/components/ui/Toast.tsx` | Accessible live notifications with `role="status"` / `role="alert"` and semantic tones (`success`, `error`, `info`, `warning`). |

---

## 3. Forbidden Anti-Patterns & Usage Rules

1. **No Ad-Hoc Page States**: Do not create page-local empty/error/loading spinners. Always use `<PageState kind="..." />`.
2. **No Hardcoded Hex Colors**: All components must consume semantic design tokens (`--color-action`, `--color-surface`, `bg-rf-action-soft`, `text-rf-ink`, etc.).
3. **No Unaccessible Overlays**: Modals and drawers must always manage focus trapping, provide Escape key handling, and return focus to the trigger element on close.
4. **No Untyped Status Badges**: Do not style badges with custom random colors; use `<StatusBadge status={...} />`.
5. **No Layout Shifts on Loading**: Use `<TableSkeleton />`, `<MetricCardSkeleton />`, or `<DetailSkeleton />` with matched dimensions rather than unconstrained spinners where data structure is known.

---

## 4. Automated Quality Gate Certification

All 6 repository quality gates passed with **Exit Code 0**:

| Gate | Scope / Command | Result | Notes |
|---|---|---|---|
| **TypeScript Typecheck** | `pnpm typecheck` | **PASS (0 errors)** | Full monorepo check across `apps/web`, `apps/api`, `apps/worker`. |
| **ESLint** | `pnpm lint` | **PASS (0 warnings, 0 errors)** | Enforced with `--max-warnings=0`. |
| **Unit Test Suites** | `pnpm test` | **PASS (22 files, 63 tests)** | 52 web tests, 11 API tests passing cleanly. |
| **Production Build** | `pnpm --filter web build` | **PASS (1.30s)** | Clean client build with code-splitting. |
| **Design Token Audit** | `pnpm check:design-tokens` | **PASS (81 strict files)** | 0 token violations across all UI components. Legacy production budget at 367/370. |
| **Bundle Size Audit** | `pnpm check:bundle` | **PASS** | Main JS: **243.47 KB** (<= 300 KB budget). Main CSS: **223.78 KB** (<= 225 KB budget). |

---

## 5. Automated Browser Verification Matrix

Executed via `tests/browser/f3_components_verification.py` across 12 viewport & theme combinations and 8 Axe accessibility scans:

| Width | Theme | Page Tested | Focus & State Checks | Axe Result | Status |
|---|---|---|---|---|---|
| **1440px** | Light | `/design-system`, `/candidates` | PageFrame, MetricCards, DataTable, Badges, Search Toolbar | 0 violations | **PASS** |
| **1440px** | Dark | `/design-system`, `/candidates` | Dark semantic tokens, contrast verification | 0 violations | **PASS** |
| **1280px** | Light | `/design-system`, `/candidates` | Standard desktop layout, no overflow | N/A | **PASS** |
| **1280px** | Dark | `/design-system`, `/candidates` | Dark theme rendering, border glow | N/A | **PASS** |
| **1024px** | Light | `/design-system`, `/candidates` | Compact desktop grid, pagination controls | 0 violations | **PASS** |
| **1024px** | Dark | `/design-system`, `/candidates` | Compact desktop dark theme | 0 violations | **PASS** |
| **768px** | Light | `/design-system`, `/candidates` | Mobile card transformation (`ResponsiveDataView`), touch targets | 0 violations | **PASS** |
| **768px** | Dark | `/design-system`, `/candidates` | Mobile card dark theme | 0 violations | **PASS** |
| **430px** | Light | `/design-system`, `/candidates` | Pro Max mobile view, 0 horizontal scroll | N/A | **PASS** |
| **430px** | Dark | `/design-system`, `/candidates` | Pro Max dark theme | N/A | **PASS** |
| **375px** | Light | `/design-system`, `/candidates` | Standard mobile view, scrollWidth <= innerWidth + 1 | 0 violations | **PASS** |
| **375px** | Dark | `/design-system`, `/candidates` | Standard mobile dark theme | 0 violations | **PASS** |

---

## 6. Generated Visual Artifacts

The following visual evidence artifacts and JSON test summaries have been saved to `tests/artifacts/browser/`:

- `f3-components-1440-light.png`
- `f3-components-1440-dark.png`
- `f3-components-1280-light.png`
- `f3-components-1280-dark.png`
- `f3-components-1024-light.png`
- `f3-components-1024-dark.png`
- `f3-components-768-light.png`
- `f3-components-768-dark.png`
- `f3-components-430-light.png`
- `f3-components-430-dark.png`
- `f3-components-375-light.png`
- `f3-components-375-dark.png`
- `f3_components_verification.json`

---

## 7. Stage F3 Certification Sign-off

Stage F3 is fully completed, certified, and ready as the foundation for **Stage F4 (Home & Command Center)** and **Stage F5 (Search & Quick Create)**.

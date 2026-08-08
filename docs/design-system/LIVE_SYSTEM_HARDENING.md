# RecruitFlow live design-system hardening

Status: `DS-LIVE-01` in progress  
Product boundary: V1 Light mode only

This document is the handoff for the live React implementation of the approved reference contract. It defines what “9/10” means operationally; it is not a claim that every route is already migrated.

## Quality scorecard

| Area | Baseline before DS-LIVE-01 | Target gate | Evidence |
|---|---:|---:|---|
| Semantic tokens | 5/10 | 9/10 | `apps/web/src/styles/tokens.css`; no new undefined aliases |
| Shared primitives | 5.5/10 | 9/10 | `apps/web/src/components/ui/` and primitive state CSS |
| Shell and navigation | 6/10 | 9/10 | Light shell, top collapse control, search, notifications, keyboard focus |
| Forms and feedback | 6.5/10 | 9/10 | Shared fields, error icon/message, alerts, loading and empty states |
| Responsive behavior | 7/10 reference / unverified live | 9/10 | 375/768/1024/1440 browser checks |
| Page parity | 5/10 | 9/10 | Domain migration checklist, one route group at a time |
| Accessibility | 6.5/10 | 9/10 | Names, focus, keyboard order, contrast, reduced motion, semantic states |

Scores are internal delivery signals. The gate is evidence-based: a route is not considered migrated because its screenshot looks close.

## Current live contract

### Source files

- `apps/web/src/styles/tokens.css` — semantic light tokens and compatibility aliases.
- `apps/web/src/styles/ui-primitives.css` — shared buttons, icon buttons, fields, alerts, cards, status badges, stepper, and legacy class aliases.
- `apps/web/src/styles/shell.css` — shell layout, account context, notification badge, and top sidebar collapse behavior.
- `apps/web/src/components/ui/` — React primitives: `Button`, `IconButton`, `FormField`, `Alert`, and `Card`.
- `apps/web/src/pages/DesignSystemPage.tsx` — live laboratory and acceptance showcase.

### Interaction rules

- V1 uses Light mode only. No theme toggle, dark-mode token, or dark-mode acceptance scenario may be added.
- Desktop controls are compact; touch/coarse pointers receive a minimum 44px target.
- Every icon-only control has an accessible label.
- Primary actions use the blue/indigo/cyan action gradient. Gradients are not used as status replacements.
- Neon treatment is reserved for one decision-critical focus card or metric per view.
- Destructive decisions use an outlined danger button until confirmation; irreversible confirmation uses a filled danger action.
- Loading preserves layout, exposes `aria-busy`, disables the action, and announces the loading label.
- Errors include an icon and explanatory text; color alone is never the only signal.
- Reduced motion removes sheen, transforms, shimmer, and pulse while preserving state meaning.

## Migration order

1. `DS-LIVE-01` — tokens, primitives, shell, login, live laboratory. **Implemented; build gate passed.**
2. `DS-LIVE-02` — shared page frame, headers, metrics, tables, filters, and status badges across Dashboard, My Tasks, Notifications, and approvals.
3. `DS-LIVE-03` — request/opening and candidate/intake route groups; remove page-level inline colors and one-off button classes.
4. `DS-LIVE-04` — pipeline, interviews, scorecards, offers, and hiring/joining route groups; migrate stepper, drawers, and decision states.
5. `DS-LIVE-05` — administration, reports, integrations, audit, and trust states.
6. `DS-LIVE-06` — browser/accessibility/performance gate and final reference parity review.

Each slice must remain small enough for one reviewer to compare against the reference and must update `progress.md` before the next slice begins.

## Verification gate

Required for each live slice:

- `npm --prefix apps/web run build`
- `git diff --check`
- Browser checks at `375px`, `768px`, `1024px`, and `1440px` for changed routes.
- Keyboard focus and accessible-name checks for all changed interactive controls.
- Reduced-motion check where animation or transitions changed.
- No new dependency, route, API claim, credential, or dark-mode behavior without an approved contract.

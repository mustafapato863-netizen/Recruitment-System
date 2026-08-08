# RecruitFlow Enterprise Visual Identity

## Brand idea

**Signal to hire.** RecruitFlow turns hiring activity into visible ownership, evidence, and momentum.

The identity should feel dependable to HR leadership, fast for recruiters, clear to managers, and respectful to candidates.

## Brand personality

- Clear, not cold.
- Confident, not loud.
- Operational, not bureaucratic.
- Evidence-led, not over-automated.
- Modern, not trendy.

## V1 theme boundary

V1 ships **Light mode only**. Dark mode, monochrome variants, and additional theme families are post-V1 exploration and must not be added to V1 acceptance criteria, page scope, or component variants.

## Logo direction

- Keep the existing `R` idea as a recognizable product mark, but move away from the purple gradient treatment.
- Use a solid navy/blue mark with a simple motion/signal cue that remains readable at 16px.
- Wordmark: `RecruitFlow`; product descriptor: `Recruiting Operations`.
- Never place the logo inside a decorative gradient, glass panel, or noisy hero treatment.
- V1 uses the light lockup only. Dark, monochrome, favicon, and tenant co-brand lockups are post-V1 exploration.

## Color system

| Token | Hex | Meaning |
|---|---|---|
| Ink 950 | `#0F172A` | Primary text, shell, high-confidence navigation |
| Ink 700 | `#334155` | Secondary text and supporting labels |
| Action 700 | `#1D4ED8` | Primary action, links, active navigation |
| Action 600 | `#2563EB` | Hover and interactive emphasis |
| Surface 0 | `#FFFFFF` | Cards and primary workspace surface |
| Surface 50 | `#F8FAFC` | Application canvas and quiet regions |
| Border | `#CBD5E1` | Dividers, table borders, field boundaries |
| Success | `#15803D` | Completed, healthy, joined |
| Warning | `#B45309` | Pending, due, SLA risk |
| Danger | `#B91C1C` | Failed, blocked, destructive |
| Info | `#0369A1` | Informational and in-progress context |

Rules: status colors require text/icon support, all text must meet WCAG AA, and primary blue is the only product action accent. Avoid a second decorative accent family.

## Typography

- Primary family: Plus Jakarta Sans or an approved self-hosted equivalent.
- Display: 28-36px, weight 700, tight but readable line-height.
- Page title: 24-28px, weight 700.
- Section title: 16-18px, weight 700.
- Body: 14-16px, line-height 1.5.
- Compact metadata: 12-13px, Ink 700 or stronger; never use tiny gray text for essential information.
- Numbers: tabular numerals for KPI/table values.
- Product language: English-first for the current application, with Arabic translation and RTL readiness designed into tokens and layouts rather than mixed into individual pages.

## Geometry and density

- 8px base spacing grid.
- 6px controls, 8px cards/rows, 12px dialogs/drawers.
- 44px minimum interactive target.
- Comfortable density for managers; Compact density for recruiters; Spacious density for executives.
- Data tables use visible row hierarchy, filter bars, column settings, bulk actions, and pagination.
- Cards are for decisions and summaries, not as a replacement for every table.

## Shell identity

- Sidebar: deep navy or white with blue active state; no purple gradients.
- Header: organization/workspace switcher, breadcrumbs, global search, My Work, notifications, help, account menu.
- Footer account area: avatar, full name, role, organization, environment, account menu; sign out is a normal menu action with a 44px target.
- Collapse: integrated into the sidebar rail/header with an explicit accessible label and persistent state.
- Main canvas: light neutral background with a consistent max-width and predictable vertical rhythm.

## Interaction identity

- Primary action verbs: Create, Submit, Approve, Request changes, Assign, Schedule, Review, Send, Verify, Complete.
- Every mutation shows pending, success, and failure feedback.
- Confirmation is used for irreversible/destructive actions, not routine navigation.
- Hover changes color/border, not layout position.
- Motion is short and purposeful: navigation transition, drawer open, inline validation, or status change only.

## Page templates

1. **Command page**: context header, primary next action, work queue, compact health summary.
2. **List page**: header, search/filter/saved view bar, table or board, bulk actions, pagination.
3. **Detail page**: identity header, status/owner panel, primary workflow, evidence/timeline, next action rail.
4. **Approval page**: assigned queue, decision context, evidence, history, explicit decision controls.
5. **Configuration page**: current published version, draft changes, impact preview, validation, audit trail.
6. **Insights page**: question-led dashboard, filters, chart/table alternative, drill-down, saved/scheduled output.

## Accessibility and trust

- No color-only status or permission signal.
- Semantic headings and landmarks on every route.
- Keyboard navigation, focus restoration, visible focus ring, accessible dialogs/drawers.
- Clear loading, empty, error, forbidden, and retry states.
- No fake data, fake success, unexplained AI, or unsupported compliance claims.

## Visual review checklist

- Does the page look like RecruitFlow even without the logo?
- Is the next action obvious for the current role?
- Can a user identify owner, status, SLA, and evidence in five seconds?
- Does the page hand off to the next story page with context preserved?
- Does the screen remain usable at 375px, 768px, 1024px, and 1440px?
## Component interaction reference update — 2026-08-08

The offline reference now includes a complete component laboratory and written frontend handoff at `docs/reference/ui-ux/COMPONENT_INTERACTION_REFERENCE.md`.

Controlled gradients are allowed for the page canvas, primary actions, selected navigation, and one decision-critical neon focus card. They must remain tokenized, accessible, and reduced-motion safe. Data surfaces remain solid and readable. Every interactive component documents default, hover, focus-visible, pressed, selected, disabled, loading, success, warning, error, and empty states. The reference grid is 12 columns on desktop, 8 on tablet, and 4 on phone with declared gutters, gaps, max width, and collapse behavior.

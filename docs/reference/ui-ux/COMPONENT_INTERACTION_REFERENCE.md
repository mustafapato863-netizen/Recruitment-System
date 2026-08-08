# RecruitFlow Frontend Component & Interaction Reference

This document is the implementation contract for the offline UI/UX reference in `app/`. It exists to keep frontend pages visually consistent and to prevent one-off design decisions.

## 1. Product visual rule

RecruitFlow is an enterprise recruiting-operations product. The UI should feel calm, accountable, and operationally dense. Use gradients to communicate hierarchy, not decoration:

| Allowed gradient use | Rule |
|---|---|
| Page canvas | A very low-contrast navy/blue atmosphere behind readable white surfaces. |
| Primary action | Blue → indigo → cyan fill; 200% background size; animate position only on hover/focus. |
| Selected sidebar item | Blue/cyan tint with a 3px action rail and selected icon. |
| Neon focus card | One decision-critical metric or readiness card per view; cyan/violet edge and soft pulse. |
| Data surfaces | Solid or near-solid surfaces. Do not put text over animated gradients. |

Neon is an accent edge, not a full-page theme. Never use neon as the only status signal; pair it with a label, icon, or text.

## 2. Semantic tokens

Use semantic tokens instead of page-specific hex values.

| Token | Value | Use |
|---|---:|---|
| `--canvas` | `#F8FAFC` | Page background |
| `--ink-950` | `#0F172A` | Primary text and brand mark |
| `--ink-700` | `#334155` | Secondary text |
| `--border` | `#CBD5E1` | Dividers and control borders |
| `--primary` | `#1D4ED8` | Primary action and selected state |
| `--p2` | `#2563EB` | Hover and active blue |
| `--neon-cyan` | `#22D3EE` | Focus edge and accent glow |
| `--neon-violet` | `#7C3AED` | Secondary neon stop only |
| `--orange` | `#C2410C` | Decision, risk, attention |
| `--green` | `#15803D` | Success, readiness, outcome |
| `--red` | `#B91C1C` | Destructive/error |
| `--gradient-action` | blue → indigo → cyan | Primary buttons only |
| `--gradient-selection` | blue/cyan translucent | Sidebar selection and selected controls |
| `--gradient-neon` | blue → violet → cyan | Neon card border and focus accent |

## 3. Grid contract

Every new page must declare its grid before implementation.

| Viewport | Container | Columns | Gutter | Gap | Default behavior |
|---|---:|---:|---:|---:|---|
| 1440+ | max `1720px` | 12 | `32px` | `24px` | Full shell with sidebar and decision rail |
| 1024–1439 | fluid | 12 | `24px` | `20px` | Reduce rail width before stacking |
| 768–1023 | fluid | 8 | `24px` | `20px` | Main/aside may become 5/3 or stack |
| 375–767 | fluid | 4 | `16px` | `16px` | Stack main content; keep tables intentionally scrollable inside their region |

Required page recipes:

- Dashboard: `6` metric cards → `8/4` operational content → `6/6` supporting cards.
- List/inbox: full-width toolbar → full-width table → optional `4`-column summary rail.
- Detail: `8`-column evidence area → `4`-column decision/ownership rail.
- Wizard: `8`-column form → `4`-column readiness/validation rail.
- Profile: full-width identity header → `8/4` content split → full-width application/history section.
- Kanban: full-width horizontal stage region; scroll belongs to the kanban region, never the entire page.
- Mobile: one column for primary work, fixed bottom navigation only on mobile reference screens.

## 4. Component states

Every interactive component must define all applicable states:

| State | Visual behavior | Motion |
|---|---|---|
| Default | Solid surface, border, readable label | None |
| Hover | Border/action color becomes clearer; optional 2px lift | `180–220ms`, ease standard |
| Focus-visible | 2–3px cyan outline with offset | No layout shift |
| Pressed | 1px downward movement or darker fill | `80ms` |
| Selected | Gradient selection fill, primary label/icon, action rail | `180–220ms` |
| Disabled | 40–50% opacity, no hover, no pointer action | None |
| Loading | Preserve size; spinner/skeleton replaces content | Shimmer/spin only while waiting |
| Success | Green label/icon plus explanatory copy | Single short confirmation |
| Warning | Orange label/icon plus required next action | No continuous alarm |
| Error | Red label/icon plus impact and recovery | No shake; focus the invalid control |
| Empty | Explain why empty and provide one next action | None |

Reduced motion must remove transforms, glow pulse, shimmer, and animated gradient movement while preserving color, focus, and state meaning.

## 5. Component contracts

### Cards

- Default card: solid surface, `1px` border, `10–12px` radius, no permanent shadow.
- Interactive card: add hover border and a maximum `2px` lift; never shift neighboring layout.
- Neon focus card: one per page at most; use `--gradient-neon` as border, subtle cyan/violet glow, and a visible label explaining why it is important.
- Card anatomy: title → context/helper text → content → optional action. Keep actions aligned to the card header or footer, never floating ambiguously.

The reference loading state uses the tokenized dual-ring dotted `.loader`: action blue outer ring, cyan inner ring, `2s` / `1s` counter-rotation, inherited size tokens, and the existing reduced-motion fallback. Keep the loading region size stable while it runs.

### Stats / metrics

- Label: `11px`, muted, sentence case.
- Value: `27–30px`, strong ink, tabular numbers where available.
- Footnote: one comparison or next action, not a paragraph.
- Accent rule: blue for operational volume, orange for risk, green for readiness, cyan for active work, red for failure.
- Never use a colored number without a label and time/context.

### Buttons

- Use sentence case consistently: `Create vacancy`, `Save draft`, `More options`.
- One primary button per page section. Label with a verb: `Create`, `Approve`, `Submit`, `Save`, `Open`.
- Primary: gradient action fill, white label, hover keeps the fill stable, lifts `1px`, and runs one smooth 45° sheen; pressed uses a subtle inset state.
- Secondary: solid surface with border; hover gets blue border and focus uses the shared `2px` keyboard ring.
- Selected: `#0B57D0` label on the light blue selection surface; never use a low-contrast pale-blue label.
- Quiet/ghost: transparent until hover, medium-weight label, and a subtle hover fill or icon; use only for low-risk actions.
- Approve: filled success green. Reject: outlined danger red with spacing from approve to reduce accidental activation; require confirmation for irreversible changes.
- Loading: preserve the same button width, replace the label with a spinner inside the same button, set `aria-busy="true"`, and provide a visually hidden status label.
- All buttons: default, hover, focus-visible, pressed, disabled, and loading states must be represented in the component contract.
- Buttons use a compact `36px` desktop control height (`32px` for explicit compact actions); touch/mobile controls expand to a `44px` hit area. Keep the shared focus ring in every state.
- Icon-only controls use a `36px` desktop visual size and expand to `44px` on touch/mobile, with `aria-label`, `title` where useful, and visible focus.
- Hover sheen: every actionable button may show one 45° diagonal highlight on entry; it must not loop, restart while the pointer remains inside, or run under reduced motion.

### Additional component recipes

- Fields: use real `input`, `select`, and `textarea` controls with associated labels, `aria-invalid` for errors, `aria-describedby` for recovery text, and a visible disabled state.
- Switches: use a real button with `role="switch"`, `aria-checked`, keyboard support, and a text label; never use a clickable `span` as the control.
- Status pills: keep stage meanings stable across candidates, vacancies, offers, and hiring cases. Pair color with text.
- Avatars: show initials/name context and use presence dots only as supporting status, never as the only identity signal.
- Tables: use real table semantics, scoped column headers, visible selected rows, and 40px pagination controls with labels.
- Tabs and segmented controls: use buttons with `role="tab"`/`aria-selected` or `aria-pressed`; keep the selected state visible without color alone.
- Dialogs: use `role="dialog"`, labelled title/body, a 44px close target, clear decision hierarchy, and a focus trap in the live implementation.
- Feedback: toasts use `role="status"` for non-blocking confirmation and `role="alert"` for failures; inline recovery remains close to the affected surface.
- Upload: expose a labelled file input, accepted file types, progress, and recovery guidance; never imply parsing or storage that is not implemented.
- Filters and saved views: use buttons for removal and selection, preserve active state, and keep pagination separate from filtering.
- Timeline and stepper: use ordered list semantics, actor/time context, and `aria-current="step"` for the active workflow position.

### Sidebar and selection

- Place the collapse control in the sidebar header beside the brand, matching the Codex-style top-shell affordance; do not bury it in the account footer.
- Sidebar selection is a gradient fill plus action rail; never rely on bold text alone.
- Hover applies a low-opacity blue/cyan tint and a maximum `2px` horizontal nudge.
- Counts are compact badges and remain visible when the sidebar is collapsed.
- Collapse must preserve icon meaning, provide a tooltip/accessible label, and never hide the current context.

### Forms and inputs

- Label above control; required marker next to label; helper text below only when needed.
- Default height `40px`, mobile hit area `44px` or more.
- Focus uses the shared cyan ring; invalid uses red border + message + recovery hint.
- Select menus preserve the same radius, border, and focus treatment as text inputs.
- Do not use browser validation bubbles as the primary error explanation.

### Tables and lists

- Toolbar: search first, then most-used filters, then overflow filters/actions.
- Header labels are concise and uppercase only when the table is dense.
- Row hover is a surface tint, not a transform.
- Row actions appear at the right and remain keyboard reachable.
- Empty, loading, error, and permission states replace the table body without changing the page grid.

### P0 audit closure rules

- Irreversible confirmation: the cancel action is secondary, while the final destructive action is a filled danger button (`.danger-solid`) with a verb that names the consequence. The decision pair must be separated enough to prevent accidental activation.
- Validation: every invalid control has `aria-invalid="true"`, points to recovery text with `aria-describedby`, and shows a visible error icon plus explanation. Color alone is never the error signal.
- Restricted navigation: a feature unavailable because of role or policy is not rendered as a faded disabled control. Keep the label readable, add a lock affordance, explain the restriction with `title`/accessible text, and use `cursor: help`.
- Selection: a selected-count summary is allowed only when row checkboxes are visible. Provide a select-all checkbox, one labelled checkbox per row, `aria-selected="true"` on selected rows, and a keyboard-reachable overflow action for each row.

### Critical recruiting workflow recipes

- Mobile stepper: at phone widths, use a compact vertical variant with `aria-current="step"`, explicit `Step n of m` context, complete/current/pending labels, and no document-level horizontal overflow.
- Drawer: preserve list context with `480px`, `640px`, and `800px` width recipes; the body scrolls independently, the close control is labelled, and decision actions remain in a sticky footer.
- Date/time picker: expose real date/range controls, a labelled calendar grid, selected date, timezone, available slots, and conflict/past-date recovery text before submission.
- Interview Calendar: use a compact week grid with timezone, previous/next/today navigation, a selected view mode, day-level interview counts, open capacity, clickable interview events, and a visible conflict state. On narrow screens, keep the grid internally scrollable without causing document overflow. Events must have descriptive accessible names; conflicts must explain the resolution required before booking.
- Bulk actions: show the selection count only while selection controls exist; place the most common action first, keep destructive actions secondary until confirmed, and provide a labelled clear-selection control.
- Dropdown: use `role="menu"` and `role="menuitem"`, visible focus, disabled semantics, and document Arrow keys, Enter, and Escape behavior.
- Pipeline board: show five compact stage cards per desktop row, then wrap additional stages below instead of creating horizontal page overflow. Include stage/WIP context, draggable/focusable cards, a visible drop zone, overflow count, and at most one neon focus card for the decision-critical candidate.
- Interview scorecard: group ratings by competency, use labelled radio semantics, validate required evidence per category, and expose one selected overall recommendation.
- Comments thread: use ordered comments with actor/time, visible `@mention` treatment, nested replies, a labelled multiline composer, formatting toolbar, and attachment input.

### Alerts, badges, and timelines

- Badge color is paired with text; use dot + label, not color alone.
- Alert includes icon, title, impact/reason, and next action when action is possible.
- Timeline uses one primary action color for completed/current and semantic colors for blocked or risky steps.

## 6. Motion contract

| Motion | Duration | Trigger |
|---|---:|---|
| Hover/focus color | `150–220ms` | Pointer/keyboard enters |
| Button press | `80ms` | Pointer down |
| Page/drawer enter | `180–300ms` | View opens |
| Skeleton shimmer | `1500ms` loop | Data is loading |
| Neon attention pulse | `3500ms` loop | Only for designated focus card |
| Toast confirmation | `180ms` in / `150ms` out | Action completes |

Do not animate layout dimensions, table rows, or dense content on every hover. Prefer opacity, border, background, and a small transform.

## 7. Page handoff matrix

| Chapter | Primary page role | Main card focus | Primary CTA | Handoff |
|---|---|---|---|---|
| Command Center | Executive/recruiter overview | Risk and workload | Open work | My Work or opening |
| My Work | Accountable queue | Due/overdue work | Complete/Open | Related record |
| Workforce & Openings | Demand and approval | Request readiness | Create/Approve | Opening |
| Talent & Intake | Candidate identity and capture | Duplicate/consent state | Add/Import | Application |
| Hiring & Interviews | Evidence-based selection | Scorecard/decision | Schedule/Submit | Offer or rejection |
| Joining & Compliance | Readiness gates | Missing document/license | Request/Approve | Joining |
| Insights | Drill-down analysis | KPI exception | Open report | Source record |
| Administration & Trust | Configuration and evidence | Permission/integration health | Configure/Review | Governed workflow |

## 8. Frontend delivery checklist

Before accepting a page:

- [ ] Page purpose, owner, next action, and handoff are visible.
- [ ] Grid recipe is documented for 1440, 1024, 768, and 375px.
- [ ] Every button, card, input, badge, table, and navigation item has states.
- [ ] Gradient use follows the allowed list; no noisy gradient behind dense data.
- [ ] Neon is limited to the designated focus surface and is not the only signal.
- [ ] Hover, focus-visible, pressed, disabled, loading, success, warning, error, and empty states are represented.
- [ ] Reduced-motion behavior removes movement but preserves meaning.
- [ ] Keyboard focus order and hit areas are usable.
- [ ] No page-specific hex values or one-off radii were introduced.

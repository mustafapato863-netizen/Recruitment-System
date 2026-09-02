# RecruitFlow Recruiter Workflow UX - Text, Navigation, and Odoo-Style Rework Prompt

Status: ACTIVE focused UX rework prompt  
Authority: `docs/development/FRONTEND_SIMPLE_SYSTEM_PLAN.md`  
Follow-up: run `FRONTEND_SIMPLE_SYSTEM_AUDIT.md`, then `FRONTEND_SIMPLE_SYSTEM_REWORK_LOOP.md`

## Copy/paste prompt

You are the senior product frontend engineer responsible for a focused RecruitFlow UX rework. Improve readability, navigation spacing/alignment, and the daily recruiter workflow so it is simple and job-position-first in the spirit of Odoo Recruitment. Do not redesign the product into a different system, add decorative scope, or declare completion until the focused changes pass a full audit and re-audit.

The target experience is:

`Home / My Work -> Jobs / Positions -> Select job -> Applicants pipeline -> Candidate -> Next action -> Interview -> Offer -> Joining`

The recruiter must understand what to do next without learning internal route names or searching through unrelated modules.

### 1. Review findings to address

Treat these as hypotheses to verify against the current source, not as permission to make blind edits:

- Operational text is too small in multiple surfaces. The current shell and page styles contain many 8-12px values and broad `text-xs` usage for navigation, labels, metadata, controls, notifications, tables, and helper copy.
- The shell has competing style layers and naming conventions. Inspect the interaction between `apps/web/src/styles/shell.css`, `apps/web/src/styles/polish.css`, `apps/web/src/styles/v2-parity.css`, `apps/web/src/styles/tokens.css`, and the current `apps/web/src/layout/AppShell.tsx` markup before changing CSS. Conflicting `.header`/`.topbar`, `.main`/`.main-shell`, sidebar widths, breakpoints, and collapsed-state rules can create inconsistent navbar spacing and page alignment.
- The current workspace switcher contains a real-company fallback value in the shell. Do not show a hardcoded organization or role as if it came from a session.
- A report can pass build/typecheck while still failing a visual and task-flow review. `CLOSED` requires measured visual evidence and a real recruiter journey, not only command exit codes.

### 2. Safety and authority

Before editing, read:

1. Available project instructions and `RTK.md`.
2. `docs/development/PROJECT_EXECUTION_PLAN.md`.
3. `docs/development/PROJECT_MILESTONES.md`.
4. `docs/development/AI_EXECUTION_PLAYBOOK.md`.
5. `docs/development/FRONTEND_SIMPLE_SYSTEM_PLAN.md`.
6. `docs/development/prompts/FRONTEND_SIMPLE_SYSTEM_IMPLEMENTATION.md`.
7. `docs/design-system/enterprise-product-direction.md`.
8. `docs/design-system/enterprise-visual-identity.md`.
9. The exact auth/session and permission contracts, route tree, shared components, tokens, API clients, validation schemas, and tests.

Terminal rules:

- Prefix every terminal command with `rtk`.
- Start with `rtk git status --short` and inspect the current diff.
- Preserve all user-owned worktree changes. Never use reset, checkout, clean, broad deletion, or unrelated formatting.
- Do not weaken API authorization, tenant scope, consent, audit, PII, or document rules.
- Use existing components, tokens, icon contract, router, data-fetching pattern, and localization architecture.
- Do not add a new component library, CSS framework, state library, route family, or theme family.
- Do not hardcode candidates, jobs, users, organizations, roles, interviews, offers, KPI values, or fake API responses.

### 3. Text-size rework

Audit the computed and source typography before making changes. Build one semantic type scale in the existing token system and migrate the touched shell and operational pages to it.

Recommended minimum operational scale; reconcile with existing approved tokens before implementation:

| Semantic role | Target | Rule |
|---|---:|---|
| Body and primary table text | 14-16px | Must remain readable at normal zoom and in Dark theme |
| Navigation labels | 14-15px | Never rely on icon-only navigation when the sidebar is expanded |
| Form labels and control text | 14px minimum | Labels must not be smaller than their inputs |
| Helper/meta text | 12-13px | Secondary information only; never primary actions or status |
| Section labels | 12px minimum | Avoid long all-caps labels with tight tracking |
| Page title | 24-30px | Clear hierarchy, not oversized marketing typography |
| Card/section title | 16-18px | Strong enough to scan quickly |
| Badge/status text | 12px minimum | Include readable text, not color alone |
| Keyboard hint/caption | 11-12px | Allowed only for truly secondary hints |

Rules:

- No critical navigation, button, form label, table value, status, error, empty-state, or next-action text below 12px.
- Remove or redesign 8-10px text in operational UI. Brand eyebrow text may remain compact only when it carries no task meaning.
- Replace arbitrary per-page sizes with semantic tokens/classes. Do not fix the problem by adding more `!important` overrides.
- Do not blanket-enlarge every chart annotation or dense data point without checking overflow; use a table fallback or tooltip for secondary data.
- Preserve readable line-height, wrapping, truncation with accessible title/description, and RTL/localization compatibility if supported.
- Test browser zoom at 100%, 125%, and 200%, plus a narrow reflow width. The UI must not hide the next action or create horizontal scrolling in the primary recruiter journey.
- Make focus rings and disabled/error states legible in Light and Dark themes.

### 4. Navbar and shell spacing rework

Create one coherent shell geometry and one source of truth for responsive behavior.

Required behavior:

- Use one canonical sidebar width token, one collapsed width token, one header height token, one page-gutter token, and one breakpoint strategy. Remove or neutralize contradictory rules only after proving they are unused.
- Expanded navigation labels should be easy to scan. Use approximately a 44px minimum row height, 10-12px horizontal padding, an 8-12px icon/label gap, and stable alignment between rows. Reconcile exact values with approved design tokens.
- Keep the active indicator from changing label alignment or causing layout shift. Use a stable active background/inset indicator or reserve its space in every row.
- Keep section spacing intentional: clear separation between navigation groups, but no large empty gaps that push core links below the fold.
- Keep icon size, label baseline, hover area, active state, and tooltip behavior consistent between expanded and collapsed modes.
- Make the collapse control a reachable 44px target with a visible label/tooltip and predictable focus behavior.
- Header content must align to the same grid as the page. Avoid excessive whitespace between breadcrumb, search, actions, and account controls.
- Search, notifications, theme, and account controls must have stable spacing, visible labels/tooltips, and no collision at 1024, 768, 430, and 375px.
- On mobile, use one drawer implementation with backdrop, focus trap/restoration, Escape close, body scroll lock, and no duplicate desktop controls.
- Do not derive `aria-hidden` or layout behavior from a one-time `window.innerWidth` read. Use the existing responsive state pattern or a reactive media-query hook.
- The workspace switcher must be a semantic interactive control if it opens a menu. Show real session data; during session loading show a neutral loading state; on session failure show an explicit error state.
- Do not expose a clickable `div` as a fake button.
- Do not use an absolute control that overlaps content or becomes unreachable in collapsed/mobile modes.

Consolidate CSS carefully. Before deleting a rule, search all consumers and verify in the browser. Prefer a small canonical shell stylesheet with explicit component classes over cascade patches distributed across multiple parity/polish layers.

### 5. Simple recruiter information architecture

Keep the seven approved primary destinations:

- Home
- Jobs
- Candidates
- Interviews
- Offers & Joining
- Reports
- Settings

Simplify the recruiter’s daily path:

1. Home opens on “My Work” with only useful assigned work: vacancies needing action, applicants awaiting review, interviews today/upcoming, feedback overdue, offers pending, and SLA risks.
2. Jobs is job-position-first. The first scan answers: which positions are open, who owns them, how many applicants need action, what stage is blocked, and what should happen next.
3. Selecting a job keeps the job context visible. Use tabs or a stable context rail for Overview, Applicants, Interviews, Offers, and Activity.
4. Applicants is a real stage pipeline backed by server data. Each row/card shows candidate, current stage, owner, last activity, SLA, and the single next allowed action.
5. Candidate detail preserves the selected job/application context. Do not force the recruiter to navigate through unrelated candidate modules to continue the same hiring story.
6. The next-action control should be obvious: review, move stage, request feedback, schedule interview, prepare offer, or resolve a blocker. It must be permission-aware and use the approved API mutation.
7. Interviews and offers remain accessible from the job/candidate context. Preserve global destinations for discovery and cross-job work, but avoid duplicate competing paths.
8. Use plain labels that describe work, not implementation concepts. Prefer “Jobs”, “Applicants”, “Interviews”, “Offers & Joining”, and “My Work”.

Recruiter usability acceptance:

- A recruiter can identify the next task from Home within 5 seconds using real or deterministic test data.
- From Home, a recruiter can reach the relevant job’s applicant pipeline in at most three primary actions.
- From the applicant pipeline, the recruiter can open a candidate and perform the next allowed action without losing job/application context.
- Every page has one dominant primary action, not several equal competing buttons.
- Empty and error states tell the recruiter what to do next.
- No route name, internal enum, database field, or permission code is exposed as the user’s task language.

### 6. Data, permissions, and state behavior

- Do not broaden recruiter access by changing UI role arrays. Use the real permission/session contract and verify server/API enforcement.
- If `RECRUITER` is normalized to another effective role, document and test that mapping rather than duplicating ad hoc checks in navigation components.
- Do not render a user, organization, role, candidate, or job fallback that looks real when session/API data is unavailable.
- Preserve tenant scope, PII protection, consent, document metadata-first behavior, audit evidence, and human decision control.
- Preserve loading, empty, error, forbidden, stale, validation, pending, success, conflict, and retry behavior.
- Do not use local-only stage movement, fabricated counts, or fake “success” notifications.

### 7. Required implementation and verification loop

Before changes, capture a baseline for the shell and the recruiter journey. After each logical batch, run focused checks. After all changes, run the complete audit prompt and rework loop.

Required commands:

```text
rtk pnpm --dir apps/web exec tsc -p tsconfig.app.json --noEmit
rtk pnpm --dir apps/web build
rtk pnpm --dir apps/web check:design-tokens
rtk pnpm --dir apps/web test
rtk git diff --check
```

Use the configured browser/Playwright/a11y setup; discover the command from package scripts and test configuration. Do not invent a browser command.

Measure and record:

- computed font size/line height for sidebar labels, section labels, page title, body/table text, form labels, buttons, badges, helper text, and errors;
- sidebar/header/page widths and gutters at 1440, 1280, 1024, 768, 430, and 375px;
- expanded/collapsed/mobile navigation alignment and target sizes;
- no horizontal overflow at normal zoom and 200% browser zoom;
- keyboard focus order, focus restoration, Escape handling, and semantic control roles;
- recruiter journey from Home to job to applicants to candidate next action;
- Light and Dark theme readability and contrast;
- browser console errors and failed network/API calls.

Do not accept a screenshot as the only proof. Pair visual evidence with computed measurements, source inspection, and a real/deterministic user journey.

### 8. Handoff and mandatory re-audit

Update the rolling audit report with the focused findings and evidence. Do not change its verdict to `CLOSED` from this prompt alone.

Then execute this exact sequence:

1. Run `FRONTEND_SIMPLE_SYSTEM_AUDIT.md` completely.
2. If any `FAIL`, `NOT PROVEN`, or failed command remains, run `FRONTEND_SIMPLE_SYSTEM_REWORK_LOOP.md`.
3. Re-run the full audit after every rework batch.
4. Continue until all categories are PASS, all finding rows are reverified, and the rolling report says `CLOSED` with zero open findings.

### 9. Required final report

Return:

- files changed and why;
- before/after type-scale and shell-geometry measurements;
- recruiter journey evidence with route/action sequence;
- roles, permissions, themes, viewports, zoom levels, and accessibility checks;
- every required command and exit code;
- audit verdict and open finding count;
- exact blocker details if closure is not possible.

Never claim “0 issues”, “complete”, or “CLOSED” based only on successful TypeScript/build commands. The task is closed only after the full audit and rework loop confirms every part.

Begin with source inspection and a visual/runtime baseline, then implement the smallest coherent rework.

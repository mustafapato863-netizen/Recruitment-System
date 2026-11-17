# RecruitFlow — Notion-Inspired System Design Specification

**Version:** 1.0  
**Date:** 28 October 2026  
**Status:** Design and implementation requirements; not implemented  
**Requested direction:** Simple Notion-inspired design, consistent recognizable icons, Saudi German Health colors, selective smooth animation and measured performance improvement  
**Delivery plan:** [Phased implementation plan](employee-experience-implementation-plan.md)  
**Execution tracker:** [Employee Experience Recovery](../.scratch/employee-experience-recovery/spec.md)

## 1. Design decision and precedence

**Notion becomes the primary visual reference across RecruitFlow.** Adopt its restrained page structure, quiet surfaces, readable information hierarchy and consistent icon placement. SGH provides the brand identity. Odoo continues to guide workflow, Linear guides daily-work prioritization/density, and Ashby guides pipeline behavior.

This supersedes earlier requirements for an operational glass/neumorphic desk, prominent glowing controls, large decorative gradients and animated backgrounds on the redesigned screens. Preserve the business workflow and existing components where appropriate while updating their presentation coherently. Historical audits and reference images remain evidence; they are not the final styling contract where they conflict with this document.

The objective is a modern recruitment tool that looks polished because it is clear, consistent and responsive. This specification does not promise a pixel-identical Notion clone or assert that Notion uses the repository's icon library.

## 2. System coverage and delivery boundary

The visual target covers all user-facing routes: employee workspace, manager/team workspace, specialist approval/licence/interviewer views, administration/settings/reports, and authentication/careers/candidate portal/self-scheduling surfaces.

Implementation starts with the shared shell and employee journey in Phases 1–7. Phase 8 adds a route-by-route visual rollout to the remaining surfaces before final integrated acceptance. Existing screen functions, role-specific navigation and information permissions remain in force. Administration and public flows receive presentation/accessibility changes and required regressions; this does not authorize new admin workflows, new integrations or changed hiring policy.

Build a coverage inventory from the actual route tree, including detail, error and public token routes. Shared token changes can affect pages early; verify those consumers immediately rather than waiting until Phase 8. Page-specific cleanup then removes residual visual differences. Do not leave half of the system using the previous glass style at the final acceptance gate.

## 3. Core visual language

| Area | Required direction |
| --- | --- |
| Canvas | Calm neutral light background; neutral dark equivalent through canonical theme tokens |
| Panels | Solid surfaces with subtle borders; elevation only when needed to establish an overlay |
| Hierarchy | Strong page/record title, short supporting text, then grouped working content |
| Branding | SGH logo and controlled cyan/emerald accents; most content stays neutral |
| Navigation | Compact, recognizable icon+label rows or the existing bar; one consistent selected state |
| Data | Clear rows, restrained cards, aligned numeric properties and explicit status text |
| Actions | One primary action in each task/record context; secondary actions use quiet controls |
| Corners | Modest shared radii instead of large rounded containers everywhere |
| Motion | Short, purposeful transitions that clarify an interaction or outcome |

Retain the existing navigation architecture unless a workflow requirement calls for a change. A Notion-inspired appearance does not require replacing the compact employee navigation with a large document sidebar or adding unrelated destinations.

### Surfaces and effects

- Remove backdrop blur, inset/raised neumorphic shadows, ambient particle canvases and animated border/glow effects from the redesigned operational surfaces.
- Use a 1px border where a boundary helps scanning. Use a light separator or spacing instead of putting every property inside its own card.
- Keep shadows limited to menus, dialogs and floating elements where needed; ordinary task rows/cards remain flat.
- Preserve the branded logo geometry. Brand gradients may remain in official artwork; ordinary panel backgrounds and primary buttons use simple token-based fills.
- Use gentle row hover, visible selection and clear focus. Cards do not grow, tilt, float or bounce on hover.

### Typography, density and geometry

Keep IBM Plex Sans and existing font delivery; no new remote font is needed for this redesign. Use the established type hierarchy, adjusted through shared tokens rather than inline screen overrides.

| Element | Starting design target | Validation |
| --- | --- | --- |
| Main page/record title | 24–28px, semibold | Long names wrap without hiding key actions |
| Section title | 16–18px, semibold | Visually distinct from body content |
| Desktop working text | 14–15px | Readable at normal zoom |
| Secondary metadata | 12–13px | Adequate contrast; not used for essential instructions |
| Mobile form inputs | At least 16px text | Readability and practical touch interaction |
| Spacing | Shared 4/8/12/16/24/32px steps | Consistent rhythm, fewer nested padded wrappers |
| Control radius | Shared target around 6–8px | Migrate tokens after auditing consumers |
| Card/panel radius | Shared target around 8–12px | Same family across routes and themes |
| Interactive area | At least 44×44px where practical for touch | Density cannot make required controls unusable |

These are proposed token targets, not a claim about current implementation. Keep compact desktop rows and responsive touch layouts coherent. No CSS zoom or whole-interface transforms.

## 4. SGH colors and semantic states

Use the current canonical tokens as the source of truth. The brand reference cyan `#00A3E0` and emerald `#00A859` remain identity accents; do not assume either raw color provides sufficient text contrast on every surface.

| Role | Use |
| --- | --- |
| Primary action | Existing accessible SGH action/deeper-cyan token with measured foreground contrast |
| Selected navigation/view | Subtle brand tint, clear text and a border/indicator where useful |
| Success/completed | Emerald-derived semantic token with a label/check state |
| Warning/attention | Amber semantic token with a reason or waiting label |
| Error/overdue/destructive | Danger token with explicit text; distinguish overdue from a destructive command by context |
| Neutral/in progress | Neutral or information token with the actual state |
| Main/secondary text | Theme-aware ink tokens; subtle does not mean faint or unreadable |

The primary button, selected tab and a completed state must not become interchangeable visual signals. Use accent color selectively instead of assigning a different bright color to each navigation icon.

Acceptance requires normal text contrast of at least 4.5:1, large text at least 3:1, and essential control/focus boundaries at least 3:1 against adjacent colors. Measure all relevant states in Light and Dark. Do not present token-check success as a contrast certification.

## 5. Icons: the same language everywhere

Use a curated set of simple Notion-like monochrome outline symbols with consistent visual weight and placement. The same meaning must use the same icon throughout navigation, My Work, rows, cards and record tools.

**Implementation default:** retain the existing Lucide/shared SVG infrastructure and select glyphs matching the intended Notion-style metaphors. Compare representative reference glyphs during Phase 1. Notion supports several icon sources; no exact one-to-one asset match or specific underlying package has been established. If a particular exact glyph is required, record the reference and the verified asset choice instead of claiming an approximate icon is identical.

| Meaning | Shared glyph direction | Treatment |
| --- | --- | --- |
| My Work | ListChecks | Neutral icon beside readable label |
| Jobs | BriefcaseBusiness | Same symbol in navigation and job tools |
| Candidates | Users | Person identity distinct from an application file |
| Application/file | FileUser or existing suitable shared equivalent | Used consistently for the job application |
| Call | Phone | Labeled call/log-call action |
| Follow-up | Clock | Due time or waiting reason beside it |
| Interview | Calendar / CalendarClock | Scheduling/appointment meaning kept consistent |
| Scorecard | ClipboardCheck | Submitted/outstanding information included |
| Note | MessageSquare / note symbol | Visually different from a document |
| Documents | Files / FileText | Count shown only after a successful read |
| Offer | FileSignature | Accompanied by actual offer state |
| Blocker | TriangleAlert | Explains what is missing and who acts |
| More actions | Ellipsis | Explicit menu with accessible name |

Use 16px for dense metadata, 18px for ordinary controls and 20px for navigation/page context where appropriate; larger page icons are optional when they help identification. Keep one stroke-weight convention. Every standalone utility icon needs an accessible name, visible focus and a usable hit area. Meaningful workflow commands retain text labels. No random emojis or large colored icon tiles for routine navigation.

## 6. Screen and component requirements

### Shared shell and page header

Use a quiet navigation area, stable search/notifications/account controls and a compact page/record header. Preserve route and role context. Breadcrumbs are secondary; the actual person/job title is primary. On narrow screens, move secondary navigation into the established accessible menu rather than truncating the primary action.

### My Work

Use grouped rows inspired by Linear, rendered in the Notion-style surface language. Each row contains type icon, candidate/job context, due/waiting detail, owner where relevant and one actionable next step. Minimize duplicate metrics. Keep Upcoming interviews and Joining soon accessible. A short list should feel intentional without an oversized empty decorative panel.

### Open jobs and candidate lists

Prefer the existing detailed list by default, with optional cards where useful. Align title, department/site, owner, headcount, due date and pipeline counts. Use subtle row hover and a clear selected state. Missing, hidden, failed and zero values remain distinguishable. Filters are compact and retain state when a record closes.

### Pipeline cards

Use a solid card with name, useful role/job detail, next step/due time and a small state indicator. Avoid redundant rows of badges and large metadata tiles. Preserve stage counts, contextual action and accessible move controls. Board/list layouts use the same source set and permissions. Preserve intentional board scrolling within its region.

### Person and application files

Organize identity and essential properties in a compact header, followed by stage progress and contextual action. Use sections/tabs for detail, activity and documents. Keep call/follow-up/note/documents discoverable with icon+label controls. Separate system activity from recruitment evidence; keep previous/next and safe return context.

### Menus, dialogs and drawers

Use a solid overlay surface, subtle border/shadow and restrained backdrop. Keep fields and error messages aligned and readable. Preserve focus trapping, Escape where appropriate, unsaved-change handling and focus return. The form becomes usable without waiting for its animation to complete.

### Empty and error states

Use a small neutral icon, specific short title, one explanatory sentence and one permitted next action. Distinguish first use, no filter results, no current work, unavailable data and permission restriction. A filtered empty state offers clearing filters; a loading error offers retry. Do not use decorative full-screen illustrations or success messaging for failed reads.

### Manager, specialist, administration and external views

Apply the same type, icons, controls, panels, tables, status and overlay rules. Preserve dense reporting and role-specific tasks. Public/authentication screens may use modest SGH branding but follow the same restrained surfaces and motion rules. Preserve public token, consent, login and upload behavior during visual changes.

## 7. Motion contract

Motion should explain a change or acknowledge input. It must not slow data entry, postpone access to a control, repeat on every refetch or create idle animation work.

| Interaction | Proposed duration | Allowed effect | Reduced-motion behavior |
| --- | --- | --- | --- |
| Hover/pressed control | 80–120ms | Small color/opacity change | Immediate or minimal transition |
| Menu/tooltip open | 120–160ms | Opacity and up to 4px translation | No translation; immediate or brief fade |
| Drawer/dialog open/close | 160–220ms | Opacity and a short appropriate transform | Immediate placement, optional brief fade |
| Tab/content replacement | 100–140ms | Gentle opacity only where helpful | Immediate swap |
| Dragging candidate | Direct pointer/keyboard feedback | Existing drag overlay/transform; short settle | Direct placement without travel animation |
| Saved/completed result | 120–180ms once | Restrained state/icon fade | Immediate state, same announcement |
| Loading | Static skeleton by default | Small spinner only for genuine active work if useful | Static indicator/text |

Use one shared easing/token vocabulary; a suitable default is `cubic-bezier(0.2, 0, 0, 1)`. Prefer CSS transitions for these simple interactions. Reuse an existing motion dependency only when it provides a measured need that CSS/current primitives cannot cover. Adding an animation package is not required by this design.

Animate opacity/transform where practical. Avoid animated layout properties, blur, large shadows, gradients, number counters and full-page transitions. Limit temporary compositor layers; do not apply `will-change` across the entire UI. Clean up listeners/timers and stop offscreen or hidden work. Respect `prefers-reduced-motion` from first render and if the preference changes.

No looping pulse on cards, animated page backgrounds, staggered entrances for every row or confetti in the operational workspace. Do not announce success before the server confirms persistence. Moving an element visually does not change the stage until the valid mutation succeeds.

## 8. Performance requirements and measurement

The redesign is intended to improve performance; a simpler appearance alone is not proof of improvement. Phase 0 records the current build; ticket 21 captures comparable before/after measurements and the work responsible for any improvement.

### Implementation requirements

- Route-split existing employee/admin/public modules; keep PDF/Word/import/chart dependencies off the initial path until needed.
- Import only used icons; avoid loading an entire alternate icon package or icon font to imitate a reference.
- Remove unused effect code from affected import paths after checking other consumers; do not delete a dependency globally when another route still needs it.
- Avoid broad rerenders, duplicate reads and unconditional refetch of the entire file after an unrelated section change. Correctness and permission checks still govern cache scope/invalidation.
- Use established paging/windowing patterns for long queues; introduce virtualization only after measuring need and testing focus/selection/drag accessibility.
- Keep layout stable with reserved loading regions and stable keys. Do not reload or remount the shell merely to play an entrance animation.
- Keep idle operational pages free of continuous decorative animation/canvas work. Real polling, reminders and active requests remain explicit and necessary.

### Budget and evidence table

| Measure | Target / current gate | How to validate |
| --- | --- | --- |
| Main JS raw | Existing script limit: 500 KiB | Actual production entry asset; confirm the tool found it |
| Main JS gzip | Existing script limit: 150 KiB | Existing bundle check |
| Main CSS gzip | Existing script limit: 60 KiB | Existing bundle check |
| Main CSS raw | Existing advisory: 225 KiB | Report separately; do not mislabel advisory as hard gate |
| Other route/dependency chunks | Record before/after, not covered by the main-entry limits alone | Build manifest and route/network trace |
| User input feedback | Proposed local p95 target ≤100ms for visible acknowledgement, excluding server completion | At least 20 comparable interactions; record conditions and sample size |
| Warm route/filter behavior | No uninvestigated regression; fix measured bottlenecks and show the before/after result | Same records, build mode, hardware, network/CPU settings and repeatable scenario |
| Animation | Smooth short interaction without avoidable layout/paint-heavy frames | Browser trace on representative desktop/mobile or throttled setup |
| Layout stability | Target CLS ≤0.1 | Lab observation; field validation if available |
| Web Vitals | Field goals LCP ≤2.5s and INP ≤200ms at the 75th percentile | Real-user evidence where available; lab runs are diagnostics, not a field pass |

The existing gate is `scripts/check-bundle-budgets.mjs`, invoked by `rtk proxy pnpm check:bundle` after a production build. Baseline violations require an explicit remediation decision; do not loosen limits to make the redesign pass. Confirm all expected entry files were found so missing assets cannot produce a false success.

Capture cold and warm navigation separately, repeat runs and report sample counts. Compare request count/bytes, entry and route chunks, long tasks, interaction feedback, render/paint behavior and idle animation activity. A faster form animation does not establish a faster API. No current performance gain is claimed by this specification.

## 9. Implementation integration

| Plan phase | Required design work |
| --- | --- |
| 0 | Inventory routes/effects/icons/style imports and record comparable performance baseline |
| 1 | Implement the Notion-inspired SGH token/component contract and motion/reduced-motion examples |
| 2 | Ensure navigation, failures and action-state changes use the new controls without hiding data errors |
| 3 | Apply compact queue rows, useful icons and restrained update feedback to My Work |
| 4 | Apply the same person/intake/activity/empty-state language |
| 5 | Apply shared list/card/pipeline rules and efficient scoped interactions |
| 6 | Deliver the file layout, contextual tools and mobile containment under the new visual contract |
| 7 | Keep interview/offer/check/approval/joining states consistent across roles and overlays |
| 8 | Complete visual route coverage (20), verify performance/motion (21), then integrated acceptance (18) and release decision (19) |

Ticket IDs remain stable; the last phase executes **20 → 21 → 18 → 19**. Dependencies, not numeric filename order, determine the execution sequence.

## 10. Acceptance checklist

- [ ] Every route in the coverage inventory has a reviewed design status; no legacy visual island remains without an explicitly recorded exception.
- [ ] The shell, rows, cards, tables, forms, menus and overlays share the same neutral/SGH presentation in both themes.
- [ ] Icon meanings, sizes and placement are consistent; meaningful commands remain labeled and reachable.
- [ ] Required loading, empty, error, denied, disabled, selected, success and closed states are complete.
- [ ] All changed surfaces are usable at 375, 768, 1024 and 1440px with no document-level horizontal overflow.
- [ ] Keyboard, accessible names, focus containment/return, contrast and practical touch targets are verified.
- [ ] Motion follows the duration/property contract and reduced-motion behavior; meaningful updates remain understandable without it.
- [ ] Effects/import cleanup preserves other consumers and removes measured unnecessary work from the affected paths.
- [ ] Existing bundle budgets pass and before/after measurements show the actual result, including unresolved bottlenecks.
- [ ] Role/tenant/ownership/pay boundaries and hiring business scenarios continue to pass after visual changes.

Store design/motion/performance evidence under `artifacts/employee-experience-recovery/` when implementation creates it. This document is planning output; the application has not been restyled or benchmarked by creating it.

## 11. Source references

The visual intent is a design interpretation of the user's reference. Notion's official documentation describes page icons and customization; it does not establish a shared icon package or these RecruitFlow component/motion values: [Notion page styling and icons](https://www.notion.com/help/customize-and-style-your-content), [Notion gallery properties](https://www.notion.com/help/galleries).

Performance implementation guidance: [Compositor properties and layer management](https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count). Field performance targets and their interpretation: [Core Web Vitals thresholds](https://web.dev/articles/defining-core-web-vitals-thresholds). Durations and local budgets in this document are proposed project requirements, not copied vendor measurements.

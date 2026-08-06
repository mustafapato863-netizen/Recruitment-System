# RecruitFlow design system

## Ownership

- `packages/design-system/src/` is the shared implementation source for tokens and reusable UI primitives.
- `apps/web/` consumes the shared system and owns feature composition.
- `docs/reference/ui-ux/` contains visual reference material only; it is not runtime application code.

## Visual direction

The approved reference uses a light enterprise workspace: purple primary accent, neutral surfaces, compact data tables, clear status badges, role-aware actions, and responsive approval/interview workflows.

## Reference screen

The complete visual token and component reference is available at:

`docs/reference/ui-ux/app/pages/44_design_system.html`

Do not copy prototype CSS into feature pages. Update shared tokens/primitives and then compose them in the relevant feature.

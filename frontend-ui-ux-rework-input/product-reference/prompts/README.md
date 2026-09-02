# RecruitFlow Agent Goal Prompts

Use one implementation prompt at a time, in the order in `PROJECT_MILESTONES.md`. Run `REVIEW_PHASE.md` after each goal. The master plan is the release authority; `FRONTEND_SIMPLE_SYSTEM_PLAN.md` fixes the intended frontend experience and scope.

For the frontend redesign implementation, use `FRONTEND_SIMPLE_SYSTEM_IMPLEMENTATION.md` as the execution prompt. It is an operational prompt, not a second planning authority.

For completion control, use the prompts in this order:

1. `FRONTEND_SIMPLE_SYSTEM_AUDIT.md` - read-only evidence audit and rolling finding report.
2. `FRONTEND_SIMPLE_SYSTEM_REWORK_LOOP.md` - fix findings, re-audit after every batch, and repeat until every part is closed.

For readability, navbar spacing/alignment, and the simplified recruiter workflow, use `FRONTEND_RECRUITER_WORKFLOW_UX_REWORK.md` before the full audit/rework sequence.

Before work, read `AGENTS.md`, the master plan, this folder's assigned prompt, the exact current source, and only the relevant product/page/design contract. Read `task_plan.md`, `findings.md`, and `progress.md` only when the task explicitly provides them or is resuming a tracked multi-step run. Historical reports are claims, not proof.

Never replace the product, discard a dirty worktree, bypass API/RLS/audit, add mock production fallbacks, or claim checks were run when they were not. Use existing repository commands and components. Update the three planning records only when the task explicitly owns a tracked multi-step run.

Prompts are intentionally concise. Their linked source paths and external references are starting points, not a substitute for inspecting the exact implementation.

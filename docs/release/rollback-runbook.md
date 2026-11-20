# RecruitFlow V2 — Blue/Green Production Rollback Runbook (Gate R0)

## Purpose
[V2Shell.tsx](../../apps/web/src/layout/V2Shell.tsx) always mounts the V2 authenticated shell regardless of `v2Enabled` or `RF_V2_SEATS`. Per [v2-complete-replacement-programme.md](../v2-complete-replacement-programme.md) Gate R0 (Option B), production rollback is executed via **atomic blue/green deployment switching** to a frozen, known-good V1 web + API release artifact rather than runtime feature-flag toggles.

## Pre-Cutover Checklist
1. **Pin Known-Good V1 Artifact ("Blue"):**
   - Record the exact Git SHA, container image digest / Vercel deployment ID, and Prisma schema version of the last verified V1 release (`origin/live`).
2. **Additive-Only Database Migrations During Bake:**
   - All Prisma migrations applied during the 14-day V2 production bake (e.g., `20261118_user_branch_assignment` adding nullable `branch_id` on `users`) MUST be additive and backward-compatible with V1 queries.
   - Never drop columns, rename tables, or tighten NOT NULL constraints without a default until the 14-day rollback-free bake completes.
3. **Storage & Session Compatibility:**
   - Cookie names, JWT claims, and document storage paths remain identical between V1 and V2 so active sessions and uploaded CVs survive a traffic switch without re-login or broken links.

## Rollback Execution Steps (< 5 Minutes)
1. **Trigger Condition:** Any P0 defect in production (unauthorized data disclosure, broken stage/approval/joining mutation, or unrecoverable auth failure).
2. **Switch Web & API Traffic to Blue (V1):**
   - Repoint the load balancer / Vercel production alias and API service router to the pinned Blue (V1) deployment artifact.
3. **Worker & Queue Safety:**
   - Scale V2 background workers to `0` and resume the pinned V1 worker pool against the shared PostgreSQL database.
4. **Post-Rollback Smoke Verification:**
   - Verify `/api/health`, login (`/login`), application list, offer approval, and document download on the restored V1 deployment.
   - Confirm zero data loss in `audit_logs`, `applications`, `offers`, `hiring_cases`, and `candidate_documents`.

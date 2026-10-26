# Hiring Click-Path Matrix (Phase 0)

**Date:** 26 October 2026  
**Baseline:** Hiring V2 on `main` at `e3602a1`  
**Purpose:** Document the current end-to-end hiring click paths so Phase 1+ can reduce context loss while keeping compliance gates, RBAC, and audit unchanged.

This matrix covers the primary recruiter path from Applied/Screening through Joined. Manager, interviewer, and approver paths are noted where they diverge. All gates listed are enforced server-side.

---

## Stages and Gates (Current V2)

| Stage | Primary next action (`primaryFor`) | Required gate to advance | Drawer opened |
|-------|------------------------------------|---------------------------|---------------|
| Applied / Screening | Log screen (if no screen note) | Screen note saved | `screen` |
| Applied / Screening | Schedule interview (if screen note exists) | — | `schedule` |
| Interview | Schedule interview (if none live) | — | `schedule` |
| Interview | Open scorecard (if interview done, scorecard missing) | Scorecard submitted | `scorecard` |
| Interview | Draft offer (if scorecard exists) | — | `offer` |
| Offer | Draft / Revise offer | — | `offer` |
| Offer | Submit for approval (Draft) | — | `waiting` |
| Offer | View approval (Pending) | — | `waiting` |
| Offer | Send offer (Approved) | — | `send` |
| Offer | Record answer (Sent) | — | `answer` |
| Offer | Move to Pre-hire (Accepted) | Offer accepted | `prehire` |
| Pre-Hire | Pre-hire checklist | Required joining checks verified | `prehire` |
| Joined | — | — | — |

Gates (from `apps/web/src/v2/api/gates.ts`):

- `GATE_SCREEN_NOTE_MISSING` — Interview needs a saved screen note
- `GATE_SCORECARD_NOT_SUBMITTED` — Offer needs a submitted interview scorecard
- `GATE_OFFER_NOT_ACCEPTED` — Pre-hire needs an accepted offer
- `GATE_JOINING_CHECKS_INCOMPLETE` — Joined needs required checks verified
- `GATE_REJECT_REASON_REQUIRED` — Reject needs a reason

---

## Primary Recruiter Click Path (Happy Path)

| Step | Starting place | Action | Lands on | Drawer / next UI | Gate enforced | Notes |
|------|----------------|--------|----------|------------------|---------------|-------|
| 1 | My Work or Open Jobs | Open job | `/vacancies/:id` (Pipeline) | — | — | Kanban of applications |
| 2 | Pipeline | Click candidate card or “Move to” | `/applications/:id` | — | — | Application File opens |
| 3 | Application File (Applied/Screening) | Click primary “Log screen” | Same file | `?drawer=screen` | Screen note | Must save note before Interview |
| 4 | Application File | Click primary “Schedule interview” | Same file | `?drawer=schedule` | — | After screen note |
| 5 | Application File (Interview) | After interview completed | Same file | `?drawer=scorecard` | Scorecard | Interviewer may open via My Interviews |
| 6 | Application File | Click primary “Draft offer” | Same file | `?drawer=offer` | Scorecard submitted | — |
| 7 | Application File | Submit for approval | Same file | `?drawer=waiting` | — | Manager/approver decides |
| 8 | Application File | Send offer (after approval) | Same file | `?drawer=send` | — | — |
| 9 | Application File | Record answer | Same file | `?drawer=answer` | — | Acceptance unlocks Pre-hire |
| 10 | Application File | Move to Pre-hire | Same file | `?drawer=prehire` | Offer accepted | Checklist opens |
| 11 | Application File (Pre-Hire) | Complete required checks | Same file | `?drawer=prehire` | Joining checks | SCFHS / ID / Contract etc. |
| 12 | Application File or classic | Confirm joining | File or `/joinings` / `/hires/:id` | — | Checks complete | Headcount updates; may still hit classic pages |

**Context loss points (current):** Steps 1→2, and any jump to classic pages for joining confirmation, licenses, or final approval inbox. My Work links often go to the file without pre-opening the drawer.

---

## Divergent Paths

### Interviewer

- My Work or My Interviews → scorecard on the interview.
- Limited destinations (interviewer-only users stay near `/my-interviews`).
- Scorecard submission unlocks Offer for the recruiter.

### Manager / Approver

- Team Work or Final approvals inbox (`/hires/approvals/inbox` — classic).
- Offer approval/rejection via waiting/offer drawers or classic pages.
- Can open the file in manager/approver mode (read-only for some actions).

### License Specialist / Final Hiring Approver

- Special home: `/licenses` or `/hires/approvals/inbox` (classic).
- Joining checks and final approval still route through classic pages in many cases.

### Reject / Withdraw

- Application File → reject drawer (requires reason).
- Gate: `GATE_REJECT_REASON_REQUIRED`.

---

## Entry Points Summary

| Entry | Typical next | Pre-opens drawer? | Notes |
|-------|--------------|-------------------|-------|
| My Work (actions) | Application File or related page | Partial | Links exist; `?drawer=` not always set |
| Open Jobs → Pipeline | Application File | No | Card click goes to file |
| Candidates list | Application File or bank | No | — |
| Classic pages | Various | No | Still active for hires, licenses, offers list, calendar |

---

## Phase 0 Completion Criteria

- [x] Stages and gates documented
- [x] Primary recruiter happy path mapped
- [x] Divergent roles noted
- [x] Context-loss points identified
- [ ] Local V2 delta vs `main` confirmed (still open if local work exists)
- [ ] Classic page inventory verified against live routes (implicit from `App.tsx` + `destinations.ts`)

**Next:** Use this matrix to implement Phase 1 (Smart Action Bar on Application File) so the primary action is always visible and the correct drawer opens without leaving the record. Gates, RBAC, and audit stay unchanged.

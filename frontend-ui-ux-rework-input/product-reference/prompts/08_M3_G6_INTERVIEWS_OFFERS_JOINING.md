# M3-G6 — Interviews, Calendar, Offers, and Joining

Goal: complete the human-controlled post-application workflow with clear schedule, evaluation, approval, and readiness evidence.

Read first: `AGENTS.md`, master plan M3, blueprint sections 3, 7–8, current interview/calendar/scorecard/offer/approval/joining services, permissions, workflow policy, schema/tests, and planning records.

Implement real list/detail journeys for interview scheduling/rescheduling/cancellation, agenda/calendar discovery, participant access, structured scorecards, offer review/approval/issuance/decision, and joining readiness. Calendar is a view of persisted interviews; it must have an accessible agenda/list alternative. Scorecards belong to assigned interviewers and are immutable/versioned after the policy's submit point. Offer and joining actions follow existing approval/transition rules and are audited.

Do not make calendar invitations/email dependencies mandatory before M7, expose participant data out of scope, auto-advance candidates from recommendations, or substitute fake schedule/offer data. Test role/tenant restrictions, direct route denial, transition validation, cancellations/reschedules, scorecard access, audit trail, themes, responsive calendar fallback, keyboard/focus behavior, and empty/error/loading states. Document commands and browser evidence.


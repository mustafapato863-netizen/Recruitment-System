# M3-G5 — Candidate Directory and Candidate 360

Goal: deliver a governed searchable candidate directory and one coherent Candidate 360 record.

Read first: `AGENTS.md`, master plan M3/M5, blueprint sections 7–8, 10–11, candidate/CV/application/talent-pool/document routes/services/schema/permissions/tests, and planning records.

Implement or repair Candidates table: real server search, filters, sorting, pagination, accessible row actions, consent/freshness signals, and scoped visibility. Candidate 360 must connect identity/contact, consent/eligibility, structured CV summary, skills/experience, documents, applications, interviews, pools, notes/activity, and audit-aware actions. Use progressive disclosure—do not duplicate a generic card grid. Ensure documents and contact data follow effective scope; never expose raw storage URLs.

Employee sees only assigned candidate work; Manager sees only scoped hiring candidates; Administrator sees tenant scope. Creation/editing must use server validation, duplicate policy, audit, and tenant enforcement. Do not create applications or decisions automatically from viewing/parsing. Test allowed/forbidden role and tenant, direct candidate/document paths, search/pagination isolation, duplicate/error handling, light/dark/responsive/keyboard behavior, and data absence states. Update evidence records.


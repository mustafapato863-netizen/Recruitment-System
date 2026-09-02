# M5-G1 — CV Bank, Structured Profile, and Parsing Review

Goal: provide secure CV Bank operations and editable structured-CV review on top of Candidate 360.

Read first: `AGENTS.md`, master plan M5, blueprint sections 8, 11, 13, current file storage/upload/parser/candidate/consent/retention APIs, schema, security tests, and planning records.

Implement CV Bank index/detail and secure upload/download/metadata workflow using real backend state. Show parsing status and an editable review form for title, experience, skills, education, certifications, licenses, source, consent, freshness, and document version/history. Require server validation and permission checks for every file metadata and content action. Define stable state labels for queued/processing/review-ready/failed/unavailable without pretending parsing succeeded.

Do not treat parsed text as a hiring decision, create applicants automatically, expose raw object-storage URLs, send files across tenants, or delete referenced documents without retention/dependency approval. Test harmful file/name/type/size validation as applicable, role/tenant file access, parse failure/retry visibility, document version history, consent restrictions, themes/responsiveness/keyboard behavior, and audit activity. Record storage/backup risks and executed checks.


# M6 — Explainable Human-Controlled Talent Matching

Goal: implement deterministic, versioned CV-to-position matching only after structured profiles and sourcing requirements are real and tested.

Read first: `AGENTS.md`, master plan M6, blueprint sections 10–13, current candidate/vacancy requirement/profile/matching/permissions/audit/report code and tests. Inspect whether prerequisite M5 contracts are actually complete; stop and report any P0 prerequisite gap.

Define structured vacancy requirements and deterministic hard eligibility gates first: required skills, minimum experience, required education/certification/license, and lawful eligibility constraints. Then implement versioned explainable scoring. Each result shows score/fit tier, scoring version, matched evidence, missing requirements, unknowns, source profile data, and calculated time. Persist only as policy permits and audit recruiter actions.

Allowed human actions may include review, shortlist, add to Talent Pool, or explicit application creation with confirmation/reason and existing workflow controls. Matching must never automatically contact, reject, move, shortlist, or create an application. Do not use protected characteristics/proxies or unexplained semantic AI as a gate. Test hard-gate determinism, scoring/version reproducibility, missing evidence, tenant/scope isolation, audit, fairness/outcome monitoring hooks, and clear accessible UI at all required themes/widths. Record methodology and limits.


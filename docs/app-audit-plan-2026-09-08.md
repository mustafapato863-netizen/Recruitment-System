# Full application audit

Scope: read-only local application audit; report bugs and enhancement priorities without changing product code or data.

1. Run current engineering checks and broad browser route checks — complete.
2. Inspect API contracts, permissions, navigation, and recruiter workflows — complete.
3. Produce evidence-backed findings, coverage limits, and phased acceptance criteria — complete.

Output: full-app-audit-2026-09-08.md. The audit identified B01-B12; the focused repair pass resolved B01-B11 in source, added contract/regression coverage, and verified B07 on a fresh API instance at port 3001. B12 remains a session-lifetime/refresh observability follow-up after a long matrix run logged 401s. Web 153/153, API 58/58, worker 4/4, and the fresh 132-check route matrix pass. CSS and design-token budgets remain above threshold.

Tooling notes: initial speculative vacancy-requests module paths were absent; continued with actual files and live API responses. Two plan/document patches were rejected for missing context; no file changes occurred and corrected patches were applied.

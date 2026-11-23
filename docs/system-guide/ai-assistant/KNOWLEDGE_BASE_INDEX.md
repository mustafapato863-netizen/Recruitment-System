# AI Assistant Knowledge Base Indexing & Retrieval Guide

This directory packages the full `RecruitFlow v0.2.0` System Guide into a turnkey retrieval kit usable across hosted Custom Assistants and custom vector pipelines.

---

## 1. Ingestion Options by Platform

| Target Platform | Recommended Files to Upload / Index | Settings |
|---|---|---|
| **Gemini Gem / Claude Project / ChatGPT Custom GPT** | Upload `SYSTEM_PROMPT.md` as System Instructions; attach `docs/system-guide/README.md`, `01`–`06`, and `ROLE_PLAYBOOKS_AND_FAQ.md` as Knowledge Files. | Cite exact routes, gates & error codes from attached files only. |
| **Vector RAG Pipeline (pgvector / Pinecone / Qdrant)** | Ingest [`KNOWLEDGE_CHUNKS.jsonl`](KNOWLEDGE_CHUNKS.jsonl) directly (each line is a self-contained JSON record with structured metadata filters). | Filter by `seat_scope` / `audience` before answer synthesis so candidates or recruiters do not receive admin-only internals unnecessarily. |
| **Assistant QA / CI Evaluation** | Run all prompts in [`ASSISTANT_EVAL_CASES.md`](ASSISTANT_EVAL_CASES.md) after prompt or model updates. | Require 100% pass on privacy (`OFFER_PAY_VIEW`) and gate (`GATE_*`) guardrails. |

---

## 2. `KNOWLEDGE_CHUNKS.jsonl` Schema

Each line in [`KNOWLEDGE_CHUNKS.jsonl`](KNOWLEDGE_CHUNKS.jsonl) is a valid JSON object containing:

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Stable chunk identifier (e.g., `rbac-pay-visibility`) |
| `topic` | `string` | High-level domain (`architecture`, `rbac`, `workflow`, `frontend`, `api`, `database`, `worker`, `security`, `ops`) |
| `title` | `string` | Short searchable heading |
| `audience` | `string[]` | Intended consumers (`recruiter`, `manager`, `admin`, `approver`, `license_specialist`, `interviewer`, `candidate`, `developer`, `ops`) |
| `seats` | `string[]` | Relevant workspace seats (`employee`, `manager`, `admin`, `public`) |
| `routes` | `string[]` | Relevant frontend paths from `SCREEN_ROUTES` |
| `api` | `string[]` | Relevant `/api/v1/...` endpoints |
| `models` | `string[]` | Relevant Prisma model names from `database/prisma/schema.prisma` |
| `error_codes` | `string[]` | Exact server `code` strings from `@recruitflow/contracts` |
| `summary` | `string` | Dense factual reference content |

---

## 3. Refresh Workflow

Whenever routes, controllers, Prisma models, worker sweepers, or system docs change:
1. Update the affected chapter in `docs/system-guide/`.
2. Update corresponding entries in `KNOWLEDGE_CHUNKS.jsonl` and `ROLE_PLAYBOOKS_AND_FAQ.md`.
3. Run `node scripts/verify-system-guide.mjs` to validate full coverage and valid JSONL formatting.

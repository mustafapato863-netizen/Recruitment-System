# RecruitFlow Enterprise SaaS Product Plan

## 1. Product decision

RecruitFlow should not present itself as a miniature Workday or a generic ATS. The strongest commercial position is:

> A workflow-first recruiting operations platform for mid-market and multi-entity organizations where every opening has an owner, every candidate has a next action, every decision has evidence, and every executive metric drills into the underlying record.

This gives the product a focused wedge while still leaving room to expand toward the enterprise capabilities buyers expect.

This document is a planning contract only. It does not authorize implementation by itself.

Active implementation order and task status are governed only by [`PROJECT_EXECUTION_PLAN.md`](./PROJECT_EXECUTION_PLAN.md). Small-model execution rules are governed by [`AI_EXECUTION_PLAYBOOK.md`](./AI_EXECUTION_PLAYBOOK.md). The capability gates later in this document describe product maturity; they are not a second task roadmap.

## 2. Design read

This is an enterprise recruiting operations product for recruiters, hiring managers, HR leadership, interviewers, and administrators. The design language should be calm, high-trust, compact, and operational: enterprise utility UI with clear hierarchy, restrained color, strong data tables, obvious ownership, and deliberate workflows.

Recommended direction: flat enterprise utility, navy/blue trust palette, neutral surfaces, 8pt spacing, 8-12px control radius, minimal shadows, 150-200ms feedback motion, and a density setting that supports both executive scanning and recruiter throughput.

Avoid: purple-gradient identity, decorative glassmorphism, oversized dashboard cards, fake precision, emoji icons, unexplained AI, dead navigation items, and pages that show data without a next action.

## 3. What enterprise providers teach us

| Provider | Proven product discipline | RecruitFlow adoption |
|---|---|---|
| Workday | Central recruiting hub, personal workspaces, action items, skills intelligence, candidate engagement, mobile continuity, real-time analytics | Make the home screen a role-aware work queue, not a static KPI wall |
| Greenhouse | Structured hiring, interview kits, scorecards, task automation, permissions, governance, reporting, integrations | Make evaluation evidence and process consistency first-class |
| Ashby | ATS + CRM + sourcing + scheduling + analytics, conditional approvals, drill-downs, alerts, privacy, openings management | Connect opening planning to execution and make every chart actionable |
| Lever | ATS + CRM, nurture, automation, analytics, consent/data controls, integrations | Add candidate relationship work, not only applicant tracking |
| SAP SuccessFactors | Career sites, global job distribution, talent pools, AI-assisted screening, privacy, APIs, digital offers, lifecycle continuity | Plan candidate experience and global governance as product surfaces |
| Oracle Recruiting | Distinct recruiting roles and scoped object visibility | Make role and data scope visible and testable throughout the UI |

These are capability patterns, not instructions to copy branding or proprietary UI.

## 4. Target market and personas

### Initial ICP

- 100-5,000 employee organizations.
- Multiple branches, legal entities, departments, or approval layers.
- Recruiting teams that have outgrown spreadsheets or a basic ATS.
- Organizations that need evidence, auditability, predictable handoffs, and management reporting but do not want a full HCM replacement.

### Personas and jobs to be done

| Persona | Primary job | Success signal |
|---|---|---|
| Recruiter | Move candidates forward with minimal follow-up | No overdue next actions; shorter time in stage |
| Hiring manager | Request headcount, align on profile, evaluate evidence, approve | Clear requisition status and comparable feedback |
| HR/TA leader | See capacity, funnel health, bottlenecks, and forecast | Trusted drill-down metrics and SLA visibility |
| Interviewer | Prepare, interview, submit structured feedback | Fast scorecard completion with no ambiguity |
| HR operations/admin | Configure roles, workflows, privacy, integrations, and audit | Safe changes with history and rollback/recovery evidence |
| Executive | Understand hiring progress and business impact | One-click path from KPI to accountable record |
| Candidate | Discover, apply, communicate, and understand next steps | Consistent branded experience across devices |

## 5. Information architecture

The app should be organized around work and ownership, not a flat list of modules:

1. **Command Center**: role-aware priorities, hiring health, approvals, overdue work, and alerts.
2. **My Work**: assigned tasks, approvals, interviews, follow-ups, and saved views.
3. **Workforce & Openings**: headcount plans, vacancy requests, openings, ownership, approvals, and fulfillment.
4. **Talent**: candidates, talent CRM, pools, sourcing, imports, consent, duplicates, and communications.
5. **Hiring**: applications, pipeline, interview plans, scorecards, offers, and decision history.
6. **Joining & Compliance**: hiring cases, documents, checks, joining readiness, and handoff to HRIS.
7. **Insights**: executive dashboards, funnel, source quality, SLA/time-in-stage, forecast, diversity, and scheduled reports.
8. **Administration & Trust**: organization, users/roles, policies, workflow templates, integrations, audit, data retention, and support.

### Global shell requirements

- Organization/workspace switcher with current tenant and environment context.
- Global search and command palette across candidates, openings, applications, tasks, and reports.
- Persistent My Work indicator with counts for tasks and approvals.
- Notifications as a cross-cutting utility, not a competing primary workflow.
- Help, support, release notes, and status entry points.
- Account menu with full name, role, tenant, preferences, session/security actions, and a 44px minimum target for sign out.
- Sidebar collapse that preserves labels through tooltips/ARIA and does not create a detached floating control.
- Breadcrumbs and object context on detail pages.

## 6. Enterprise product capabilities

### Required before an enterprise sales claim

- Tenant isolation and organization-scoped authorization on every object and relation.
- RBAC plus scoped data visibility for recruiter, manager, executive, interviewer, admin, and external/agency roles.
- SSO/SAML, SCIM lifecycle, session/security policy, and audit evidence.
- Consent, retention, anonymization, data export/deletion workflows, and regional/privacy policy hooks.
- Private document storage with signed access, malware scanning, extraction status, and failure recovery.
- Configurable approval chains with conditional rules, delegated approvers, SLA/escalation behavior, and immutable decision history.
- Structured interview plans, scorecards, debriefs, and decision records.
- Candidate communications, templates, delivery status, consent, and campaign/nurture history.
- API/webhook contracts, integration health, retries, failure visibility, and credential ownership.
- Reports with filters, saved views, drill-down to records, scheduled delivery, and export governance.
- Supportable onboarding: setup checklist, demo tenant, role templates, configuration validation, and audit-friendly change history.

### Must remain explicitly staged

- AI screening, matching, or recommendations are not marketable until model scope, explainability, human review, privacy, bias monitoring, and opt-out behavior are implemented.
- Compliance badges such as SOC 2, ISO, or GDPR certification are not claims until independently evidenced and approved.
- “Real-time” and “enterprise-grade” are product promises that need measurable SLOs and instrumentation.

## 7. Packaging hypothesis

Do not publish a $5 flat price for the current product. The initial commercial model should be sales-assisted and value-based while usage and support costs are measured:

- **Foundation**: openings, candidate/application workflow, tasks, approvals, core reporting, role templates, and guided onboarding.
- **Growth**: talent CRM, nurture, interview kits, automation, advanced analytics, integrations, and configurable workflows.
- **Enterprise**: SSO/SAML, SCIM, advanced data scope, audit/retention, private documents/scanning, API/webhooks, scheduled reporting, premium support, and implementation services.

Pricing is a later commercial decision. The implementation must first make these packaging boundaries real and enforceable.

The complete page-by-page story and handoff contract is defined in [Enterprise Page Story](./enterprise-page-story.md), and the detailed visual identity is defined in [Enterprise Visual Identity](../design-system/enterprise-visual-identity.md).

## 8. Enterprise phase gates

### E0 - Strategy and product boundary

Deliverables: approved ICP, personas, positioning, capability map, non-goals, packaging hypothesis, success metrics, and decision log.

Gate: product owner approves the wedge and confirms the first paid workflow.

### E1 - Shell and information architecture

Deliverables: role-aware shell, workspace switcher, global search, My Work, account/support menu, navigation taxonomy, breadcrumbs, and responsive behavior.

Gate: recruiter, hiring-manager, and executive journeys can each start from a clear home and reach their next action in three clicks or fewer.

### E2 - Design system

Deliverables: tokens, typography, density modes, table/filter patterns, drawers, forms, approval patterns, empty/loading/error/forbidden states, focus behavior, and responsive rules.

Gate: representative pages look like one product, pass accessibility checks, and do not rely on hardcoded/fake metrics.

### E3 - Operating workspaces

Deliverables: recruiter queue, hiring-manager requisition view, structured pipeline, interview plan/scorecard, offer approvals, and joining handoff.

Gate: one complete opening-to-join flow has ownership, next actions, evidence, permissions, audit, and browser/API tests.

### E4 - Candidate experience and CRM

Deliverables: branded career site foundation, candidate application, communications, nurture, consent, duplicates, talent pools, and source attribution.

Gate: candidate journey works on mobile and every outbound communication has status and consent evidence.

### E5 - Governance and trust

Deliverables: SSO/SAML, SCIM, scoped permissions, retention/anonymization, secure file lifecycle, audit export, support diagnostics, and tenant isolation tests.

Gate: security review passes and every trust claim has evidence.

### E6 - Analytics, integrations, and automation

Deliverables: drill-down dashboards, saved/scheduled reports, webhooks/API, integration health, automation rules, SLA alerts, and observability.

Gate: a leader can answer a business question from dashboard to source record without manual database work.

### E7 - Commercial readiness

Deliverables: automated test suite, performance/accessibility evidence, onboarding guide, demo tenant, support playbook, packaging enforcement, release checklist, and sales-safe capability matrix.

Gate: external demo uses only real capabilities, and unresolved claims are visibly marked as roadmap.

## 9. First implementation decision after approval

The first approved build slice should be E1 plus the minimum E2 foundation, not another isolated page. It must repair the shell shown in the supplied screenshot and establish the reusable enterprise primitives before page-by-page remediation.

## 10. Sources

- Workday Talent Acquisition: https://www.workday.com/en-us/products/talent-management/talent-acquisition.html
- Greenhouse Interviewing and Decision-Making: https://www.greenhouse.com/interviewing-decision-making
- Ashby Enterprise Recruiting: https://www.ashbyhq.com/enterprise
- Lever Recruiting Platform: https://www.lever.co/
- SAP SuccessFactors Recruiting Features: https://www.sap.com/mena/products/hcm/recruiting-software/features.html
- Oracle Recruiting Roles: https://docs.oracle.com/en/cloud/saas/talent-management/faimh/recruiting-roles.html

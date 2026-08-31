# RecruitFlow V1 P3-P9 Completion Plan

This file tracks the task execution for completing P3-P9 phases before P10 release hardening.

## Current Position

- **Status**: P3-P9 in progress → P10 release hardening
- **Plan**: Complete P3-P9 phases with full browser/acceptance evidence
- **Next task**: P3.1 API authentication contract

## P3 - Authentication, Organization Scope & Access Control

### P3.1 API authentication contract (2.0d)
- [ ] P3.1.1 Login endpoint with validation, error codes, rate/lockout
- [ ] P3.1.2 Me endpoint with session behavior
- [ ] P3.1.3 Logout/session refresh behavior
- [ ] P3.1.4 API tests for authentication scenarios

### P3.2 Frontend auth boundary (2.0d)
- [ ] P3.2.1 Login form with password visibility
- [ ] P3.2.2 Error/success states and redirect
- [ ] P3.2.3 Session expiry handling
- [ ] P3.2.4 Browser journey tests

### P3.3 Organization context (2.0d)
- [ ] P3.3.1 Workspace context and organization-scoped queries
- [ ] P3.3.2 Cross-tenant leakage protection
- [ ] P3.3.3 API and browser tests

### P3.4 Role matrix (2.0d)
- [ ] P3.4.1 Role definitions: recruiter, hiring manager, approver, HR admin, interviewer, admin
- [ ] P3.4.2 Route/action permission matrix
- [ ] P3.4.3 RBAC integration tests

### P3.5 Safe disclosure (1.5d)
- [ ] P3.5.1 Missing record vs insufficient access distinction
- [ ] P3.5.2 API tests for forbidden/not-found scenarios
- [ ] P3.5.3 Browser journey tests

### P3.6 Auth tests (2.0d)
- [ ] P3.6.1 Unauthenticated journey
- [ ] P3.6.2 Authenticated journey
- [ ] P3.6.3 Expired session handling
- [ ] P3.6.4 Forbidden scenarios
- [ ] P3.6.5 Wrong organization handling
- [ ] P3.6.6 Invalid input validation

## P4 - My Work, Command Center, Notifications, Approvals

### P4.1 Task and notification contract (1.5d)
- [ ] P4.1.1 Task/notification fields: owner, priority, due date, SLA, related record, unread state
- [ ] P4.1.2 Completion action definition
- [ ] P4.1.3 Integration tests

### P4.2 Metrics and drill-down (2.0d)
- [ ] P4.2.1 Command Center metrics with time range and source
- [ ] P4.2.2 Working drill-down routes
- [ ] P4.2.3 Browser journey tests

### P4.3 Task queue (2.0d)
- [ ] P4.3.1 Filters and overdue states
- [ ] P4.3.2 Saved-view decision
- [ ] P4.3.3 Pagination
- [ ] P4.3.4 Safe bulk actions
- [ ] P4.3.5 Browser journey tests

### P4.4 Notification center behavior (2.0d)
- [ ] P4.4.1 Header popover with typed data
- [ ] P4.4.2 Full list with read state
- [ ] P4.4.3 Retry, keyboard, mobile behavior
- [ ] P4.4.4 Browser journey tests

### P4.5 Approval inbox (3.0d)
- [ ] P4.5.1 Evidence drawer
- [ ] P4.5.2 Comments and request changes
- [ ] P4.5.3 Approve/reject actions
- [ ] P4.5.4 Permission checks and audit event
- [ ] P4.5.5 Browser journey tests

### P4.6 Role journeys (2.0d)
- [ ] P4.6.1 Recruiter flow: alert → record → action → confirmation
- [ ] P4.6.2 Manager flow: alert → record → action → confirmation
- [ ] P4.6.3 Browser journey tests

## P5 - Workforce Requests and Openings

### P5.1 Request create/edit (2.0d)
- [ ] P5.1.1 Fields: organization, branch, department, position, reason, headcount, budget, criticality, target date
- [ ] P5.1.2 Create/edit API tests

### P5.2 Multi-step form (2.0d)
- [ ] P5.2.1 Client validation
- [ ] P5.2.2 Draft save
- [ ] P5.2.3 Readiness checklist
- [ ] P5.2.4 Submit and server errors
- [ ] P5.2.5 Browser journey tests

### P5.3 Request approvals (2.5d)
- [ ] P5.3.1 Sequential/conditional approvers
- [ ] P5.3.2 Comments and request changes
- [ ] P5.3.3 Audit history and ownership
- [ ] P5.3.4 Integration tests

### P5.4 Approved request to opening (2.0d)
- [ ] P5.4.1 One opening per approved request
- [ ] P5.4.2 No position/candidate duplication
- [ ] P5.4.3 Integration tests

### P5.5 Opening list/detail (2.0d)
- [ ] P5.5.1 Owner, aging/SLA, status, headcount, pipeline summary
- [ ] P5.5.2 Next action definition
- [ ] P5.5.3 Browser journey tests

### P5.6 Request-to-opening tests (2.0d)
- [ ] P5.6.1 Budgeted request scenario
- [ ] P5.6.2 Unbudgeted request scenario
- [ ] P5.6.3 Replacement scenario
- [ ] P5.6.4 Rejected scenario
- [ ] P5.6.5 Changes requested scenario

## P6 - Candidate Identity, CV Intake, Applications

### P6.1 Candidate identity (2.0d)
- [ ] P6.1.1 Unique person profile
- [ ] P6.1.2 Contact fields and consent
- [ ] P6.1.3 Source and duplicate keys
- [ ] P6.1.4 Visibility controls
- [ ] P6.1.5 Integration tests

### P6.2 CV/CSV intake (2.5d)
- [ ] P6.2.1 Template preview
- [ ] P6.2.2 Row validation
- [ ] P6.2.3 Batch status
- [ ] P6.2.4 Duplicate decisions
- [ ] P6.2.5 Safe retry
- [ ] P6.2.6 Integration tests

### P6.3 Candidate profile (2.5d)
- [ ] P6.3.1 Identity data separated from application stage
- [ ] P6.3.2 Score, source, owner, status
- [ ] P6.3.3 Browser journey tests

### P6.4 Application operations (2.5d)
- [ ] P6.4.1 Link to opening
- [ ] P6.4.2 Stage transitions
- [ ] P6.4.3 Withdraw/reject/close actions
- [ ] P6.4.4 Owner and next action
- [ ] P6.4.5 Browser journey tests

### P6.5 Pool and consent (2.0d)
- [ ] P6.5.1 Membership management
- [ ] P6.5.2 Source tracking
- [ ] P6.5.3 Retention/consent state
- [ ] P6.5.4 Communication eligibility
- [ ] P6.5.5 Integration tests

### P6.6 Candidate tests (3.0d)
- [ ] P6.6.1 Valid candidate flow
- [ ] P6.6.2 Malformed data handling
- [ ] P6.6.3 Duplicate detection
- [ ] P6.6.4 Withdrawn application
- [ ] P6.6.5 Rejected application
- [ ] P6.6.6 Consent expired handling
- [ ] P6.6.7 Forbidden scenarios

## P7 - Interviews, Scorecards, Decisions, Pipeline

### P7.1 Pipeline stages (2.0d)
- [ ] P7.1.1 Configured stages
- [ ] P7.1.2 Allowed transitions
- [ ] P7.1.3 Stage owner, SLA, reason
- [ ] P7.1.4 Audit event
- [ ] P7.1.5 Integration tests

### P7.2 Interview scheduling (2.5d)
- [ ] P7.2.1 Round and participants
- [ ] P7.2.2 Timezone handling
- [ ] P7.2.3 Meeting details
- [ ] P7.2.4 Reschedule/cancel
- [ ] P7.2.5 Candidate communication state
- [ ] P7.2.6 Integration tests

### P7.3 Structured scorecard (3.0d)
- [ ] P7.3.1 Competencies and ratings
- [ ] P7.3.2 Evidence comments
- [ ] P7.3.3 Required fields
- [ ] P7.3.4 Draft, submitted, locked states
- [ ] P7.3.5 Integration tests

### P7.4 Feedback queue (2.0d)
- [ ] P7.4.1 Missing/overdue scorecards
- [ ] P7.4.2 Reminders
- [ ] P7.4.3 Permissions and escalation
- [ ] P7.4.4 Integration tests

### P7.5 Hiring decision (2.5d)
- [ ] P7.5.1 Evidence summary
- [ ] P7.5.2 Approve/reject/hold actions
- [ ] P7.5.3 Reason and next task
- [ ] P7.5.4 Audit event
- [ ] P7.5.5 Integration tests

### P7.6 Pipeline and decision tests (2.5d)
- [ ] P7.6.1 Transition permissions
- [ ] P7.6.2 Incomplete scorecard blocking
- [ ] P7.6.3 Timezone handling
- [ ] P7.6.4 Reschedule scenarios
- [ ] P7.6.5 Rejection scenarios
- [ ] P7.6.6 Decision reversal policy

## P8 - Offers, Hiring Cases, Documents, Licenses, Joining

### P8.1 Offer versions (2.0d)
- [ ] P8.1.1 Immutable versions
- [ ] P8.1.2 Compensation components
- [ ] P8.1.3 Expiry handling
- [ ] P8.1.4 Response tracking
- [ ] P8.1.5 Owner and approval status
- [ ] P8.1.6 Integration tests

### P8.2 Offer approval workflow (2.5d)
- [ ] P8.2.1 Conditional approvers
- [ ] P8.2.2 Version comparison
- [ ] P8.2.3 Comments and changes
- [ ] P8.2.4 Approval audit
- [ ] P8.2.5 Integration tests

### P8.3 Readiness case (2.5d)
- [ ] P8.3.1 Checklist management
- [ ] P8.3.2 Ownership
- [ ] P8.3.3 Offer/documents/licenses/joining links
- [ ] P8.3.4 Final approval
- [ ] P8.3.5 Integration tests

### P8.4 Document controls (2.0d)
- [ ] P8.4.1 Metadata management
- [ ] P8.4.2 Review status
- [ ] P8.4.3 Expiry tracking
- [ ] P8.4.4 Permission controls
- [ ] P8.4.5 Secure-file boundary
- [ ] P8.4.6 Audit events
- [ ] P8.4.7 Integration tests

### P8.5 License controls (2.0d)
- [ ] P8.5.1 Requirement definition
- [ ] P8.5.2 Verification status
- [ ] P8.5.3 Expiry tracking
- [ ] P8.5.4 Missing/blocked states
- [ ] P8.5.5 Responsible owner assignment
- [ ] P8.5.6 Integration tests

### P8.6 Joining outcome (2.0d)
- [ ] P8.6.1 Confirmed date recording
- [ ] P8.6.2 Readiness state tracking
- [ ] P8.6.3 Joined/not-joined outcome
- [ ] P8.6.4 Handoff notification
- [ ] P8.6.5 Integration tests

## P9 - Insights, Administration, Integrations, Trust

### P9.1 Reports (2.5d)
- [ ] P9.1.1 Funnel reports
- [ ] P9.1.2 Aging reports
- [ ] P9.1.3 Time-to-stage reports
- [ ] P9.1.4 Source reports
- [ ] P9.1.5 Workload reports
- [ ] P9.1.6 Approval reports
- [ ] P9.1.7 Drill-down links
- [ ] P9.1.8 Integration tests

### P9.2 Administration (2.0d)
- [ ] P9.2.1 Users and roles management
- [ ] P9.2.2 Master data management
- [ ] P9.2.3 Workflow settings
- [ ] P9.2.4 Configuration boundaries
- [ ] P9.2.5 Integration tests

### P9.3 Integration health (2.0d)
- [ ] P9.3.1 Provider management
- [ ] P9.3.2 Connection state
- [ ] P9.3.3 Last sync tracking
- [ ] P9.3.4 Failure reason logging
- [ ] P9.3.5 Retry mechanism
- [ ] P9.3.6 Secret boundary
- [ ] P9.3.7 Integration tests

### P9.4 Audit log (2.0d)
- [ ] P9.4.1 Actor tracking
- [ ] P9.4.2 Organization context
- [ ] P9.4.3 Action logging
- [ ] P9.4.4 Entity tracking
- [ ] P9.4.5 Before/after summary
- [ ] P9.4.6 Timestamp and correlation ID
- [ ] P9.4.7 Export permission
- [ ] P9.4.8 Integration tests

### P9.5 Data trust (2.0d)
- [ ] P9.5.1 Retention/consent display
- [ ] P9.5.2 Sensitive-field visibility
- [ ] P9.5.3 Access review
- [ ] P9.5.4 Evidence-backed claims
- [ ] P9.5.5 Integration tests

### P9.6 Administration and trust tests (2.0d)
- [ ] P9.6.1 Admin permission tests
- [ ] P9.6.2 Stale integration recovery
- [ ] P9.6.3 Failed sync handling
- [ ] P9.6.4 Audit filtering
- [ ] P9.6.5 Export controls
- [ ] P9.6.6 Report drill-down

## Browser Journey Tests (Cross-Phase)

### P3 Browser Tests
- [ ] P3-B.1 Unauthenticated journeys
- [ ] P3-B.2 Authenticated journeys
- [ ] P3-B.3 Forbidden scenarios
- [ ] P3-B.4 Wrong organization handling

### P4 Browser Tests
- [ ] P4-B.1 Task queue workflows
- [ ] P4-B.2 Notification center flows
- [ ] P4-B.3 Approval inbox actions

### P5 Browser Tests
- [ ] P5-B.1 Request create/edit workflows
- [ ] P5-B.2 Approval workflows
- [ ] P5-B.3 Opening management

### P6 Browser Tests
- [ ] P6-B.1 Candidate intake flows
- [ ] P6-B.2 Application lifecycle
- [ ] P6-B.3 Talent pool management

### P7 Browser Tests
- [ ] P7-B.1 Interview scheduling
- [ ] P7-B.2 Scorecard completion
- [ ] P7-B.3 Pipeline transitions

### P8 Browser Tests
- [ ] P8-B.1 Offer workflows
- [ ] P8-B.2 Hiring case completion
- [ ] P8-B.3 Joining confirmation

### P9 Browser Tests
- [ ] P9-B.1 Report navigation
- [ ] P9-B.2 Admin workflows
- [ ] P9-B.3 Audit log filtering

## Dependencies

- P3 must complete before P4-P9
- P4 must complete before P5-P9
- P5 must complete before P6-P9
- P6 must complete before P7-P9
- P7 must complete before P8-P9
- P8 must complete before P9
- Browser tests can run in parallel with API tests

## Status

- **P3**: 0/24 tasks
- **P4**: 0/16 tasks
- **P5**: 0/15 tasks
- **P6**: 0/18 tasks
- **P7**: 0/18 tasks
- **P8**: 0/15 tasks
- **P9**: 0/18 tasks
- **Browser tests**: 0/21 tasks
- **Total**: 0/145 tasks

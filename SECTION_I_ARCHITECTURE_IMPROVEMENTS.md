# Section I — Architecture Improvements

This section outlines recommended architectural improvements to address systemic issues identified throughout the audit.

## I.1 Unified Application Stage Transition Routine

### Problem
The system currently has four independent code paths handling application stage transitions:
- Applications service (manual stage updates)
- Interviews service (stage updates when interviews scheduled/completed)
- Offers service (stage updates when offers made/accepted/rejected)
- Hiring service (stage updates when candidates join/onboarded)

This leads to inconsistency (H-5), race conditions, and maintenance complexity.

### Recommended Improvement
Implement a centralized application stage transition service that:
1. **Consolidates all stage transition logic** into a single service with clear entry points
2. **Enforces business rules** through a state machine or transition validation layer
3. **Provides transactional consistency** ensuring stage updates are atomic
4. **Emits domain events** for downstream processes (notifications, analytics, etc.)
5. **Includes comprehensive audit trail** of all stage changes with context

### Implementation Approach
- Create `ApplicationStageTransitionService` with methods like:
  - `advanceToScreening(applicationId, triggeredBy, context)`
  - `scheduleInterview(applicationId, interviewDetails, triggeredBy)`
  - `extendOffer(applicationId, offerDetails, triggeredBy)`
  - `markAsJoined(applicationId, joiningDetails, triggeredBy)`
- Each method validates current state, applies business rules, updates stage, and emits events
- Use database transactions to ensure consistency
- Replace direct stage updates in existing services with calls to this centralized service

### Benefits
- Eliminates race conditions (addresses H-5)
- Ensures consistent business rule application
- Reduces code duplication
- Improves maintainability and testability
- Provides single point for audit logging and monitoring

### Files Involved
- New: `apps/api/src/application-stage-transition/application-stage-transition.service.ts`
- Updated: 
  - `apps/api/src/applications/applications.service.ts`
  - `apps/api/src/interviews/interviews.service.ts`
  - `apps/api/src/offers/offers.service.ts`
  - `apps/api/src/hiring/hiring.service.ts`
- Related: Event emitters, DTOs, exception types

## I.2 Centralized Role/Permission Sync Mechanism

### Problem
Role permissions are currently synchronized through scattered logic in AccessControlService, leading to:
- Potential inconsistencies (H-4: Role policy data loss when saving access control rules)
- Complexity in tracking permission changes
- Difficulty in auditing permission assignments

### Recommended Improvement
Implement a centralized permission synchronization mechanism that:
1. **Single source of truth** for role-permission mappings
2. **Event-driven updates** that trigger whenever roles or permissions change
3. **Comprehensive audit logging** of all permission changes
4. **Fallback mechanisms** to recover from sync failures
5. **Validation layer** to prevent invalid permission assignments

### Implementation Approach
- Create `PermissionSyncService` that listens to:
  - Role creation/update/deletion events
  - Permission assignment/removal events
  - User role assignment/removal events
- Maintain synchronized mapping tables optimized for query performance
- Provide clear APIs for checking permissions that bypass complex joins when possible
- Implement retry mechanisms and dead letter queues for failed sync operations
- Add health checks and monitoring for sync lag/failures

### Benefits
- Eliminates role policy data loss (addresses H-4)
- Improves query performance for permission checks
- Provides clear audit trail of permission changes
- Increases system reliability through event-driven architecture
- Simplifies troubleshooting of permission-related issues

### Files Involved
- New: `apps/api/src/permission-sync/permission-sync.service.ts`
- Updated: 
  - `apps/api/src/access-control/access-control.service.ts` (remove sync logic)
  - `apps/api/src/roles/roles.service.ts` (emit events)
  - `apps/api/src/users/users.service.ts` (emit events)
- Infrastructure: Event types, database tables for synced permissions

## I.3 Improved Concurrency Patterns

### Problem
Current concurrency handling shows several issues:
- Race conditions in headcount updates (M-9)
- Lack of optimistic locking in critical sections
- Inconsistent use of database transactions
- Potential for lost updates in high-concurrency scenarios

### Recommended Improvement
Adopt improved concurrency patterns including:
1. **Optimistic locking** for frequently updated entities (vacancies, applications, users)
2. **Database-level constraints** where applicable (unique constraints, check constraints)
3. **Transactional outbox pattern** for reliable event publishing
4. **Idempotency keys** for external service calls
5. **Distributed locks** only when absolutely necessary (prefer optimistic approaches)

### Implementation Approach
- Add version fields to entities prone to concurrent updates:
  - Vacancy (headcount, status)
  - Application (currentStage, status)
  - User (role assignments, responsibilities)
- Use `@Version` decorators or manual version checking in update methods
- Implement retry logic with exponential backoff for version conflicts
- Use database transactions for multi-step operations that must be atomic
- For critical sections, consider PostgreSQL advisory locks or Redis-based distributed locks as last resort
- Implement outbox pattern to ensure events are published only after database commits succeed

### Benefits
- Eliminates headcount race conditions (addresses M-9)
- Prevents lost updates in high-concurrency scenarios
- Improves data consistency and reliability
- Provides better user experience under load (clear conflict resolution vs silent data loss)
- Reduces need for complex manual locking mechanisms

### Files Involved
- Updated entity definitions in:
  - `database/prisma/schema.prisma` (add version fields)
  - `apps/api/src/vacancy-core/vacancy-core.repository.ts` and similar
  - Service update methods throughout codebase
- New: Infrastructure for transactional outbox (if not already implemented)
- Updated: Error handling for version conflicts

## I.4 Expected Impact

Implementing these architectural improvements will:

1. **Address Root Causes**: Rather than treating symptoms, these changes fix underlying architectural weaknesses
2. **Reduce Future Deficits**: Prevent introduction of similar issues during future development
3. **Improve System Qualities**: Enhance reliability, maintainability, and scalability
4. **Provide Clear Migration Path**: Each improvement can be implemented incrementally with clear before/after states

## Risk Assessment

| Improvement | Risk Level | Mitigation Strategy |
|-------------|------------|---------------------|
| Unified Stage Transition | Medium | Feature flag rollback, comprehensive test coverage, gradual migration |
| Centralized Permission Sync | Medium | Parallel run with existing system, monitoring, rollback procedures |
| Improved Concurrency Patterns | Low to Medium | Additive changes, backward compatibility, thorough testing |

These improvements represent investments in architectural integrity that will pay dividends in reduced defect rates, improved development velocity, and enhanced system stability.
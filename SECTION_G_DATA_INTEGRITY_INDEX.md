# Section G — Data Integrity Findings Index

This section cross-references all data integrity-related findings from Sections A-E by category: race conditions, uniqueness constraints, cascade behavior, and other data consistency impacts.

## G.1 Race Condition Findings

### G.1.1 High Priority
**H-5: Application stage transitions lack consistency across 4 independent code paths**
- **Source**: High Priority Problems
- **Evidence**: Multiple files including:
  - `apps/api/src/applications/applications.service.ts`
  - `apps/api/src/interviews/interviews.service.ts` 
  - `apps/api/src/offers/offers.service.ts`
  - `apps/api/src/hiring/hiring.service.ts`
- **Description**: Four independent code paths handle application stage transitions (applications service, interviews service, offers service, hiring service) without centralized coordination, leading to race conditions where stage updates can conflict.
- **Impact**: Applications can be in inconsistent states (e.g., marked as both Interview and Offer simultaneously) due to concurrent updates from different services.

### G.1.2 Medium Priority
**M-9: Headcount race conditions in vacancy management**
- **Source**: Medium Priority Problems
- **Evidence**: `apps/api/src/vacancy-core/vacancy-core.service.ts`
- **Description**: Vacancy headcount updates lack proper locking mechanisms when multiple recruiters update the same vacancy simultaneously.
- **Impact**: Headcount values can become inaccurate due to lost updates when concurrent modifications occur.

## G.2 Uniqueness Constraint Findings

### G.2.1 Medium Priority
**M-12: Email uniqueness constraints create tenant isolation issues**
- **Source**: Medium Priority Problems
- **Evidence**: `apps/api/src/users/users.service.ts`, database schema
- **Description**: Email uniqueness constraint applied at database level without tenant scoping, preventing same email from being used across different tenants/organizations.
- **Impact**: Legitimate use case where same email address belongs to different people in different organizations is blocked.

### G.2.2 Low Priority (from Section E)
**E-3: Duplicate location normalization logic**
- **Source**: Low Priority Problems
- **Evidence**: `apps/web/src/utils/jdParser.ts` (lines 171-173)
- **Description**: Hardcoded "offshore" → "Cairo" replacement creates potential for duplicate candidate records when location variations aren't properly normalized.
- **Impact**: Same candidate location represented differently ("offshore" vs "Cairo") leading to duplicate records.

## G.3 Cascade Behavior Findings

### G.3.1 Medium Priority
**M-16: Inconsistent cascade delete behavior across related entities**
- **Source**: Medium Priority Problems
- **Evidence**: `database/prisma/schema.prisma`
- **Description**: Varied cascade delete settings across related entities (applications → candidates, vacancies → applications, etc.) leading to potential orphaned records or excessive data deletion.
- **Impact**: Deleting a vacancy might or might not delete related applications depending on cascade settings, creating inconsistency.

### G.3.2 Low Priority
**E-15: Hardcoded timeout values affecting data consistency**
- **Source**: Low Priority Problems
- **Evidence**: `apps/api/src/email/outbox-crypto.ts`, `apps/api/src/interviews/self-schedule.service.ts`
- **Description**: Hardcoded timeouts (like 72-hour self-schedule expiry) can lead to inconsistent data states when background cleanup processes don't align with business rules.
- **Impact**: Expired self-schedule tokens may linger in database longer than intended, causing confusion.

## G.4 Referential Integrity Findings

### G.4.1 Medium Priority
**M-20: Missing foreign key constraints on denormalized fields**
- **Source**: Medium Priority Problems
- **Evidence**: `database/prisma/schema.prisma`
- **Description**: Some denormalized fields for performance (like vacancy branchName, departmentName) lack corresponding foreign key constraints, risking referential integrity.
- **Impact**: Branch or department names can become outdated if source records are updated but denormalized copies aren't.

## G.5 Data Validation Findings

### G.5.1 Medium Priority
**M-14: Application stage validation gaps**
- **Source**: Medium Priority Problems
- **Evidence**: `apps/api/src/applications/applications.dto.ts`
- **Description**: Application DTOs lack comprehensive validation for stage transitions, allowing invalid state changes through direct API calls.
- **Impact**: Applications can be forced into invalid stages (e.g., from Offer back to Screening) bypassing business logic.

### G.5.2 Low Priority
**E-11: Magic Numbers in Quest XP Totals**
- **Source**: Low Priority Problems
- **Evidence**: `apps/web/src/quickguide/pageGuidesData.ts`
- **Description**: Hardcoded XP values can lead to inconsistent gamification data if not properly validated.
- **Impact**: Experience points values outside expected ranges due to lack of validation.

## Summary Table

| Finding ID | Severity | Category | Primary Evidence | Brief Description |
|------------|----------|----------|------------------|-------------------|
| H-5 | High | Race Condition | Multiple services | Inconsistent stage transitions across 4 code paths |
| M-9 | Medium | Race Condition | vacancy-core.service.ts | Headcount race conditions in vacancy management |
| M-12 | Medium | Uniqueness | users.service.ts, schema.prisma | Email uniqueness lacks tenant scoping |
| M-16 | Medium | Cascade Behavior | schema.prisma | Inconsistent cascade delete behavior |
| M-20 | Medium | Referential Integrity | schema.prisma | Missing FK constraints on denormalized fields |
| M-14 | Medium | Data Validation | applications.dto.ts | Application stage validation gaps |
| E-3 | Low | Uniqueness | jdParser.ts | Duplicate location normalization logic |
| E-15 | Low | Cascade Behavior | outbox-crypto.ts, self-schedule.service.ts | Hardcoded timeout values |
| E-11 | Low | Data Validation | pageGuidesData.ts | Magic Numbers in Quest XP Totals |

**Total Data Integrity Findings**: 9 (1 High, 5 Medium, 3 Low)
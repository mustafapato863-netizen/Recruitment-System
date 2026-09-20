# Section F — Security Findings Index

This section cross-references all security-related findings from Sections A-E by category: authentication, authorization, tenant isolation, and data exposure.

## F.1 Authentication Findings
*No high/medium priority authentication findings identified in the reviewed sections.*

## F.2 Authorization Findings

### F.2.1 High Priority
**F1: Inconsistent Permission Requirements in Recruiter Targets Controller**
- **Source**: Critical Problems (from commit analysis)
- **Evidence**: `apps/api/src/recruiter-targets/recruiter-targets.controller.ts` lines 26-29, 43-46, 53-56, 64-67
- **Description**: Inconsistent use of `@RequireAnyPermissions` vs `@RequirePermissions` decorators across HTTP methods in recruiter-targets.controller.ts. Methods switched from requiring ANY of VACANCY_MANAGE or VACANCY_ASSIGN to requiring ONLY VACANCY_MANAGE, then reverted.
- **Impact**: Users with only VACANCY_ASSIGN permission could be incorrectly denied access to functionality they should be able to use.

### F.2.2 Medium Priority
**F2: Missing Permission Validation in Manager Dashboard**
- **Source**: High Priority Problems 
- **Evidence**: `apps/web/src/pages/ManagerDashboard.tsx` lines 72-74, 110-118
- **Description**: ManagerDashboard component replaced direct permission checking with call to `isTeamLeaderOrAdmin(user)` function, creating potential bypass if function flawed.
- **Impact**: Incorrect authorization logic could grant unauthorized access to management functions.

**F6: Role Assignment Authorization Gap**
- **Source**: Security Analysis
- **Evidence**: `apps/api/src/users/users.service.ts` lines 121-132, 134-142
- **Description**: assignRole and removeRole methods don't verify that requesting user has permission to manage roles for target user's organization.
- **Impact**: User with USERS_MANAGE permission in one organization could potentially assign/remove roles for users in another organization.

## F.3 Tenant Isolation Findings

### F.3.1 Medium Priority
**F5: Inconsistent Tenant Scoping in User Assignment Logic**
- **Source**: Security Analysis
- **Evidence**: `apps/api/src/users/users.service.ts` lines 149-165
- **Description**: listAssignable method correctly scopes users by organizationId for admin check, but OR condition for non-admins doesn't re-verify managerId belongs to same organization.
- **Impact**: In multi-tenant system, user might see users from other organizations if those users have managerId matching userId.

## F.4 Data Exposure Findings

### F.4.1 High Priority
**F3: Currency Restriction Implementation Flaw**
- **Source**: High Priority Problems
- **Evidence**: `apps/api/src/screening/screening.dto.ts` line 39, `apps/api/src/screening/screening.service.ts` lines 63-66, 76
- **Description**: While code restricts currency to AED/EGP, implementation normalizes EGP/EGY to EGP but doesn't validate input is allowed currency before normalization.
- **Impact**: Unexpected currency values might bypass restrictions or cause data inconsistencies.

### F.4.2 Medium Priority
**F4: Potential Information Disclosure in Navigation Catalog**
- **Source**: Security Analysis
- **Evidence**: `apps/api/src/access-control/navigation.catalog.ts` lines 9-32
- **Description**: Navigation catalog shows different menu items based on permissions; visibility of items like 'audit-log' vs 'settings' could leak information about system capabilities.
- **Impact**: Attacker could map out permission structure by observing visible/invisible navigation items.

## Summary Table

| Finding ID | Severity | Category | Primary Evidence | Brief Description |
|------------|----------|----------|------------------|-------------------|
| F1 | High | Authorization | recruiter-targets.controller.ts | Inconsistent permission requirements in recruiter targets controller |
| F2 | High | Authorization | ManagerDashboard.tsx | Missing permission validation in manager dashboard |
| F3 | High | Data Exposure | screening.dto.ts, screening.service.ts | Currency restriction implementation flaw |
| F4 | Medium | Data Exposure | navigation.catalog.ts | Potential information disclosure in navigation catalog |
| F5 | Medium | Tenant Isolation | users.service.ts | Inconsistent tenant scoping in user assignment logic |
| F6 | Medium | Authorization | users.service.ts | Role assignment authorization gap |

**Total Security Findings**: 6 (2 High, 4 Medium)
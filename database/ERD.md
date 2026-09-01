# RecruitFlow Database Entity Relationship Diagram (ERD)

This document describes the database schema for the RecruitFlow application, generated from the Prisma schema.

## Tables Overview

The database contains the following tables:

1. [Organization](#organization)
2. [LegalEntity](#legalentity)
3. [Branch](#branch)
4. [Position](#position)
5. [User](#user)
6. [Role](#role)
7. [Permission](#permission)
8. [UserRole](#userrole)
9. [RolePermission](#rolepermission)
10. [VacancyRequest](#vacancyrequest)
11. [VacancyRequestApproval](#vacancyrequestapproval)
12. [Vacancy](#vacancy)
13. [VacancyAssignment](#vacancyassignment)
14. [AuditLog](#auditlog)
15. [AuthRateLimit](#authratelimit)
16. [CodeSequence](#codesequence)
17. [Candidate](#candidate)
18. [Application](#application)
19. [ApplicationStatusHistory](#applicationstatushistory)
20. [CandidateDocument](#candidatedocument)
21. [ScreeningLog](#screeninglog)
22. [Interview](#interview)
23. [InterviewAttendee](#interviewattendee)
24. [InterviewScorecard](#interviewscorecard)
25. [Offer](#offer)
26. [OfferVersion](#offerversion)
27. [OfferComponent](#offercomponent)
28. [OfferApproval](#offerapproval)
29. [HiringCase](#hiringcase)
30. [ComplianceRequirement](#compliancerequirement)
31. [HiringCaseApproval](#hiringcaseapproval)
32. [TalentPool](#talentpool)
33. [TalentPoolCandidate](#talentpoolcandidate)
34. [CandidateImportJob](#candidateimportjob)
35. [CandidateImportRow](#candidateimportrow)
36. [PipelineTemplate](#pipelinetemplate)
37. [PipelineStage](#pipelinestage)
38. [Integration](#integration)
39. [Notification](#notification)
40. [Task](#task)
41. [AuthToken](#authtoken)
42. [EmailOutbox](#emailoutbox)

---

## Table Details

### Organization
Organizations represent companies or tenants in the system.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| code | String (50) | Unique organization code |
| name | String (200) | Organization name |
| status | String (30) | Organization status (default: "Active") |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relationships:**
- Has many LegalEntity
- Has many Branch
- Has many Position
- Has many User
- Has many VacancyRequest
- Has many Vacancy
- Has many Candidate
- Has many Application
- Has many UserRole
- Has many Role
- Has many Permission
- Has many AuditLog
- Has many AuthToken
- Has many Notification
- Has many Task
- Has many CustomRole
- Has many EmailOutbox

---

### LegalEntity
Legal entities belong to organizations.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| organizationId | String (UUID) | Foreign key to Organization |
| organization | Organization | Relation to Organization |
| code | String (50) | Legal entity code |
| name | String (200) | Legal entity name |
| status | String (30) | Status (default: "Active") |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relationships:**
- Belongs to Organization
- Has many Branch
- Has many Position
- Has many VacancyRequest
- Has many Vacancy

---

### Branch
Branches belong to legal entities and organizations.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| organizationId | String (UUID) | Foreign key to Organization |
| organization | Organization | Relation to Organization |
| legalEntityId | String (UUID) | Foreign key to LegalEntity |
| legalEntity | LegalEntity | Relation to LegalEntity |
| code | String (50) | Branch code |
| name | String (200) | Branch name |
| city | String (120) | City location |
| status | String (30) | Status (default: "Active") |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relationships:**
- Belongs to Organization
- Belongs to LegalEntity
- Has many VacancyRequest
- Has many Vacancy

---

### Position
Job positions within organizations.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| organizationId | String (UUID) | Foreign key to Organization |
| organization | Organization | Relation to Organization |
| legalEntityId | String (UUID) | Foreign key to LegalEntity (optional) |
| legalEntity | LegalEntity | Relation to LegalEntity (optional) |
| code | String (50) | Position code |
| title | String (200) | Position title |
| description | Text | Position description |
| status | String (30) | Status (default: "Active") |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relationships:**
- Belongs to Organization
- Belongs to LegalEntity (optional)
- Has many VacancyRequest
- Has many Vacancy

---

### User
System users belonging to organizations.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| organizationId | String (UUID) | Foreign key to Organization |
| organization | Organization | Relation to Organization |
| email | String (320) | User email |
| emailNormalized | String (320) | Normalized email for uniqueness |
| passwordHash | String (128) | Hashed password (optional) |
| displayName | String (200) | User display name |
| status | String (30) | User status (default: "Active") |
| emailVerifiedAt | DateTime | Email verification timestamp (optional) |
| invitationAcceptedAt | DateTime | Invitation acceptance timestamp (optional) |
| tokenVersion | Integer | Token version for security (default: 0) |
| lastLoginAt | DateTime | Last login timestamp (optional) |
| theme | String (10) | UI theme (default: "light") |
| timezone | String (80) | User timezone (default: "UTC") |
| dateFormat | String (40) | Date format preference (default: "MMM d, yyyy") |
| timeFormat | String (10) | Time format preference (default: "12h") |
| reducedMotion | Boolean | Reduced motion preference (default: false) |
| inAppNotifications | Boolean | In-app notifications (default: true) |
| emailNotifications | Boolean | Email notifications (default: false) |
| interviewReminders | Boolean | Interview reminders (default: true) |
| approvalReminders | Boolean | Approval reminders (default: true) |
| taskReminders | Boolean | Task reminders (default: true) |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relationships:**
- Belongs to Organization
- Has many UserRole
- Has many VacancyRequest (as requester)
- Has many VacancyRequestApproval (as assignee)
- Has many VacancyAssignment
- Has many Application (as primary recruiter)
- Has many Application (as task owner)
- Has many ApplicationStatusHistory
- Has many CandidateDocument (as uploader)
- Has many CandidateDocument (as deleter)
- Has many ScreeningLog
- Has many InterviewAttendee
- Has many InterviewScorecard
- Has many OfferApproval
- Has many HiringCase (as owner)
- Has many ComplianceRequirement (as verifier)
- Has many HiringCaseApproval (as approver)
- Has many TalentPool (as uploader)
- Has many Notification (as recipient)
- Has many Task (as assignee)
- Has many Task (as creator)
- Has many AuthToken

---

### Role
Roles define permissions within the system.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| code | String (80) | Unique role code |
| name | String (120) | Role name |
| status | String (30) | Status (default: "Active") |
| organizationId | String (UUID) | Foreign key to Organization (optional, null for system roles) |
| organization | Organization | Relation to Organization (optional) |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relationships:**
- Belongs to Organization (optional)
- Has many UserRole
- Has many RolePermission

---

### Permission
Permissions define specific access rights.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| code | String (120) | Unique permission code |
| description | Text | Permission description |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relationships:**
- Has many RolePermission

---

### UserRole
Many-to-many relationship between Users and Roles.

| Field | Type | Description |
|-------|------|-------------|
| userId | String (UUID) | Foreign key to User (part of primary key) |
| roleId | String (UUID) | Foreign key to Role (part of primary key) |
| user | User | Relation to User |
| role | Role | Relation to Role |
| assignedAt | DateTime | Assignment timestamp (default: now) |

**Relationships:**
- Belongs to User
- Belongs to Role

---

### RolePermission
Many-to-many relationship between Roles and Permissions.

| Field | Type | Description |
|-------|------|-------------|
| roleId | String (UUID) | Foreign key to Role (part of primary key) |
| permissionId | String (UUID) | Foreign key to Permission (part of primary key) |
| role | Role | Relation to Role |
| permission | Permission | Relation to Permission |

**Relationships:**
- Belongs to Role
- Belongs to Permission

---

### VacancyRequest
Requests to create new job vacancies.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| organizationId | String (UUID) | Foreign key to Organization |
| organization | Organization | Relation to Organization |
| legalEntityId | String (UUID) | Foreign key to LegalEntity (optional) |
| legalEntity | LegalEntity | Relation to LegalEntity (optional) |
| branchId | String (UUID) | Foreign key to Branch |
| branch | Branch | Relation to Branch |
| positionId | String (UUID) | Foreign key to Position |
| position | Position | Relation to Position |
| requesterId | String (UUID) | Foreign key to User |
| requester | User | Relation to User (as requester) |
| requestCode | String (50) | Unique request code |
| status | String (40) | Request status (default: "Draft") |
| requestedHeadcount | Integer | Requested number of hires |
| employmentType | String (60) | Type of employment (optional) |
| reason | String (120) | Reason for request (optional) |
| budgetStatus | String (60) | Budget status (optional) |
| criticality | String (40) | Criticality level (optional) |
| targetStartDate | Date | Target start date (optional) |
| justification | Text | Justification for request (optional) |
| submittedAt | DateTime | Submission timestamp (optional) |
| approvalRevision | Integer | Approval revision number (default: 1) |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relationships:**
- Belongs to Organization
- Belongs to LegalEntity (optional)
- Belongs to Branch
- Belongs to Position
- Belongs to User (as requester)
- Has many VacancyRequestApproval
- Has one Vacancy (optional)

---

### VacancyRequestApproval
Approval steps for vacancy requests.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| vacancyRequestId | String (UUID) | Foreign key to VacancyRequest |
| vacancyRequest | VacancyRequest | Relation to VacancyRequest |
| revision | Integer | Approval revision number |
| step | Integer | Approval step number |
| roleCode | String (80) | Required role for approval |
| assigneeUserId | String (UUID) | Foreign key to User (optional) |
| assignee | User | Relation to User (as assignee, optional) |
| status | String (40) | Approval status (default: "Pending") |
| comment | Text | Approver comment (optional) |
| decidedAt | DateTime | Decision timestamp (optional) |
| createdAt | DateTime | Creation timestamp |

**Relationships:**
- Belongs to VacancyRequest
- Belongs to User (as assignee, optional)

---

### Vacancy
Approved job vacancies.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| organizationId | String (UUID) | Foreign key to Organization |
| organization | Organization | Relation to Organization |
| legalEntityId | String (UUID) | Foreign key to LegalEntity (optional) |
| legalEntity | LegalEntity | Relation to LegalEntity (optional) |
| branchId | String (UUID) | Foreign key to Branch |
| branch | Branch | Relation to Branch |
| positionId | String (UUID) | Foreign key to Position |
| position | Position | Relation to Position |
| vacancyRequestId | String (UUID) | Foreign key to VacancyRequest (unique) |
| vacancyRequest | VacancyRequest | Relation to VacancyRequest |
| vacancyCode | String (50) | Unique vacancy code |
| status | String (40) | Vacancy status (default: "Pending Activation") |
| approvedHeadcount | Integer | Approved number of hires |
| joinedHeadcount | Integer | Number of candidates who joined (default: 0) |
| openedAt | DateTime | Vacancy opening timestamp (optional) |
| targetStartDate | Date | Target start date (optional) |
| requiredSkills | String[] | Array of required skills (default: []) |
| minExperienceYears | Integer | Minimum experience years (optional) |
| location | String (120) | Job location (optional) |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relationships:**
- Belongs to Organization
- Belongs to LegalEntity (optional)
- Belongs to Branch
- Belongs to Position
- Belongs to VacancyRequest (unique)
- Has many VacancyAssignment
- Has many Application

---

### VacancyAssignment
Assignments of users to vacancies with specific roles.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| vacancyId | String (UUID) | Foreign key to Vacancy |
| vacancy | Vacancy | Relation to Vacancy |
| userId | String (UUID) | Foreign key to User |
| user | User | Relation to User |
| roleCode | String (60) | Role code for the assignment |
| isActive | Boolean | Whether assignment is active (default: true) |
| assignedAt | DateTime | Assignment timestamp (default: now) |

**Relationships:**
- Belongs to Vacancy
- Belongs to User

---

### AuditLog
Audit trail for system changes.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| organizationId | String (UUID) | Foreign key to Organization (optional) |
| actorUserId | String (UUID) | Foreign key to User (optional) |
| action | String (120) | Action performed |
| entityType | String (80) | Type of entity affected |
| entityId | String (80) | ID of entity affected |
| result | String (40) | Result of action |
| reason | Text | Reason for action (optional) |
| beforeData | Json | Entity state before change (optional) |
| afterData | Json | Entity state after change (optional) |
| correlationId | String (120) | Correlation ID for tracking (optional) |
| ipAddress | String (64) | IP address of actor (optional) |
| createdAt | DateTime | Creation timestamp |

**Relationships:**
- Belongs to Organization (optional)
- Belongs to User (as actor, optional)

---

### AuthRateLimit
Rate limiting for authentication attempts.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| scope | String (16) | Scope of rate limit (e.g., "ip", "email") |
| keyHash | String (64) | Hashed key for rate limit |
| attempts | Integer | Number of attempts (default: 0) |
| lastAttemptAt | DateTime | Timestamp of last attempt |
| lockedUntil | DateTime | Lockout expiration timestamp (optional) |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

---

### CodeSequence
Sequences for generating codes.

| Field | Type | Description |
|-------|------|-------------|
| key | String (80) | Primary key (sequence identifier) |
| lastIssued | Integer | Last issued number (default: 0) |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

---

### Candidate
Job candidates in the system.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| organizationId | String (UUID) | Foreign key to Organization |
| organization | Organization | Relation to Organization |
| candidateCode | String (50) | Unique candidate code |
| firstName | String (80) | First name |
| lastName | String (80) | Last name |
| email | String (255) | Email address |
| phone | String (40) | Phone number (optional) |
| currentTitle | String (120) | Current job title (optional) |
| currentCompany | String (120) | Current company (optional) |
| source | String (80) | Source of candidate (optional) |
| status | String (40) | Candidate status (default: "Active") |
| consentStatus | String (30) | Consent status (default: "Unknown") |
| consentCapturedAt | DateTime | Consent capture timestamp (optional) |
| consentSource | String (80) | Consent source (optional) |
| skills | String[] | Array of skills (default: []) |
| experienceYears | Integer | Years of experience (optional) |
| location | String (120) | Candidate location (optional) |
| certifications | String[] | Array of certifications (default: []) |
| languages | String[] | Array of languages (default: []) |
| availability | String (60) | Availability status (optional) |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relationships:**
- Belongs to Organization
- Has many Application
- Has many CandidateDocument
- Has many TalentPoolCandidate

---

### Application
Job applications submitted by candidates.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| organizationId | String (UUID) | Foreign key to Organization |
| organization | Organization | Relation to Organization |
| applicationCode | String (50) | Unique application code |
| vacancyId | String (UUID) | Foreign key to Vacancy |
| vacancy | Vacancy | Relation to Vacancy |
| candidateId | String (UUID) | Foreign key to Candidate |
| candidate | Candidate | Relation to Candidate |
| stage | String (50) | Application stage (default: "Applied") |
| source | String (80) | Application source (optional) |
| primaryRecruiterId | String (UUID) | Foreign key to User (optional) |
| primaryRecruiter | User | Relation to User (as primary recruiter, optional) |
| taskOwnerId | String (UUID) | Foreign key to User (optional) |
| taskOwner | User | Relation to User (as task owner, optional) |
| appliedAt | DateTime | Application timestamp (default: now) |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relationships:**
- Belongs to Organization
- Belongs to Vacancy
- Belongs to Candidate
- Belongs to User (as primary recruiter, optional)
- Belongs to User (as task owner, optional)
- Has many ApplicationStatusHistory
- Has many ScreeningLog
- Has many Interview
- Has many Offer
- Has one HiringCase (optional)

---

### ApplicationStatusHistory
History of application stage changes.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| applicationId | String (UUID) | Foreign key to Application |
| application | Application | Relation to Application |
| fromStage | String (50) | Previous stage (optional) |
| toStage | String (50) | New stage |
| changedById | String (UUID) | Foreign key to User (optional) |
| changedBy | User | Relation to User (as changer, optional) |
| reason | Text | Reason for stage change (optional) |
| createdAt | DateTime | Creation timestamp |

**Relationships:**
- Belongs to Application
- Belongs to User (as changer, optional)

---

### CandidateDocument
Documents uploaded for candidates.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| organizationId | String (UUID) | Foreign key to Organization |
| organization | Organization | Relation to Organization |
| candidateId | String (UUID) | Foreign key to Candidate |
| candidate | Candidate | Relation to Candidate |
| documentType | String (60) | Type of document |
| fileName | String (255) | File name |
| fileSize | Integer | File size in bytes |
| mimeType | String (100) | MIME type |
| storageKey | String (500) | Storage key/location |
| storageProvider | String (50) | Storage provider (default: "local-private") |
| sha256 | String (64) | SHA-256 hash (optional) |
| extractionText | Text | Extracted text from document (optional) |
| scanStatus | String (40) | Virus scan status (default: "Clean") |
| scanProvider | String (50) | Virus scan provider (optional) |
| scanMessage | Text | Virus scan message (optional) |
| scannedAt | DateTime | Scan timestamp (optional) |
| parserStatus | String (40) | Document parsing status (default: "NotStarted") |
| parserVersion | String (40) | Parser version used (optional) |
| retentionExpiresAt | DateTime | Data retention expiration (optional) |
| consentStatus | String (30) | Consent status (default: "Unknown") |
| deletedAt | DateTime | Deletion timestamp (optional) |
| deletedById | String (UUID) | Foreign key to User (optional) |
| deletedBy | User | Relation to User (as deleter, optional) |
| deletionReason | Text | Reason for deletion (optional) |
| uploadedById | String (UUID) | Foreign key to User (optional) |
| uploadedBy | User | Relation to User (as uploader, optional) |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relationships:**
- Belongs to Organization
- Belongs to Candidate
- Belongs to User (as uploader, optional)
- Belongs to User (as deleter, optional)
- Has many ComplianceRequirement

---

### ScreeningLog
Logs of candidate screening activities.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| organizationId | String (UUID) | Foreign key to Organization |
| organization | Organization | Relation to Organization |
| applicationId | String (UUID) | Foreign key to Application |
| application | Application | Relation to Application |
| screenerId | String (UUID) | Foreign key to User |
| screener | User | Relation to User (as screener) |
| outcome | String (40) | Screening outcome |
| notes | Text | Screening notes (optional) |
| screenedAt | DateTime | Screening timestamp (default: now) |
| createdAt | DateTime | Creation timestamp |

**Relationships:**
- Belongs to Organization
- Belongs to Application
- Belongs to User (as screener)

---

### Interview
Scheduled interviews for applications.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| organizationId | String (UUID) | Foreign key to Organization |
| organization | Organization | Relation to Organization |
| interviewCode | String (50) | Unique interview code |
| applicationId | String (UUID) | Foreign key to Application |
| application | Application | Relation to Application |
| title | String (200) | Interview title |
| interviewType | String (60) | Type of interview |
| scheduledStart | DateTime | Scheduled start time |
| scheduledEnd | DateTime | Scheduled end time |
| timezone | String (50) | Timezone (default: "UTC") |
| locationUrl | String (500) | Location URL (optional) |
| status | String (40) | Interview status (default: "Scheduled") |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relationships:**
- Belongs to Organization
- Belongs to Application
- Has many InterviewAttendee
- Has many InterviewScorecard

---

### InterviewAttendee
Attendees of interviews.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| interviewId | String (UUID) | Foreign key to Interview |
| interview | Interview | Relation to Interview |
| userId | String (UUID) | Foreign key to User |
| user | User | Relation to User |
| role | String (60) | Attendee role (default: "Interviewer") |
| response | String (40) | Response status (default: "Accepted") |

**Relationships:**
- Belongs to Interview
- Belongs to User

---

### InterviewScorecard
Scorecards filled out by interviewers.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| interviewId | String (UUID) | Foreign key to Interview |
| interview | Interview | Relation to Interview |
| interviewerId | String (UUID) | Foreign key to User |
| interviewer | User | Relation to User (as interviewer) |
| overallRating | Integer | Overall rating (1-5 scale typically) |
| recommendation | String (40) | Hiring recommendation |
| strengths | Text | Strengths noted (optional) |
| concerns | Text | Concerns noted (optional) |
| notes | Text | Additional notes (optional) |
| isLocked | Boolean | Whether scorecard is locked (default: false) |
| submittedAt | DateTime | Submission timestamp (default: now) |

**Relationships:**
- Belongs to Interview
- Belongs to User (as interviewer)

---

### Offer
Job offers made to candidates.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| organizationId | String (UUID) | Foreign key to Organization |
| organization | Organization | Relation to Organization |
| applicationId | String (UUID) | Foreign key to Application |
| application | Application | Relation to Application |
| offerCode | String (50) | Unique offer code |
| currentVersionId | String (UUID) | Foreign key to OfferVersion (optional) |
| status | String (50) | Offer status (default: "Draft") |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relationships:**
- Belongs to Organization
- Belongs to Application
- Has many OfferVersion
- Has one HiringCase (optional)

---

### OfferVersion
Versions of job offers.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| offerId | String (UUID) | Foreign key to Offer |
| offer | Offer | Relation to Offer |
| versionNumber | Integer | Version number |
| monthlyPackage | Decimal (12,2) | Monthly compensation package (optional) |
| annualFixed | Decimal (12,2) | Annual fixed compensation (optional) |
| contractType | String (100) | Contract type (optional) |
| probationPeriod | String (100) | Probation period details (optional) |
| offerExpiry | DateTime | Offer expiration timestamp (optional) |
| proposedJoiningDate | DateTime | Proposed joining date (optional) |
| workLocation | String (200) | Work location (optional) |
| workingSchedule | String (100) | Working schedule (optional) |
| approvalStatus | String (50) | Approval status (default: "Draft") |
| isLocked | Boolean | Whether version is locked (default: false) |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relationships:**
- Belongs to Offer
- Has many OfferComponent
- Has many OfferApproval

---

### OfferComponent
Components of offer compensation packages.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| offerVersionId | String (UUID) | Foreign key to OfferVersion |
| offerVersion | OfferVersion | Relation to OfferVersion |
| type | String (50) | Component type (Salary, Allowance, Benefit) |
| name | String (150) | Component name |
| amount | Decimal (12,2) | Amount value (optional) |
| currency | String (10) | Currency code (optional) |
| frequency | String (50) | Payment frequency (optional) |
| isTaxable | Boolean | Whether component is taxable (default: true) |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relationships:**
- Belongs to OfferVersion

---

### OfferApproval
Approvals for offer versions.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| offerVersionId | String (UUID) | Foreign key to OfferVersion |
| offerVersion | OfferVersion | Relation to OfferVersion |
| approverUserId | String (UUID) | Foreign key to User (optional) |
| approver | User | Relation to User (as approver, optional) |
| roleCode | String (80) | Required role for approval |
| status | String (50) | Approval status (default: "Pending") |
| comment | Text | Approver comment (optional) |
| decidedAt | DateTime | Decision timestamp (optional) |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relationships:**
- Belongs to OfferVersion
- Belongs to User (as approver, optional)

---

### HiringCase
Cases tracking the hiring process from application to joining.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| organizationId | String (UUID) | Foreign key to Organization |
| organization | Organization | Relation to Organization |
| applicationId | String (UUID) | Foreign key to Application (unique) |
| application | Application | Relation to Application |
| offerId | String (UUID) | Foreign key to Offer (unique) |
| offer | Offer | Relation to Offer |
| status | String (50) | Case status (default: "Pending Compliance") |
| plannedJoiningDate | DateTime | Planned joining date (optional) |
| actualJoiningDate | DateTime | Actual joining date (optional) |
| ownerUserId | String (UUID) | Foreign key to User (optional) |
| owner | User | Relation to User (as owner, optional) |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relationships:**
- Belongs to Organization
- Belongs to Application (unique)
- Belongs to Offer (unique)
- Belongs to User (as owner, optional)
- Has many ComplianceRequirement
- Has many HiringCaseApproval

---

### ComplianceRequirement
Requirements that must be satisfied for hiring.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| hiringCaseId | String (UUID) | Foreign key to HiringCase |
| hiringCase | HiringCase | Relation to HiringCase |
| type | String (50) | Requirement type (Document, License, Check) |
| name | String (150) | Requirement name |
| status | String (50) | Requirement status (default: "Pending") |
| isRequired | Boolean | Whether requirement is mandatory (default: true) |
| documentId | String (UUID) | Foreign key to CandidateDocument (optional) |
| document | CandidateDocument | Relation to CandidateDocument (optional) |
| expiryDate | DateTime | Expiration date (optional) |
| verifiedAt | DateTime | Verification timestamp (optional) |
| verifiedById | String (UUID) | Foreign key to User (optional) |
| verifier | User | Relation to User (as verifier, optional) |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relationships:**
- Belongs to HiringCase
- Belongs to CandidateDocument (optional)
- Belongs to User (as verifier, optional)

---

### HiringCaseApproval
Approvals for hiring cases.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| hiringCaseId | String (UUID) | Foreign key to HiringCase |
| hiringCase | HiringCase | Relation to HiringCase |
| roleCode | String (80) | Required role for approval |
| status | String (50) | Approval status (default: "Pending") |
| comment | Text | Approver comment (optional) |
| approverUserId | String (UUID) | Foreign key to User (optional) |
| approver | User | Relation to User (as approver, optional) |
| decidedAt | DateTime | Decision timestamp (optional) |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relationships:**
- Belongs to HiringCase
- Belongs to User (as approver, optional)

---

### TalentPool
Pools of candidates for future opportunities.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| organizationId | String (UUID) | Foreign key to Organization |
| organization | Organization | Relation to Organization |
| name | String (200) | Talent pool name |
| description | Text | Talent pool description (optional) |
| tags | String[] | Array of tags (default: []) |
| status | String (30) | Status (default: "Active") |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relationships:**
- Belongs to Organization
- Has many TalentPoolCandidate

---

### TalentPoolCandidate
Relationship between talent pools and candidates.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| talentPoolId | String (UUID) | Foreign key to TalentPool |
| talentPool | TalentPool | Relation to TalentPool |
| candidateId | String (UUID) | Foreign key to Candidate |
| candidate | Candidate | Relation to Candidate |
| eligibility | String (50) | Eligibility status (default: "Eligible") |
| coolingOffUntil | DateTime | Cooling off period end (optional) |
| consentStatus | String (30) | Consent status (default: "Active") |
| consentExpiry | DateTime | Consent expiry date (optional) |
| source | String (100) | Source of addition (optional) |
| addedAt | DateTime | Addition timestamp (default: now) |

**Relationships:**
- Belongs to TalentPool
- Belongs to Candidate

---

### CandidateImportJob
Jobs for importing candidate data.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| organizationId | String (UUID) | Foreign key to Organization |
| organization | Organization | Relation to Organization |
| fileName | String (255) | Name of imported file |
| dataset | String (40) | Dataset type (default: "candidates") |
| sourceFormat | String (20) | Source format (default: "json") |
| sheetName | String (120) | Sheet name (for Excel files, optional) |
| fileSize | Integer | File size in bytes (optional) |
| checksum | String (64) | File checksum (optional) |
| status | String (50) | Job status (default: "Validating") |
| totalRows | Integer | Total rows in file (default: 0) |
| validRows | Integer | Number of valid rows (default: 0) |
| invalidRows | Integer | Number of invalid rows (default: 0) |
| duplicateRows | Integer | Number of duplicate rows (default: 0) |
| newRows | Integer | Number of new rows to create (default: 0) |
| updateRows | Integer | Number of existing rows to update (default: 0) |
| uploadedById | String (UUID) | Foreign key to User (optional) |
| uploadedBy | User | Relation to User (as uploader, optional) |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relationships:**
- Belongs to Organization
- Belongs to User (as uploader, optional)
- Has many CandidateImportRow

---

### CandidateImportRow
Individual rows from candidate import files.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| jobId | String (UUID) | Foreign key to CandidateImportJob |
| job | CandidateImportJob | Relation to CandidateImportJob |
| rowNumber | Integer | Row number in source file |
| rawData | Json | Raw data from source file |
| firstName | String (100) | First name (optional) |
| lastName | String (100) | Last name (optional) |
| email | String (320) | Email address (optional) |
| phone | String (30) | Phone number (optional) |
| result | String (30) | Processing result (default: "Pending") |
| details | Text | Processing details (optional) |
| decision | String (30) | Processing decision (optional) |
| createdAt | DateTime | Creation timestamp |

**Relationships:**
- Belongs to CandidateImportJob

---

### PipelineTemplate
Templates defining hiring pipeline stages.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| organizationId | String (UUID) | Foreign key to Organization |
| organization | Organization | Relation to Organization |
| name | String (200) | Template name |
| isDefault | Boolean | Whether this is the default template (default: false) |
| status | String (30) | Status (default: "Draft") |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relationships:**
- Belongs to Organization
- Has many PipelineStage

---

### PipelineStage
Individual stages within hiring pipelines.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| templateId | String (UUID) | Foreign key to PipelineTemplate |
| template | PipelineTemplate | Relation to PipelineTemplate |
| name | String (100) | Stage name |
| stageType | String (50) | Type of stage |
| sortOrder | Integer | Display order (default: 0) |
| slaDays | Integer | SLA in days (optional) |
| defaultOwner | String (100) | Default owner for stage (optional) |
| entryGate | String (200) | Entry criteria (optional) |
| exitGate | String (200) | Exit criteria (optional) |
| status | String (30) | Status (default: "Active") |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relationships:**
- Belongs to PipelineTemplate

---

### Integration
Third-party system integrations.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| organizationId | String (UUID) | Foreign key to Organization |
| organization | Organization | Relation to Organization |
| name | String (200) | Integration name |
| provider | String (100) | Service provider |
| category | String (50) | Integration category |
| status | String (30) | Status (default: "Available") |
| configJson | Json | Configuration JSON (optional) |
| lastSyncAt | DateTime | Last synchronization timestamp (optional) |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relationships:**
- Belongs to Organization

---

### Notification
System notifications sent to users.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| organizationId | String (UUID) | Foreign key to Organization |
| organization | Organization | Relation to Organization |
| recipientUserId | String (UUID) | Foreign key to User |
| recipient | User | Relation to User (as recipient) |
| type | String (80) | Notification type |
| title | String (255) | Notification title |
| message | Text | Notification message |
| entityType | String (80) | Related entity type (optional) |
| entityId | String (80) | Related entity ID (optional) |
| readAt | DateTime | Read timestamp (optional) |
| createdAt | DateTime | Creation timestamp |

**Relationships:**
- Belongs to Organization
- Belongs to User (as recipient)

---

### Task
Tasks assigned to users in the system.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| organizationId | String (UUID) | Foreign key to Organization |
| organization | Organization | Relation to Organization |
| assigneeUserId | String (UUID) | Foreign key to User |
| assignee | User | Relation to User (as assignee) |
| createdById | String (UUID) | Foreign key to User |
| createdBy | User | Relation to User (as creator) |
| type | String (80) | Task type |
| title | String (255) | Task title |
| description | Text | Task description (optional) |
| priority | String (30) | Priority level (default: "Normal") |
| status | String (30) | Task status (default: "Open") |
| dueAt | DateTime | Due timestamp (optional) |
| entityType | String (80) | Related entity type (optional) |
| entityId | String (80) | Related entity ID (optional) |
| completedAt | DateTime | Completion timestamp (optional) |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relationships:**
- Belongs to Organization
- Belongs to User (as assignee)
- Belongs to User (as creator)

---

### AuthToken
Authentication tokens for users.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| organizationId | String (UUID) | Foreign key to Organization |
| organization | Organization | Relation to Organization |
| userId | String (UUID) | Foreign key to User |
| user | User | Relation to User |
| type | String (40) | Token type |
| tokenHash | String (64) | Hashed token value (unique) |
| expiresAt | DateTime | Expiration timestamp |
| consumedAt | DateTime | Consumption timestamp (optional) |
| createdAt | DateTime | Creation timestamp (default: now) |

**Relationships:**
- Belongs to Organization
- Belongs to User

---

### EmailOutbox
Queue for outgoing emails.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| organizationId | String (UUID) | Foreign key to Organization (optional) |
| organization | Organization | Relation to Organization (optional) |
| toEmail | String (320) | Recipient email address |
| subject | String (500) | Email subject |
| template | String (80) | Email template identifier |
| payload | Json | Email template payload |
| status | String (20) | Email status (default: "Pending") |
| attempts | Integer | Send attempts count (default: 0) |
| maxAttempts | Integer | Maximum send attempts (default: 5) |
| lastError | Text | Last error message (optional) |
| availableAt | DateTime | When email becomes available for sending (default: now) |
| sentAt | DateTime | When email was sent (optional) |
| createdAt | DateTime | Creation timestamp (default: now) |
| updatedAt | DateTime | Last update timestamp |

**Relationships:**
- Belongs to Organization (optional)
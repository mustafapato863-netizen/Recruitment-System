# Section E — Low Priority Problems (16 findings)

## E.1 Magic Number in XP Rewards
- **Severity**: Low
- **Evidence**: `apps/web/src/quickguide/pageGuidesData.ts` - Multiple hardcoded XP values (30, 35, 25, 50, 20)
- **Current behavior**: Experience points for quest completion are hardcoded as literals throughout the page guides data
- **Why it's a problem**: Makes gamification rebalancing difficult; business rules embedded in data rather than centralized configuration
- **Failure scenario**: Game designers cannot easily adjust XP values without searching through multiple data files
- **Root cause**: Lack of centralized constants for gamification values
- **Recommended fix**: Extract XP values to a constants file (e.g., `src/constants/gamification.ts`) with descriptive names like `QUEST_STEP_XP_REWARD_BASE`, `QUEST_STEP_XP_REWARD_BONUS`
- **Risk of fixing**: Very low - only changes data values, no logic modification
- **Files involved**: 
  - `apps/web/src/quickguide/pageGuidesData.ts` (primary)
  - New constants file to be created

## E.2 Hardcoded Permission Strings
- **Severity**: Low
- **Evidence**: Multiple files in `apps/api/src/access-control/` and frontend components
- **Current behavior**: Permission strings like 'ROLES_VIEW', 'USERS_MANAGE' are hardcoded as string literals
- **Why it's a problem**: Typos not caught at compile time; difficult to find all usages when permissions change
- **Failure scenario**: Permission string typo causes silent permission failures; refactoring permissions requires grep/search across codebase
- **Root cause**: No centralized permission definitions or type-safe enum
- **Recommended fix**: Create permission constants file or TypeScript enum with all permission strings
- **Risk of fixing**: Low - requires updating references but improves type safety
- **Files involved**:
  - `apps/api/src/access-control/access-control.service.ts`
  - `apps/api/src/access-control/access-control.controller.ts`
  - Multiple frontend files using PermissionGate components
  - New constants file to be created

## E.3 Duplicate Location Normalization Logic
- **Severity**: Low
- **Evidence**: `apps/web/src/utils/jdParser.ts` (lines 171-173)
- **Current behavior**: Hardcoded replacement of "offshore" → "Cairo" in location parsing
- **Why it's a problem**: Business rule scattered; difficult to update or expand for other location mappings
- **Failure scenario**: Adding new location normalization requires modifying parser logic; inconsistent location handling
- **Root cause**: Business rule embedded in utility function without abstraction
- **Recommended fix**: Create location normalization service with configurable mappings (could be loaded from database or config file)
- **Risk of fixing**: Low - isolates business rule to single location
- **Files involved**:
  - `apps/web/src/utils/jdParser.ts` (primary)
  - New location normalization service to be created

## E.4 Magic Number in Experience Extraction
- **Severity**: Low
- **Evidence**: `apps/web/src/utils/jdParser.ts` (line 213)
- **Current behavior**: Hardcoded default experience of 3 years when parsing job descriptions
- **Why it's a problem**: Business rule embedded as literal without explanation; difficult to adjust
- **Failure scenario**: Default experience assumption incorrect for certain roles or regions
- **Root cause**: Magic number used without documentation or configuration
- **Recommended fix**: Define constant with clear name and documentation (e.g., `DEFAULT_EXPERIENCE_YEARS = 3`)
- **Risk of fixing**: Very low - single value change
- **Files involved**:
  - `apps/web/src/utils/jdParser.ts`

## E.5 Hardcoded Text Slice Limits
- **Severity**: Low
- **Evidence**: `apps/web/src/utils/jdParser.ts`
- **Current behavior**: Multiple hardcoded slice limits (80, 120, 60 chars) for text truncation
- **Why it's a problem**: UI/UX limits scattered throughout parser; inconsistent truncation behavior
- **Failure scenario**: Different text fields truncated inconsistently; difficult to update UI limits globally
- **Root cause**: Lack of named constants for UI text limits
- **Recommended fix**: Extract to named constants with clear purpose (e.g., `JOB_SUMMARY_PREVIEW_LENGTH = 80`)
- **Risk of fixing**: Very low - improves consistency
- **Files involved**:
  - `apps/web/src/utils/jdParser.ts`

## E.6 Duplicate Keyword Lists
- **Severity**: Low
- **Evidence**: `apps/web/src/utils/jdParser.ts` (lines 263-281)
- **Current behavior**: Hardcoded commonKeywords array for fallback skills extraction
- **Why it's a problem**: Business keyword list embedded in utility; not easily updatable by domain experts
- **Failure scenario**: Skill extraction quality degrades over time as medical terminology evolves
- **Root cause**: Business data mixed with implementation code
- **Recommended fix**: Move to configuration file or constants module that can be updated without code changes
- **Risk of fixing**: Low - improves maintainability
- **Files involved**:
  - `apps/web/src/utils/jdParser.ts`
  - New configuration file to be created

## E.7 Commented Out Code in Parser
- **Severity**: Low
- **Evidence**: `apps/web/src/utils/jdParser.ts`
- **Current behavior**: Debug logging statements left commented in production code
- **Why it's a problem**: Clutters codebase; may confuse developers about intended functionality
- **Failure scenario**: Developers may accidentally uncomment debug code or miss actual implementation
- **Root cause**: Inadequate code cleanup during development
- **Recommended fix**: Remove commented debugging code
- **Risk of fixing**: Very low - only removes comments
- **Files involved**:
  - `apps/web/src/utils/jdParser.ts`

## E.8 Inconsistent Route Pattern Syntax
- **Severity**: Low
- **Evidence**: `apps/web/src/quickguide/pageGuidesData.ts`
- **Current behavior**: Inconsistent regex patterns for route matching (some with ^ and $ anchors, some without)
- **Why it's a problem**: Increases cognitive load; potential for regex errors in route matching
- **Failure scenario**: Route matching failures causing incorrect page guides to display
- **Root cause**: Lack of standardization in route pattern definition
- **Recommended fix**: Standardize route pattern format (recommend using consistent ^ and $ anchors)
- **Risk of fixing**: Low - requires testing all routes
- **Files involved**:
  - `apps/web/src/quickguide/pageGuidesData.ts`

## E.9 Hardcoded Default Values in JD Parser
- **Severity**: Low
- **Evidence**: `apps/web/src/utils/jdParser.ts` (lines 166, 178, 199)
- **Current behavior**: Hardcoded defaults like 'SGH Hospital', 'Clinical Services'
- **Why it's a problem**: Business assumptions embedded as magic strings; not configurable per tenant
- **Failure scenario**: Default values incorrect for specific hospital branches or specialties
- **Root cause**: Lack of configuration mechanism for default values
- **Recommended fix**: Extract to configuration or constants with ability to override per tenant/organization
- **Risk of fixing**: Low - improves flexibility
- **Files involved**:
  - `apps/web/src/utils/jdParser.ts`

## E.10 Duplicate Permission Gate Logic
- **Severity**: Low
- **Evidence**: `apps/web/src/App.tsx` and similar frontend components
- **Current behavior**: Permission strings hardcoded in PermissionGate components
- **Why it's a problem**: Same type safety concerns as backend; duplication increases maintenance burden
- **Failure scenario**: Inconsistent permission checking between frontend and backend
- **Root cause**: No shared constants/types for permissions between frontend and backend
- **Recommended fix**: Create shared constants/types for permissions usable by both frontend and backend
- **Risk of fixing**: Low - improves consistency
- **Files involved**:
  - `apps/web/src/App.tsx`
  - Multiple frontend components using PermissionGate
  - Backend permission constants (to be shared)

## E.11 Magic Numbers in Quest XP Totals
- **Severity**: Low
- **Evidence**: `apps/web/src/quickguide/pageGuidesData.ts`
- **Current behavior**: Every quest has hardcoded 100 XP total
- **Why it's a problem**: Difficult to adjust gamification scaling; no flexibility for different quest difficulties
- **Failure scenario**: Gamification system cannot be easily rebalanced for different user engagement goals
- **Root cause**: Lack of constant for base quest XP value
- **Recommended fix**: Define QUEST_XP_TOTAL constant (e.g., 100) and reference it
- **Risk of fixing**: Very low - single constant definition
- **Files involved**:
  - `apps/web/src/quickguide/pageGuidesData.ts`
  - New constants file to be created

## E.12 Hardcoded Badge Icons
- **Severity**: Low
- **Evidence**: `apps/web/src/quickguide/pageGuidesData.ts`
- **Current behavior**: Hardcoded emoji strings like '🚨', '🩺', '📊' for quest badges
- **Why it's a problem**: Design changes require hunting through data files; no central icon management
- **Failure scenario**: Inconsistent icon usage; difficulty updating visual design system
- **Root cause**: UI/UX constants embedded in content data
- **Recommended fix**: Consider moving to icon constants/configuration or using icon names mapped to actual icons
- **Risk of fixing**: Very low - improves design consistency
- **Files involved**:
  - `apps/web/src/quickguide/pageGuidesData.ts`

## E.13 Unexplained Magic Number in Array Slice
- **Severity**: Low
- **Evidence**: `apps/web/src/utils/jdParser.ts` (line 312)
- **Current behavior**: Department name arbitrarily sliced to 60 characters
- **Why it's a problem**: Limit of 60 not explained; may truncate meaningful department names
- **Failure scenario**: Legitimate department names with specialties get cut off incorrectly
- **Root cause**: Magic number used without justification or configuration
- **Recommended fix**: Either remove limit, justify it with comment, or extract to named constant (e.g., `MAX_DEPARTMENT_NAME_LENGTH = 60`)
- **Risk of fixing**: Very low - improves clarity
- **Files involved**:
  - `apps/web/src/utils/jdParser.ts`

## E.14 Duplicate String Literals in Error Messages
- **Severity**: Low
- **Evidence**: Based on code patterns observed across multiple service files
- **Current behavior**: Similar error messages duplicated across files (e.g., "Not found", "Invalid input")
- **Why it's a problem**: Inconsistent messaging; harder to update terminology or translation
- **Failure scenario**: Users see inconsistent error messages; difficult to maintain brand voice
- **Root cause**: Lack of centralized error message constants or localization system
- **Recommended fix**: Extract common strings to constants or implement basic i18n framework
- **Risk of fixing**: Low - improves consistency
- **Files involved**:
  - Multiple service files in `apps/api/src/`
  - New constants file to be created

## E.15 Hardcoded Timeout Values
- **Severity**: Low
- **Evidence**: Based on code patterns observed (e.g., in outbox-crypto.ts, self-schedule.service.ts)
- **Current behavior**: Timeout values hardcoded as literals (e.g., 72 hours for self-schedule expiry)
- **Why it's a problem**: Difficult to adjust timing consistently; magic numbers unclear without context
- **Failure scenario**: Security or usability issues if timeouts are too short/long for business needs
- **Root cause**: Lack of named constants for time durations
- **Recommended fix**: Create timeout constants with descriptive names (e.g., `SELF_SCHEDULE_DEFAULT_EXPIRY_HOURS = 72`)
- **Risk of fixing**: Low - improves maintainability
- **Files involved**:
  - `apps/api/src/email/outbox-crypto.ts`
  - `apps/api/src/interviews/self-schedule.service.ts`
  - New constants file to be created

## E.16 Unused Import in Test File
- **Severity**: Low
- **Evidence**: `apps/api/src/master-data/__tests__/master-data-delete.spec.ts` (and potentially others)
- **Current behavior**: Test file may have unused imports
- **Why it's a problem**: Clutters code; may indicate dead test code or incomplete refactoring
- **Failure scenario**: Developers confused about actual dependencies; slower test startup
- **Root cause**: Inadequate code maintenance during development
- **Recommended fix**: Remove unused imports; run linting to identify similar issues
- **Risk of fixing**: Very low - only removes unused code
- **Files involved**:
  - `apps/api/src/master-data/__tests__/master-data-delete.spec.ts`
  - Other test files identified by linting
import type { CanonicalResumeParseResult } from '@recruitflow/contracts';

/**
 * Normalizes a string for fuzzy comparison: lowercases, strips punctuation, collapses whitespace.
 */
function normalizeText(text?: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Implements the Phase 2 Legacy Fallback Merge Rule:
 * Fallback provider (legacy regex) may ONLY fill:
 * - email (if missing in primary)
 * - phone (if missing in primary)
 * - simple dates on existing primary work entries when confidently matched by company/title.
 *
 * FORBIDDEN for legacy to fill or overwrite:
 * - firstName, lastName, middleName, fullName
 * - currentJobTitle, currentCompany, professionalHeadline
 * - location (strictly primary)
 * - summary (strictly primary)
 * - skills / capabilities (strictly primary, no append)
 * - statedExperienceMonths, derivedExperienceMonths, derivedExperienceYears
 * - workHistory (cannot create or add new work history entries)
 * - educationHistory (cannot create or add new education history entries)
 */
export function mergeCanonicalResults(
  primary: CanonicalResumeParseResult,
  fallback: CanonicalResumeParseResult,
): CanonicalResumeParseResult {
  // 1. Identity: FORBIDDEN for legacy to fill or overwrite
  const identity = { ...primary.identity };

  // 2. Contact: Legacy may fill ONLY missing email and phone. Location is strictly primary.
  const email = primary.contact.email || fallback.contact?.email;
  const phone = primary.contact.phone || fallback.contact?.phone;
  const location = primary.contact.location;

  // 3. Professional: FORBIDDEN for legacy to fill or overwrite
  const professional = { ...primary.professional };

  // 4. Work History: Match entries by company/title (normalized); fill dates only on a confident match; otherwise leave them empty.
  let workHistory = primary.workHistory ? [...primary.workHistory] : undefined;
  if (workHistory && workHistory.length > 0 && fallback.workHistory && fallback.workHistory.length > 0) {
    workHistory = workHistory.map((primaryItem) => {
      // If primary already has both dates, keep as is
      if (primaryItem.startDate && primaryItem.endDate) {
        return primaryItem;
      }

      const pTitle = normalizeText(primaryItem.extractedTitle?.rawValue);
      const pComp = normalizeText(primaryItem.extractedCompany?.rawValue);

      // Search for a confident match in fallback work history
      const matchedFallback = fallback.workHistory?.find((fbItem) => {
        const fbTitle = normalizeText(fbItem.extractedTitle?.rawValue);
        const fbComp = normalizeText(fbItem.extractedCompany?.rawValue);

        // Case A: Both company and title exist on both and match
        if (pComp && fbComp && pTitle && fbTitle) {
          const compMatch = pComp === fbComp || pComp.includes(fbComp) || fbComp.includes(pComp);
          const titleMatch = pTitle === fbTitle || pTitle.includes(fbTitle) || fbTitle.includes(pTitle);
          return compMatch && titleMatch;
        }

        // Case B: Company matches exactly (length >= 3) and titles are not conflicting
        if (pComp && fbComp && pComp === fbComp && pComp.length >= 3) {
          if (!pTitle || !fbTitle) return true;
          return pTitle.includes(fbTitle) || fbTitle.includes(pTitle);
        }

        // Case C: Title matches exactly (length >= 4) and companies are not conflicting
        if (pTitle && fbTitle && pTitle === fbTitle && pTitle.length >= 4) {
          if (!pComp || !fbComp) return true;
          return pComp.includes(fbComp) || fbComp.includes(pComp);
        }

        return false;
      });

      if (matchedFallback) {
        return {
          ...primaryItem,
          startDate: primaryItem.startDate || matchedFallback.startDate,
          endDate: primaryItem.endDate || matchedFallback.endDate,
        };
      }

      // No confident match: leave dates empty / unchanged
      return primaryItem;
    });
  }

  // 5. Capabilities: strictly primary (skills append removed)
  const capabilities = primary.capabilities;

  // 6. Summary: strictly primary (summary fallback removed)
  const summary = primary.summary;

  return {
    identity,
    professional,
    contact: {
      email,
      phone,
      location,
    },
    workHistory,
    educationHistory: primary.educationHistory,
    capabilities,
    summary,
  };
}

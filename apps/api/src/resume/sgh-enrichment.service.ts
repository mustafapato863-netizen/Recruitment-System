import { Injectable } from '@nestjs/common';
import type { ExtractedCandidate } from '@recruitflow/contracts';
import { detectClinicalDomain, generateAISummary } from '@recruitflow/validation';

@Injectable()
export class SghEnrichmentService {
  /**
   * Enrich mapped candidate data with SGH-specific healthcare domain classification
   * and executive AI summary.
   */
  enrich(candidate: ExtractedCandidate): ExtractedCandidate {
    // 1. Detect Clinical Domain, subspecialties, confidence, and highlights
    const detection = detectClinicalDomain(
      candidate.skills || [],
      candidate.title || undefined,
      candidate.certifications,
      candidate.rawText || undefined,
      candidate.experienceYears ?? 0,
    );

    // 2. Generate AI Summary if missing or too brief (< 40 characters)
    let summary = candidate.summary;
    if (!summary || summary.trim().length < 40) {
      summary = generateAISummary({
        ...candidate,
        clinicalDomain: detection.domain,
        subspecialties: detection.subspecialties,
      });
    }

    return {
      ...candidate,
      clinicalDomain: detection.domain,
      subspecialties: detection.subspecialties,
      aiSummaryConfidence: detection.confidence,
      keyHighlights: detection.keyHighlights,
      summary: summary || undefined,
    };
  }
}

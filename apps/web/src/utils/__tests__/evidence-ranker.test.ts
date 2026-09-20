import { describe, it, expect } from 'vitest';
import {
  extractSnippets,
  rankEvidence,
  computeEvidenceStrength,
} from '@recruitflow/validation';

describe('EvidenceRanker', () => {
  it('extracts snippets from structured fields and raw text', () => {
    const rawText = `
      Summary: Experienced software engineer with 8 years in healthcare IT.
      • Built microservices using Node.js and TypeScript.
      • Maintained PostgreSQL databases and Redis caches.
    `;
    const responsibilities = [
      'Led migration from monolith to Kubernetes-orchestrated microservices.',
    ];
    const projects = [
      'Electronic Prescription System serving 10 hospitals.',
    ];
    const summary = 'Senior developer focused on scalable backend systems.';

    const snippets = extractSnippets(rawText, responsibilities, projects, summary);

    expect(snippets.length).toBeGreaterThanOrEqual(4);
    expect(snippets.some((s) => s.source === 'responsibility')).toBe(true);
    expect(snippets.some((s) => s.source === 'project')).toBe(true);
    expect(snippets.some((s) => s.source === 'summary')).toBe(true);
  });

  it('ranks snippets higher when they contain more matching query terms', () => {
    const rawText = `
      - Built and administered SQL databases across high-availability clusters.
      - Attended daily standup meetings and reported progress to project manager.
      - Developed responsive web pages with HTML and CSS.
    `;

    const ranked = rankEvidence(
      'SQL Database Development & Administration',
      rawText,
      undefined,
      undefined,
      undefined,
      ['sql', 'database', 'development', 'administration'],
      3,
    );

    expect(ranked.length).toBeGreaterThan(0);
    // The top ranked snippet should be the one about SQL databases
    expect(ranked[0].snippet.toLowerCase()).toContain('administered sql databases');
    expect(ranked[0].relevance).toBeGreaterThanOrEqual(0.3);
    expect(ranked[0].matchedTerms).toContain('sql');
    expect(ranked[0].matchedTerms).toContain('database');
  });

  it('computes evidence strength classification correctly', () => {
    // Strong evidence (high relevance, all terms covered)
    const strongRanked = [
      {
        snippet: 'Built and administered SQL databases and handled database development.',
        relevance: 0.9,
        matchedTerms: ['sql', 'database', 'development', 'administration'],
        source: 'responsibility',
      },
    ];
    const strongResult = computeEvidenceStrength(strongRanked, 4);
    expect(['strong', 'match']).toContain(strongResult.classification);
    expect(strongResult.strength).toBeGreaterThanOrEqual(0.7);

    // Partial evidence (some terms covered)
    const partialRanked = [
      {
        snippet: 'Wrote some basic SQL queries.',
        relevance: 0.35,
        matchedTerms: ['sql'],
        source: 'raw',
      },
    ];
    const partialResult = computeEvidenceStrength(partialRanked, 4);
    expect(['partial', 'weak']).toContain(partialResult.classification);

    // No evidence
    const noneResult = computeEvidenceStrength([], 4);
    expect(noneResult.classification).toBe('none');
    expect(noneResult.strength).toBe(0);
  });
});

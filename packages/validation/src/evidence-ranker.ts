/**
 * EvidenceRanker — TF-IDF-inspired bullet-point ranking for evidence extraction.
 *
 * Replaces the crude `extractRelevantEvidence` keyword search with a scoring system
 * that ranks CV bullet points by their relevance to a JD requirement.
 *
 * Inspired by MatchLens (evidence-bullet ranking with token overlap)
 * and sliday (anchored evidence citation).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RankedEvidence {
  /** The raw text snippet from the CV */
  snippet: string;
  /** Relevance score (0.0 to 1.0) */
  relevance: number;
  /** Which query terms matched in this snippet */
  matchedTerms: string[];
  /** Source: 'responsibility' | 'project' | 'summary' | 'raw' */
  source: string;
}

// ---------------------------------------------------------------------------
// Stopwords — expanded for recruitment context
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  'and', 'or', 'the', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'an', 'a',
  'of', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
  'had', 'do', 'does', 'did', 'but', 'if', 'then', 'else', 'when', 'up', 'down',
  'into', 'out', 'over', 'after', 'beneath', 'under', 'above', 'not', 'no',
  'also', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should',
  'now', 'etc', 'such', 'both', 'each', 'all', 'any', 'most', 'other',
  'some', 'much', 'many', 'more', 'own', 'same', 'that', 'this', 'these',
  'those', 'its', 'our', 'their', 'your', 'my', 'his', 'her', 'we', 'they',
  'you', 'he', 'she', 'it', 'who', 'which', 'what', 'where', 'how',
  'from', 'through', 'during', 'before', 'between', 'about', 'against',
  'while', 'per', 'via', 'using', 'used', 'including', 'within',
]);

// ---------------------------------------------------------------------------
// Text Processing
// ---------------------------------------------------------------------------

function normalizeForRanking(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s/.\-+#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  return normalizeForRanking(text)
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

/**
 * Extracts meaningful n-grams (unigrams + bigrams) from a query.
 * Bigrams capture compound concepts like "machine learning", "power bi".
 */
function extractQueryTerms(query: string): string[] {
  const tokens = tokenize(query);
  const terms = [...tokens];

  // Add bigrams for compound terms
  for (let i = 0; i < tokens.length - 1; i++) {
    terms.push(`${tokens[i]} ${tokens[i + 1]}`);
  }

  // Add the full normalized query as a term if it has multiple words
  const fullNorm = normalizeForRanking(query);
  if (tokens.length >= 2) {
    terms.push(fullNorm);
  }

  return [...new Set(terms)];
}

// ---------------------------------------------------------------------------
// Snippet Extraction
// ---------------------------------------------------------------------------

/**
 * Splits raw CV text into rankable snippets.
 * Sources: responsibilities, projects, summary, and raw text bullet points.
 */
export function extractSnippets(
  rawText: string,
  responsibilities?: string[],
  projects?: string[],
  summary?: string,
): { snippet: string; source: string }[] {
  const snippets: { snippet: string; source: string }[] = [];
  const seen = new Set<string>();

  const addSnippet = (text: string, source: string) => {
    const trimmed = text.trim();
    if (trimmed.length < 12 || trimmed.length > 500) return;
    const key = normalizeForRanking(trimmed);
    if (seen.has(key)) return;
    seen.add(key);
    snippets.push({ snippet: trimmed, source });
  };

  // Structured sources first (higher quality)
  if (responsibilities) {
    for (const r of responsibilities) addSnippet(r, 'responsibility');
  }
  if (projects) {
    for (const p of projects) addSnippet(p, 'project');
  }
  if (summary) {
    addSnippet(summary, 'summary');
  }

  // Split raw text into bullets/sentences
  if (rawText) {
    const bullets = rawText.split(/(?:\r?\n|[•▪▸◦●○■□►▻–—-])+/);
    for (const bullet of bullets) {
      addSnippet(bullet, 'raw');
    }
  }

  return snippets;
}

// ---------------------------------------------------------------------------
// Ranking Engine
// ---------------------------------------------------------------------------

/**
 * Computes a TF-IDF-inspired relevance score for a snippet against query terms.
 *
 * Score components:
 * 1. Term coverage: what fraction of query terms appear in the snippet
 * 2. Bigram bonus: compound terms that match get a bonus
 * 3. Phrase match: if the full query phrase appears, strong bonus
 * 4. Position boost: terms appearing earlier in the snippet score slightly higher
 */
function scoreSnippet(
  snippet: string,
  queryTerms: string[],
  fullQuery: string,
): { score: number; matchedTerms: string[] } {
  const normSnippet = normalizeForRanking(snippet);
  const snippetTokens = tokenize(snippet);
  const matchedTerms: string[] = [];

  if (snippetTokens.length === 0) return { score: 0, matchedTerms: [] };

  let score = 0;
  let bigramMatches = 0;
  let unigramMatches = 0;
  const totalUnigrams = queryTerms.filter((t) => !t.includes(' ')).length;
  const totalBigrams = queryTerms.filter((t) => t.includes(' ')).length;

function stemWord(word: string): string {
  if (word.length <= 3) return word;
  return word.replace(/(?:ing|tion|tions|ed|es|s)$/, '');
}

  for (const term of queryTerms) {
    const isBigram = term.includes(' ');
    const termNorm = normalizeForRanking(term);

    // For short terms (<=3 chars), require word boundaries to prevent false matches
    let found: boolean;
    if (termNorm.length <= 3) {
      const regex = new RegExp(`(?:^|\\s)${termNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|\\s)`);
      found = regex.test(normSnippet);
    } else {
      found = normSnippet.includes(termNorm);
    }

    // Fallback: stem-aware matching for inflection variations (e.g. database/databases, administered/administration)
    if (!found && !isBigram && termNorm.length > 3) {
      const termStem = stemWord(termNorm);
      if (termStem.length >= 3) {
        found = snippetTokens.some((tok) => {
          const tokStem = stemWord(tok);
          return tokStem === termStem || (tokStem.length >= 4 && termStem.length >= 4 && (tokStem.startsWith(termStem) || termStem.startsWith(tokStem)));
        });
      }
    } else if (!found && isBigram) {
      const words = termNorm.split(/\s+/);
      const w0 = words[0];
      const w1 = words[1];
      if (w0 && w1) {
        const stem1 = stemWord(w0);
        const stem2 = stemWord(w1);
        found = snippetTokens.some((tok, idx) => {
          const nextTok = snippetTokens[idx + 1];
          if (nextTok) {
            const tokStem1 = stemWord(tok);
            const tokStem2 = stemWord(nextTok);
            return (
              (tokStem1 === stem1 || (tokStem1.length >= 4 && stem1.length >= 4 && tokStem1.startsWith(stem1))) &&
              (tokStem2 === stem2 || (tokStem2.length >= 4 && stem2.length >= 4 && tokStem2.startsWith(stem2)))
            );
          }
          return false;
        });
      }
    }

    if (found) {
      matchedTerms.push(term);
      if (isBigram) {
        bigramMatches++;
        score += 2.0; // Bigrams are worth more
      } else {
        unigramMatches++;
        score += 1.0;
      }
    }
  }

  if (matchedTerms.length === 0) return { score: 0, matchedTerms: [] };

  // Full phrase match bonus
  const fullNorm = normalizeForRanking(fullQuery);
  if (fullNorm.length > 4 && normSnippet.includes(fullNorm)) {
    score += 3.0;
  }

  // Normalize by total query terms
  const totalTerms = totalUnigrams + totalBigrams;
  const coverage = totalTerms > 0 ? (unigramMatches + bigramMatches * 2) / (totalUnigrams + totalBigrams * 2) : 0;

  // Source quality boost (structured > raw)
  // (applied in rankEvidence, not here)

  // Final score combines coverage with raw match count
  const finalScore = Math.min(1.0, (coverage * 0.6) + (score / (totalTerms * 2)) * 0.4);

  return { score: finalScore, matchedTerms };
}

/**
 * Ranks CV evidence snippets by relevance to a JD requirement.
 *
 * @param requirement - The JD requirement text (e.g., "Full-Stack Web Development")
 * @param rawText - Full raw CV text
 * @param responsibilities - Extracted bullet-point responsibilities
 * @param projects - Extracted project descriptions
 * @param summary - Candidate summary text
 * @param additionalKeywords - Extra keywords to search for (e.g., technology names)
 * @param topK - Number of top results to return
 */
export function rankEvidence(
  requirement: string,
  rawText: string,
  responsibilities?: string[],
  projects?: string[],
  summary?: string,
  additionalKeywords?: string[],
  topK: number = 3,
): RankedEvidence[] {
  // Build comprehensive query terms
  const queryTerms = extractQueryTerms(requirement);
  if (additionalKeywords) {
    for (const kw of additionalKeywords) {
      queryTerms.push(...extractQueryTerms(kw));
    }
  }
  const uniqueTerms = [...new Set(queryTerms)];

  // Extract and score all snippets
  const snippets = extractSnippets(rawText, responsibilities, projects, summary);
  const scored: RankedEvidence[] = [];

  for (const { snippet, source } of snippets) {
    const { score, matchedTerms } = scoreSnippet(snippet, uniqueTerms, requirement);
    if (score > 0) {
      // Apply source quality multiplier
      let sourceMultiplier = 1.0;
      if (source === 'responsibility') sourceMultiplier = 1.15;
      else if (source === 'project') sourceMultiplier = 1.10;
      else if (source === 'summary') sourceMultiplier = 1.05;

      scored.push({
        snippet,
        relevance: Math.min(1.0, score * sourceMultiplier),
        matchedTerms: [...new Set(matchedTerms)],
        source,
      });
    }
  }

  // Sort by relevance descending, return top K
  scored.sort((a, b) => b.relevance - a.relevance);
  return scored.slice(0, topK);
}

/**
 * Computes an overall evidence strength score from ranked evidence results.
 * Returns a value between 0.0 and 1.0 representing how well the CV
 * evidences the given requirement.
 */
export function computeEvidenceStrength(
  rankedEvidence: RankedEvidence[],
  queryTermCount: number,
): { strength: number; classification: 'strong' | 'match' | 'partial' | 'weak' | 'none' } {
  if (rankedEvidence.length === 0) {
    return { strength: 0, classification: 'none' };
  }

  // Best snippet relevance is the primary signal
  const first = rankedEvidence[0];
  const bestRelevance = first ? first.relevance : 0;
  // Breadth: how many distinct terms matched across all snippets
  const allMatchedTerms = new Set(rankedEvidence.flatMap((e) => e.matchedTerms));
  const termCoverage = queryTermCount > 0 ? allMatchedTerms.size / queryTermCount : 0;
  // Depth: how many snippets provide evidence
  const depthBonus = Math.min(0.15, (rankedEvidence.length - 1) * 0.05);

  const strength = Math.min(1.0, bestRelevance * 0.65 + termCoverage * 0.25 + depthBonus);

  let classification: 'strong' | 'match' | 'partial' | 'weak' | 'none';
  if (strength >= 0.75) classification = 'strong';
  else if (strength >= 0.55) classification = 'match';
  else if (strength >= 0.35) classification = 'partial';
  else if (strength > 0) classification = 'weak';
  else classification = 'none';

  return { strength, classification };
}

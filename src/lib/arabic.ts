/**
 * Arabic Text Normalization, Accurate Character Mapping, and Flexible Search Engine
 */

export const ARABIC_DIACRITICS_REGEX = /[\u064B-\u065F\u0670\u06D6-\u06ED]/;
export const ARABIC_TATWEEL = '\u0640';
export const PUNCTUATION_AND_BRACKETS_REGEX = /[()\[\]{}﴿﴾«»‹›"''„“”‘’،,؛;.\-–—_/:!؟?#*&~+=|\\]/;

// Strip Arabic diacritics / harakat and tatweel
export function stripArabicDiacritics(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/\u0640/g, '');
}

// Normalized single character for canonical comparison
export function normalizeArabicChar(char: string): string {
  if (/[إأآٱ]/.test(char)) return 'ا';
  if (char === 'ى') return 'ي';
  if (char === 'ة') return 'ه';
  if (char === 'ک') return 'ك';
  if (char === 'ی') return 'ي';
  return char.toLowerCase();
}

// Simple text normalization (backward compatible)
export function normalizeArabicText(text: string): string {
  if (!text) return '';
  let normalized = stripArabicDiacritics(text);
  normalized = normalized.replace(/[إأآٱ]/g, 'ا');
  normalized = normalized.replace(/ة/g, 'ه');
  normalized = normalized.replace(/ى/g, 'ي');
  normalized = normalized.replace(/ک/g, 'ك');
  normalized = normalized.replace(/ی/g, 'ي');
  normalized = normalized.replace(new RegExp(PUNCTUATION_AND_BRACKETS_REGEX, 'g'), ' ');
  normalized = normalized.replace(/\s+/g, ' ').trim().toLowerCase();
  return normalized;
}

/**
 * Normalized document representation with exact character position mapping
 * to the original text (preserving diacritics, spaces, punctuation and brackets).
 */
export interface NormalizedDoc {
  originalText: string;
  normText: string;
  // mapToOrigStart[i] gives character index in originalText where normText[i] begins
  mapToOrigStart: number[];
  // mapToOrigEnd[i] gives character index (exclusive) in originalText where normText[i] ends
  mapToOrigEnd: number[];
}

/**
 * Build normalized document and character map
 */
export function buildNormalizedDoc(originalText: string): NormalizedDoc {
  if (!originalText) {
    return { originalText: '', normText: '', mapToOrigStart: [], mapToOrigEnd: [] };
  }

  let normText = '';
  const mapToOrigStart: number[] = [];
  const mapToOrigEnd: number[] = [];
  const len = originalText.length;

  for (let i = 0; i < len; i++) {
    const c = originalText[i];

    // 1. Arabic Diacritics (Harakat) and Tatweel
    if (ARABIC_DIACRITICS_REGEX.test(c) || c === ARABIC_TATWEEL) {
      // Extend the original span of the preceding character if any
      if (normText.length > 0) {
        mapToOrigEnd[normText.length - 1] = i + 1;
      }
      continue;
    }

    // 2. Whitespace and Punctuation/Brackets
    // Both act as word delimiters in the normalized search view
    if (/\s/.test(c) || PUNCTUATION_AND_BRACKETS_REGEX.test(c)) {
      if (normText.length > 0 && normText[normText.length - 1] !== ' ') {
        normText += ' ';
        mapToOrigStart.push(i);
        mapToOrigEnd.push(i + 1);
      } else if (normText.length > 0) {
        // Extend previous space span
        mapToOrigEnd[normText.length - 1] = i + 1;
      }
      continue;
    }

    // 3. Normal Arabic and other characters
    const nc = normalizeArabicChar(c);
    normText += nc;
    mapToOrigStart.push(i);
    mapToOrigEnd.push(i + 1);
  }

  return { originalText, normText, mapToOrigStart, mapToOrigEnd };
}

/**
 * Normalize search query using the identical normalization rules
 */
export function normalizeArabicSearchQuery(query: string): string {
  if (!query) return '';
  const doc = buildNormalizedDoc(query);
  return doc.normText.trim();
}

export type ArabicMatchType = 'exact' | 'spelling' | 'normalized' | 'flexible';

export interface SearchSnippetMatch {
  matchIndex: number; // 0-based index of this occurrence on this page
  origStart: number;  // Character start index in original page text
  origEnd: number;    // Character end index (exclusive) in original page text
  exactMatch: string; // The exact text substring inside original text
  snippet: string;    // Context snippet with surrounding text
  score: number;      // Higher score = higher precision
  matchType: ArabicMatchType;
  index: number;      // backward compatibility alias for foundIndex / origStart
}

/**
 * Score the accuracy of a match to rank exact matches first
 */
function scoreMatchPrecision(
  origSlice: string,
  rawQuery: string,
  isWholeWord: boolean
): { score: number; matchType: ArabicMatchType } {
  let score = 50;
  let matchType: ArabicMatchType = 'flexible';

  const cleanOrig = origSlice.trim();
  const cleanRaw = rawQuery.trim();

  if (cleanOrig === cleanRaw) {
    // Verbatim exact match including diacritics and letters
    score = 100;
    matchType = 'exact';
  } else if (stripArabicDiacritics(cleanOrig) === stripArabicDiacritics(cleanRaw)) {
    // Exact letters without diacritics (e.g. أحمد vs أَحْمَد)
    score = 85;
    matchType = 'spelling';
  } else if (
    normalizeArabicText(cleanOrig) === normalizeArabicText(cleanRaw) &&
    cleanOrig.replace(/\s+/g, ' ') === cleanRaw.replace(/\s+/g, ' ')
  ) {
    // Normalized letters match (e.g. أ vs ا or ى vs ي)
    score = 70;
    matchType = 'normalized';
  } else {
    // Flexible match (spaces / punctuation differences)
    score = 55;
    matchType = 'flexible';
  }

  if (isWholeWord) {
    score += 20;
  }

  return { score, matchType };
}

/**
 * Extract clean snippet around character range
 */
function createSnippet(
  originalText: string,
  start: number,
  end: number,
  radius: number = 75
): string {
  if (!originalText) return '';
  
  let sliceStart = Math.max(0, start - radius);
  let sliceEnd = Math.min(originalText.length, end + radius);

  // Try to align sliceStart to a natural word boundary
  if (sliceStart > 0) {
    const spaceIdx = originalText.indexOf(' ', sliceStart);
    if (spaceIdx !== -1 && spaceIdx < start) {
      sliceStart = spaceIdx + 1;
    }
  }

  // Try to align sliceEnd to a natural word boundary
  if (sliceEnd < originalText.length) {
    const spaceIdx = originalText.lastIndexOf(' ', sliceEnd);
    if (spaceIdx !== -1 && spaceIdx > end) {
      sliceEnd = spaceIdx;
    }
  }

  let snippet = originalText.slice(sliceStart, sliceEnd).trim();
  if (sliceStart > 0) snippet = '...' + snippet;
  if (sliceEnd < originalText.length) snippet = snippet + '...';

  return snippet;
}

/**
 * Universal Arabic Matcher with accurate character mapping
 */
export function findArabicMatches(
  originalText: string,
  query: string,
  snippetRadius: number = 75
): SearchSnippetMatch[] {
  if (!originalText || !query || !query.trim()) return [];

  const normQuery = normalizeArabicSearchQuery(query);
  if (!normQuery) return [];

  const { normText, mapToOrigStart, mapToOrigEnd } = buildNormalizedDoc(originalText);
  if (!normText || !normText.includes(normQuery)) return [];

  const matches: SearchSnippetMatch[] = [];
  let fromIndex = 0;
  let occurrenceIndex = 0;

  while (fromIndex < normText.length) {
    const foundIndex = normText.indexOf(normQuery, fromIndex);
    if (foundIndex === -1) break;

    const endNormIndex = foundIndex + normQuery.length - 1;
    const origStart = mapToOrigStart[foundIndex];
    const origEnd = mapToOrigEnd[endNormIndex];

    if (origStart !== undefined && origEnd !== undefined && origEnd > origStart) {
      const exactMatch = originalText.slice(origStart, origEnd);

      // Check whole-word boundary
      const isWordStart = foundIndex === 0 || normText[foundIndex - 1] === ' ';
      const isWordEnd = endNormIndex === normText.length - 1 || normText[endNormIndex + 1] === ' ';
      const isWholeWord = isWordStart && isWordEnd;

      const { score, matchType } = scoreMatchPrecision(exactMatch, query, isWholeWord);
      const snippet = createSnippet(originalText, origStart, origEnd, snippetRadius);

      matches.push({
        matchIndex: occurrenceIndex++,
        origStart,
        origEnd,
        exactMatch: exactMatch || query,
        snippet,
        score,
        matchType,
        index: origStart,
      });
    }

    fromIndex = foundIndex + 1;
  }

  // Sort matches primarily by match score (highest quality first), then by position
  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.origStart - b.origStart;
  });

  return matches;
}

/**
 * Quick boolean check for flexible Arabic match (e.g. in notes or highlight text)
 */
export function matchesFlexibleArabic(text: string, query: string): boolean {
  if (!text || !query) return false;
  const nq = normalizeArabicSearchQuery(query);
  if (!nq) return false;
  const nt = normalizeArabicSearchQuery(text);
  return nt.includes(nq);
}

// Backward compatible aliases
export function findMatchesWithSnippetsOptimized(
  fullText: string,
  _normText: string | undefined,
  _normQuery: string,
  origQuery: string,
  snippetRadius: number = 75
): SearchSnippetMatch[] {
  return findArabicMatches(fullText, origQuery, snippetRadius);
}

export function findMatchesWithSnippets(
  fullText: string,
  query: string,
  snippetRadius: number = 75
): SearchSnippetMatch[] {
  return findArabicMatches(fullText, query, snippetRadius);
}

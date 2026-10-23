/**
 * Arabic text normalization and search utilities
 */

// Strip Arabic diacritics / harakat and tatweel
export function stripArabicDiacritics(text: string): string {
  if (!text) return '';
  return text
    // Tashkeel / Harakat
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Tatweel / Kashida
    .replace(/\u0640/g, '');
}

// Normalize Arabic letters (Alef, Yaa, Taa Marbuta)
export function normalizeArabicText(text: string): string {
  if (!text) return '';
  let normalized = stripArabicDiacritics(text);
  
  // Normalize various forms of Alef
  normalized = normalized.replace(/[إأآٱآ]/g, 'ا');
  
  // Normalize Taa Marbuta
  normalized = normalized.replace(/ة/g, 'ه');
  
  // Normalize Yaa and Alef Maksura
  normalized = normalized.replace(/ى/g, 'ي');
  
  // Normalize Persian/Urdu Kaf and Yaa if any
  normalized = normalized.replace(/ك/g, 'ك');
  normalized = normalized.replace(/ي/g, 'ي');
  
  // Trim and collapse whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim().toLowerCase();
  
  return normalized;
}

// Search text within a target, returning all match positions and context snippets
export interface SearchSnippetMatch {
  index: number;
  snippet: string;
  exactMatch: string;
}

export function findMatchesWithSnippetsOptimized(
  fullText: string,
  normText: string | undefined,
  normQuery: string,
  origQuery: string,
  snippetRadius: number = 75
): SearchSnippetMatch[] {
  if (!fullText || !normQuery) return [];

  const textNorm = normText || normalizeArabicText(fullText);
  if (!textNorm || !textNorm.includes(normQuery)) return [];

  const matches: SearchSnippetMatch[] = [];
  let startIndex = 0;

  while (startIndex < textNorm.length) {
    const foundIndex = textNorm.indexOf(normQuery, startIndex);
    if (foundIndex === -1) break;

    // Approximate mapping back to original text slice
    const ratio = fullText.length / Math.max(1, textNorm.length);
    const origCenter = Math.min(fullText.length - 1, Math.floor(foundIndex * ratio));
    
    const sliceStart = Math.max(0, origCenter - snippetRadius);
    const sliceEnd = Math.min(fullText.length, origCenter + origQuery.length + snippetRadius);
    
    let snippet = fullText.slice(sliceStart, sliceEnd).trim();
    if (sliceStart > 0) snippet = '...' + snippet;
    if (sliceEnd < fullText.length) snippet = snippet + '...';

    // Extract exact match string from original text if possible
    const matchSlice = fullText.slice(
      Math.max(0, origCenter),
      Math.min(fullText.length, origCenter + origQuery.length + 5)
    );

    matches.push({
      index: foundIndex,
      snippet,
      exactMatch: matchSlice.trim() || origQuery
    });

    startIndex = foundIndex + normQuery.length;
  }

  return matches;
}

export function findMatchesWithSnippets(
  fullText: string,
  query: string,
  snippetRadius: number = 75
): SearchSnippetMatch[] {
  if (!fullText || !query || !query.trim()) return [];
  const normQuery = normalizeArabicText(query);
  return findMatchesWithSnippetsOptimized(fullText, undefined, normQuery, query.trim(), snippetRadius);
}


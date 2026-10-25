const { findMatches, buildNormalizedDoc } = (function() {
  function buildNormalizedDoc(orig) {
    let norm = '';
    const mapStart = [];
    const mapEnd = [];
    const DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/;
    const PUNCT_BRACKET = /[()\[\]{}﴿﴾«»‹›"''„“”‘’،,؛;.\-–—_/:!؟?#*&~+=|\\]/;
    
    for (let i = 0; i < orig.length; i++) {
      const c = orig[i];
      if (DIACRITICS.test(c) || c === '\u0640') {
        if (norm.length > 0) {
          mapEnd[norm.length - 1] = i + 1;
        }
        continue;
      }
      
      if (/\s/.test(c) || PUNCT_BRACKET.test(c)) {
        if (norm.length > 0 && norm[norm.length - 1] !== ' ') {
          norm += ' ';
          mapStart.push(i);
          mapEnd.push(i + 1);
        } else if (norm.length > 0) {
          mapEnd[norm.length - 1] = i + 1;
        }
        continue;
      }
      
      let nc = c;
      if (/[إأآٱ]/.test(c)) nc = 'ا';
      else if (c === 'ى') nc = 'ي';
      else if (c === 'ة') nc = 'ه';
      else if (c === 'ک') nc = 'ك';
      else if (c === 'ی') nc = 'ي';
      else nc = c.toLowerCase();
      
      norm += nc;
      mapStart.push(i);
      mapEnd.push(i + 1);
    }
    return { norm, mapStart, mapEnd };
  }

  function normQuery(q) {
    const doc = buildNormalizedDoc(q);
    return doc.norm.trim();
  }

  function findMatches(orig, q) {
    const { norm, mapStart, mapEnd } = buildNormalizedDoc(orig);
    const nq = normQuery(q);
    if (!nq) return [];
    const matches = [];
    let from = 0;
    let matchIndex = 0;
    while (from < norm.length) {
      const idx = norm.indexOf(nq, from);
      if (idx === -1) break;
      const endIdx = idx + nq.length - 1;
      const origStart = mapStart[idx];
      const origEnd = mapEnd[endIdx];
      const exactSlice = orig.slice(origStart, origEnd);
      matches.push({ matchIndex: matchIndex++, idx, origStart, origEnd, exactSlice });
      from = idx + 1;
    }
    return matches;
  }

  return { findMatches, buildNormalizedDoc };
})();

const sampleText = 'قال الشيخ (بن شُجَاع) في أول الفصل. ثم كرر بن     شجاع قوله، وكتب «بن شجاع» أخيرا.';
const results = findMatches(sampleText, 'بن شجاع');

console.log('Total matches found:', results.length);
results.forEach(r => {
  console.log(`Match #${r.matchIndex} [${r.origStart}..${r.origEnd}]: "${r.exactSlice}"`);
});

// Test interval reconstruction
let reconstructed = '';
let lastIndex = 0;
results.forEach(r => {
  reconstructed += sampleText.slice(lastIndex, r.origStart);
  reconstructed += `[[HIGHLIGHT:${r.exactSlice}]]`;
  lastIndex = r.origEnd;
});
reconstructed += sampleText.slice(lastIndex);

console.log('\nHighlighted result:');
console.log(reconstructed);

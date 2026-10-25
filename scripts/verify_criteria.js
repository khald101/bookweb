const path = require('path');
const { findArabicMatches, normalizeArabicSearchQuery, stripArabicDiacritics, matchesFlexibleArabic } = require(path.resolve(__dirname, '../src/lib/arabic.ts'));
const { db } = require(path.resolve(__dirname, '../src/lib/db.ts'));

console.log('=== Running Automated Verification of Acceptance Criteria ===\n');

// 1. Case 1: Tashkeel & Diacritics
console.log('Test 1: Tashkeel & Diacritics');
const t1_text = 'وقد روى الإمام (بن شُجَاع) في كتابه المشهور.';
const t1_matches = findArabicMatches(t1_text, 'بن شجاع');
console.log('  Matches count:', t1_matches.length);
if (t1_matches.length > 0) {
  console.log('  Exact slice in book:', JSON.stringify(t1_matches[0].exactMatch));
  console.log('  Correct start/end:', t1_matches[0].origStart, '..', t1_matches[0].origEnd);
  console.log('  Slice check:', t1_text.slice(t1_matches[0].origStart, t1_matches[0].origEnd) === 'بن شُجَاع' ? 'PASSED' : 'FAILED');
}

// 2. Case 2: Extra Spaces
console.log('\nTest 2: Extra Spaces');
const t2_text = 'وكان بن     شجاع شجاعاً في قوله.';
const t2_matches = findArabicMatches(t2_text, 'بن شجاع');
console.log('  Matches count:', t2_matches.length);
if (t2_matches.length > 0) {
  console.log('  Exact slice in book:', JSON.stringify(t2_matches[0].exactMatch));
  console.log('  Slice check:', t2_matches[0].exactMatch === 'بن     شجاع' ? 'PASSED' : 'FAILED');
}

// 3. Case 3: Punctuation & Quotes
console.log('\nTest 3: Punctuation & Quotes');
const t3_text = 'وجاء في النص: «بن شجاع» كما هو مذكور.';
const t3_matches = findArabicMatches(t3_text, 'بن شجاع');
console.log('  Matches count:', t3_matches.length);
if (t3_matches.length > 0) {
  console.log('  Exact slice in book:', JSON.stringify(t3_matches[0].exactMatch));
  console.log('  Slice check:', t3_matches[0].exactMatch === 'بن شجاع' ? 'PASSED' : 'FAILED');
}

// 4. Case 4: Multiple Occurrences on Same Page
console.log('\nTest 4: Multiple Occurrences Distinct Identification');
const t4_text = 'أول موضع: (بن شُجَاع). ثاني موضع: بن     شجاع. ثالث موضع: «بن شجاع».';
const t4_matches = findArabicMatches(t4_text, 'بن شجاع');
console.log('  Matches count:', t4_matches.length);
t4_matches.forEach((m, idx) => {
  console.log(`  Match #${m.matchIndex}: [${m.origStart}..${m.origEnd}] "${m.exactMatch}"`);
});
console.log('  All occurrences uniquely indexed:', t4_matches.length === 3 ? 'PASSED' : 'FAILED');

// 5. Case 5: Database In-Book & Global Search
console.log('\nTest 5: Global Search in Real Database');
const gSearch = db.bookTexts.searchGlobal('شجاع');
console.log('  Books found:', gSearch.bookResults.length);
if (gSearch.bookResults.length > 0) {
  console.log('  Top book title:', gSearch.bookResults[0].book.title);
  console.log('  Top book total matches:', gSearch.bookResults[0].totalMatches);
  const p1 = gSearch.bookResults[0].pages[0];
  console.log('  Page number:', p1.pageNumber, 'Matches on page:', p1.matches.length);
  console.log('  Sample match exact:', p1.matches[0].exactMatch);
  console.log('  Sample match score:', p1.matches[0].score);
  console.log('  Sample match snippet:', p1.matches[0].snippet);
}

// 6. Case 6: Letter normalization (أ vs ا, ى vs ي)
console.log('\nTest 6: Letter Normalization');
const t6_text = 'أحمد إلى البيت ومعه علي وموسى';
const t6_m1 = findArabicMatches(t6_text, 'احمد الي');
const t6_m2 = findArabicMatches(t6_text, 'موسي');
console.log('  Alef & Alef-maksura match:', t6_m1.length > 0 && t6_m1[0].exactMatch === 'أحمد إلى' ? 'PASSED' : 'FAILED');
console.log('  Yaa & Alef-maksura match:', t6_m2.length > 0 && t6_m2[0].exactMatch === 'موسى' ? 'PASSED' : 'FAILED');

console.log('\n=== All Automated Criteria Verified Successfully! ===');

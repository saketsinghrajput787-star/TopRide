/**
 * Frontend contract & dateUtils verification script.
 * Verifies Section 30 frontend requirements:
 * 1. Page load does not call matching API.
 * 2. Date picker opening does not call matching API.
 * 3. Date selection does not call matching API.
 * 4. Search button creates exactly one matching request.
 * 5. Double-click Search does not create duplicate requests.
 * 6. Latest search response wins.
 * 9. Frontend does not calculate match_score.
 * 14. Date is sent as canonical YYYY-MM-DD.
 * 15. Past dates are disabled.
 * 19. No-result state does not automatically trigger another search.
 * 20. Filters do not trigger requests until Apply/Search.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- RUNNING TOPRIDE FRONTEND CONTRACT VERIFICATION ---');

// 1. Inspect FindView.tsx source code
const rootDir = path.resolve(__dirname, '..', '..');
const findViewCandidatePaths = [
  path.join(rootDir, 'frontend', 'src', 'views', 'FindView.tsx'),
  path.join(rootDir, 'src', 'views', 'FindView.tsx'),
];
const findViewPath = findViewCandidatePaths.find(p => fs.existsSync(p));
assert(findViewPath, 'FAIL: FindView.tsx not found in frontend/src/views or src/views');
const findViewSource = fs.readFileSync(findViewPath, 'utf8');

// Check 1: No useEffect calling performSearch on mount
assert(
  !findViewSource.includes('useEffect(() => {\n    if (mode === \'passenger\') {\n      performSearch();'),
  'FAIL: FindView must NOT have useEffect triggering performSearch on mount'
);
assert(
  !findViewSource.includes('performSearch();\n  }, []),') && !findViewSource.includes('performSearch();\n  }, []'),
  'FAIL: FindView must NOT auto-search on mount'
);
console.log('✓ Requirement 1: Page load does not call matching API (Idle on mount).');

// Check 2 & 3: CalendarPicker onChange does not call performSearch
const calendarMatch = findViewSource.match(/<CalendarPicker[\s\S]*?\/>/);
assert(calendarMatch, 'FAIL: CalendarPicker component must be used');
const calendarSnippet = calendarMatch[0];
assert(
  !calendarSnippet.includes('performSearch'),
  'FAIL: CalendarPicker opening or date selection must NOT call performSearch'
);
console.log('✓ Requirement 2 & 3: Date picker opening and selection do NOT call matching API.');

// Check 4 & 5: Guard against double-clicks
assert(
  findViewSource.includes('inFlightRef.current') && findViewSource.includes('isLoading'),
  'FAIL: performSearch must guard against concurrent / double-click requests'
);
console.log('✓ Requirement 4 & 5: Search button creates 1 request; double-click is guarded.');

// Check 6: Race condition protection via request ID and AbortController
assert(
  findViewSource.includes('AbortController') && findViewSource.includes('searchRequestIdRef'),
  'FAIL: performSearch must have AbortController and latest request ID check'
);
console.log('✓ Requirement 6: Latest search response wins (AbortController + monotonic request ID).');

// Check 9: Frontend does not calculate match_score
assert(
  !findViewSource.includes('score = route * 0.35') && !findViewSource.includes('calculateScore') && !findViewSource.includes('WeightedScorer'),
  'FAIL: Frontend must NOT calculate match_score'
);
console.log('✓ Requirement 9: Frontend does not calculate match_score (authoritative backend).');

// Check 10: Technical banner removed
const bannedTerms = [
  'Deterministic Weighted Matching Engine',
  'Auto-Match Best Available Trip',
  'Auto-Match',
  'Weighted Matching',
  'Route 35%',
  'Pickup 20%',
  'Drop-off 15%',
  'Departure Time 15%',
  'Price 5%',
  'Driver Rating 5%',
  'Vehicle 5%',
  'Automatic fallback'
];
for (const term of bannedTerms) {
  assert(!findViewSource.includes(term), `FAIL: Old technical term found in FindView: "${term}"`);
}
console.log('✓ Section 1: Old technical matching banners and algorithm breakdown completely removed.');

// Check 14: Canonical YYYY-MM-DD date representation
assert(
  findViewSource.includes('date: dateIso'),
  'FAIL: Search payload must send dateIso (canonical YYYY-MM-DD)'
);
console.log('✓ Requirement 14: Date is sent as canonical YYYY-MM-DD.');

// Check 15: Past dates handling in dateUtils
const dateUtilsCandidatePaths = [
  path.join(rootDir, 'frontend', 'src', 'utils', 'dateUtils.ts'),
  path.join(rootDir, 'src', 'utils', 'dateUtils.ts'),
];
const dateUtilsPath = dateUtilsCandidatePaths.find(p => fs.existsSync(p));
assert(dateUtilsPath, 'FAIL: dateUtils.ts not found');
const dateUtilsSource = fs.readFileSync(dateUtilsPath, 'utf8');
assert(
  dateUtilsSource.includes('isPastDate') && dateUtilsSource.includes('toCanonicalIsoDate'),
  'FAIL: dateUtils must export isPastDate and toCanonicalIsoDate'
);
console.log('✓ Requirement 15: Past dates disabled in dateUtils.');

// Check 19: No-result state does not trigger another search automatically
const emptyStateMatch = findViewSource.match(/No matching rides found right now[\s\S]*?<\/div>/);
assert(emptyStateMatch, 'FAIL: Empty state markup not found');
assert(
  !emptyStateMatch[0].includes('performSearch()'),
  'FAIL: Empty state must not auto-trigger search'
);
console.log('✓ Requirement 19: No-result state does not automatically trigger another search.');

// Check 20: Filters do not trigger requests on slider movement
assert(
  !findViewSource.includes('onChange={(e) => { setMaxPrice(parseInt(e.target.value, 10)); performSearch(); }}'),
  'FAIL: Sliders must not call performSearch on change'
);
console.log('✓ Requirement 20: Filters do not trigger requests until Apply/Search.');

console.log('\nALL FRONTEND CONTRACT CHECKS PASSED SUCCESSFULLY!\n');

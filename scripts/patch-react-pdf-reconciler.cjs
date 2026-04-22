/**
 * Patches @react-pdf/reconciler to support React 18.3.x transitional elements.
 * 
 * React 18.3.x + turbopack produces elements with $$typeof = Symbol.for("react.transitional.element")
 * but @react-pdf/reconciler only handles Symbol.for("react.element") (stored as var `d`).
 * 
 * The reconciler uses switch(x.$$typeof){case d: ...} pattern.
 * We add a `case _rte_:` right after each `case d:` so both symbols are handled.
 *
 * Run: node scripts/patch-react-pdf-reconciler.cjs
 */
const fs = require('fs');
const path = require('path');

const RECONCILER_PATH = path.join(
  __dirname, '..', 'node_modules', '@react-pdf', 'reconciler', 'lib', 'reconciler-23.js'
);

if (!fs.existsSync(RECONCILER_PATH)) {
  console.log('[patch] reconciler-23.js not found, skipping');
  process.exit(0);
}

// First, restore from clean copy if we have one, or read current
let code = fs.readFileSync(RECONCILER_PATH, 'utf8');

// Remove any previous patch marker
const PATCH_MARKER = '/* PATCHED: react.transitional.element */';
if (code.startsWith(PATCH_MARKER)) {
  code = code.slice(PATCH_MARKER.length + 1); // +1 for newline
}

// Also undo any previous _rte_ variable that was incorrectly added
code = code.replace(
  ',_rte_=s?Symbol.for("react.transitional.element"):60104',
  ''
);
// Undo any previous broken $$typeof patches (parenthesization)  
code = code.replace(
  /\(\$1\.\$\$typeof===d\|\|\$1\.\$\$typeof===_rte_\)/g,
  '$1.$$typeof===d'
);

const VAR_DECL = 'd=s?Symbol.for("react.element"):60103';
if (!code.includes(VAR_DECL)) {
  console.error('[patch] Could not find expected variable declaration');
  process.exit(1);
}

// Step 1: Add the transitional symbol variable alongside d
code = code.replace(
  VAR_DECL,
  VAR_DECL + ',_rte_=s?Symbol.for("react.transitional.element"):60104'
);

// Step 2: Find all switch(x.$$typeof){case d: patterns and add case _rte_: after case d:
// The actual pattern in minified code: .$$typeof){case d:
// We add `case _rte_:` as a fall-through right after `case d:`
const switchCasePattern = /\.(\$\$typeof)\)\{case d:/g;
const replacedCount = (code.match(switchCasePattern) || []).length;
code = code.replace(switchCasePattern, '.$$typeof){case _rte_:case d:');

console.log(`[patch] Replaced ${replacedCount} switch-case checks`);

// Step 3: Also check for direct comparisons (e.$$typeof)===T or similar 
// Pattern #6 shows: if((e=e.$$typeof)===T) - this assigns $$typeof to a var
// Pattern #7 shows: switch(e.$$typeof){case b: - this is for provider/context, not element
// We need to make sure any ===d comparison also catches _rte_

// Find standalone comparisons like `===d` that could be element checks
// Actually, the switch cases are the main ones for element processing.
// Let's also check if there are any if-style comparisons
const ifPattern = /(\w+)\.(\$\$typeof)===d(?!\w)/g;
const ifMatches = code.match(ifPattern) || [];
console.log(`[patch] Found ${ifMatches.length} if-style $$typeof===d comparisons`);
if (ifMatches.length > 0) {
  code = code.replace(ifPattern, '($1.$$typeof===d||$1.$$typeof===_rte_)');
  console.log(`[patch] Patched ${ifMatches.length} if-style comparisons`);
}

// Also check for d===x.$$typeof (reversed order)
const reversedPattern = /d===(\w+)\.(\$\$typeof)/g;
const reversedMatches = code.match(reversedPattern) || [];
if (reversedMatches.length > 0) {
  code = code.replace(reversedPattern, '(d===$1.$$typeof||_rte_===$1.$$typeof)');
  console.log(`[patch] Patched ${reversedMatches.length} reversed comparisons`);
}

// Add patch marker
code = PATCH_MARKER + '\n' + code;

fs.writeFileSync(RECONCILER_PATH, code, 'utf8');
console.log('[patch] Successfully patched reconciler-23.js');

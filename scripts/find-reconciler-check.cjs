const fs = require('fs');
const code = fs.readFileSync('node_modules/@react-pdf/reconciler/lib/reconciler-23.js', 'utf8');

// Find all patterns related to $$typeof comparisons
// The minifier might use different patterns like:
// e.$$typeof === d
// d === e.$$typeof  
// e["$$typeof"] === d
// etc.

// Search for $$typeof near comparison operators
const patterns = [
  /\.\$\$typeof\s*={1,3}\s*\w/g,
  /\$\$typeof/g,
];

const pat = /\$\$typeof/g;
let m;
let count = 0;
while ((m = pat.exec(code)) !== null) {
  const start = Math.max(0, m.index - 40);
  const end = Math.min(code.length, m.index + 30);
  const context = code.slice(start, end);
  // Only show unique comparison contexts
  if (context.includes('===') || context.includes('!==')) {
    count++;
    if (count <= 20) {
      console.log(`\n#${count} at ${m.index}:`);
      console.log(context);
    }
  }
}
console.log(`\nTotal $$typeof comparison contexts: ${count}`);

const fs = require('fs');
const code = fs.readFileSync('main.js', 'utf8');
if (code.includes('last today') || code.includes('next today') || code.includes('last tomorrow') || code.includes('next tomorrow')) {
  console.error('Invalid phrases found');
  process.exit(1);
}
console.log('All tests passed');

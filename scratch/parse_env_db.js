const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env.local');
const content = fs.readFileSync(envPath, 'utf8');

console.log('--- env file contents ---');
console.log(content);
console.log('--- end ---');

const lines = content.split('\n');
console.log('Number of lines:', lines.length);
lines.forEach((line, idx) => {
  console.log(`Line ${idx + 1}: length=${line.length}, content=${JSON.stringify(line)}`);
});

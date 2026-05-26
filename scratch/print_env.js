const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env.local');
const buffer = fs.readFileSync(envPath);
console.log('Buffer length:', buffer.length);
console.log('First 100 bytes:', buffer.slice(0, 100));
console.log('First 100 chars as UTF-16LE:', buffer.toString('utf16le').slice(0, 100));

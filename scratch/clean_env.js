const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env.local');
const content = fs.readFileSync(envPath, 'utf8');

// Replace all null bytes with empty string
const cleaned = content.replace(/\u0000/g, '');

fs.writeFileSync(envPath, cleaned, 'utf8');
console.log('Cleaned env file successfully!');
console.log('New content length:', cleaned.length);

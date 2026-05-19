const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const env = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length) acc[key.trim()] = val.join('=').trim().replace(/^['"]|['"]$/g, '');
  return acc;
}, {});

const connectionString = env.SUPABASE_DB_URL || env.DATABASE_URL;

const client = new Client({
  connectionString: connectionString,
});

async function run() {
  await client.connect();
  const res = await client.query('SELECT * FROM catalogo_hitos ORDER BY orden');
  console.table(res.rows);
  await client.end();
}

run();

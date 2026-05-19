const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const env = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length) acc[key.trim()] = val.join('=').trim().replace(/^['"]|['"]$/g, '');
  return acc;
}, {});

const client = new Client({ connectionString: env.SUPABASE_DB_URL || env.DATABASE_URL });

async function run() {
  await client.connect();
  try {
    await client.query("ALTER TYPE tipo_documento ADD VALUE 'efirma_representante'");
    console.log("Added efirma_representante");
  } catch (e) {
    console.log("Ya existe o error:", e.message);
  }
  await client.end();
}
run();

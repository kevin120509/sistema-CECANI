const { Client } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

async function testConnection(connectionString, label) {
  console.log(`\nTesting: ${label}`);
  console.log(`Connection string prefix: ${connectionString.substring(0, 45)}...`);
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log(`SUCCESS connected to ${label}`);
    const res = await client.query('SELECT version();');
    console.log('Result:', res.rows[0]);
    await client.end();
    return true;
  } catch (err) {
    console.error(`FAILED connected to ${label}:`, err.message);
    try { await client.end(); } catch(e) {}
    return false;
  }
}

async function run() {
  let poolerUrl = process.env.DATABASE_URL;
  if (poolerUrl) {
    // Clean quotes and backslashes
    poolerUrl = poolerUrl.replace(/\\"/g, '"').replace(/"/g, '').trim();
  }
  console.log('Cleaned DATABASE_URL:', poolerUrl);

  const directUrl = "postgres://postgres:Antigravity2026!@aws-0-us-west-1.pooler.supabase.com:5432/postgres";

  await testConnection(poolerUrl, "Cleaned Env Database URL");
  await testConnection(directUrl, "Direct Pooler Host on Port 5432");
}

run();

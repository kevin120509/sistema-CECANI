const { Client } = require('pg');

async function test(connectionString, label) {
  console.log(`\nTesting: ${label}`);
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    console.log(`🎉 SUCCESS: Connected to ${label}`);
    const res = await client.query('SELECT version();');
    console.log('Result:', res.rows[0]);
    await client.end();
    return true;
  } catch (err) {
    console.log(`❌ Failed ${label}: ${err.message}`);
    try { await client.end(); } catch(e) {}
    return false;
  }
}

async function run() {
  const host = "aws-0-us-east-1.pooler.supabase.com";
  const projectRef = "cvbvzseaokobbyawkbzf";
  const password = "Antigravity2026!";

  await test(`postgres://postgres.${projectRef}:${password}@${host}:6543/postgres`, "US-EAST-1 Port 6543 (Transaction Mode)");
  await test(`postgres://postgres.${projectRef}:${password}@${host}:5432/postgres`, "US-EAST-1 Port 5432 (Session Mode)");
}

run();

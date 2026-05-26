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
  const host = "aws-0-us-west-1.pooler.supabase.com";
  const projectRef = "cvbvzseaokobbyawkbzf";
  const password = "Antigravity2026!";

  // 1. Port 6543 (Transaction)
  await test(`postgres://postgres.${projectRef}:${password}@${host}:6543/postgres`, "Port 6543 (Transaction Mode)");

  // 2. Port 5432 (Session Mode via Pooler Host)
  await test(`postgres://postgres.${projectRef}:${password}@${host}:5432/postgres`, "Port 5432 (Session Mode via Pooler Host)");

  // 3. Port 5432 Direct DB (IPv4/IPv6 fallback)
  await test(`postgres://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`, "Direct DB Host db.ref.supabase.co:5432");

  // 4. Port 6543 Direct DB
  await test(`postgres://postgres.${projectRef}:${password}@db.${projectRef}.supabase.co:6543/postgres`, "Direct DB Host with projectRef username on Port 6543");
}

run();

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const connectionString = process.env.DATABASE_URL || "postgres://postgres:Antigravity2026!@aws-0-us-west-1.pooler.supabase.com:5432/postgres";
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'datos_concentrado' 
      AND table_schema = 'public';
    `);
    console.log('Columns in datos_concentrado:', res.rows.map(r => r.column_name));
    await client.end();
  } catch (err) {
    console.error('Error:', err.message);
    try { await client.end(); } catch(e) {}
  }
}
run();

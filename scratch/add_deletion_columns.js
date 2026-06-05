const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const connectionString = process.env.DATABASE_URL || "postgres://postgres:Antigravity2026!@aws-0-us-west-1.pooler.supabase.com:5432/postgres";
  if (!connectionString) {
    console.error('DATABASE_URL not found');
    return;
  }

  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to database');
    
    await client.query(`
      ALTER TABLE documentos 
      ADD COLUMN IF NOT EXISTS solicitud_borrado BOOLEAN DEFAULT FALSE, 
      ADD COLUMN IF NOT EXISTS motivo_borrado TEXT;
    `);
    
    console.log('Columns added successfully');
    await client.end();
  } catch (err) {
    console.error('Error adding columns:', err.message);
    try { await client.end(); } catch(e) {}
  }
}

run();

const { Client } = require('pg');

const dbUrl = "postgres://postgres:Antigravity2026!@db.cvbvzseaokobbyawkbzf.supabase.co:5432/postgres";

console.log('Connecting to Supabase direct host...');

const client = new Client({
  connectionString: dbUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

async function main() {
  await client.connect();
  try {
    console.log('Running migration: ADD COLUMN integrante_id TO documentos...');
    
    const query = `
      ALTER TABLE public.documentos 
      ADD COLUMN IF NOT EXISTS integrante_id UUID REFERENCES public.expediente_integrantes(id) ON DELETE CASCADE;
    `;
    
    await client.query(query);
    console.log('Migration successful: integrante_id column added to documentos.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

main();

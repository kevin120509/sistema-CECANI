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

async function runMigration() {
  const sql = `
    -- Add objeto_social_ventas to datos_concentrado
    ALTER TABLE datos_concentrado ADD COLUMN IF NOT EXISTS objeto_social_ventas TEXT;
  `;

  try {
    await client.connect();
    await client.query(sql);
    console.log('Migración de objeto_social_ventas completada.');
  } catch (err) {
    console.error('Error en migración:', err);
  } finally {
    await client.end();
  }
}

runMigration();

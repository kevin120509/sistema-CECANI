const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const env = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length) acc[key.trim()] = val.join('=').trim().replace(/^['"]|['"]$/g, '');
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function runMigration() {
  console.log('Actualizando enum tipo_documento...');
  const { error } = await supabase.rpc('execute_sql', { sql_query: "ALTER TYPE tipo_documento ADD VALUE IF NOT EXISTS 'efirma_representante';" });
  if (error) console.error('Error (puede ignorarse si no existe el RPC, lo haremos manualmente):', error);
}

runMigration();

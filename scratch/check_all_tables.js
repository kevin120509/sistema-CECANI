const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = envContent.split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length) {
    acc[key.trim()] = val.join('=').trim().replace(/^['"]|['"]$/g, '');
  }
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const tables = ['expedientes', 'perfiles', 'contratos', 'documentos', 'seguimiento_tareas', 'pagos', 'expediente_integrantes', 'bitacora', 'expediente_asesoras'];
  
  for (const table of tables) {
    const { error } = await supabase.from(table).select('*').limit(1);
    console.log(`Table ${table}:`, error ? `ERROR: ${error.message}` : 'OK');
  }
}

check();

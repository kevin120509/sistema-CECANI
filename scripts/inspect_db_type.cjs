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

async function inspect() {
  const { data, error } = await supabase.rpc('get_column_type', { t_name: 'documentos', c_name: 'tipo' });
  if (error) {
     // If RPC doesn't exist, try a simple query to information_schema if possible via another RPC or just guess.
     console.log("No se pudo usar RPC get_column_type");
  } else {
     console.log("Tipo de columna:", data);
  }
}

// Since I can't easily run arbitrary SQL to inspect, I'll try to use the execute_sql if it exists or just provide a more comprehensive SQL to the user.
inspect();

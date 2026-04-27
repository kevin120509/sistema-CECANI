const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const env = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length) acc[key.trim()] = val.join('=').trim().replace(/^['"]|['"]$/g, '');
  return acc;
}, {});

const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data: hitos } = await supabaseAdmin.from('catalogo_hitos').select('*').limit(1);
  const { data: tareas } = await supabaseAdmin.from('seguimiento_tareas').select('*').limit(1);
  console.log('Hitos:', JSON.stringify(hitos, null, 2));
  console.log('Tareas:', JSON.stringify(tareas, null, 2));
})();

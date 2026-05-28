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
  const { data: tables, error } = await supabase.rpc('get_tables'); 
  // Probably no get_tables RPC. Let's try a raw query if possible or just try to select from information_schema
  
  const { data: exp_asesoras, error: err1 } = await supabase.from('expediente_asesoras').select('*').limit(1);
  if (err1) console.error('Error selecting from expediente_asesoras:', err1.message);
  else console.log('expediente_asesoras exists.');

  const { data: exp, error: err2 } = await supabase.from('expedientes').select('*');
  console.log('Total Expedientes:', exp?.length);
  console.log('Expedientes with asesora_id:', exp?.filter(e => e.asesora_id)?.length);
}

check();

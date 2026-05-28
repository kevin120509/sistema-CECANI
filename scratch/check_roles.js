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
  const { data: roles } = await supabase.from('perfiles').select('rol');
  console.log('Unique Roles:', [...new Set(roles.map(r => r.rol))]);
  
  const { data: assignments } = await supabase.from('expediente_asesoras').select('asesora_id, expediente_id');
  console.log('Assignments in expediente_asesoras:', assignments?.length);
  
  const { data: legacy } = await supabase.from('expedientes').select('id, asesora_id').not('asesora_id', 'is', null);
  console.log('Assignments in expedientes (legacy):', legacy?.length);
}

check();
